import crypto from "crypto";
import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";

import { ensureAdmin } from "../admin/authz";
import { bucketObjectExists, resolveObjectKeyUrlForClient, resolveObjectUrlForClient, uploadBufferToBucket, uploadBufferToBucketKey } from "../helpers/bucket-storage";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL_ID = "eleven_v3";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_192";
const ELEVENLABS_MAX_TEXT_LENGTH = 5000;
const ELEVENLABS_TARGET_CHUNK_LENGTH = 4800;
const DEFAULT_INLINE_AUDIO_MAX_BYTES = 1_500_000;
const DEFAULT_DIALOGUE_CHUNK_CONCURRENCY = 3;

interface GenerateElevenLabsDialogueRequest {
  script: string;
  speakerVoiceMap: Record<string, string>;
  modelId?: string;
  outputFormat?: string;
}

interface GenerateElevenLabsDialogueResponse {
  variants: Array<{
    id: string;
    audioData?: string;
    audioUrl?: string;
    mimeType: string;
  }>;
  turns: number;
  speakers: string[];
  /**
   * "ready" when variants carry audio, "pending" when the synthesis is still
   * running in the background (long dialogues exceed the Railway edge's ~60s
   * request budget → 502). On "pending" the client polls the same endpoint
   * with the identical payload; the in-flight job keeps running server-side
   * and lands in the bucket cache, so a follow-up call returns "ready".
   */
  status: "ready" | "pending";
}

// Server-side budget for the synchronous wait. Kept safely under the Railway
// edge proxy's ~60s cutoff so we return a structured "pending" instead of a
// 502 the browser reports as an opaque CORS failure.
const DIALOGUE_SYNC_WAIT_BUDGET_MS = 45_000;

type DialogueAudioVariant = GenerateElevenLabsDialogueResponse['variants'][number];

interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  labels?: Record<string, string>;
  description?: string;
  previewUrl?: string;
}

interface ListElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[];
}

type DialogueTurn = {
  speaker: string;
  text: string;
};

type ElevenLabsDialogueInput = {
  text: string;
  voice_id: string;
};

const normalizeSpeaker = (value: string): string => value.replace(/\s+/g, " ").trim();

const getElevenLabsApiKey = (): string => {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    throw APIError.failedPrecondition("ELEVENLABS_API_KEY is not configured on the backend.");
  }
  return key;
};

const parseDialogueScript = (script: string): DialogueTurn[] => {
  const normalizedScript = script.replace(/\r\n/g, "\n").trim();
  if (!normalizedScript) {
    throw APIError.invalidArgument("Script is required.");
  }

  const lines = normalizedScript.split("\n");
  const turns: DialogueTurn[] = [];

  let currentSpeaker = "";
  let currentLines: string[] = [];

  const pushCurrentTurn = () => {
    if (!currentSpeaker) return;
    const text = currentLines.join("\n").trim();
    if (text) {
      turns.push({ speaker: currentSpeaker, text });
    }
    currentSpeaker = "";
    currentLines = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const speakerMatch = line.match(/^\s*([^:\n]{1,80}):\s*(.*)$/);

    if (speakerMatch) {
      pushCurrentTurn();
      currentSpeaker = normalizeSpeaker(speakerMatch[1]);
      currentLines = [speakerMatch[2].trim()];
      return;
    }

    if (!line.trim()) {
      if (currentLines.length > 0) currentLines.push("");
      return;
    }

    if (!currentSpeaker) {
      throw APIError.invalidArgument(
        `Invalid script format on line ${index + 1}. Each dialogue block must start with "SPEAKER: text".`
      );
    }

    currentLines.push(line.trim());
  });

  pushCurrentTurn();

  if (turns.length === 0) {
    throw APIError.invalidArgument(
      "No dialogue turns found. Use the format \"SPEAKER: text\" for each block."
    );
  }

  return turns;
};

const resolveVoiceId = (speaker: string, speakerVoiceMap: Record<string, string>): string | undefined => {
  const direct = speakerVoiceMap[speaker]?.trim();
  if (direct) return direct;

  const normalized = speaker.toLowerCase();
  for (const [candidateSpeaker, candidateVoiceId] of Object.entries(speakerVoiceMap)) {
    if (candidateSpeaker.trim().toLowerCase() !== normalized) continue;
    const voiceId = candidateVoiceId?.trim();
    if (voiceId) return voiceId;
  }

  return undefined;
};

const getDialogueTextLength = (inputs: ElevenLabsDialogueInput[]): number =>
  inputs.reduce((sum, input) => sum + input.text.length, 0);

type DialogueMetadata = {
  turns: number;
  speakers: string[];
};

const getDialogueMetadata = (
  script: string,
  speakerVoiceMap: Record<string, string>,
): DialogueMetadata => {
  if (!speakerVoiceMap || Object.keys(speakerVoiceMap).length === 0) {
    throw APIError.invalidArgument("speakerVoiceMap is required.");
  }

  const turns = parseDialogueScript(script);
  const missingSpeakers = new Set<string>();
  for (const turn of turns) {
    if (!resolveVoiceId(turn.speaker, speakerVoiceMap)) {
      missingSpeakers.add(turn.speaker);
    }
  }

  if (missingSpeakers.size > 0) {
    throw APIError.invalidArgument(`Missing voice IDs for speaker(s): ${[...missingSpeakers].join(", ")}`);
  }

  return {
    turns: turns.length,
    speakers: [...new Set(turns.map((turn) => turn.speaker))],
  };
};

const sortRecord = (record: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(record)
      .map(([key, value]) => [key.trim().toLowerCase(), value.trim()] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

const outputExtensionFromFormat = (outputFormat: string): string => {
  const normalized = outputFormat.toLowerCase();
  if (normalized.startsWith("pcm_")) return "pcm";
  if (normalized.includes("wav")) return "wav";
  return "mp3";
};

const mimeTypeFromOutputFormat = (outputFormat: string): string => {
  const normalized = outputFormat.toLowerCase();
  if (normalized.startsWith("pcm_")) return "audio/pcm";
  if (normalized.includes("wav")) return "audio/wav";
  return "audio/mpeg";
};

const buildDialogueCacheKey = (options: {
  script: string;
  speakerVoiceMap: Record<string, string>;
  modelId: string;
  outputFormat: string;
}): string => {
  const hash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        version: 1,
        script: options.script.replace(/\r\n/g, "\n").trim(),
        speakerVoiceMap: sortRecord(options.speakerVoiceMap),
        modelId: options.modelId,
        outputFormat: options.outputFormat,
      }),
    )
    .digest("hex");

  return `audio/generated/elevenlabs-dialogue-${hash}.${outputExtensionFromFormat(options.outputFormat)}`;
};

const readPositiveIntEnv = (name: string, fallback: number): number => {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getInlineAudioMaxBytes = (): number =>
  readPositiveIntEnv("ELEVENLABS_INLINE_AUDIO_MAX_BYTES", DEFAULT_INLINE_AUDIO_MAX_BYTES);

const getDialogueChunkConcurrency = (): number =>
  Math.max(
    1,
    Math.min(
      5,
      readPositiveIntEnv("ELEVENLABS_DIALOGUE_CHUNK_CONCURRENCY", DEFAULT_DIALOGUE_CHUNK_CONCURRENCY),
    ),
  );

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    }),
  );

  return results;
}

const findLastPatternIndex = (text: string, pattern: RegExp): number => {
  let lastIndex = -1;
  for (const match of text.matchAll(pattern)) {
    lastIndex = typeof match.index === "number" ? match.index + match[0].length : lastIndex;
  }
  return lastIndex;
};

const findPreferredSplitIndex = (text: string, maxLength: number): number => {
  const window = text.slice(0, maxLength + 1);
  const minPreferredIndex = Math.floor(maxLength * 0.6);
  const preferredPatterns = [/\n\n+/g, /\n/g, /[.!?]\s+/g, /[,;:]\s+/g];

  for (const pattern of preferredPatterns) {
    const index = findLastPatternIndex(window, pattern);
    if (index >= minPreferredIndex) {
      return index;
    }
  }

  const whitespaceIndex = findLastPatternIndex(window, /\s+/g);
  if (whitespaceIndex > 0) {
    return whitespaceIndex;
  }

  return maxLength;
};

const splitTextForElevenLabs = (text: string, maxLength: number): string[] => {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const chunks: string[] = [];
  let remaining = normalized;

  while (remaining.length > maxLength) {
    const splitIndex = findPreferredSplitIndex(remaining, maxLength);
    const chunk = remaining.slice(0, splitIndex).trim();
    const safeChunk = chunk || remaining.slice(0, maxLength).trim();
    if (!safeChunk) {
      break;
    }

    chunks.push(safeChunk);
    remaining = remaining.slice(safeChunk.length).trimStart();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
};

const chunkDialogueInputsForElevenLabs = (
  inputs: ElevenLabsDialogueInput[],
  maxLength: number
): ElevenLabsDialogueInput[][] => {
  const expandedInputs = inputs.flatMap((input) =>
    splitTextForElevenLabs(input.text, maxLength).map((text) => ({
      text,
      voice_id: input.voice_id,
    }))
  );

  const batches: ElevenLabsDialogueInput[][] = [];
  let currentBatch: ElevenLabsDialogueInput[] = [];
  let currentLength = 0;

  const flushBatch = () => {
    if (currentBatch.length === 0) return;
    batches.push(currentBatch);
    currentBatch = [];
    currentLength = 0;
  };

  for (const input of expandedInputs) {
    if (input.text.length > maxLength) {
      throw APIError.invalidArgument(
        `A dialogue block still exceeds the ElevenLabs limit of ${ELEVENLABS_MAX_TEXT_LENGTH} characters after splitting.`
      );
    }

    if (currentLength > 0 && currentLength + input.text.length > maxLength) {
      flushBatch();
    }

    currentBatch.push(input);
    currentLength += input.text.length;
  }

  flushBatch();
  return batches;
};

const extractElevenLabsErrorMessage = (errText: string): string => {
  const fallback = errText.trim();

  try {
    const payload = JSON.parse(errText) as {
      detail?:
        | string
        | {
            message?: string;
            code?: string;
            status?: string;
            param?: string;
          };
      message?: string;
      error?: {
        message?: string;
      };
    };

    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail.trim();
    }

    if (
      typeof payload.detail === "object" &&
      payload.detail !== null &&
      typeof payload.detail.message === "string" &&
      payload.detail.message.trim()
    ) {
      return payload.detail.message.trim();
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }

    if (typeof payload.error?.message === "string" && payload.error.message.trim()) {
      return payload.error.message.trim();
    }
  } catch {
    // Fall back to the raw response body.
  }

  return fallback || "Unknown ElevenLabs error.";
};

const throwElevenLabsApiError = (status: number, errText: string): never => {
  const message = extractElevenLabsErrorMessage(errText);

  if (status === 400) {
    throw APIError.invalidArgument(`ElevenLabs rejected the dialogue request: ${message}`);
  }

  if (status === 401 || status === 403) {
    throw APIError.failedPrecondition(`ElevenLabs authentication failed: ${message}`);
  }

  throw APIError.unavailable(`ElevenLabs dialogue generation failed: ${message}`);
};

function concatenateAudioBuffers(buffers: Buffer[], mimeType: string): Buffer {
  if (buffers.length <= 1) return buffers[0] || Buffer.alloc(0);

  const isWav = mimeType.includes("wav") || mimeType.includes("wave");
  if (!isWav) {
    return Buffer.concat(buffers);
  }

  const WAV_HEADER_SIZE = 44;
  const chunks: Buffer[] = [];

  for (let i = 0; i < buffers.length; i += 1) {
    const buffer = buffers[i];
    if (i === 0) {
      chunks.push(buffer);
    } else if (buffer.length > WAV_HEADER_SIZE && isWavHeader(buffer)) {
      chunks.push(buffer.subarray(WAV_HEADER_SIZE));
    } else {
      chunks.push(buffer);
    }
  }

  const combined = Buffer.concat(chunks);
  if (combined.length >= WAV_HEADER_SIZE && isWavHeader(combined)) {
    combined.writeUInt32LE(combined.length - 8, 4);
    combined.writeUInt32LE(combined.length - WAV_HEADER_SIZE, 40);
  }

  return combined;
}

function isWavHeader(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  return (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x41 &&
    buf[10] === 0x56 &&
    buf[11] === 0x45
  );
}

export const listElevenLabsVoices = api(
  { expose: true, method: "GET", path: "/tts/elevenlabs/voices", auth: true },
  async (): Promise<ListElevenLabsVoicesResponse> => {
    ensureAdmin();
    const apiKey = getElevenLabsApiKey();

    const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      log.error(`[ElevenLabs] list voices failed (${response.status}): ${errText}`);
      throw APIError.unavailable("Failed to fetch ElevenLabs voices.");
    }

    const payload = (await response.json()) as {
      voices?: Array<{
        voice_id?: string;
        name?: string;
        labels?: Record<string, string>;
        description?: string;
        preview_url?: string;
      }>;
    };

    const voices: ElevenLabsVoice[] = (payload.voices ?? [])
      .filter((voice) => Boolean(voice.voice_id) && Boolean(voice.name))
      .map((voice) => ({
        voiceId: voice.voice_id!,
        name: voice.name!,
        labels: voice.labels ?? undefined,
        description: voice.description ?? undefined,
        previewUrl: voice.preview_url ?? undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { voices };
  }
);

export interface SynthesizeDialogueOptions {
  script: string;
  speakerVoiceMap: Record<string, string>;
  modelId?: string;
  /**
   * ElevenLabs output_format. Defaults to studio MP3. For server-side mastering pass a
   * lossless raw PCM format (e.g. "pcm_44100") to avoid any MP3 transcoding before the mix.
   */
  outputFormat?: string;
}

export interface SynthesizeDialogueResult {
  /** Raw audio bytes. For pcm_* formats this is headerless signed 16-bit little-endian PCM. */
  audio: Buffer;
  mimeType: string;
  turns: number;
  speakers: string[];
}

/**
 * Core ElevenLabs text-to-dialogue synthesis used by both the public dialogue endpoint and
 * the server-side audio-doku master. Performs no auth — the caller is responsible for it.
 */
export async function synthesizeDialogue(
  options: SynthesizeDialogueOptions
): Promise<SynthesizeDialogueResult> {
  const apiKey = getElevenLabsApiKey();

  if (!options.speakerVoiceMap || Object.keys(options.speakerVoiceMap).length === 0) {
    throw APIError.invalidArgument("speakerVoiceMap is required.");
  }

  const turns = parseDialogueScript(options.script);
  const missingSpeakers = new Set<string>();

  const inputs: ElevenLabsDialogueInput[] = turns.map((turn) => {
    const voiceId = resolveVoiceId(turn.speaker, options.speakerVoiceMap);
    if (!voiceId) {
      missingSpeakers.add(turn.speaker);
    }
    return {
      text: turn.text,
      voice_id: voiceId || "",
    };
  });

  if (missingSpeakers.size > 0) {
    const speakers = [...missingSpeakers].join(", ");
    throw APIError.invalidArgument(`Missing voice IDs for speaker(s): ${speakers}`);
  }

  const modelId = options.modelId?.trim() || DEFAULT_MODEL_ID;
  const outputFormat = options.outputFormat?.trim() || DEFAULT_OUTPUT_FORMAT;
  const isPcm = outputFormat.startsWith("pcm_");
  const totalTextLength = getDialogueTextLength(inputs);
  const inputBatches = chunkDialogueInputsForElevenLabs(inputs, ELEVENLABS_TARGET_CHUNK_LENGTH);

  if (inputBatches.length > 1) {
    log.info(
      `[ElevenLabs] Splitting dialogue request into ${inputBatches.length} chunk(s) (${totalTextLength} chars total).`
    );
  }

  const generateBatch = async (batchedInputs: ElevenLabsDialogueInput[], chunkNumber: number) => {
    let response: Response;
    try {
      response = await fetch(`${ELEVENLABS_API_BASE}/text-to-dialogue`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: isPcm ? "application/octet-stream" : "audio/mpeg",
        },
        body: JSON.stringify({
          model_id: modelId,
          output_format: outputFormat,
          inputs: batchedInputs,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`[ElevenLabs] dialogue request failed before response (chunk ${chunkNumber}): ${message}`);
      throw APIError.unavailable("ElevenLabs dialogue generation failed before a response was received.");
    }

    if (!response.ok) {
      const errText = await response.text();
      log.error(`[ElevenLabs] dialogue generation failed (${response.status}, chunk ${chunkNumber}): ${errText}`);
      throwElevenLabsApiError(response.status, errText);
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    if (!bytes.length) {
      throw APIError.unavailable("ElevenLabs returned an empty audio response.");
    }

    return {
      bytes,
      mimeType: (response.headers.get("content-type") || (isPcm ? "audio/pcm" : "audio/mpeg"))
        .split(";")[0]
        .trim(),
    };
  };

  const chunkConcurrency = getDialogueChunkConcurrency();
  if (inputBatches.length > 1) {
    log.info(
      `[ElevenLabs] Generating ${inputBatches.length} dialogue chunk(s) with concurrency=${Math.min(
        chunkConcurrency,
        inputBatches.length,
      )}.`,
    );
  }

  const batchResults = await mapWithConcurrency(inputBatches, chunkConcurrency, (batch, index) =>
    generateBatch(batch, index + 1),
  );

  const audioParts: Buffer[] = [];
  let detectedMimeType = "";

  for (const result of batchResults) {
    audioParts.push(result.bytes);
    if (!detectedMimeType) {
      detectedMimeType = result.mimeType || (isPcm ? "audio/pcm" : "audio/mpeg");
    } else if (result.mimeType && result.mimeType !== detectedMimeType) {
      log.warn(
        `[ElevenLabs] Mixed mime types across dialogue chunks: ${detectedMimeType} vs ${result.mimeType}.`,
      );
    } else {
      detectedMimeType = result.mimeType || detectedMimeType;
    }
  }

  // Raw PCM is headerless, so chunks concatenate directly. WAV needs header stitching.
  const combinedAudio = isPcm
    ? Buffer.concat(audioParts)
    : concatenateAudioBuffers(audioParts, detectedMimeType);
  if (!combinedAudio.length) {
    throw APIError.unavailable("ElevenLabs returned no audio data.");
  }

  return {
    audio: combinedAudio,
    mimeType: detectedMimeType,
    turns: turns.length,
    speakers: [...new Set(turns.map((turn) => turn.speaker))],
  };
}

const buildDialogueAudioVariant = async (
  result: SynthesizeDialogueResult,
  cacheKey?: string,
): Promise<DialogueAudioVariant> => {
  const inlineMaxBytes = getInlineAudioMaxBytes();
  if (result.audio.length <= inlineMaxBytes) {
    return {
      id: "variant-1",
      audioData: `data:${result.mimeType};base64,${result.audio.toString("base64")}`,
      mimeType: result.mimeType,
    };
  }

  const uploaded = cacheKey
    ? await uploadBufferToBucketKey(result.audio, result.mimeType, cacheKey)
    : await uploadBufferToBucket(result.audio, result.mimeType, {
        prefix: "audio/generated",
        filenameHint: "elevenlabs-dialogue",
      });

  if (!uploaded) {
    log.error(
      `[ElevenLabs] dialogue audio is ${result.audio.length} bytes, above inline limit ${inlineMaxBytes}, but bucket upload is unavailable.`,
    );
    throw APIError.failedPrecondition(
      "Generated dialogue audio is too large to return inline and bucket upload is not available.",
    );
  }

  const audioUrl = await resolveObjectUrlForClient(uploaded.url);
  if (!audioUrl || audioUrl.startsWith("bucket://")) {
    log.error(`[ElevenLabs] dialogue audio uploaded to ${uploaded.key}, but no browser URL could be resolved.`);
    throw APIError.failedPrecondition("Generated dialogue audio could not be exposed to the browser.");
  }

  log.info(
    `[ElevenLabs] Uploaded dialogue audio (${result.audio.length} bytes) to ${uploaded.key}; returning URL instead of inline base64.`,
  );

  return {
    id: "variant-1",
    audioUrl,
    mimeType: result.mimeType,
  };
};

const buildCachedDialogueAudioVariant = async (
  cacheKey: string,
  mimeType: string,
): Promise<DialogueAudioVariant | null> => {
  if (!(await bucketObjectExists(cacheKey))) {
    return null;
  }

  const audioUrl = await resolveObjectKeyUrlForClient(cacheKey);
  if (!audioUrl || audioUrl.startsWith("bucket://")) {
    return null;
  }

  log.info(`[ElevenLabs] Reusing cached dialogue audio from ${cacheKey}.`);
  return {
    id: "variant-1",
    audioUrl,
    mimeType,
  };
};

const inFlightDialogueAudioJobs = new Map<string, Promise<DialogueAudioVariant>>();

const getOrStartDialogueAudioJob = (
  cacheKey: string,
  createResult: () => Promise<SynthesizeDialogueResult>,
): Promise<DialogueAudioVariant> => {
  const existingJob = inFlightDialogueAudioJobs.get(cacheKey);
  if (existingJob) {
    return existingJob;
  }

  const job = (async () => {
    const result = await createResult();
    return buildDialogueAudioVariant(result, cacheKey);
  })();

  inFlightDialogueAudioJobs.set(cacheKey, job);
  const cleanup = () => {
    if (inFlightDialogueAudioJobs.get(cacheKey) === job) {
      inFlightDialogueAudioJobs.delete(cacheKey);
    }
  };
  job.then(cleanup, cleanup);

  return job;
};

export interface DialogueWord {
  word: string;
  /** Global start time in seconds across the whole concatenated dialogue. */
  start: number;
  end: number;
  speaker: string;
}

export interface DialogueTurnSpan {
  /** 1-based turn index (≈ script line). */
  index: number;
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface TimedDialogueSegment {
  /** 1-based turn index (≈ script line). */
  index: number;
  speaker: string;
  text: string;
  /** MP3 audio for this single turn (mp3_44100_128, one voice). */
  audio: Buffer;
  /** Word timings relative to THIS segment's own audio start. */
  words: DialogueWord[];
  /**
   * Spoken duration per the ElevenLabs alignment (last character end time).
   * 0 when the response carried no alignment — callers should then measure the
   * decoded audio themselves (e.g. via ffprobe).
   */
  alignmentDurationSec: number;
}

export interface SynthesizeDialogueTimedResult {
  /**
   * One segment per dialogue turn. Deliberately NOT pre-concatenated: MP3 frames are
   * padded to a 26 ms grid, so byte-concatenation would accumulate timing drift across
   * turns. The renderer measures each segment's real decoded duration and concatenates
   * in the decoded domain (sample-accurate word anchors).
   */
  segments: TimedDialogueSegment[];
  turns: number;
  speakers: string[];
}

type ElevenLabsAlignment = {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
};

/**
 * Reconstructs words from ElevenLabs character-level alignment, skipping audio-tag
 * spans like "[excited]" (the bracket content is a v3 directive, not spoken text).
 */
const buildWordsFromAlignment = (
  alignment: ElevenLabsAlignment,
  offsetSec: number,
  speaker: string,
): DialogueWord[] => {
  const chars = alignment.characters ?? [];
  const starts = alignment.character_start_times_seconds ?? [];
  const ends = alignment.character_end_times_seconds ?? [];
  if (chars.length === 0) return [];

  const words: DialogueWord[] = [];
  let cur = "";
  let curStart = -1;
  let curEnd = -1;
  let depth = 0;

  const flush = () => {
    if (cur && curStart >= 0) {
      words.push({ word: cur, start: curStart + offsetSec, end: curEnd + offsetSec, speaker });
    }
    cur = "";
    curStart = -1;
    curEnd = -1;
  };

  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i];
    if (c === "[") {
      flush();
      depth += 1;
      continue;
    }
    if (c === "]") {
      if (depth > 0) depth -= 1;
      continue;
    }
    if (depth > 0) continue;
    if (/\s/.test(c)) {
      flush();
      continue;
    }
    if (curStart < 0) curStart = Number.isFinite(starts[i]) ? starts[i] : curStart;
    if (Number.isFinite(ends[i])) curEnd = ends[i];
    cur += c;
  }
  flush();

  return words
    .map((w) => ({ ...w, word: w.word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") }))
    .filter((w) => w.word.length > 0 && Number.isFinite(w.start) && Number.isFinite(w.end));
};

/**
 * Renders the dialogue turn-by-turn via ElevenLabs text-to-speech "with-timestamps", so we
 * get a precise word timeline per turn (the basis for word-anchored sound design). Audio is
 * requested as mp3_44100_128 — raw PCM output formats require the ElevenLabs Pro tier and
 * would 403 on lower tiers. No auth — the caller is responsible for it.
 */
export async function synthesizeDialogueWithTimestamps(options: {
  script: string;
  speakerVoiceMap: Record<string, string>;
  modelId?: string;
}): Promise<SynthesizeDialogueTimedResult> {
  const apiKey = getElevenLabsApiKey();
  if (!options.speakerVoiceMap || Object.keys(options.speakerVoiceMap).length === 0) {
    throw APIError.invalidArgument("speakerVoiceMap is required.");
  }

  const turns = parseDialogueScript(options.script);
  const missingSpeakers = new Set<string>();
  for (const turn of turns) {
    if (!resolveVoiceId(turn.speaker, options.speakerVoiceMap)) missingSpeakers.add(turn.speaker);
  }
  if (missingSpeakers.size > 0) {
    throw APIError.invalidArgument(`Missing voice IDs for speaker(s): ${[...missingSpeakers].join(", ")}`);
  }

  const modelId = options.modelId?.trim() || DEFAULT_MODEL_ID;
  const segments: TimedDialogueSegment[] = [];

  for (let t = 0; t < turns.length; t += 1) {
    const turn = turns[t];
    const voiceId = resolveVoiceId(turn.speaker, options.speakerVoiceMap)!;
    let response: Response;
    try {
      response = await fetch(
        `${ELEVENLABS_API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ text: turn.text, model_id: modelId }),
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`[ElevenLabs] with-timestamps request failed before response: ${message}`);
      throw APIError.unavailable("ElevenLabs timed synthesis failed before a response was received.");
    }

    if (!response.ok) {
      const errText = await response.text();
      log.error(`[ElevenLabs] with-timestamps failed (${response.status}): ${errText}`);
      throwElevenLabsApiError(response.status, errText);
    }

    const payload = (await response.json()) as {
      audio_base64?: string;
      alignment?: ElevenLabsAlignment;
      normalized_alignment?: ElevenLabsAlignment;
    };
    const audioBase64 = payload.audio_base64;
    if (!audioBase64) {
      throw APIError.unavailable("ElevenLabs with-timestamps returned no audio.");
    }

    const alignment = payload.alignment ?? payload.normalized_alignment;
    if (!alignment) {
      log.warn(`[ElevenLabs] with-timestamps returned no alignment for turn ${t + 1}; word anchors unavailable for it.`);
    }
    const endTimes = alignment?.character_end_times_seconds ?? [];
    const alignmentDurationSec = endTimes.length > 0 ? Math.max(...endTimes) : 0;

    segments.push({
      index: t + 1,
      speaker: turn.speaker,
      text: turn.text,
      audio: Buffer.from(audioBase64, "base64"),
      // Offset 0: word times stay relative to this segment; the renderer shifts them by
      // each segment's real decoded start once measured.
      words: alignment ? buildWordsFromAlignment(alignment, 0, turn.speaker) : [],
      alignmentDurationSec,
    });
  }

  if (segments.length === 0 || segments.every((s) => s.audio.length === 0)) {
    throw APIError.unavailable("ElevenLabs returned no audio data.");
  }

  return {
    segments,
    turns: turns.length,
    speakers: [...new Set(turns.map((t) => t.speaker))],
  };
}

export const generateElevenLabsDialogue = api<GenerateElevenLabsDialogueRequest, GenerateElevenLabsDialogueResponse>(
  { expose: true, method: "POST", path: "/tts/elevenlabs/dialogue", auth: true },
  async (req) => {
    ensureAdmin();

    const modelId = req.modelId?.trim() || DEFAULT_MODEL_ID;
    const outputFormat = req.outputFormat?.trim() || DEFAULT_OUTPUT_FORMAT;
    const metadata = getDialogueMetadata(req.script, req.speakerVoiceMap);
    const cacheKey = buildDialogueCacheKey({
      script: req.script,
      speakerVoiceMap: req.speakerVoiceMap,
      modelId,
      outputFormat,
    });

    const cachedVariant = await buildCachedDialogueAudioVariant(
      cacheKey,
      mimeTypeFromOutputFormat(outputFormat),
    );
    if (cachedVariant) {
      return {
        variants: [cachedVariant],
        turns: metadata.turns,
        speakers: metadata.speakers,
        status: "ready",
      };
    }

    // The job runs in the background and keeps running even if THIS request
    // returns "pending" — it lands in the bucket cache for the next poll.
    const job = getOrStartDialogueAudioJob(cacheKey, () =>
      synthesizeDialogue({
        script: req.script,
        speakerVoiceMap: req.speakerVoiceMap,
        modelId,
        outputFormat,
      }),
    );

    // Race the synthesis against the sync-wait budget. A long dialogue that
    // would otherwise blow the edge timeout resolves to a structured
    // "pending" the client can poll on, instead of a 502/CORS error.
    const pendingSentinel = Symbol("dialogue-pending");
    const raced = await Promise.race([
      job,
      new Promise<typeof pendingSentinel>((resolve) =>
        setTimeout(() => resolve(pendingSentinel), DIALOGUE_SYNC_WAIT_BUDGET_MS),
      ),
    ]);

    if (raced === pendingSentinel) {
      // Swallow late rejection so an unhandled promise rejection cannot crash
      // the worker; the next poll re-invokes synthesizeDialogue on a miss.
      job.catch((err) => {
        log.warn(
          `[ElevenLabs] Background dialogue job for ${cacheKey} failed after client received pending: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
      log.info(
        `[ElevenLabs] Dialogue synthesis exceeded ${Math.round(
          DIALOGUE_SYNC_WAIT_BUDGET_MS / 1000,
        )}s sync budget; returning pending for ${cacheKey}. Client should poll.`,
      );
      return {
        variants: [],
        turns: metadata.turns,
        speakers: metadata.speakers,
        status: "pending",
      };
    }

    return {
      variants: [raced],
      turns: metadata.turns,
      speakers: metadata.speakers,
      status: "ready",
    };
  }
);

// ============================================================
// Sound-Effect / Ambient Generation (ElevenLabs Sound API)
// ============================================================

interface GenerateElevenLabsSoundEffectRequest {
  /** Beschreibungstext fuer den gewuenschten Sound. Deutsch ist erlaubt; konkrete, kurze Prompts funktionieren am besten. */
  prompt: string;
  /** Gewuenschte Dauer in Sekunden. ElevenLabs erlaubt 0.5-30s. Wir clampen entsprechend. */
  durationSeconds: number;
  /** "loop" fuer nahtlose Wiederholbarkeit, sonst "oneshot". Default: loop. */
  mode?: "loop" | "oneshot";
  /** Prompt-Influence (0..1). Hoeher = praeziser am Prompt, niedriger = kreativer. Default 0.4. */
  promptInfluence?: number;
}

interface GenerateElevenLabsSoundEffectResponse {
  /** Base64 dataUrl der erzeugten MP3 */
  audioData: string;
  mimeType: string;
  /** Tatsaechlich angeforderte Dauer */
  durationSeconds: number;
}

const ELEVENLABS_SOUND_MIN_DURATION = 0.5;
const ELEVENLABS_SOUND_MAX_DURATION = 30;

export interface SynthesizeSoundEffectOptions {
  prompt: string;
  durationSeconds: number;
  mode?: "loop" | "oneshot";
  promptInfluence?: number;
  /** ElevenLabs output_format. Pass "pcm_44100" for lossless server-side mixing. */
  outputFormat?: string;
}

export interface SynthesizeSoundEffectResult {
  audio: Buffer;
  mimeType: string;
  durationSeconds: number;
}

/**
 * Core ElevenLabs sound-generation used by both the public sound-effect endpoint and the
 * server-side audio-doku master. Performs no auth — the caller is responsible for it.
 */
export async function synthesizeSoundEffect(
  options: SynthesizeSoundEffectOptions
): Promise<SynthesizeSoundEffectResult> {
  const apiKey = getElevenLabsApiKey();

  const promptText = (options.prompt || "").trim();
  if (!promptText) {
    throw APIError.invalidArgument("prompt is required");
  }

  const requestedDuration = Number(options.durationSeconds);
  if (!Number.isFinite(requestedDuration)) {
    throw APIError.invalidArgument("durationSeconds must be a number");
  }
  const durationSeconds = Math.max(
    ELEVENLABS_SOUND_MIN_DURATION,
    Math.min(ELEVENLABS_SOUND_MAX_DURATION, requestedDuration),
  );

  const promptInfluence = Number.isFinite(Number(options.promptInfluence))
    ? Math.max(0, Math.min(1, Number(options.promptInfluence)))
    : 0.4;

  const loop = options.mode !== "oneshot";
  const outputFormat = options.outputFormat?.trim() || "mp3_44100_128";
  const isPcm = outputFormat.startsWith("pcm_");

  const body = {
    text: promptText,
    duration_seconds: durationSeconds,
    prompt_influence: promptInfluence,
    loop,
    output_format: outputFormat,
  };

  let response: Response;
  try {
    response = await fetch(`${ELEVENLABS_API_BASE}/sound-generation`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: isPcm ? "application/octet-stream" : "audio/mpeg",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`[ElevenLabs] sound-effect request failed before response: ${message}`);
    throw APIError.unavailable("ElevenLabs sound generation failed before a response was received.");
  }

  if (!response.ok) {
    const errText = await response.text();
    log.error(`[ElevenLabs] sound-effect generation failed (${response.status}): ${errText}`);
    throwElevenLabsApiError(response.status, errText);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  if (!bytes.length) {
    throw APIError.unavailable("ElevenLabs returned an empty sound-effect response.");
  }

  const mimeType = (response.headers.get("content-type") || (isPcm ? "audio/pcm" : "audio/mpeg"))
    .split(";")[0]
    .trim();
  return { audio: bytes, mimeType, durationSeconds };
}

export const generateElevenLabsSoundEffect = api<
  GenerateElevenLabsSoundEffectRequest,
  GenerateElevenLabsSoundEffectResponse
>(
  { expose: true, method: "POST", path: "/tts/elevenlabs/sound-effect", auth: true },
  async (req) => {
    ensureAdmin();

    const result = await synthesizeSoundEffect({
      prompt: req.prompt,
      durationSeconds: req.durationSeconds,
      mode: req.mode,
      promptInfluence: req.promptInfluence,
    });

    return {
      audioData: `data:${result.mimeType};base64,${result.audio.toString("base64")}`,
      mimeType: result.mimeType,
      durationSeconds: result.durationSeconds,
    };
  },
);

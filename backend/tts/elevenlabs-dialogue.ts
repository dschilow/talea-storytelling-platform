import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";

import { ensureAdmin } from "../admin/authz";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL_ID = "eleven_v3";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_192";
const ELEVENLABS_MAX_TEXT_LENGTH = 5000;
const ELEVENLABS_TARGET_CHUNK_LENGTH = 4800;

interface GenerateElevenLabsDialogueRequest {
  script: string;
  speakerVoiceMap: Record<string, string>;
  modelId?: string;
  outputFormat?: string;
}

interface GenerateElevenLabsDialogueResponse {
  variants: Array<{
    id: string;
    audioData: string;
    mimeType: string;
  }>;
  turns: number;
  speakers: string[];
}

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

export const generateElevenLabsDialogue = api<GenerateElevenLabsDialogueRequest, GenerateElevenLabsDialogueResponse>(
  { expose: true, method: "POST", path: "/tts/elevenlabs/dialogue", auth: true },
  async (req) => {
    ensureAdmin();
    const apiKey = getElevenLabsApiKey();

    if (!req.speakerVoiceMap || Object.keys(req.speakerVoiceMap).length === 0) {
      throw APIError.invalidArgument("speakerVoiceMap is required.");
    }

    const turns = parseDialogueScript(req.script);
    const missingSpeakers = new Set<string>();

    const inputs: ElevenLabsDialogueInput[] = turns.map((turn) => {
      const voiceId = resolveVoiceId(turn.speaker, req.speakerVoiceMap);
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

    const modelId = req.modelId?.trim() || DEFAULT_MODEL_ID;
    const outputFormat = req.outputFormat?.trim() || DEFAULT_OUTPUT_FORMAT;
    const totalTextLength = getDialogueTextLength(inputs);
    const inputBatches = chunkDialogueInputsForElevenLabs(inputs, ELEVENLABS_TARGET_CHUNK_LENGTH);

    if (inputBatches.length > 1) {
      log.info(
        `[ElevenLabs] Splitting dialogue request into ${inputBatches.length} chunk(s) (${totalTextLength} chars total).`
      );
    }

    const generateVariant = async (batchedInputs: ElevenLabsDialogueInput[], chunkNumber: number) => {
      let response: Response;
      try {
        response = await fetch(`${ELEVENLABS_API_BASE}/text-to-dialogue`, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
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
        mimeType: (response.headers.get("content-type") || "audio/mpeg").split(";")[0].trim(),
      };
    };

    const audioParts: Buffer[] = [];
    let detectedMimeType = "";

    for (let index = 0; index < inputBatches.length; index += 1) {
      const result = await generateVariant(inputBatches[index], index + 1);
      audioParts.push(result.bytes);
      if (!detectedMimeType) {
        detectedMimeType = result.mimeType || "audio/mpeg";
      } else if (result.mimeType && result.mimeType !== detectedMimeType) {
        log.warn(
          `[ElevenLabs] Mixed mime types across dialogue chunks: ${detectedMimeType} vs ${result.mimeType}.`
        );
      } else {
        detectedMimeType = result.mimeType || detectedMimeType;
      }
    }

    const combinedAudio = concatenateAudioBuffers(audioParts, detectedMimeType);
    if (!combinedAudio.length) {
      throw APIError.unavailable("ElevenLabs returned no audio data.");
    }

    const variants: GenerateElevenLabsDialogueResponse["variants"] = [
      {
        id: "variant-1",
        audioData: `data:${detectedMimeType};base64,${combinedAudio.toString("base64")}`,
        mimeType: detectedMimeType,
      },
    ];

    return {
      variants,
      turns: turns.length,
      speakers: [...new Set(turns.map((turn) => turn.speaker))],
    };
  }
);

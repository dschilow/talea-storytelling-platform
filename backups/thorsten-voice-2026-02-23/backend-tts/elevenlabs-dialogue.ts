// @ts-nocheck
import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";

import { ensureAdmin } from "../../../backend/admin/authz";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL_ID = "eleven_v3";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

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

    const inputs = turns.map((turn) => {
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
    const generateVariant = async (variantNumber: number) => {
      const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-dialogue`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          model_id: modelId,
          output_format: outputFormat,
          inputs,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        log.error(`[ElevenLabs] dialogue generation failed (${response.status}): ${errText}`);
        throw APIError.unavailable("ElevenLabs dialogue generation failed.");
      }

      const arrayBuffer = await response.arrayBuffer();
      const bytes = Buffer.from(arrayBuffer);
      if (!bytes.length) {
        throw APIError.unavailable("ElevenLabs returned an empty audio response.");
      }

      const mimeType = (response.headers.get("content-type") || "audio/mpeg").split(";")[0].trim();

      return {
        id: `variant-${variantNumber}`,
        audioData: `data:${mimeType};base64,${bytes.toString("base64")}`,
        mimeType,
      };
    };

    const variants: GenerateElevenLabsDialogueResponse["variants"] = [await generateVariant(1)];

    return {
      variants,
      turns: turns.length,
      speakers: [...new Set(turns.map((turn) => turn.speaker))],
    };
  }
);


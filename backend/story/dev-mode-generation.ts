/**
 * Developer Mode Story Generation
 *
 * Minimal-prompt path used for A/B testing prompt quality. Bypasses the full
 * Story Pipeline v2: no avatar visual profiles, no personality traits, no
 * memories, no Story DNA, no artifacts, no character pool, no style packs,
 * no professional storytelling rules, no parental-guidance prompt injection.
 *
 * Only fields fed into the prompt:
 *   - length (chapter count derived) + ageGroup
 *   - genre + setting
 *   - avatar names (+ primary age) — names only, no traits
 *   - learningMode subjects (if enabled)
 *   - language
 *   - customPrompt (the raw user wish text, no profile context merged in)
 *
 * No images are generated in this mode (chapters render text-only in the reader).
 * No personality / memory mutation happens after generation — the caller
 * (`backend/story/generate.ts`) is responsible for skipping that block.
 */

import { secret } from "encore.dev/config";
import { generateWithGemini, isGeminiConfigured } from "./gemini-generation";
import { callAnthropicCompletion } from "./pipeline/llm-client";
import { callOpenRouterChatCompletion, normalizeOpenRouterModel } from "./openrouter-generation";
import type { StoryConfig, AIProvider } from "./generate";

const openAIKey = secret("OpenAIKey");

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";

interface DevModeChapter {
  title: string;
  content: string;
  order: number;
}

interface DevModeRawStory {
  title: string;
  description: string;
  chapters: DevModeChapter[];
}

export interface DevModeGeneratedStory {
  title: string;
  description: string;
  coverImageUrl?: string;
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
    imageUrl?: string;
    imagePrompt?: string;
    imageModel?: string;
  }>;
  avatarDevelopments: never[];
  metadata: {
    tokensUsed: {
      prompt: number;
      completion: number;
      total: number;
      inputCostUSD?: number;
      outputCostUSD?: number;
      totalCostUSD?: number;
      modelUsed: string;
    };
    model: string;
    imagesGenerated: number;
    developerMode: true;
  };
}

export interface DevModeGenerationInput {
  config: StoryConfig;
  avatarNames: string[];
  primaryProfileAge?: number | null;
}

function deriveChapterCount(length: StoryConfig["length"]): number {
  switch (length) {
    case "short":
      return 3;
    case "long":
      return 8;
    case "medium":
    default:
      return 5;
  }
}

function localizedLanguageName(language?: string): string {
  switch (language) {
    case "en":
      return "English";
    case "fr":
      return "French (français)";
    case "es":
      return "Spanish (español)";
    case "it":
      return "Italian (italiano)";
    case "nl":
      return "Dutch (Nederlands)";
    case "ru":
      return "Russian (русский)";
    case "de":
    default:
      return "German (Deutsch)";
  }
}

function buildPrompts(input: DevModeGenerationInput): { systemPrompt: string; userPrompt: string; chapterCount: number } {
  const { config, avatarNames, primaryProfileAge } = input;
  const chapterCount = deriveChapterCount(config.length);
  const languageName = localizedLanguageName(config.language);

  const systemPrompt = [
    "Du bist ein erfahrener Kinderbuchautor.",
    "Schreibe eine sehr gute, fesselnde, altersgerechte Kindergeschichte.",
    "Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt nach diesem Schema:",
    "{",
    '  "title": string,',
    '  "description": string,',
    '  "chapters": [ { "title": string, "content": string, "order": number } ]',
    "}",
    "Regeln für die JSON-Ausgabe:",
    "- KEIN Markdown, KEINE Code-Fences (``` ... ```), KEINE Erklärungen vor oder nach dem JSON.",
    "- KEINE Kommentare (// ...) und KEINE trailing commas.",
    '- Alle Property-Namen MÜSSEN in doppelten Anführungszeichen stehen.',
    "- Innerhalb von String-Werten dürfen Anführungszeichen NUR als \\\" escaped vorkommen.",
    "- Zeilenumbrüche innerhalb der Kapitel-Texte müssen als \\n escaped werden, nicht als echter Zeilenumbruch.",
    "- Das JSON muss als Ganzes parsbar sein (JSON.parse muss ohne Fehler durchlaufen).",
    `Die Geschichte muss in ${languageName} verfasst sein.`,
  ].join("\n");

  const avatarLine =
    avatarNames.length > 0
      ? `Hauptfiguren: ${avatarNames.map((n, i) => (i === 0 && typeof primaryProfileAge === "number" ? `${n} (${primaryProfileAge} Jahre)` : n)).join(", ")}`
      : "Hauptfiguren: frei wählbar.";

  const learningLine =
    config.learningMode?.enabled && config.learningMode.subjects?.length
      ? `Lernziel (dezent einbauen, nicht aufdrängen): ${config.learningMode.subjects.join(", ")}.`
      : null;

  const customLine = config.customPrompt?.trim()
    ? `Zusätzlicher Wunsch des Lesers: ${config.customPrompt.trim()}`
    : null;

  const userPrompt = [
    `Schreibe eine Kindergeschichte mit ${chapterCount} Kapiteln.`,
    `Altersgruppe: ${config.ageGroup}.`,
    `Genre: ${config.genre}.`,
    `Schauplatz / Setting: ${config.setting}.`,
    avatarLine,
    learningLine,
    customLine,
    `Jedes Kapitel soll einen klaren Bogen haben (Anfang, Mitte, Wendung/Höhepunkt) und in sich rund sein.`,
    `"order" beginnt bei 1 und zählt aufwärts. Genau ${chapterCount} Kapitel.`,
    `"description" ist ein kurzer 1-2 Satz Klappentext.`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  return { systemPrompt, userPrompt, chapterCount };
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return trimmed;
}

function sliceToOuterObject(content: string): string {
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }
  return content;
}

/**
 * Best-effort JSON repair. Models sometimes emit:
 *   - // line comments or /* block *\/ comments
 *   - trailing commas before } or ]
 *   - unescaped real newlines inside string values
 *   - single quotes instead of doubles
 * We fix what we safely can without breaking valid JSON.
 */
function repairLooseJson(input: string): string {
  let s = input;
  // Strip /* ... */ block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip // line comments (but not inside strings — best-effort: only outside quotes via simple state machine)
  s = stripLineCommentsOutsideStrings(s);
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return s;
}

function stripLineCommentsOutsideStrings(s: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && s[i + 1] === "/") {
      // Skip until end-of-line
      while (i < s.length && s[i] !== "\n") i++;
      if (i < s.length) out += s[i]; // preserve the newline
      continue;
    }
    out += ch;
  }
  return out;
}

function tryParseJson(raw: string): any {
  const attempts: string[] = [];
  const trimmed = raw.trim();
  attempts.push(trimmed);
  attempts.push(stripJsonFence(trimmed));
  const sliced = sliceToOuterObject(stripJsonFence(trimmed));
  attempts.push(sliced);
  attempts.push(repairLooseJson(sliced));

  let lastError: unknown = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "unknown JSON parse failure"));
}

function parseAndValidate(content: string, chapterCount: number): DevModeRawStory {
  let parsed: any;
  try {
    parsed = tryParseJson(content);
  } catch (err) {
    const preview = content.slice(0, 400);
    const tail = content.length > 800 ? `…${content.slice(-300)}` : "";
    console.error("[dev-mode-generation] Failed to parse model JSON. Preview:", { preview, tail, length: content.length });
    throw new Error(
      `Developer-mode generation returned unparseable JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Developer-mode generation returned malformed JSON.");
  }

  const title = String(parsed.title || "").trim();
  const description = String(parsed.description || "").trim();
  const rawChapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];

  if (!title) throw new Error("Developer-mode story missing title.");
  if (rawChapters.length === 0) throw new Error("Developer-mode story has no chapters.");

  const chapters: DevModeChapter[] = rawChapters.map((ch: any, idx: number) => {
    const chTitle = String(ch?.title || "").trim() || `Kapitel ${idx + 1}`;
    const chContent = String(ch?.content || "").trim();
    if (!chContent) {
      throw new Error(`Developer-mode chapter ${idx + 1} is empty.`);
    }
    const order = Number.isInteger(ch?.order) && ch.order > 0 ? Number(ch.order) : idx + 1;
    return { title: chTitle, content: chContent, order };
  });

  if (chapters.length !== chapterCount) {
    console.warn(
      `[dev-mode-generation] Expected ${chapterCount} chapters, got ${chapters.length}. Continuing with what the model returned.`
    );
  }

  return { title, description, chapters };
}

interface ProviderResult {
  content: string;
  usage: { prompt: number; completion: number; total: number };
  modelUsed: string;
}

async function callProvider(
  config: StoryConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ProviderResult> {
  const aiProvider: AIProvider = config.aiProvider === "openrouter" ? "openrouter" : "native";
  const requestedModel = (config.aiModel || DEFAULT_GEMINI_MODEL).trim();

  if (aiProvider === "openrouter") {
    const orModel = normalizeOpenRouterModel(config.openRouterModel);
    // Some OpenRouter-routed providers (e.g. Anthropic Claude) don't honor
    // OpenAI's response_format=json_object and may return slightly malformed
    // JSON when it's forced. For Claude via OpenRouter we skip the flag and
    // rely on the strict JSON instructions in the system prompt + our
    // tolerant parser.
    const isClaudeViaOpenRouter = /claude/i.test(orModel) || /anthropic/i.test(orModel);
    console.log(`[dev-mode-generation] Calling OpenRouter model: ${orModel}`, {
      forceJsonObjectFormat: !isClaudeViaOpenRouter,
    });
    const res = await callOpenRouterChatCompletion({
      model: orModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 16000,
      responseFormat: isClaudeViaOpenRouter ? "text" : "json_object",
      temperature: 0.9,
    });
    const choice = res.data.choices?.[0];
    const content = choice?.message?.content || "";
    if (!content) throw new Error("Empty response from OpenRouter (dev mode).");
    const usage = res.data.usage || {};
    return {
      content,
      usage: {
        prompt: Number(usage.prompt_tokens || 0),
        completion: Number(usage.completion_tokens || 0),
        total: Number(usage.total_tokens || 0),
      },
      modelUsed: orModel,
    };
  }

  if (requestedModel.startsWith("gemini-")) {
    if (!isGeminiConfigured()) {
      throw new Error("Gemini API not configured. Set GeminiAPIKey secret.");
    }
    console.log(`[dev-mode-generation] Calling Gemini model: ${requestedModel}`);
    const res = await generateWithGemini({
      systemPrompt,
      userPrompt,
      model: requestedModel,
      maxTokens: 32768,
      temperature: 0.9,
      logSource: "dev-mode-generation",
      logMetadata: { devMode: true },
    });
    return {
      content: res.content,
      usage: {
        prompt: res.usage.promptTokens,
        completion: res.usage.completionTokens,
        total: res.usage.totalTokens,
      },
      modelUsed: res.model,
    };
  }

  if (requestedModel.startsWith("claude-")) {
    console.log(`[dev-mode-generation] Calling Anthropic model: ${requestedModel}`);
    const res = await callAnthropicCompletion({
      model: requestedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 16000,
      temperature: 0.9,
      context: "dev-mode-generation",
      logSource: "dev-mode-generation",
      logMetadata: { devMode: true },
    });
    return {
      content: res.content,
      usage: {
        prompt: res.usage?.promptTokens ?? 0,
        completion: res.usage?.completionTokens ?? 0,
        total: res.usage?.totalTokens ?? 0,
      },
      modelUsed: requestedModel,
    };
  }

  // Default: OpenAI native (gpt-*, o4-*, etc.)
  console.log(`[dev-mode-generation] Calling OpenAI model: ${requestedModel}`);
  const payload = {
    model: requestedModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 16000,
    response_format: { type: "json_object" },
  };

  const timeoutMs =
    config.length === "long" ? 360_000 : config.length === "medium" ? 240_000 : 180_000;
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIKey()}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as any)?.name === "AbortError") {
      throw new Error(`OpenAI request timed out after ${timeoutMs / 1000}s (dev mode).`);
    }
    throw err;
  } finally {
    clearTimeout(handle);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error (dev mode): ${response.status} - ${text}`);
  }

  const data: any = await response.json();
  const content = data?.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("Empty response from OpenAI (dev mode).");

  return {
    content,
    usage: {
      prompt: Number(data?.usage?.prompt_tokens || 0),
      completion: Number(data?.usage?.completion_tokens || 0),
      total: Number(data?.usage?.total_tokens || 0),
    },
    modelUsed: requestedModel,
  };
}

export async function generateStoryDevMode(
  input: DevModeGenerationInput
): Promise<DevModeGeneratedStory> {
  const { systemPrompt, userPrompt, chapterCount } = buildPrompts(input);

  console.log("[dev-mode-generation] 🧪 Minimal prompt path", {
    chapterCount,
    ageGroup: input.config.ageGroup,
    genre: input.config.genre,
    setting: input.config.setting,
    avatarCount: input.avatarNames.length,
    aiModel: input.config.aiModel,
    aiProvider: input.config.aiProvider,
    systemPromptChars: systemPrompt.length,
    userPromptChars: userPrompt.length,
  });

  const provider = await callProvider(input.config, systemPrompt, userPrompt);
  const parsed = parseAndValidate(provider.content, chapterCount);

  const chapters = parsed.chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((ch, idx) => ({
      id: crypto.randomUUID(),
      title: ch.title,
      content: ch.content,
      order: idx + 1, // normalize ordering to 1..n regardless of what the model emitted
      imageUrl: undefined,
      imagePrompt: undefined,
      imageModel: undefined,
    }));

  return {
    title: parsed.title,
    description: parsed.description || parsed.title,
    coverImageUrl: undefined,
    chapters,
    avatarDevelopments: [],
    metadata: {
      tokensUsed: {
        prompt: provider.usage.prompt,
        completion: provider.usage.completion,
        total: provider.usage.total,
        modelUsed: provider.modelUsed,
      },
      model: provider.modelUsed,
      imagesGenerated: 0,
      developerMode: true,
    },
  };
}

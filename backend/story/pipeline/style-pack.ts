import { storyDB } from "../db";
import type { StoryCategory } from "./constants";

export interface StoryStylePack {
  id: string;
  name: string;
  language: string;
  category?: StoryCategory | string | null;
  version: number;
  rules: string[];
  promptFragments?: Record<string, string>;
}

const DEFAULT_STYLE_PACK_DE: StoryStylePack = {
  id: "default-de-v2",
  name: "Kinderbuch-Standard",
  language: "de",
  version: 2,
  rules: [
    "DIALOGUE FIRST: At least 40% of text must be dialogue. The story is told THROUGH what characters say and do.",
    "Short, grounded sentences. Mostly 6-12 words. No sentence monsters.",
    "Strong ACTION verbs: 'slammed', 'grabbed', 'jumped' — NOT atmosphere verbs: 'shimmered', 'whispered', 'drifted'.",
    "FORBIDDEN: personifying nature ('the forest whispered'), mixing senses ('light tasted cold'), poetic metaphors.",
    "FORBIDDEN: paragraphs without dialogue or physical action.",
    "Max ONE comparison per chapter — and it must be concrete, funny, or surprising (like 'as if the lid were a crocodile mouth').",
    "Each character acts distinctly — recognizable by their speech pattern alone.",
    "Multi-character scenes: at least two clearly distinct speakers with quick back-and-forth.",
    "Humor through SITUATION and dialogue, never through poetic description.",
    "Chapter endings vary: sometimes forward-looking, sometimes punchline, sometimes calm.",
  ],
  promptFragments: {
    closingHint: "Chapter endings should vary; avoid repeating the same pattern.",
  },
};

const DEFAULT_STYLE_PACK_EN: StoryStylePack = {
  id: "default-en-v2",
  name: "Children's Book Standard",
  language: "en",
  version: 2,
  rules: [
    "DIALOGUE FIRST: At least 40% of text must be dialogue. The story is told THROUGH what characters say and do.",
    "Short, grounded sentences. Mostly 6-12 words. No sentence monsters.",
    "Strong ACTION verbs: 'slammed', 'grabbed', 'jumped' — NOT atmosphere verbs: 'shimmered', 'whispered', 'drifted'.",
    "FORBIDDEN: personifying nature ('the forest whispered'), mixing senses ('light tasted cold'), poetic metaphors.",
    "FORBIDDEN: paragraphs without dialogue or physical action.",
    "Max ONE comparison per chapter — concrete, funny, or surprising.",
    "Each character acts distinctly — recognizable by their speech pattern alone.",
    "Multi-character scenes: at least two clearly distinct speakers with quick back-and-forth.",
    "Humor through SITUATION and dialogue, never through poetic description.",
    "Chapter endings vary: sometimes forward-looking, sometimes punchline, sometimes calm.",
  ],
  promptFragments: {
    closingHint: "Chapter endings should vary; avoid repeating the same pattern.",
  },
};

let cachedPacks: StoryStylePack[] = [];
let cachedAt = 0;

export async function loadStylePack(input: { language: string; category?: StoryCategory | string }): Promise<StoryStylePack> {
  const now = Date.now();
  if (cachedPacks.length > 0 && now - cachedAt < 60_000) {
    const match = pickFromCache(input);
    if (match) return match;
  }

  try {
    const rows = await storyDB.queryAll<{
      id: string;
      name: string;
      language: string;
      category: string | null;
      version: number;
      rules: any;
      prompt_fragments: any;
    }>`
      SELECT id, name, language, category, version, rules, prompt_fragments
      FROM story_style_packs
      WHERE is_active = TRUE
    `;

    if (rows.length > 0) {
      cachedPacks = rows.map(row => ({
        id: row.id,
        name: row.name,
        language: row.language,
        category: row.category ?? undefined,
        version: row.version ?? 1,
        rules: typeof row.rules === "string" ? JSON.parse(row.rules) : (row.rules || []),
        promptFragments: typeof row.prompt_fragments === "string" ? JSON.parse(row.prompt_fragments) : (row.prompt_fragments || {}),
      }));
      cachedAt = now;
      const match = pickFromCache(input);
      if (match) return match;
    }
  } catch (error) {
    console.warn("[pipeline] Failed to load style packs, using defaults", error);
  }

  return input.language === "de" ? DEFAULT_STYLE_PACK_DE : DEFAULT_STYLE_PACK_EN;
}

export function formatStylePackPrompt(pack: StoryStylePack): string {
  const uniqueRules = dedupeLines(pack.rules || []);
  const rules = uniqueRules.length > 0 ? uniqueRules.map(rule => `- ${rule}`).join("\n") : "";
  const fragments = pack.promptFragments || {};
  const hint = typeof fragments.closingHint === "string" ? fragments.closingHint.trim() : "";
  const hasEquivalentRule = hint
    ? uniqueRules.some(rule => normalizeKey(rule) === normalizeKey(hint))
    : false;
  return [
    pack.name ? `STYLE PACK: ${pack.name} (v${pack.version})` : "STYLE PACK",
    rules,
    hint && !hasEquivalentRule ? `HINWEIS: ${hint}` : "",
  ].filter(Boolean).join("\n");
}

function pickFromCache(input: { language: string; category?: StoryCategory | string }) {
  const direct = cachedPacks.find(pack => pack.language === input.language && pack.category === input.category);
  if (direct) return direct;
  const fallback = cachedPacks.find(pack => pack.language === input.language && !pack.category);
  if (fallback) return fallback;
  return input.language === "de" ? DEFAULT_STYLE_PACK_DE : DEFAULT_STYLE_PACK_EN;
}

function dedupeLines(lines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const trimmed = (line || "").trim();
    if (!trimmed) continue;
    const key = normalizeKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

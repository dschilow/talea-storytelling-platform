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
  id: "default-de-v1",
  name: "Kinderbuch-Standard",
  language: "de",
  version: 1,
  rules: [
    "Zeige statt nur zu sagen: sinnliche Details (Geruch, Klang, Licht, Haptik).",
    "Kurze, klare Saetze mit Rhythmus. Variiere Satzanfaenge.",
    "Natuerliche Dialoge, sparsam aber wirkungsvoll.",
    "Jede Figur handelt aktiv und treibt die Szene voran.",
    "Keine Meta-Saetze oder Pipeline-Begriffe.",
    "Kapitelstruktur: 2-5 kurze Absaetze, gelegentlich direkte Rede.",
    "Jedes Kapitel endet mit einem kleinen Ausblick (ausser im letzten Kapitel).",
  ],
  promptFragments: {
    closingHint: "Jedes Kapitel endet mit einem sanften Ausblick (ausser im letzten Kapitel).",
  },
};

const DEFAULT_STYLE_PACK_EN: StoryStylePack = {
  id: "default-en-v1",
  name: "Children's Book Standard",
  language: "en",
  version: 1,
  rules: [
    "Show, don't tell: use vivid sensory details.",
    "Short, clear sentences with rhythmic flow and varied starts.",
    "Natural dialogue, sparing but effective.",
    "Each character acts meaningfully in the scene.",
    "No meta or pipeline language.",
    "Chapter structure: 2-5 short paragraphs, occasional dialogue.",
    "Each chapter ends with a gentle forward-looking line (except the final chapter).",
  ],
  promptFragments: {
    closingHint: "Each chapter ends with a gentle forward-looking line (except the final chapter).",
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
  const rules = pack.rules.length > 0 ? pack.rules.map(rule => `- ${rule}`).join("\n") : "";
  const fragments = pack.promptFragments || {};
  return [
    pack.name ? `STYLE PACK: ${pack.name} (v${pack.version})` : "STYLE PACK",
    rules,
    fragments.closingHint ? `HINWEIS: ${fragments.closingHint}` : "",
  ].filter(Boolean).join("\n");
}

function pickFromCache(input: { language: string; category?: StoryCategory | string }) {
  const direct = cachedPacks.find(pack => pack.language === input.language && pack.category === input.category);
  if (direct) return direct;
  const fallback = cachedPacks.find(pack => pack.language === input.language && !pack.category);
  if (fallback) return fallback;
  return input.language === "de" ? DEFAULT_STYLE_PACK_DE : DEFAULT_STYLE_PACK_EN;
}



/**
 * Developer Mode Story Generation
 *
 * Developer quality lane used for A/B testing prompt quality. Bypasses the
 * full Story Pipeline v2 (no memories, Story DNA, artifacts, images, TTS,
 * or personality mutation) but keeps a focused, inspectable prompt surface:
 * selected avatars, their visual/personality grounding, and a slim pool cast.
 *
 * Fields fed into the prompt:
 *   - length (chapter count derived) + ageGroup
 *   - genre + setting
 *   - selected avatar appearance + personality traits
 *   - a small supporting character pool
 *   - learningMode subjects (if enabled)
 *   - language
 *   - customPrompt (the raw user wish text, no profile context merged in)
 *
 * Generation is intentionally multi-call:
 *   1. story blueprint
 *   2. dramaturgy / quality check
 *   3. final story draft
 *   4. JSON + style + logic validation / light repair
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
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { logTopic } from "../log/logger";
import { storyDB } from "./db";

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

type DevModePipelineStage =
  | "blueprint"
  | "dramaturgy-check"
  | "story-draft"
  | "final-validation";

interface DevModeStageLog {
  stage: DevModePipelineStage;
  systemPrompt: string;
  userPrompt: string;
  rawContent?: string;
  parsed?: any;
  parseError?: string;
  usage?: { prompt: number; completion: number; total: number };
  modelUsed?: string;
  durationMs?: number;
  error?: string;
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

/**
 * Subset of avatar fields the dev mode injects into the prompt. We deliberately
 * keep the shape minimal — only what the model can actually use as character
 * grounding (appearance + personality). No memories, no inventory, no skills.
 */
export interface DevModeAvatar {
  id?: string;
  name: string;
  age?: number | null;
  description?: string;
  /** Avatar visual profile (canonical appearance). Free-form JSON. */
  visualProfile?: any;
  /** Avatar personality traits (9 base values, optionally with subcategories). Free-form JSON. */
  personalityTraits?: any;
}

/**
 * Slim pool character info for prompt injection. Mirrors what the standard
 * pipeline's casting-engine produces (auto-cast), but stripped to what a
 * single-shot prompt actually needs.
 */
export interface DevModePoolCharacter {
  id: string;
  name: string;
  role?: string;
  archetype?: string;
  species?: string | null;
  ageCategory?: string | null;
  /** One-line visual hook. */
  physicalDescription?: string | null;
  /** Up to ~3 personality words. */
  personalityKeywords?: string[];
  catchphrase?: string | null;
  speechStyle?: string[];
  quirk?: string | null;
  backstory?: string | null;
}

export interface DevModeGenerationInput {
  config: StoryConfig;
  /** Full hero avatars (the user's chosen avatars). */
  avatars: DevModeAvatar[];
  /** Auto-cast supporting characters picked from character_pool. */
  poolCharacters?: DevModePoolCharacter[];
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

/**
 * Compact, human-readable summary of an avatar's visualProfile. The full
 * visualProfile JSON is too verbose and noisy for a single-shot prompt —
 * we extract the most useful canonical traits.
 */
function compactText(value: any, depth = 0): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => compactText(item, depth + 1))
      .filter(Boolean)
      .slice(0, 8)
      .join(", ");
  }
  if (typeof value !== "object" || depth > 2) return "";

  const preferredKeys = [
    "description",
    "summary",
    "text",
    "tone",
    "color",
    "style",
    "type",
    "length",
    "texture",
    "shape",
    "outfit",
    "top",
    "bottom",
    "shoes",
    "features",
    "distinctiveFeatures",
    "otherFeatures",
  ];

  const preferred = preferredKeys
    .map((key) => compactText(value[key], depth + 1))
    .filter(Boolean);
  if (preferred.length > 0) return preferred.slice(0, 5).join(", ");

  return Object.entries(value)
    .map(([key, nested]) => {
      const nestedText = compactText(nested, depth + 1);
      return nestedText ? `${key}: ${nestedText}` : "";
    })
    .filter(Boolean)
    .slice(0, 5)
    .join(", ");
}

function summarizeVisualProfile(vp: any): string {
  if (!vp || typeof vp !== "object") return "";
  const parts: string[] = [];

  const pick = (label: string, ...keys: string[]) => {
    for (const key of keys) {
      const text = compactText(vp[key]);
      if (text.length === 0 || text === "[object Object]") continue;
      parts.push(`${label}: ${text}`);
      return;
    }
  };

  pick("Alter", "ageDescription", "age", "ageApprox", "ageNumeric");
  pick("Geschlecht", "gender");
  pick("Spezies", "species", "speciesCategory", "characterType");
  pick("Haut", "skinTone", "skin");
  pick("Haare", "hair", "hairDescription", "hairColor");
  pick("Augen", "eyes", "eyeColor", "eyeDescription");
  pick("Statur", "build", "body", "physicalBuild", "height", "heightCm");
  pick("Kleidung", "outfit", "clothing", "clothingDescription", "clothingCanonical");
  pick("Besondere Merkmale", "distinctiveFeatures", "uniqueFeatures", "marks", "face");

  if (parts.length === 0) {
    const fallback = compactText(vp);
    if (fallback.length > 0 && fallback !== "[object Object]") {
      parts.push(fallback);
    }
  }

  return parts.join("; ");
}

/**
 * Render the 9 base personality traits as a compact line.
 * Subcategories (knowledge.history etc.) get a separate sublist if present.
 * Traits with value 0 are omitted to keep the prompt focused.
 */
function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function traitBand(value: number): string {
  if (value <= 5) return "kaum ausgepraegt";
  if (value < 20) return "niedrig";
  if (value < 45) return "zurueckhaltend";
  if (value < 70) return "mittel";
  if (value < 90) return "stark";
  return "sehr stark";
}

function summarizePersonalityTraits(pt: any): { baseLine: string; subLines: string[] } {
  if (!pt || typeof pt !== "object") return { baseLine: "", subLines: [] };

  const BASE_KEYS = ["knowledge", "creativity", "vocabulary", "courage", "curiosity", "teamwork", "empathy", "persistence", "logic"];
  const LABEL_DE: Record<string, string> = {
    knowledge: "Wissen",
    creativity: "Kreativität",
    vocabulary: "Wortschatz",
    courage: "Mut",
    curiosity: "Neugier",
    teamwork: "Teamgeist",
    empathy: "Empathie",
    persistence: "Ausdauer",
    logic: "Logik",
  };

  const baseParts: string[] = [];
  const subLines: string[] = [];

  for (const key of BASE_KEYS) {
    const node = pt[key];
    const rawValue = typeof node === "number" ? node : (node && typeof node === "object" ? Number(node.value ?? 0) : 0);
    const value = clampNumber(rawValue, 0, 100);
    baseParts.push(`${LABEL_DE[key]} ${Math.round(value)} (${traitBand(value)})`);

    const subs = node && typeof node === "object" ? node.subcategories : undefined;
    if (subs && typeof subs === "object") {
      const subParts: string[] = [];
      for (const [subKey, subVal] of Object.entries(subs)) {
        const v = typeof subVal === "number" ? subVal : Number((subVal as any)?.value ?? subVal ?? 0);
        if (Number.isFinite(v) && v > 0) {
          subParts.push(`${subKey} ${Math.round(clampNumber(v, 0, 1000))}`);
        }
      }
      if (subParts.length > 0) {
        subLines.push(`  ${LABEL_DE[key]} im Detail: ${subParts.join(", ")}`);
      }
    }
  }

  return { baseLine: baseParts.join(", "), subLines };
}

function buildAvatarBlock(avatars: DevModeAvatar[]): string {
  if (!avatars || avatars.length === 0) return "";
  const lines: string[] = ["HAUPTFIGUREN (verwende sie wie beschrieben — Aussehen und Charakter konsistent durch die ganze Geschichte):"];

  avatars.forEach((avatar, idx) => {
    const heading = avatar.age != null
      ? `${idx + 1}. ${avatar.name} (${avatar.age} Jahre)`
      : `${idx + 1}. ${avatar.name}`;
    lines.push(heading);

    if (avatar.description && avatar.description.trim().length > 0) {
      lines.push(`   Kurzbeschreibung: ${avatar.description.trim()}`);
    }

    const visual = summarizeVisualProfile(avatar.visualProfile);
    if (visual.length > 0) {
      lines.push(`   Aussehen: ${visual}`);
    }

    const { baseLine, subLines } = summarizePersonalityTraits(avatar.personalityTraits);
    if (baseLine.length > 0) {
      lines.push(`   Persoenlichkeit (Prompt-Skala 0-100; Werte ueber 100 wurden nur fuer den Prompt gekappt): ${baseLine}`);
      lines.push("   Dramaturgie: Niedrige Werte sind Reibung und Wachstumsflaeche, hohe Werte sind aktive Staerken. Die Figur soll nie gegen diese Werte handeln, nur daran wachsen.");
      for (const sub of subLines) lines.push(sub);
    }
  });

  return lines.join("\n");
}

function sanitizePoolPromptText(text?: string | null): string | null {
  const raw = String(text || "").trim();
  if (!raw) return null;

  return raw
    .replace(
      /(?:^|[\s;,.])Besiegt\s+durch\s*:[^.;\n]*(?:[.;]|$)/gi,
      " Schwaechen-Hinweis: Die Figur reagiert empfindlich auf gemeinsam gehaltene, ruhige Aufmerksamkeit. "
    )
    .replace(
      /(?:^|[\s;,.])Defeated\s+by\s*:[^.;\n]*(?:[.;]|$)/gi,
      " Weakness hint: the character reacts to shared, calm attention. "
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildPoolBlock(pool?: DevModePoolCharacter[]): string {
  if (!pool || pool.length === 0) return "";
  const lines: string[] = [
    "NEBENFIGUREN-POOL (wähle natürlich passende Figuren aus dieser Liste in die Geschichte ein; nicht alle müssen vorkommen, aber nutze sie bevorzugt vor frei erfundenen Nebenfiguren — sie haben einprägsamen Charakter):",
  ];
  pool.forEach((c, idx) => {
    const heading = `${idx + 1}. ${c.name}${c.role ? ` (${c.role})` : ""}${c.archetype ? ` — ${c.archetype}` : ""}`;
    lines.push(heading);
    const meta: string[] = [];
    if (c.species) meta.push(`Spezies: ${c.species}`);
    if (c.ageCategory) meta.push(`Altersgruppe: ${c.ageCategory}`);
    if (meta.length > 0) lines.push(`   ${meta.join(" · ")}`);
    const physicalDescription = sanitizePoolPromptText(c.physicalDescription);
    if (physicalDescription) lines.push(`   Aussehen: ${physicalDescription}`);
    if (c.personalityKeywords && c.personalityKeywords.length > 0) {
      lines.push(`   Charakter: ${c.personalityKeywords.join(", ")}`);
    }
    if (c.catchphrase) lines.push(`   Sprichwort: „${c.catchphrase}“`);
    if (c.speechStyle && c.speechStyle.length > 0) {
      lines.push(`   Sprechstil: ${c.speechStyle.join(", ")}`);
    }
    if (c.quirk) lines.push(`   Eigenheit: ${c.quirk}`);
    const backstory = sanitizePoolPromptText(c.backstory);
    if (backstory) lines.push(`   Hintergrund: ${backstory}`);
  });
  return lines.join("\n");
}

function buildPrompts(input: DevModeGenerationInput): { systemPrompt: string; userPrompt: string; chapterCount: number } {
  const { config, avatars, poolCharacters, primaryProfileAge } = input;
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
    `- Für wörtliche Rede / Dialog in den Kapiteltexten verwende AUSSCHLIESSLICH die typografischen Anführungszeichen „…“ (deutsch: U+201E öffnend, U+201C schließend) bzw. die landesüblichen Varianten. KEIN normales " innerhalb der Story-Texte.`,
    `- Das Zeichen " darf in String-Werten NUR auftauchen wenn es als \\" escaped ist. Bevorzuge die typografischen Varianten oben.`,
    "- Zeilenumbrüche innerhalb der Kapitel-Texte müssen als \\n escaped werden, nicht als echter Zeilenumbruch.",
    "- Das JSON muss als Ganzes parsbar sein (JSON.parse muss ohne Fehler durchlaufen).",
    `Die Geschichte muss in ${languageName} verfasst sein.`,
  ].join("\n");

  // Build avatar block with full visual profile + personality traits.
  // If the caller didn't supply enriched avatars, fall back to a minimal name list.
  let avatarBlock = buildAvatarBlock(avatars || []);
  if (!avatarBlock) {
    const names = (avatars || []).map((a) => a.name).filter(Boolean);
    avatarBlock =
      names.length > 0
        ? `HAUPTFIGUREN: ${names
            .map((n, i) =>
              i === 0 && typeof primaryProfileAge === "number" ? `${n} (${primaryProfileAge} Jahre)` : n
            )
            .join(", ")}`
        : "HAUPTFIGUREN: frei wählbar.";
  }

  const poolBlock = buildPoolBlock(poolCharacters);

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
    "",
    avatarBlock,
    poolBlock || null,
    "",
    learningLine,
    customLine,
    `Jedes Kapitel soll einen klaren Bogen haben (Anfang, Mitte, Wendung/Höhepunkt) und in sich rund sein.`,
    `"order" beginnt bei 1 und zählt aufwärts. Genau ${chapterCount} Kapitel.`,
    `"description" ist ein kurzer 1-2 Satz Klappentext.`,
  ]
    .filter((line): line is string => line !== null && line !== undefined)
    .join("\n");

  return { systemPrompt, userPrompt, chapterCount };
}

function buildDevStoryContext(input: DevModeGenerationInput, chapterCount: number): string {
  const { config, avatars, poolCharacters, primaryProfileAge } = input;
  const languageName = localizedLanguageName(config.language);

  let avatarBlock = buildAvatarBlock(avatars || []);
  if (!avatarBlock) {
    const names = (avatars || []).map((a) => a.name).filter(Boolean);
    avatarBlock =
      names.length > 0
        ? `HAUPTFIGUREN: ${names
            .map((n, i) =>
              i === 0 && typeof primaryProfileAge === "number" ? `${n} (${primaryProfileAge} Jahre)` : n
            )
            .join(", ")}`
        : "HAUPTFIGUREN: frei waehlbar.";
  }

  const poolBlock = buildPoolBlock(poolCharacters);
  const learningLine =
    config.learningMode?.enabled && config.learningMode.subjects?.length
      ? `Lernziel (dezent einbauen, nicht aufdraengen): ${config.learningMode.subjects.join(", ")}.`
      : null;
  const customLine = config.customPrompt?.trim()
    ? `Zusatzwunsch des Lesers: ${config.customPrompt.trim()}`
    : null;

  return [
    `Sprache: ${languageName}.`,
    `Altersgruppe: ${config.ageGroup}.`,
    `Kapitelanzahl: genau ${chapterCount}.`,
    `Genre: ${config.genre}.`,
    `Setting: ${config.setting}.`,
    "",
    genreCraftGuidance(config.genre),
    settingCraftGuidance(config.setting),
    "",
    avatarBlock,
    poolBlock || null,
    learningLine,
    customLine,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function genreCraftGuidance(genre?: string): string {
  const normalized = String(genre || "").toLowerCase();
  if (normalized.includes("fairy") || normalized.includes("maerchen") || normalized.includes("märchen")) {
    return [
      "GENRE-HANDWERK MAERCHEN:",
      "- Nutze Maerchen-Konventionen bewusst: Schwelle, klare magische Regel, symbolische Gegenstaende, einfache aber tiefe Wahrheit.",
      "- Keine generische Fantasy-Quest. Das Wunder muss kindlich konkret und in Szenen sichtbar sein.",
      "- Die Loesung darf nicht als Moral erklaert werden; sie muss aus Handlung, Figuren und zuvor gesetzten Details entstehen.",
    ].join("\n");
  }
  if (normalized.includes("adventure") || normalized.includes("abenteuer")) {
    return [
      "GENRE-HANDWERK ABENTEUER:",
      "- Jedes Kapitel braucht ein sichtbares Ziel, ein Hindernis und eine kleine Konsequenz.",
      "- Gefahr bleibt kindgerecht, aber Entscheidungen muessen spuerbare Folgen haben.",
    ].join("\n");
  }
  return [
    "GENRE-HANDWERK:",
    "- Uebersetze das Genre in konkrete Szenen, Regeln, Requisiten und Wendungen.",
    "- Vermeide leere Genre-Etiketten und austauschbare Standardmotive.",
  ].join("\n");
}

function settingCraftGuidance(setting?: string): string {
  const normalized = String(setting || "").toLowerCase();
  if (!normalized || normalized === "fantasy") {
    return [
      "SETTING-HANDWERK:",
      "- Wenn das Setting allgemein ist, erfinde einen spezifischen Ort mit wiedererkennbaren Details.",
      "- Der Ort muss die Handlung beeinflussen, nicht nur Kulisse sein.",
    ].join("\n");
  }
  return [
    "SETTING-HANDWERK:",
    "- Mache den Ort sinnlich konkret: Licht, Geraeusche, Geruch, Textur, Wege, Regeln.",
    "- Nutze den Ort im Finale aktiv.",
  ].join("\n");
}

function chapterLengthGuidance(config: StoryConfig): string {
  if (config.length === "short") return "Jedes Kapitel ca. 1.200-1.800 Zeichen.";
  if (config.length === "long") return "Jedes Kapitel ca. 2.000-2.700 Zeichen.";
  return "Jedes Kapitel ca. 1.800-2.400 Zeichen.";
}

function qualitySystemPrompt(languageName: string, outputSchema: string): string {
  return [
    "Du bist ein preisgekroenter Kinderbuchautor und Dramaturg fuer altersgerechte Vorlese- und Lesegeschichten.",
    "Dein Ziel ist echte Kinderbuchqualitaet: warm, spannend, klar, bildhaft, emotional, humorvoll und mit Figuren, die Kinder wiedererkennen und moegen.",
    "",
    "SCHREIBSTANDARD:",
    "- Schreibe szenisch, nicht zusammenfassend.",
    "- Beginne konkrete Szenen mit Handlung, Dialog, kleinen Gesten, Sinneseindruecken und Entscheidungen.",
    "- Jede Hauptfigur handelt sichtbar und hat eine eigene Rolle.",
    "- Gefuehle werden durch Verhalten, Koerper, Blick, Stimme und Entscheidung gezeigt; selten direkt benannt.",
    "- Keine Moralpredigt, keine Standard-Fantasy, keine Loesung durch blosses Glauben.",
    "- Niedrige Persoenlichkeitswerte bedeuten Reibung/Wachstum, nicht Unsympathie.",
    "- Hohe Persoenlichkeitswerte muessen als aktive Staerke in Handlung sichtbar werden.",
    "",
    "SPRACHE:",
    `- Die Ausgabe muss in ${languageName} sein.`,
    "- Fuer die Zielgruppe verstaendlich: klare Saetze, klare Bilder, keine verschachtelten Erwachsenensaetze.",
    "- Mindestens 30 Prozent Dialog in der finalen Geschichte.",
    "- Pro Kapitel mindestens zwei konkrete Sinneseindruecke.",
    "- Pro Kapitel ein kleiner humorvoller Moment aus Situation oder Figur.",
    "",
    "VERBOTENE MUSTER:",
    "- Sie lernten, dass ...",
    "- Das groesste Geschenk war Freundschaft.",
    "- Mit Mut und Zusammenhalt schafften sie es.",
    "- wahre Magie liegt im Herzen",
    "- Es war alles nur ein Traum.",
    "- Gegner wird in einem Satz bekehrt.",
    "- Nebenfigur erklaert nur die Loesung.",
    "- kaputte Platzhalter wie [object Object].",
    "",
    "JSON-AUSGABE:",
    "Antworte AUSSCHLIESSLICH mit einem gueltigen JSON-Objekt.",
    "Kein Markdown. Keine Code-Fences. Keine Kommentare. Keine trailing commas.",
    "Alle Property-Namen in doppelten Anfuehrungszeichen.",
    "Dialog innerhalb von Storytexten mit typografischen Anfuehrungszeichen „...“, nicht mit normalen ASCII-Anfuehrungszeichen.",
    "Zeilenumbrueche in JSON-Strings als \\n escapen.",
    "",
    outputSchema,
  ].join("\n");
}

function buildBlueprintPrompts(input: DevModeGenerationInput, chapterCount: number): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "premise": string,',
      '  "coreMagicRule": string,',
      '  "characterArcs": [ { "name": string, "startingFriction": string, "strength": string, "finalContribution": string } ],',
      '  "supportingCastUse": [ { "name": string, "storyFunction": string, "mustDo": string } ],',
      '  "plantsAndPayoffs": [ { "plant": string, "payoff": string } ],',
      '  "chapterPlan": [ { "order": number, "title": string, "hook": string, "sceneBeats": string[], "conflict": string, "turn": string, "endingTension": string } ],',
      '  "forbiddenShortcuts": string[]',
      "}",
    ].join("\n")
  );
  const userPrompt = [
    "CALL 1: Erzeuge nur einen Story-Blueprint, noch keine ausformulierte Geschichte.",
    "Der Blueprint muss die spaetere Geschichte vorbereiten: Figurenrollen, klare magische Regel, Versuch-Irrtum-Folge, Finale aus vorbereiteten Details.",
    "",
    buildDevStoryContext(input, chapterCount),
    "",
    `Plane genau ${chapterCount} Kapitel.`,
    "Achte besonders darauf, dass Antagonisten-Hinweise nicht als Spoiler-Loesung uebernommen werden.",
  ].join("\n");
  return { systemPrompt, userPrompt };
}

function buildCritiquePrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  blueprint: any
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "score": number,',
      '  "strengths": string[],',
      '  "mustFix": string[],',
      '  "chapterRisks": [ { "order": number, "risk": string, "fix": string } ],',
      '  "revisedBlueprint": object',
      "}",
    ].join("\n")
  );
  const userPrompt = [
    "CALL 2: Pruefe den Blueprint wie ein strenger Kinderbuch-Dramaturg.",
    "Finde alles, was die Geschichte unter 9.5/10 druecken wuerde: schwache Spannung, Spoiler-Loesung, Figuren ohne aktive Rolle, Telling, generische Motive, fehlende Sinnlichkeit, unverdiente Wendung.",
    "Gib danach einen verbesserten revisedBlueprint zurueck. Der revisedBlueprint darf die Struktur schaerfen, aber keine neue unpassende Pipeline-Komplexitaet einfuehren.",
    "",
    "KONTEXT:",
    buildDevStoryContext(input, chapterCount),
    "",
    "BLUEPRINT:",
    JSON.stringify(blueprint, null, 2),
  ].join("\n");
  return { systemPrompt, userPrompt };
}

function buildStoryDraftPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  blueprint: any,
  critique: any
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Finales Story-Schema:",
      "{",
      '  "title": string,',
      '  "description": string,',
      '  "chapters": [',
      '    { "order": number, "title": string, "content": string }',
      "  ]",
      "}",
    ].join("\n")
  );
  const revisedBlueprint = critique?.revisedBlueprint || blueprint;
  const userPrompt = [
    "CALL 3: Schreibe jetzt die finale Geschichte als echte Szene, nicht als Zusammenfassung.",
    "",
    buildDevStoryContext(input, chapterCount),
    "",
    "DRAMATURGIE-VORGABEN:",
    `- Genau ${chapterCount} Kapitel.`,
    `- ${chapterLengthGuidance(input.config)}`,
    "- Jedes Kapitel 6-12 Absaetze.",
    "- Kapitel 1: starker Hook in den ersten 2 Saetzen, konkretes Problem, unterschiedliche Reaktion der Hauptfiguren, offenes Ende.",
    "- Kapitel 2: Welt konkreter, Spur/Begegnung, Nebenfigur/Gegenspieler zeigt Eigenart, Problem wird groesser.",
    "- Kapitel 3: falscher Versuch oder Fehlentscheidung aus Charakter heraus, echte Konsequenz, kein Zufall rettet.",
    "- Kapitel 4: tiefere Regel verstehen, unterschiedliche Staerken verbinden, emotionaler Moment, Finale vorbereiten.",
    "- Kapitel 5: konkrete Handlung, vorbereitete Loesung, emotionaler Nachhall, starkes Schlussbild, keine erklaerte Moral.",
    "",
    "GEPRUEFTER BLUEPRINT:",
    JSON.stringify(revisedBlueprint, null, 2),
    "",
    "KRITIK, DIE DU BEHEBEN MUSST:",
    JSON.stringify(
      {
        score: critique?.score,
        mustFix: critique?.mustFix || [],
        chapterRisks: critique?.chapterRisks || [],
      },
      null,
      2
    ),
  ].join("\n");
  return { systemPrompt, userPrompt };
}

function buildValidationPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  story: DevModeRawStory
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "isValid": boolean,',
      '  "score": number,',
      '  "errors": string[],',
      '  "warnings": string[],',
      '  "story": {',
      '    "title": string,',
      '    "description": string,',
      '    "chapters": [ { "order": number, "title": string, "content": string } ]',
      "  }",
      "}",
    ].join("\n")
  );
  const userPrompt = [
    "CALL 4: Validiere JSON, Stil und Logik der finalen Geschichte.",
    "Wenn nur kleine Probleme vorhanden sind, repariere sie direkt in story. Wenn alles passt, gib story unveraendert zurueck.",
    "Pruefe: genau richtige Kapitelanzahl, gueltiges JSON, keine [object Object], klare Figurenrollen, keine erklaerte Moral, vorbereitete Loesung, keine gespoilerte/billige Antagonisten-Niederlage, altersgerechte Sprache, Dialog mit typografischen Anfuehrungszeichen.",
    "",
    "KONTEXT:",
    buildDevStoryContext(input, chapterCount),
    "",
    "STORY:",
    JSON.stringify(story, null, 2),
  ].join("\n");
  return { systemPrompt, userPrompt };
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
 *   - unescaped " inside string values (typical when the story uses German
 *     typographic dialog like „Ja" — model writes regular " inside the value
 *     and doesn't escape it).
 *   - single quotes instead of doubles (rarer; we don't auto-fix this).
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

/**
 * Heuristic recovery for the most common dev-mode failure: a model emits
 * a JSON object whose string values contain unescaped " characters from
 * dialog. We walk the input, treat every `"key":` token as a property
 * boundary, then re-quote the value by detecting where the value ends
 * (next `,\n  "key":` or `\n]` or `\n}` at a reasonable indent).
 *
 * This is a fallback for when JSON.parse keeps throwing "Expected
 * double-quoted property name" — meaning the parser has miscounted
 * quotes inside a value. Only attempt this when normal repair already
 * failed; the cost is correctness loss in edge cases vs. the alternative
 * of "story generation failed entirely".
 */
function escapeInnerQuotesInStringValues(raw: string): string {
  // Find the top-level object body.
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first < 0 || last <= first) return raw;
  const before = raw.slice(0, first);
  const body = raw.slice(first, last + 1);
  const after = raw.slice(last + 1);

  // Property-name pattern: a key followed by colon. We use a state machine.
  // For each string-value start (after `":` or `: `), scan forward and
  // collect characters; whenever we see a `"` decide whether it terminates
  // the value (next non-space is `,`, `}`, `]`, or newline+key) or is an
  // inner quote that must be escaped.
  let out = "";
  let i = 0;
  let depth = 0;
  while (i < body.length) {
    const ch = body[i];
    out += ch;
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;

    // Detect a property `"key":` or array-element string start.
    // Approach: when we hit `"`, scan the string. If the string is a
    // "value" string (preceded by `:` ignoring whitespace), parse with
    // tolerant rules.
    if (ch === '"') {
      // Check whether this " opens a VALUE string (preceded by `:` after ws)
      // or a KEY string (preceded by `{` or `,` after ws).
      let look = out.length - 2;
      while (look >= 0 && /\s/.test(out[look])) look--;
      const prevNonWs = look >= 0 ? out[look] : "";
      const isValueString = prevNonWs === ":";
      const isKeyOrSimple = prevNonWs === "{" || prevNonWs === "," || prevNonWs === "[";

      // Scan forward, copying characters, handling escapes.
      let j = i + 1;
      let valueAcc = "";
      while (j < body.length) {
        const c = body[j];
        if (c === "\\") {
          // Pass through escape sequence verbatim.
          valueAcc += c;
          if (j + 1 < body.length) {
            valueAcc += body[j + 1];
            j += 2;
            continue;
          }
          j++;
          continue;
        }
        if (c === '"') {
          // Decide: terminator or inner quote?
          // Peek ahead skipping whitespace.
          let k = j + 1;
          while (k < body.length && /[ \t]/.test(body[k])) k++;
          const peek = body[k];
          // Terminator if followed by , } ] : or end-of-line that leads to one of these.
          // For a KEY string the next non-ws must be `:`. For a VALUE string the next
          // non-ws should be `,` `}` `]` or newline+`"key":` pattern.
          let isTerminator = false;
          if (isKeyOrSimple && !isValueString) {
            // It's a key string — terminator must be `:`.
            isTerminator = peek === ":";
          } else if (isValueString) {
            if (peek === "," || peek === "}" || peek === "]") {
              isTerminator = true;
            } else if (peek === "\n" || peek === "\r") {
              // Look further: skip whitespace then expect `,` `}` `]` or `"key":` shape.
              let m = k;
              while (m < body.length && /\s/.test(body[m])) m++;
              const nextChar = body[m];
              if (nextChar === "," || nextChar === "}" || nextChar === "]") {
                isTerminator = true;
              } else if (nextChar === '"') {
                // Possible key — look for `":` after a non-quote run.
                let n = m + 1;
                while (n < body.length && body[n] !== '"') {
                  if (body[n] === "\\") n += 2;
                  else n++;
                }
                let o = n + 1;
                while (o < body.length && /[ \t]/.test(body[o])) o++;
                if (body[o] === ":") isTerminator = true;
              }
            } else {
              // Inner quote inside a value — escape it.
              isTerminator = false;
            }
          } else {
            // Bare string somewhere (e.g., inside an array of strings).
            isTerminator = peek === "," || peek === "}" || peek === "]" || peek === "\n" || peek === "\r";
          }

          if (isTerminator) {
            valueAcc += c;
            j++;
            break;
          } else {
            valueAcc += "\\\"";
            j++;
            continue;
          }
        }
        // Escape raw control characters that JSON doesn't allow inside strings.
        if (c === "\n") {
          valueAcc += "\\n";
          j++;
          continue;
        }
        if (c === "\r") {
          valueAcc += "\\r";
          j++;
          continue;
        }
        if (c === "\t") {
          valueAcc += "\\t";
          j++;
          continue;
        }
        valueAcc += c;
        j++;
      }
      out += valueAcc;
      i = j;
      continue;
    }
    i++;
  }
  return before + out + after;
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
  const trimmed = raw.trim();
  const fenced = stripJsonFence(trimmed);
  const sliced = sliceToOuterObject(fenced);
  const looseRepaired = repairLooseJson(sliced);
  const aggressiveRepaired = escapeInnerQuotesInStringValues(looseRepaired);

  const attempts: Array<{ label: string; text: string }> = [
    { label: "raw", text: trimmed },
    { label: "fence-stripped", text: fenced },
    { label: "outer-sliced", text: sliced },
    { label: "loose-repaired", text: looseRepaired },
    { label: "aggressive-quote-repair", text: aggressiveRepaired },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt.text);
      if (attempt.label !== "raw") {
        console.log(`[dev-mode-generation] JSON parsed via "${attempt.label}" repair stage.`);
      }
      return parsed;
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

function parseStageObject(content: string): { parsed?: any; parseError?: string } {
  try {
    return { parsed: tryParseJson(content) };
  } catch (err) {
    return {
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

function usageSum(results: ProviderResult[]): { prompt: number; completion: number; total: number } {
  return results.reduce(
    (acc, result) => ({
      prompt: acc.prompt + result.usage.prompt,
      completion: acc.completion + result.usage.completion,
      total: acc.total + result.usage.total,
    }),
    { prompt: 0, completion: 0, total: 0 }
  );
}

function validationStoryCandidate(parsedValidation: any): any {
  if (parsedValidation?.story && typeof parsedValidation.story === "object") {
    return parsedValidation.story;
  }
  if (parsedValidation?.title && Array.isArray(parsedValidation?.chapters)) {
    return parsedValidation;
  }
  return null;
}

interface ProviderResult {
  content: string;
  usage: { prompt: number; completion: number; total: number };
  modelUsed: string;
}

interface ProviderCallOptions {
  stage?: DevModePipelineStage;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

async function callProvider(
  config: StoryConfig,
  systemPrompt: string,
  userPrompt: string,
  options: ProviderCallOptions = {}
): Promise<ProviderResult> {
  const aiProvider: AIProvider = config.aiProvider === "openrouter" ? "openrouter" : "native";
  const requestedModel = (config.aiModel || DEFAULT_GEMINI_MODEL).trim();
  const maxTokens = options.maxTokens ?? 16000;
  const temperature = options.temperature ?? 0.9;

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
      maxTokens,
      responseFormat: isClaudeViaOpenRouter ? "text" : "json_object",
      temperature,
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
      maxTokens: Math.max(maxTokens, 1024),
      temperature,
      fetchTimeoutMs: options.timeoutMs,
      logSource: "dev-mode-generation",
      logMetadata: { devMode: true, stage: options.stage },
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
      maxTokens,
      temperature,
      context: "dev-mode-generation",
      logSource: "dev-mode-generation",
      logMetadata: { devMode: true, stage: options.stage },
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
    max_completion_tokens: maxTokens,
    response_format: { type: "json_object" },
  };

  const timeoutMs =
    options.timeoutMs ??
    (config.length === "long" ? 360_000 : config.length === "medium" ? 240_000 : 180_000);
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
  const chapterCount = deriveChapterCount(input.config.length);
  const avatarNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
  const poolNames = (input.poolCharacters || []).map((c) => c.name);
  const stageLogs: DevModeStageLog[] = [];
  const providerResults: ProviderResult[] = [];
  const startedAt = Date.now();

  const runStage = async (
    stage: DevModePipelineStage,
    prompts: { systemPrompt: string; userPrompt: string },
    options: ProviderCallOptions
  ): Promise<{ provider: ProviderResult; parsed?: any; parseError?: string }> => {
    const stageStartedAt = Date.now();
    const logEntry: DevModeStageLog = {
      stage,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
    };
    stageLogs.push(logEntry);

    try {
      const provider = await callProvider(
        input.config,
        prompts.systemPrompt,
        prompts.userPrompt,
        { ...options, stage }
      );
      providerResults.push(provider);
      const parsedStage = parseStageObject(provider.content);

      logEntry.rawContent = provider.content;
      logEntry.parsed = parsedStage.parsed;
      logEntry.parseError = parsedStage.parseError;
      logEntry.usage = provider.usage;
      logEntry.modelUsed = provider.modelUsed;
      logEntry.durationMs = Date.now() - stageStartedAt;

      return { provider, ...parsedStage };
    } catch (err) {
      logEntry.error = err instanceof Error ? err.message : String(err);
      logEntry.durationMs = Date.now() - stageStartedAt;
      throw err;
    }
  };

  console.log("[dev-mode-generation] Dev mode four-stage pipeline", {
    chapterCount,
    ageGroup: input.config.ageGroup,
    genre: input.config.genre,
    setting: input.config.setting,
    avatarCount: avatarNames.length,
    avatarNames,
    poolCharacterCount: poolNames.length,
    poolCharacterNames: poolNames,
    aiModel: input.config.aiModel,
    aiProvider: input.config.aiProvider,
  });

  let finalParsed: DevModeRawStory | null = null;
  let finalModelUsed: string = input.config.aiModel || DEFAULT_GEMINI_MODEL;

  try {
    const blueprintPrompts = buildBlueprintPrompts(input, chapterCount);
    const blueprintStage = await runStage("blueprint", blueprintPrompts, {
      maxTokens: 7000,
      temperature: 0.55,
      timeoutMs: 90_000,
    });
    const blueprint = blueprintStage.parsed || {
      rawBlueprint: blueprintStage.provider.content,
      parseWarning: blueprintStage.parseError,
    };
    finalModelUsed = blueprintStage.provider.modelUsed;

    const critiquePrompts = buildCritiquePrompts(input, chapterCount, blueprint);
    const critiqueStage = await runStage("dramaturgy-check", critiquePrompts, {
      maxTokens: 7000,
      temperature: 0.35,
      timeoutMs: 90_000,
    });
    const critique = critiqueStage.parsed || {
      rawCritique: critiqueStage.provider.content,
      parseWarning: critiqueStage.parseError,
    };
    finalModelUsed = critiqueStage.provider.modelUsed;

    const storyPrompts = buildStoryDraftPrompts(input, chapterCount, blueprint, critique);
    const storyStage = await runStage("story-draft", storyPrompts, {
      maxTokens: input.config.length === "long" ? 28000 : 18000,
      temperature: 0.82,
      timeoutMs: input.config.length === "long" ? 300_000 : 210_000,
    });
    const draftParsed = parseAndValidate(storyStage.provider.content, chapterCount);
    finalModelUsed = storyStage.provider.modelUsed;

    const validationPrompts = buildValidationPrompts(input, chapterCount, draftParsed);
    const validationStage = await runStage("final-validation", validationPrompts, {
      maxTokens: input.config.length === "long" ? 30000 : 20000,
      temperature: 0.2,
      timeoutMs: input.config.length === "long" ? 240_000 : 150_000,
    });
    finalModelUsed = validationStage.provider.modelUsed;

    const candidate = validationStoryCandidate(validationStage.parsed);
    if (candidate) {
      try {
        finalParsed = parseAndValidate(JSON.stringify(candidate), chapterCount);
      } catch (validationParseError) {
        console.warn("[dev-mode-generation] Final validation story failed schema parse; using story draft.", validationParseError);
        finalParsed = draftParsed;
        const finalLog = stageLogs.find((stage) => stage.stage === "final-validation");
        if (finalLog) {
          finalLog.parseError = `Validated story rejected: ${
            validationParseError instanceof Error ? validationParseError.message : String(validationParseError)
          }`;
        }
      }
    } else {
      finalParsed = draftParsed;
      const finalLog = stageLogs.find((stage) => stage.stage === "final-validation");
      if (finalLog && !finalLog.parseError) {
        finalLog.parseError = "Validation response did not include a story object; using story draft.";
      }
    }
  } catch (pipelineError) {
    await publishWithTimeout(logTopic, {
      source: "dev-mode-generation",
      timestamp: new Date(),
      request: {
        mode: "developer",
        pipeline: "four-stage-quality",
        provider: input.config.aiProvider === "openrouter" ? "openrouter" : "native",
        model: input.config.aiModel,
        openRouterModel: input.config.openRouterModel,
        wizardConfig: {
          chapterCount,
          ageGroup: input.config.ageGroup,
          genre: input.config.genre,
          setting: input.config.setting,
          language: input.config.language,
          avatarNames,
          poolCharacterNames: poolNames,
          primaryProfileAge: input.primaryProfileAge,
          learningModeEnabled: !!input.config.learningMode?.enabled,
          learningModeSubjects: input.config.learningMode?.subjects,
          customPrompt: input.config.customPrompt,
        },
      },
      response: {
        error: pipelineError instanceof Error ? pipelineError.message : String(pipelineError),
        stages: stageLogs,
        durationMs: Date.now() - startedAt,
      },
      metadata: { devMode: true, pipeline: "four-stage-quality", stage: "failed", failed: true },
    }).catch((logErr) => {
      console.warn("[dev-mode-generation] Failed to publish failure log:", logErr);
    });
    throw pipelineError;
  }

  const parsed = finalParsed;
  if (!parsed) {
    throw new Error("Developer-mode four-stage pipeline did not produce a story.");
  }

  const totalUsage = usageSum(providerResults);

  await publishWithTimeout(logTopic, {
    source: "dev-mode-generation",
    timestamp: new Date(),
    request: {
      mode: "developer",
      pipeline: "four-stage-quality",
      provider: input.config.aiProvider === "openrouter" ? "openrouter" : "native",
      model: finalModelUsed,
      openRouterModel: input.config.openRouterModel,
      wizardConfig: {
        chapterCount,
        ageGroup: input.config.ageGroup,
        genre: input.config.genre,
        setting: input.config.setting,
        language: input.config.language,
        avatarNames,
        poolCharacterNames: poolNames,
        primaryProfileAge: input.primaryProfileAge,
        learningModeEnabled: !!input.config.learningMode?.enabled,
        learningModeSubjects: input.config.learningMode?.subjects,
        customPrompt: input.config.customPrompt,
      },
      stages: stageLogs.map((stage) => ({
        stage: stage.stage,
        systemPrompt: stage.systemPrompt,
        userPrompt: stage.userPrompt,
      })),
    },
    response: {
      stages: stageLogs.map((stage) => ({
        stage: stage.stage,
        rawContent: stage.rawContent,
        contentLength: stage.rawContent?.length ?? 0,
        parsed: stage.parsed,
        parseError: stage.parseError,
        usage: stage.usage,
        modelUsed: stage.modelUsed,
        durationMs: stage.durationMs,
      })),
      parsed: {
        title: parsed.title,
        description: parsed.description,
        chapterCount: parsed.chapters.length,
        chapters: parsed.chapters.map((c) => ({
          order: c.order,
          title: c.title,
          contentChars: c.content.length,
        })),
      },
      usage: totalUsage,
      durationMs: Date.now() - startedAt,
    },
    metadata: { devMode: true, pipeline: "four-stage-quality", stage: "complete" },
  }).catch((logErr) => {
    console.warn("[dev-mode-generation] Failed to publish success log:", logErr);
  });

  const chapters = parsed.chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((ch, idx) => ({
      id: crypto.randomUUID(),
      title: ch.title,
      content: ch.content,
      order: idx + 1,
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
        prompt: totalUsage.prompt,
        completion: totalUsage.completion,
        total: totalUsage.total,
        modelUsed: finalModelUsed,
      },
      model: finalModelUsed,
      imagesGenerated: 0,
      developerMode: true,
    },
  };
}

async function generateStoryDevModeLegacy(
  input: DevModeGenerationInput
): Promise<DevModeGeneratedStory> {
  const { systemPrompt, userPrompt, chapterCount } = buildPrompts(input);

  const avatarNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
  const poolNames = (input.poolCharacters || []).map((c) => c.name);

  console.log("[dev-mode-generation] 🧪 Dev mode prompt", {
    chapterCount,
    ageGroup: input.config.ageGroup,
    genre: input.config.genre,
    setting: input.config.setting,
    avatarCount: avatarNames.length,
    avatarNames,
    poolCharacterCount: poolNames.length,
    poolCharacterNames: poolNames,
    aiModel: input.config.aiModel,
    aiProvider: input.config.aiProvider,
    systemPromptChars: systemPrompt.length,
    userPromptChars: userPrompt.length,
  });

  const startedAt = Date.now();
  let provider: ProviderResult;
  try {
    provider = await callProvider(input.config, systemPrompt, userPrompt);
  } catch (callError) {
    // Persist the failed attempt so it shows up in /logs for debugging.
    await publishWithTimeout(logTopic, {
      source: "dev-mode-generation",
      timestamp: new Date(),
      request: {
        mode: "developer",
        provider: input.config.aiProvider === "openrouter" ? "openrouter" : "native",
        model: input.config.aiModel,
        openRouterModel: input.config.openRouterModel,
        systemPrompt,
        userPrompt,
        wizardConfig: {
          chapterCount,
          ageGroup: input.config.ageGroup,
          genre: input.config.genre,
          setting: input.config.setting,
          language: input.config.language,
          avatarNames,
          poolCharacterNames: poolNames,
          primaryProfileAge: input.primaryProfileAge,
          learningModeEnabled: !!input.config.learningMode?.enabled,
          learningModeSubjects: input.config.learningMode?.subjects,
          customPrompt: input.config.customPrompt,
        },
      },
      response: {
        error: callError instanceof Error ? callError.message : String(callError),
        durationMs: Date.now() - startedAt,
      },
      metadata: { devMode: true, stage: "provider-call", failed: true },
    }).catch((logErr) => {
      console.warn("[dev-mode-generation] Failed to publish failure log:", logErr);
    });
    throw callError;
  }

  let parsed: DevModeRawStory;
  try {
    parsed = parseAndValidate(provider.content, chapterCount);
  } catch (parseError) {
    // Log the raw model output even when parsing fails — this is exactly
    // what we need on /logs to diagnose JSON breakage.
    await publishWithTimeout(logTopic, {
      source: "dev-mode-generation",
      timestamp: new Date(),
      request: {
        mode: "developer",
        provider: input.config.aiProvider === "openrouter" ? "openrouter" : "native",
        model: provider.modelUsed,
        openRouterModel: input.config.openRouterModel,
        systemPrompt,
        userPrompt,
      },
      response: {
        rawContent: provider.content,
        contentLength: provider.content.length,
        usage: provider.usage,
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
        durationMs: Date.now() - startedAt,
      },
      metadata: { devMode: true, stage: "parse", failed: true },
    }).catch((logErr) => {
      console.warn("[dev-mode-generation] Failed to publish parse-failure log:", logErr);
    });
    throw parseError;
  }

  // Successful run — log input prompts + raw model output + parsed story.
  await publishWithTimeout(logTopic, {
    source: "dev-mode-generation",
    timestamp: new Date(),
    request: {
      mode: "developer",
      provider: input.config.aiProvider === "openrouter" ? "openrouter" : "native",
      model: provider.modelUsed,
      openRouterModel: input.config.openRouterModel,
      systemPrompt,
      userPrompt,
      wizardConfig: {
        chapterCount,
        ageGroup: input.config.ageGroup,
        genre: input.config.genre,
        setting: input.config.setting,
        language: input.config.language,
        avatarNames,
        poolCharacterNames: poolNames,
        primaryProfileAge: input.primaryProfileAge,
        learningModeEnabled: !!input.config.learningMode?.enabled,
        learningModeSubjects: input.config.learningMode?.subjects,
        customPrompt: input.config.customPrompt,
      },
    },
    response: {
      rawContent: provider.content,
      contentLength: provider.content.length,
      parsed: {
        title: parsed.title,
        description: parsed.description,
        chapterCount: parsed.chapters.length,
        chapters: parsed.chapters.map((c) => ({
          order: c.order,
          title: c.title,
          contentChars: c.content.length,
        })),
      },
      usage: provider.usage,
      durationMs: Date.now() - startedAt,
    },
    metadata: { devMode: true, stage: "complete" },
  }).catch((logErr) => {
    console.warn("[dev-mode-generation] Failed to publish success log:", logErr);
  });

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

// ─── Auto-cast supporting characters from character_pool ───────────────────
// Mirrors the *outcome* of the standard pipeline's casting-engine but stays
// fully synchronous and self-contained — no variant plan, no RNG seed, no
// artifact matching, no LLM calls. Just: filter by setting/age, prefer
// less-recently-used, return 2–4 candidates.

interface CharacterPoolRow {
  id: string;
  name: string;
  role: string | null;
  archetype: string | null;
  emotional_nature: any;
  visual_profile: any;
  age_category: string | null;
  species_category: string | null;
  personality_keywords: string[] | null;
  physical_description: string | null;
  backstory: string | null;
  catchphrase: string | null;
  speech_style: string[] | null;
  quirk: string | null;
  canon_settings: string[] | null;
  recent_usage_count: number | null;
  total_usage_count: number | null;
}

function ageGroupMaxAge(ageGroup?: string): number {
  switch (ageGroup) {
    case "3-5":
      return 5;
    case "6-8":
      return 8;
    case "9-12":
      return 12;
    case "13+":
      return 16;
    default:
      return 12;
  }
}

/**
 * Pick supporting characters for dev mode. Caller passes the wizard's
 * setting/genre/age and the set of hero avatar names to exclude.
 *
 * Selection strategy:
 *  1. Load all active pool characters.
 *  2. Score each by setting match (canon_settings overlap) + freshness
 *     (lower recent_usage_count is better) + diversity (try not to pick
 *     duplicate archetypes).
 *  3. Return top N, where N = 4 for ages ≤ 8, 6 for older, minus the
 *     hero count, clamped to [2, 5].
 */
export async function pickDevModePoolCharacters(input: {
  setting?: string;
  genre?: string;
  ageGroup?: string;
  excludeNames: Set<string>;
  heroCount: number;
}): Promise<DevModePoolCharacter[]> {
  let rows: CharacterPoolRow[] = [];
  try {
    rows = await storyDB.queryAll<CharacterPoolRow>`
      SELECT id, name, role, archetype, emotional_nature, visual_profile,
             age_category, species_category, personality_keywords,
             physical_description, backstory, catchphrase, speech_style,
             quirk, canon_settings, recent_usage_count, total_usage_count
      FROM character_pool
      WHERE is_active = TRUE
    `;
  } catch (err) {
    console.warn("[dev-mode-generation] Failed to load character_pool, continuing without supporting cast:", err);
    return [];
  }

  if (rows.length === 0) return [];

  const setting = (input.setting || "").trim().toLowerCase();
  const ageMax = ageGroupMaxAge(input.ageGroup);
  const maxGlobalChars = ageMax <= 5 ? 3 : ageMax <= 8 ? 4 : 6;
  const targetCount = Math.max(2, Math.min(5, maxGlobalChars - Math.max(1, input.heroCount)));

  const scored = rows
    .filter((r) => !input.excludeNames.has((r.name || "").toLowerCase()))
    .map((r) => {
      let score = 0;

      // Setting match — strong signal. canon_settings is text[].
      const canon = (r.canon_settings || []).map((s) => s.toLowerCase());
      if (setting.length > 0 && canon.length > 0) {
        if (canon.includes(setting)) score += 50;
        else if (canon.some((c) => c.includes(setting) || setting.includes(c))) score += 25;
      } else if (canon.length === 0) {
        // No canon_settings = universal character, small neutral score.
        score += 10;
      }

      // Freshness — prefer less-recently-used to rotate cast across stories.
      const recent = Number(r.recent_usage_count) || 0;
      score += Math.max(0, 20 - recent * 4);

      // Small noise so identical scores rotate naturally between generations.
      score += Math.random() * 5;

      return { row: r, score };
    })
    .sort((a, b) => b.score - a.score);

  // Diversity: when picking the top N, skip duplicates of an archetype we
  // already chose (unless we'd have to drop below targetCount).
  const picked: CharacterPoolRow[] = [];
  const seenArchetypes = new Set<string>();
  for (const candidate of scored) {
    if (picked.length >= targetCount) break;
    const arch = (candidate.row.archetype || "").toLowerCase();
    if (arch && seenArchetypes.has(arch)) continue;
    picked.push(candidate.row);
    if (arch) seenArchetypes.add(arch);
  }
  // If diversity filter left us short, top up from the rest.
  if (picked.length < targetCount) {
    for (const candidate of scored) {
      if (picked.length >= targetCount) break;
      if (picked.includes(candidate.row)) continue;
      picked.push(candidate.row);
    }
  }

  return picked.map((r) => {
    const vp = r.visual_profile;
    const physicalDescription =
      r.physical_description ||
      (vp && typeof vp === "object" ? (vp.description || vp.appearance || null) : null);

    return {
      id: r.id,
      name: r.name,
      role: r.role || undefined,
      archetype: r.archetype || undefined,
      species: r.species_category,
      ageCategory: r.age_category,
      physicalDescription,
      personalityKeywords: r.personality_keywords || [],
      catchphrase: r.catchphrase,
      speechStyle: r.speech_style || [],
      quirk: r.quirk,
      backstory: r.backstory,
    };
  });
}

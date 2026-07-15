/**
 * Dev-Mode Sanitizers & Local Validators (v11 Section 2, 7, 8)
 *
 * Pure functions that run BEFORE / AFTER the LLM stages of the
 * `whole-story-first-v11` pipeline. They:
 *
 *   - sanitize metadata-only wording out of `description` so generic
 *     genre adjectives ("warme, lustige Märchengeschichte") never trigger
 *     a hard novelty gate
 *   - auto-fix predictable German orthography artefacts that leaked from
 *     ASCII-transliterated pool data ("gross" -> "groß", "Fluegel" -> "Flügel")
 *   - detect grammar artefacts ("Ich Idee", "Der ist silberne") that need
 *     LLM repair, not local fix
 *   - detect a supporting helper directly explaining the magic rule / solution
 *
 * All functions are exported individually so the orchestrator can run them
 * at the four checkpoints defined in v11 §2:
 *   1) directly after idea selection
 *   2) after whole-story draft
 *   3) after story polish
 *   4) directly before final validation
 *
 * Image-side sanitizers live in `dev-mode-image-guards.ts` so a vision-team
 * change does not touch the text pipeline.
 */

// ---------------------------------------------------------------------------
// §2 Metadata sanitizer (description-only word stripping)
// ---------------------------------------------------------------------------

/**
 * Words that are pure metadata / genre wrapper and never load-bearing
 * story motifs. If they only appear in `description`, they must NEVER
 * trigger a hard novelty gate or a score-cap.
 *
 * Pattern format: word stems matched as whole words, case-insensitive,
 * with up to 4 trailing chars (so "Fantasiegeschichte", "Fantasiegeschichten"
 * both match). Adjectives that inflect get a trailing `\w{0,3}` automatically
 * via {@link stripMetadataWords}.
 */
const METADATA_WORD_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  // Generic genre wrappers — replace with neutral noun
  { pattern: /\bM(ä|ae)rchengeschichten?\b/gi, replacement: "Geschichte", label: "marchengeschichte" },
  { pattern: /\bFantasiegeschichten?\b/gi, replacement: "Geschichte", label: "fantasiegeschichte" },
  { pattern: /\bKindergeschichten?\b/gi, replacement: "Geschichte", label: "kindergeschichte" },
  { pattern: /\bGutenachtgeschichten?\b/gi, replacement: "Geschichte", label: "gutenachtgeschichte" },
  { pattern: /\bAbenteuergeschichten?\b/gi, replacement: "Abenteuer", label: "abenteuergeschichte" },
  // Generic adjectives that are decoration, not motif
  { pattern: /\bwarme[mnrs]?\b/gi, replacement: "", label: "warme" },
  { pattern: /\blustige[mnrs]?\b/gi, replacement: "", label: "lustige" },
  { pattern: /\bspannende[mnrs]?\b/gi, replacement: "", label: "spannende" },
  { pattern: /\bzauberhafte[mnrs]?\b/gi, replacement: "", label: "zauberhafte" },
  { pattern: /\bmagische[mnrs]?\b/gi, replacement: "", label: "magische" },
  { pattern: /\bherzerwärmende[mnrs]?\b/gi, replacement: "", label: "herzerwarmende" },
  { pattern: /\bwitzige[mnrs]?\b/gi, replacement: "", label: "witzige" },
  { pattern: /\bfröhliche[mnrs]?\b/gi, replacement: "", label: "frohliche" },
  { pattern: /\bschöne[mnrs]?\b/gi, replacement: "", label: "schone" },
  { pattern: /\bwundervolle[mnrs]?\b/gi, replacement: "", label: "wundervolle" },
];

export interface DescriptionSanitizeResult {
  description: string;
  changed: boolean;
  removed: string[];
}

/**
 * Strip metadata wrapper words from a description. Safe to run multiple times.
 * Whitespace and stray comma/space artefacts are cleaned up after stripping.
 *
 * @param description Raw description from the LLM
 * @returns Sanitized description + change log
 */
export function sanitizeDescription(description: string): DescriptionSanitizeResult {
  if (!description) return { description: "", changed: false, removed: [] };

  const removed: string[] = [];
  let cleaned = description;

  for (const { pattern, replacement, label } of METADATA_WORD_REPLACEMENTS) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, replacement);
    if (cleaned !== before) removed.push(label);
  }

  cleaned = cleaned
    .replace(/\b(Eine|Ein|Einen),\s+/g, "$1 ")
    .replace(/\s*,\s*,/g, ",")
    .replace(/,\s*(\.|!|\?)/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
    .replace(/^,\s*/, "")
    .replace(/\s*,\s*$/, "");

  return {
    description: cleaned,
    changed: cleaned !== description,
    removed: [...new Set(removed)],
  };
}

export interface StoryHeaderSanitizeResult {
  text: string;
  changed: boolean;
  fixes: string[];
}

/**
 * Keeps user-facing story headers printable and renderer-safe. In particular,
 * generated emoji and broken JSON wrappers must never become visible content.
 */
export function sanitizeStoryHeaderText(value: string): StoryHeaderSanitizeResult {
  const source = String(value || "");
  if (!source) return { text: "", changed: false, fixes: [] };

  const fixes: string[] = [];
  let cleaned = source.trim();
  const withoutFences = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  if (withoutFences !== cleaned) fixes.push("header-code-fence");
  cleaned = withoutFences;

  if (/^\s*\{/.test(cleaned)) {
    try {
      const parsed = JSON.parse(cleaned);
      const extracted = parsed?.title ?? parsed?.description;
      if (typeof extracted === "string" && extracted.trim()) {
        cleaned = extracted.trim();
        fixes.push("header-json-wrapper");
      }
    } catch {
      // The serialization gate handles malformed JSON; keep only safe text here.
    }
  }

  const withoutEmoji = cleaned.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, " ");
  if (withoutEmoji !== cleaned) fixes.push("header-emoji");
  const withoutMojibakeSuffix = withoutEmoji.replace(/\s+(?:\u00D8\S*|(?:\u00C3.|\u00C2.|\u00E2\S*)+|\uFFFD+)\s*$/u, "");
  if (withoutMojibakeSuffix !== withoutEmoji) fixes.push("header-mojibake");
  cleaned = withoutMojibakeSuffix
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/^\s*["']|["']\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    text: cleaned,
    changed: cleaned !== source,
    fixes: [...new Set(fixes)],
  };
}

// ---------------------------------------------------------------------------
// §2 helper: classify a single hard-issue string by severity tier
// ---------------------------------------------------------------------------

/**
 * Novelty hits get re-classified into match levels so the orchestrator can
 * decide whether to hard-fail, sanitize, or ignore.
 *
 * The spec (v11 §2) distinguishes 10 levels; we collapse to 3 actionable
 * buckets for the current pipeline. Subcategorizing further is only useful
 * once the long-term motif memory (§3) lands.
 */
export type NoveltyMatchLevel = "core_motif" | "supporting_match" | "metadata_only";

/**
 * Heuristic classifier for a hard-novelty issue string. We use the exact
 * issue text emitted by {@link collectNoveltyGateIssues} in
 * `dev-mode-generation.ts` plus the current story to decide.
 *
 * Rule of thumb:
 *  - If the motif only appears in `description` and never in any chapter
 *    title or paragraph, it is metadata.
 *  - If it appears in a chapter title or repeatedly in the body, it is
 *    a core motif.
 *  - Otherwise: supporting match (single body mention).
 */
export function classifyNoveltyHit(
  motif: string,
  description: string,
  chapterTitles: string[],
  chapterContents: string[],
): NoveltyMatchLevel {
  const norm = (value: string): string =>
    String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss");

  const motifN = norm(motif);
  if (!motifN || motifN.length < 4) return "metadata_only";

  const inDesc = norm(description).includes(motifN);
  const inTitles = chapterTitles.some((t) => norm(t).includes(motifN));
  let bodyHits = 0;
  for (const c of chapterContents) {
    const lower = norm(c);
    let idx = 0;
    while ((idx = lower.indexOf(motifN, idx)) !== -1) {
      bodyHits += 1;
      idx += motifN.length;
    }
  }

  if (inTitles || bodyHits >= 2) return "core_motif";
  if (bodyHits === 1) return "supporting_match";
  if (inDesc) return "metadata_only";
  return "supporting_match";
}

// ---------------------------------------------------------------------------
// §8 Orthography auto-fix (ASCII transliteration in pool data leaks)
// ---------------------------------------------------------------------------

const ORTHOGRAPHY_AUTOFIX: Array<[RegExp, string, string]> = [
  // Umlaut transliteration (only when adjacent letters confirm German word)
  [/\bFluegel\b/g, "Flügel", "Fluegel"],
  [/\bFluegelschlag\b/g, "Flügelschlag", "Fluegelschlag"],
  [/\bFluegeln\b/g, "Flügeln", "Fluegeln"],
  [/\bZauberstaebe\b/g, "Zauberstäbe", "Zauberstaebe"],
  [/\bZauberstaeben\b/g, "Zauberstäben", "Zauberstaeben"],
  [/\bBluetenkranz\b/g, "Blütenkranz", "Bluetenkranz"],
  [/\bBluetenkraenze\b/g, "Blütenkränze", "Bluetenkraenze"],
  [/\bGeraeusche\b/g, "Geräusche", "Geraeusche"],
  [/\bGeraeuschen\b/g, "Geräuschen", "Geraeuschen"],
  [/\bGloeckchen\b/g, "Glöckchen", "Gloeckchen"],
  // Sharp s
  [/\bgross\b/g, "groß", "gross"],
  [/\bgroesser\b/g, "größer", "groesser"],
  [/\bgroesste[mnrs]?\b/g, "größte", "groesste"],
  [/\bhoeher\b/g, "höher", "hoeher"],
  [/\bhoeher\s/g, "höher ", "hoeher"],
  [/\bSpass\b/g, "Spaß", "Spass"],
  [/\bweiss\b/g, "weiß", "weiss"],
  // Common ae/oe/ue inside words that almost-never have a non-umlaut variant
  [/\bschoen(e[mnrs]?)?\b/g, (_m: string, infl: string = "") => `schön${infl}`, "schoen"] as unknown as [RegExp, string, string],
  [/\bFestklemmt\b/g, "Klemmt fest", "Festklemmt"],
  [/\bwuetend\b/g, "wütend", "wuetend"],
];

export interface OrthographyFixResult {
  text: string;
  changed: boolean;
  fixes: string[];
}

/**
 * Apply safe orthography fixes that NEVER change meaning. Use after each
 * text-producing LLM stage. The list is intentionally narrow — we only fix
 * ASCII-transliterations and a small handful of `ss/ß` swaps where the
 * non-`ß` form is wrong post-2006 reform for these specific tokens.
 */
export function applyOrthographyAutoFix(text: string): OrthographyFixResult {
  if (!text) return { text: "", changed: false, fixes: [] };
  let out = text;
  const fixes: string[] = [];
  for (const [pattern, replacement, label] of ORTHOGRAPHY_AUTOFIX) {
    const before = out;
    out = out.replace(pattern, replacement as string);
    if (out !== before) fixes.push(label);
  }
  return { text: out, changed: out !== text, fixes: [...new Set(fixes)] };
}

export interface DialoguePunctuationFixResult {
  text: string;
  changed: boolean;
  fixes: string[];
}

/** Repairs only high-confidence German direct-speech punctuation errors. */
export function applyGermanDialoguePunctuationAutoFix(text: string): DialoguePunctuationFixResult {
  if (!text) return { text: "", changed: false, fixes: [] };
  const fixes: string[] = [];
  let out = text;
  const reportingVerb =
    "(?:sagte|rief|fragte|fl\u00FCsterte|fluesterte|murmelte|hauchte|wisperte|keuchte|antwortete|erwiderte|widersprach|beharrte|meinte|erkl\u00E4rte|erklaerte|warnte|versprach)";

  const commaAfterExclamation = new RegExp(`([!?])\u201C\\s+(${reportingVerb})\\b`, "giu");
  const withComma = out.replace(commaAfterExclamation, "$1\u201C, $2");
  if (withComma !== out) {
    out = withComma;
    fixes.push("german-dialogue-tag-comma");
  }

  const periodBeforeReporting = new RegExp(`\\.\u201C\\s*,?\\s*(${reportingVerb})\\b`, "giu");
  const withoutInnerPeriod = out.replace(periodBeforeReporting, "\u201C, $1");
  if (withoutInnerPeriod !== out) {
    out = withoutInnerPeriod;
    fixes.push("german-dialogue-tag-period");
  }

  const actionVerb =
    "(grinste|lachte|nickte|zog|winkte|sch\u00FCttelte|schuettelte|zuckte|stolperte|zeigte|deutete|lief|rannte|sprang)";
  const actionClause = new RegExp(
    `([.!?])\u201C\\s+${actionVerb}\\s+([A-Z\u00C4\u00D6\u00DC][\\p{L}\x27\u2019-]*)`,
    "gu",
  );
  const reordered = out.replace(actionClause, (_match, punctuation, verb, subject) =>
    `${punctuation}\u201C ${subject} ${verb}`
  );
  if (reordered !== out) {
    out = reordered;
    fixes.push("german-dialogue-action-clause");
  }

  return { text: out, changed: out !== text, fixes: [...new Set(fixes)] };
}


// ---------------------------------------------------------------------------
// §8 Grammar hard-fail patterns (need LLM repair, NOT auto-fix)
// ---------------------------------------------------------------------------

const GRAMMAR_HARD_FAIL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // "Ich Idee" — missing verb between subject and noun
  { pattern: /\bIch\s+(Idee|Plan|Frage|Antwort)\b/i, reason: "Ich + Substantiv ohne Verb" },
  // Common English narrative verbs must never leak into German prose.
  { pattern: /\b(crunched|whispered|muttered|shouted|stared|looked|smiled|walked|jumped|nodded|shrugged|gasped)\b/i, reason: "englisches Erzählverb im deutschen Storytext" },
  // "Der ist silberne" — adjective in wrong position with article.
  // Keep this deliberately narrow; broad "\w+e" patterns misclassify valid
  // openings such as "Das ist wie ..." or "Der ist hier ...".
  { pattern: /\b(Der|Die|Das)\s+ist\s+(?:silberne[rn]?|goldene[rn]?|kleine[rn]?|gro(?:ss|ß)e[rn]?|schoene[rn]?|schöne[rn]?|rote[rn]?|blaue[rn]?|gruene[rn]?|grüne[rn]?|runde[rn]?|lange[rn]?|warme[rn]?|kalte[rn]?|neue[rn]?|alte[rn]?|leise[rn]?|laute[rn]?|schwere[rn]?|leichte[rn]?)\b/i, reason: "Artikel + ist + Adjektiv-Endung" },
  // "Sie ist silberne" with adjective ending requiring article
  { pattern: /\b(Sie|Er|Es)\s+ist\s+silberne[rns]?\b/i, reason: "Pronomen + ist + Adjektiv mit falscher Endung" },
];

export function detectRepeatedSceneCardFields(
  sceneCards: Array<Record<string, unknown>>,
  fields: string[] = ["visibleGoal", "obstacle", "wrongAction", "visibleConsequence", "endPull"],
): string[] {
  if (!Array.isArray(sceneCards) || sceneCards.length < 3) return [];
  const normalize = (value: unknown): string => String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const threshold = Math.max(3, Math.ceil(sceneCards.length * 0.6));
  const issues: string[] = [];
  for (const field of fields) {
    const counts = new Map<string, number>();
    for (const card of sceneCards) {
      const value = normalize(card?.[field]);
      if (value.length < 18) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    const repeated = Math.max(0, ...counts.values());
    if (repeated >= threshold) {
      issues.push(`sceneCards.${field} repeats verbatim across ${repeated}/${sceneCards.length} scenes`);
    }
  }
  return issues;
}

/**
 * Replaces only scene-card fields that the repetition gate identifies.
 * The caller supplies story-specific values so the repair remains generic and
 * deterministic without spending another model call.
 */
export function diversifyRepeatedSceneCardFields(
  sceneCards: Array<Record<string, any>>,
  replacementsByField: Record<string, string[]>,
): { sceneCards: Array<Record<string, any>>; changed: boolean; fields: string[] } {
  const repeatedFields = detectRepeatedSceneCardFields(sceneCards)
    .map((issue) => issue.match(/^sceneCards\.([^.\s]+)/)?.[1])
    .filter((field): field is string => Boolean(field));
  if (repeatedFields.length === 0) {
    return { sceneCards, changed: false, fields: [] };
  }

  const repaired = sceneCards.map((card) => ({ ...card }));
  const repairedFields: string[] = [];
  for (const field of repeatedFields) {
    const replacements = replacementsByField[field] || [];
    if (replacements.length < repaired.length || replacements.some((value) => !String(value || "").trim())) {
      continue;
    }
    const previousValues = repaired.map((card) => card[field]);
    repaired.forEach((card, index) => {
      card[field] = String(replacements[index]).trim();
    });
    const stillRepeated = detectRepeatedSceneCardFields(repaired, [field]).length > 0;
    if (stillRepeated) {
      repaired.forEach((card, index) => { card[field] = previousValues[index]; });
      continue;
    }
    repairedFields.push(field);
  }

  return {
    sceneCards: repaired,
    changed: repairedFields.length > 0,
    fields: repairedFields,
  };
}

export interface GrammarValidationResult {
  hardIssues: string[];
  matched: Array<{ pattern: string; reason: string; sample: string }>;
}

/**
 * Detect grammar artefacts that mean the LLM produced broken German. These
 * issues require a targeted LLM repair (we cannot auto-fix semantics) and
 * should appear as hard issues in the diagnostics.
 */
export function validateGermanGrammar(text: string): GrammarValidationResult {
  if (!text) return { hardIssues: [], matched: [] };
  const issues: string[] = [];
  const matched: Array<{ pattern: string; reason: string; sample: string }> = [];
  for (const { pattern, reason } of GRAMMAR_HARD_FAIL_PATTERNS) {
    const hit = text.match(pattern);
    if (hit) {
      const sample = hit[0];
      issues.push(`Grammatik-Fehler erkannt (${reason}): "${sample}".`);
      matched.push({ pattern: pattern.source, reason, sample });
    }
  }
  return { hardIssues: issues, matched };
}

// ---------------------------------------------------------------------------
// §7 Helper-explains-solution detector
// ---------------------------------------------------------------------------

/**
 * Heuristic: a pool/helper character "explains the solution" when their
 * dialogue contains both an explicit rule statement *and* an imperative
 * how-to. We score this as a soft issue (cap 8.2 per spec) rather than a
 * hard fail, because some helpers must reveal the wonder rule for the kids
 * to act — but they may not also hand over the fix.
 *
 * Detection looks for a span of helper-attributed dialogue (named line:
 * `Rosalie sagte`, `flüsterte Rosalie`, or a direct quote in a paragraph
 * starting with the helper name).
 *
 * @param chapterContent  Full chapter text including dialogue tags
 * @param helperNames     Names of pool/supporting cast as written in the story
 */
export interface HelperExplainsResult {
  triggered: boolean;
  helper?: string;
  evidence?: string;
}

const SOLUTION_KEYWORDS_DE = [
  /\bschaut?\s+durch\b/i,
  /\bnehmt?\b/i,
  /\bdreht?\b.{0,12}(linse|spiegel|schluessel|key|tool|werkzeug)/i,
  /\bdann\s+seht?\s+ihr\b/i,
  /\bso\s+(funktioniert|geht|loest)\b/i,
  /\bwenn\s+ihr\s+\w+,\s+dann\b/i,
  /\bder\s+trick\s+ist\b/i,
  /\bdie\s+loesung\s+ist\b/i,
  /\bnur\s+wer\b.{0,30}\b(kann|darf|wird)\b/i,
];

const RULE_KEYWORDS_DE = [
  // "Wer ... nimmt, wird klein" — universal conditional with arbitrary middle
  /\bwer\s+[\s\S]{0,80}?,\s*(der|die|wird|kann|muss)\b/i,
  /\bman\s+(muss|darf\s+nicht|kann\s+nur)\b/i,
  /\bdie\s+regel\s+ist\b/i,
  // "wenn ... dann ..." conditional rule structures
  /\bwenn\s+[\s\S]{0,60}?,\s*(dann|wird|kann|muss)\b/i,
  // "Die Uhr kann wachsen lassen, doch sie kann auch erschöpfen" — helper
  // explains the magic object's operating rule instead of letting children
  // infer it from repeated physical consequences.
  /\b(der|die|das)\s+[\p{L}]+\s+kann\b[\s\S]{0,90}\b(doch|aber|nur|auch|nimmt|kostet|verliert|ersch[oö]pft|ersch[oö]pfen|erschoepft|erschoepfen)\b/iu,
];

const HELPER_RULE_DUMP_DE = /\b(regel|magie|zauber|uhr|spieluhr|ding|gegenstand)\b[\s\S]{0,100}\b(kann|nimmt|kostet|verliert|ersch[oö]pft|ersch[oö]pfen|erschoepft|erschoepfen|mag\s+keine|will\s+nicht)\b/iu;

export function detectHelperExplainsSolution(
  chapterContent: string,
  helperNames: string[],
): HelperExplainsResult {
  if (!chapterContent || helperNames.length === 0) return { triggered: false };

  const paragraphs = chapterContent.split(/\n\s*\n/);
  for (const para of paragraphs) {
    const lower = para.toLowerCase();
    const helperHit = helperNames.find((name) => name && lower.includes(name.toLowerCase()));
    if (!helperHit) continue;

    // Extract quoted dialogue (German „..." or "...")
    const dialogueMatches = para.match(/[„"]([^"„"]+)["”"]/g) || [];
    if (dialogueMatches.length === 0) continue;

    for (const dialogue of dialogueMatches) {
      const hasRule = RULE_KEYWORDS_DE.some((re) => re.test(dialogue));
      const hasSolution = SOLUTION_KEYWORDS_DE.some((re) => re.test(dialogue));
      const hasRuleDump = hasRule && HELPER_RULE_DUMP_DE.test(dialogue);
      if ((hasRule && hasSolution) || hasRuleDump) {
        return {
          triggered: true,
          helper: helperHit,
          evidence: dialogue.length > 120 ? `${dialogue.slice(0, 117)}...` : dialogue,
        };
      }
    }
  }

  return { triggered: false };
}

// ---------------------------------------------------------------------------
// §6 Structure score-cap inputs
// ---------------------------------------------------------------------------

/**
 * Light structural detector: does the story have a visible "irreversible
 * middle"? We look at the middle chapter(s) for either an explicit
 * physical change ("schrumpfte", "verlor", "zerbrach") or a costly
 * commitment ("opferte", "gab her", "verschenkte", "liess los"). Without
 * one, structure score caps at 8.3.
 *
 * Mid-chapter heuristic: chapter 3 of a 5-chapter story, or chapters
 * 3-4 of a 7+-chapter story. For 3-chapter stories the irreversible
 * middle is chapter 2.
 */
export interface StructureSignals {
  hasIrreversibleMiddle: boolean;
  hasPersonalSacrifice: boolean;
  finaleEndsInImage: boolean;
}

const IRREVERSIBLE_KEYWORDS = [
  "schrumpf", "schrumpfte", "winzig", "zerbrach", "verlor", "verschwand",
  "fiel", "stürzte", "stuerzte", "riss", "kaputt", "zersprang", "irreversib",
  "feststeck", "steckte fest", "steckt fest", "festgewachsen", "verschmolz",
  "verschmilzt", "versteinert", "verankert", "einsinkt", "einsank",
  "sank ein", "verwuchs", "bleiern", "klemmt", "klemmte",
];

const IRREVERSIBLE_PATTERN = /\b(?:steck\w*\s+fest|blieb\w*\s+fest|feststeck\w*|festgewachsen|verwuchs\w*|verschm(?:o|ö)lz\w*|verschmilz\w*|versteinert\w*|verankert\w*|eins(?:a|ä)nk\w*|sank\s+ein|einsink\w*|bleiern\w*|klemm(?:t|te|en)\w*)\b/i;

const SACRIFICE_KEYWORDS = [
  "opferte", "gab", "schenkte", "verschenkte", "ließ los", "liess los",
  "gab her", "gebe her", "gibt her", "geben her", "gib her", "hergeben",
  "hergegeben", "trennte sich", "gab ihn", "gab sie", "gebe ihn", "gebe sie",
  "verzichtete", "verzichte", "letztes stück", "letztes stueck", "letzte reserve",
  "gehört jetzt euch", "gehoert jetzt euch", "für euch", "fuer euch",
  // Resource-consumption sacrifice: the child consciously spends the last of
  // a loved/needed resource on someone else (log b9994e62: Adrian uses the
  // final chalk stub for Rosalie's bridge — "Sie braucht es dringender" — and
  // the detector reported no sacrifice, wrongly blocking the premium gate).
  "letzten rest", "letzter rest", "braucht es dringender",
  "braucht ihn dringender", "braucht sie dringender",
];

const SACRIFICE_PATTERN = /\b(?:gab|gebe|gibt|geben|gib)\b.{0,48}\b(?:her|weg|ab|euch|dir|ihm|ihr)\b|\b(?:hergeben|hergegeben|verschenk\w*|schenk\w*|opfer\w*|verzicht\w*)\b|\b(?:letztes\s+(?:stueck|stück)|letzte\s+reserve|geh(?:oe|ö)rt\s+jetzt\s+euch|f(?:ue|ü)r\s+euch)\b|\bbrauchs?t\s+(?:es|ihn|sie|das|den|die)\s+(?:dringender|n(?:oe|ö)tiger|mehr\s+als\s+ich)\b|\bletzte[rn]?\s+rest\b|\b(?:dann\s+)?komme?\s+ich\s+nicht\s+(?:r(?:ue|ü)ber|mit|hinauf|hin(?:ue|ü)ber)\b/i;

// Placement-style sacrifice (run a75b53af "Das Labyrinth der zwei Wege":
// "Dann legte er den Kompass in den Spalt. […] Aber der Kompass war fort."
// — the child wedges/leaves a loved object behind to hold the world
// together; no give/gift/sacrifice verb appears, so the detector reported
// "kein persönlicher Einsatz" and wrongly capped the premium score at 8.4).
// Both signals must appear in the SAME chapter window to stay precise:
// a placement verb with a container preposition AND an explicit loss
// confirmation.
const SACRIFICE_PLACEMENT_PATTERN = /\b(?:legte|steckte|stopfte|schob|klemmte)\b.{0,80}\b(?:in|zwischen|unter)\b/i;
const SACRIFICE_LOSS_CONFIRMATION_PATTERN = /\b(?:war|ist|blieb)\s+(?:fort|weg|verloren)\b|\bleere[nr]?\s+hand\b|\bnie\s+wieder\b|\bkam\s+nicht\s+(?:wieder|zur(?:ue|ü)ck)\b/i;

// Throw-away sacrifice (run 3db9b3b0 "Bibliothek der beinahe ausgesprochenen
// Geheimnisse": "Dann warf er den Notizblock. Weit in die Dunkelheit." — the
// child hurls a beloved object away to distract the threat; no give/place
// verb, so the detector missed it and capped the score at 7.8).
const SACRIFICE_THROW_PATTERN = /\b(?:warf|wirft|schleuderte|schmiss)\b.{0,60}\b(?:weg|fort|in\s+die\s+(?:dunkelheit|tiefe|nacht|ferne)|hinein|hinaus|davon)\b/i;

// Destruction sacrifice (run 67d63377 "Die Stiefel, die den mutigen Schritt
// verlangten": Adrian pries the magic boots that gave him every power off his
// own feet — "Die Stiefel brachen auf. […] Sie fielen zu Boden. Grau. Leblos."
// — consciously destroying a loved/powerful object to regain himself. No
// give/throw/place verb, so the detector reported no sacrifice and capped the
// otherwise strong story at 8.4). A destruction verb plus a confirmation that
// the object is now broken/dead/left behind, in the same chapter window.
const SACRIFICE_DESTROY_PATTERN = /\b(?:brach\w*\s+auf|zerbrach\w*|zerriss\w*|zerst(?:ö|oe)rte\w*|riss\b.{0,30}\b(?:ab|auf|los)|stemmte\s+sich\s+dagegen|drückte\s+.{0,30}\b(?:zwischen|gegen))\b/i;
const SACRIFICE_DESTROY_CONFIRMATION_PATTERN = /\b(?:fielen?\s+(?:zu\s+boden|ab)|leblos|zerbrochen|kaputt|in\s+st(?:ü|ue)cke|grau\s+und\s+spr(?:ö|oe)de|spr(?:ö|oe)de|barfu(?:ß|ss))\b/i;

// Submersion/relinquish sacrifice (run a611384d "Die Karte der steinigen
// Schritte": "Alexander ließ die Karte sinken. In die Pfütze […] Sie
// blubberte auf. Versank." — the child deliberately lets a beloved object
// sink/go under; no give/place/throw/destroy verb matched, so the detector
// reported "kein persönlicher Einsatz", the premium score was capped
// 8.8→8.4 and two chapter-repair rounds chased a sacrifice that was already
// on the page). Body-part idioms ("ließ den Kopf sinken") are excluded, and
// a loss confirmation must appear in the same chapter window.
const SACRIFICE_RELEASE_PATTERN = /\blie(?:ß|ss)\s+(?!den\s+kopf|die\s+h(?:a|ä)nde?|die\s+arme|die\s+schultern|die\s+stimme|den\s+blick|die\s+mundwinkel)(?:\w+\s+){0,4}?(?:sinken|fallen|zur(?:ue|ü)ck)\b|\bversenkte?\w*\b/i;
const SACRIFICE_RELEASE_CONFIRMATION_PATTERN = /\b(?:versank\w*|versunken|ging\s+unter|blubberte|unbrauchbar|war\s+(?:fort|weg|verloren)|blieb\s+(?:fort|unten|verschwunden)|nie\s+wieder)\b/i;

const IMAGE_FINALE_HINTS = [
  // Ends in a concrete sensory image rather than a moral statement
  "ping", "tickte", "schnurrte", "atmete", "leuchtete", "knirschte", "summte",
  "blieb stehen", "öffnete sich", "oeffnete sich", "schloss sich",
  // Light / reflection images (a very common picture-book closing beat)
  "spiegelte", "glänzte", "glaenzte", "glitzerte", "schimmerte", "funkelte",
  "blinkte", "strahlte", "sonne", "licht", "schein",
  // Sound / onomatopoeia closings (the Gruffalo-style acoustic anchor):
  // a finale that fades on a repeated/transformed sound is an image, not a moral.
  "klong", "kling", "klingen", "klingern", "klingelte", "klirrte", "plopp",
  "klimperte", "raschelte", "flüsterte", "fluesterte", "wisperte", "pochte",
  // Touch / warmth / quiet closings
  "wurde warm", "wurde leicht", "lag offen", "lag still", "wurde still",
];

const MORAL_FINALE_HINTS = [
  /sie\s+lernten/i,
  /das\s+(g)?roesste\s+geschenk/i,
  /das\s+groesste\s+geschenk/i,
  /wahre\s+magie\s+liegt/i,
  /freundschaft\s+ist\s+/i,
  /mut\s+ist\s+/i,
];

export function detectStructureSignals(
  chapters: Array<{ order: number; title: string; content: string }>,
): StructureSignals {
  if (chapters.length === 0) {
    return { hasIrreversibleMiddle: false, hasPersonalSacrifice: false, finaleEndsInImage: false };
  }

  const sorted = chapters.slice().sort((a, b) => a.order - b.order);
  const mid = sorted.length >= 5
    ? [sorted[Math.floor(sorted.length / 2) - 1], sorted[Math.floor(sorted.length / 2)]]
    : [sorted[Math.floor(sorted.length / 2)]];

  const midContent = mid.filter(Boolean).map((c) => c.content.toLowerCase()).join(" ");
  const hasIrreversibleMiddle = IRREVERSIBLE_PATTERN.test(midContent)
    || IRREVERSIBLE_KEYWORDS.some((kw) => midContent.includes(kw));
  const sacrificeIn = (text: string) => {
    const lower = text.toLowerCase();
    return SACRIFICE_PATTERN.test(lower)
      || SACRIFICE_KEYWORDS.some((kw) => lower.includes(kw))
      || (SACRIFICE_PLACEMENT_PATTERN.test(lower) && SACRIFICE_LOSS_CONFIRMATION_PATTERN.test(lower))
      || SACRIFICE_THROW_PATTERN.test(lower)
      || (SACRIFICE_DESTROY_PATTERN.test(lower) && SACRIFICE_DESTROY_CONFIRMATION_PATTERN.test(lower))
      || (SACRIFICE_RELEASE_PATTERN.test(lower) && SACRIFICE_RELEASE_CONFIRMATION_PATTERN.test(lower));
  };
  const hasPersonalSacrifice = sacrificeIn(midContent)
    || sorted.slice(-2).some((c) => sacrificeIn(c.content));

  const finalChapter = sorted[sorted.length - 1];
  const finalTail = finalChapter.content
    .split(/\n\s*\n/)
    .slice(-2)
    .join(" ")
    .toLowerCase();
  const endsInMoral = MORAL_FINALE_HINTS.some((re) => re.test(finalTail));
  const endsInImage = !endsInMoral && IMAGE_FINALE_HINTS.some((kw) => finalTail.includes(kw));

  return {
    hasIrreversibleMiddle,
    hasPersonalSacrifice,
    finaleEndsInImage: endsInImage,
  };
}

// ---------------------------------------------------------------------------
// Chapter-seam duplicate guard
// ---------------------------------------------------------------------------

export interface ChapterSeamDuplicate {
  previousOrder: number;
  order: number;
  sentences: string[];
}

/**
 * Chapter-repair rewrites one page in isolation and occasionally re-narrates
 * the previous page's closing beat verbatim (run 4c0e2169 "Der Turm der
 * zögernden Zahnräder": "Die Zahnräder drehten sich schneller. […] Wie ein
 * langsamer Walzer." ends reading page 4 AND opens page 5). A printed book
 * never repeats its sentences across a page turn.
 *
 * Flags a seam when 2+ distinct sentences of 4+ words from the tail of one
 * chapter reappear verbatim in the head of the next. Short lines are ignored
 * so intentional refrains ("Nicht hektisch.") never trigger, and a single
 * repeated sentence is tolerated as a stylistic echo.
 */
export function detectChapterSeamDuplicates(
  chapters: Array<{ order: number; content: string }>,
): ChapterSeamDuplicate[] {
  const sorted = chapters.slice().sort((a, b) => a.order - b.order);
  const results: ChapterSeamDuplicate[] = [];
  const normalize = (s: string) => s
    .toLowerCase()
    .replace(/["„“”»«'‚‘’\s]+/g, " ")
    .trim();
  const sentencesOf = (text: string) => String(text || "")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    const tailSentences = new Set(
      sentencesOf(String(prev.content || "").slice(-400))
        .map(normalize)
        .filter((s) => s.split(" ").length >= 4)
    );
    if (tailSentences.size === 0) continue;
    const duplicated: string[] = [];
    const seen = new Set<string>();
    for (const sentence of sentencesOf(String(next.content || "").slice(0, 400))) {
      const norm = normalize(sentence);
      if (norm.split(" ").length < 4) continue;
      if (tailSentences.has(norm) && !seen.has(norm)) {
        seen.add(norm);
        duplicated.push(sentence);
      }
    }
    if (duplicated.length >= 2) {
      results.push({ previousOrder: prev.order, order: next.order, sentences: duplicated.slice(0, 3) });
    }
  }
  return results;
}
// ---------------------------------------------------------------------------
// Last-mile serialization integrity gate
// ---------------------------------------------------------------------------

export interface StorySerializationArtifactResult {
  detected: boolean;
  issues: string[];
  samples: string[];
}

/**
 * Detect JSON/object envelopes that have leaked into user-facing story prose.
 *
 * This deliberately does not attempt to "clean" the text. Once structural
 * fields such as title/description/paragraphs are interleaved with prose, a
 * local cleanup can silently lose or reorder narrative content. The safe
 * behavior is to reject the payload and retry the writer stage.
 */
export function detectStorySerializationArtifacts(story: {
  title?: string | null;
  description?: string | null;
  chapters?: Array<{ title?: string | null; content?: string | null }> | null;
}): StorySerializationArtifactResult {
  const fields: Array<{ label: string; value: string }> = [
    { label: "title", value: String(story.title || "") },
    { label: "description", value: String(story.description || "") },
    ...((story.chapters || []).flatMap((chapter, index) => [
      { label: `chapter[${index + 1}].title`, value: String(chapter.title || "") },
      { label: `chapter[${index + 1}].content`, value: String(chapter.content || "") },
    ])),
  ];

  const patterns: Array<{ label: string; pattern: RegExp }> = [
    {
      label: "JSON story envelope",
      pattern: /(?:^|\n)\s*\{\s*["„“]?(?:title|description|chapters|paragraphs|storyText)["„“]?\s*:/i,
    },
    {
      label: "serialized story field",
      pattern: /["„“](?:title|description|chapters|paragraphs|content|order)["„“]\s*:\s*(?:["„“]|\[|\{|\d)/i,
    },
    {
      label: "paragraph array syntax",
      pattern: /["„“]?paragraphs["„“]?\s*:\s*\[/i,
    },
    {
      label: "chapter object syntax",
      pattern: /\}\s*,\s*\{\s*["„“]?(?:title|order|content|paragraphs)["„“]?\s*:/i,
    },
  ];

  const issues: string[] = [];
  const samples: string[] = [];
  for (const field of fields) {
    for (const detector of patterns) {
      const match = field.value.match(detector.pattern);
      if (!match) continue;
      issues.push(`${detector.label} in ${field.label}`);
      const start = Math.max(0, (match.index || 0) - 30);
      samples.push(field.value.slice(start, start + 150).replace(/\s+/g, " ").trim());
      break;
    }
  }

  return {
    detected: issues.length > 0,
    issues: [...new Set(issues)],
    samples: [...new Set(samples)].slice(0, 4),
  };
}

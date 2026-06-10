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

// ---------------------------------------------------------------------------
// §8 Grammar hard-fail patterns (need LLM repair, NOT auto-fix)
// ---------------------------------------------------------------------------

const GRAMMAR_HARD_FAIL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // "Ich Idee" — missing verb between subject and noun
  { pattern: /\bIch\s+(Idee|Plan|Frage|Antwort)\b/i, reason: "Ich + Substantiv ohne Verb" },
  // "Der ist silberne" — adjective in wrong position with article.
  // Keep this deliberately narrow; broad "\w+e" patterns misclassify valid
  // openings such as "Das ist wie ..." or "Der ist hier ...".
  { pattern: /\b(Der|Die|Das)\s+ist\s+(?:silberne[rn]?|goldene[rn]?|kleine[rn]?|gro(?:ss|ß)e[rn]?|schoene[rn]?|schöne[rn]?|rote[rn]?|blaue[rn]?|gruene[rn]?|grüne[rn]?|runde[rn]?|lange[rn]?|warme[rn]?|kalte[rn]?|neue[rn]?|alte[rn]?|leise[rn]?|laute[rn]?|schwere[rn]?|leichte[rn]?)\b/i, reason: "Artikel + ist + Adjektiv-Endung" },
  // "Sie ist silberne" with adjective ending requiring article
  { pattern: /\b(Sie|Er|Es)\s+ist\s+silberne[rns]?\b/i, reason: "Pronomen + ist + Adjektiv mit falscher Endung" },
];

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

const IMAGE_FINALE_HINTS = [
  // Ends in a concrete sensory image rather than a moral statement
  "ping", "tickte", "schnurrte", "atmete", "leuchtete", "knirschte", "summte",
  "blieb stehen", "öffnete sich", "oeffnete sich", "schloss sich",
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
    return SACRIFICE_PATTERN.test(lower) || SACRIFICE_KEYWORDS.some((kw) => lower.includes(kw));
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

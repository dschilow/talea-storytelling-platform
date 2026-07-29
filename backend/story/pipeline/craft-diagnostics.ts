/**
 * Craft diagnostics — the deterministic half of "what separates 8 from 10".
 *
 * The existing local diagnostics (`analyzeDevModeStoryQuality`) measure FORM:
 * dialogue share, word count, characters per reading page, paragraphs per page,
 * longest sentence. Those are the only signals wired to a hard gate, so every
 * expensive repair pass the pipeline buys goes into moving a percentage.
 *
 * The 2026-07-28 audit of runs 69dace41 / eefd3600 showed what that costs:
 * 38-41% of a story's LLM bill went into dialogue rebalancing and polish, and
 * in run eefd3600 the second polish moved the market score 8.7 -> 8.7. Meanwhile
 * both stories silently dropped craft the pipeline had already planned and paid
 * for — run 69dace41 planned the refrain "Schubs es weg, plopp, da ist es
 * wieder!", used it once on page 1 and never again, and let two supporting
 * characters stand around in the finale. Neither is measured anywhere, so
 * neither ever claimed a repair pass.
 *
 * This module measures exactly those things, with no LLM call and no network.
 * The checks are deliberately conservative: each one was calibrated so that it
 * fires on run 69dace41 (the weaker story, rated 7.5) and stays silent on run
 * eefd3600 (the stronger one, rated 8.0). A check that cannot tell those two
 * apart is not in here — notably "is the wonder rule re-tested on the page",
 * which needs semantics that word stems cannot supply and produced a false
 * positive on the story whose rule demonstrably works.
 */

export type CraftIssueCode =
  | "refrain-missing"
  | "motif-thin"
  | "finale-crowded"
  | "cast-catchphrase-repeated"
  | "humor-missing"
  | "dimension-below-floor";

export interface CraftIssue {
  code: CraftIssueCode;
  /** German, matching the register of the existing soft-issue strings. */
  message: string;
  /** What a repair pass should actually DO about it. Goes into the prompt. */
  repairHint: string;
}

export interface CraftChapter {
  order: number;
  content: string;
}

export interface CraftCastMember {
  name: string;
  catchphrase?: string | null;
}

export interface CraftAnalysisInput {
  chapters: CraftChapter[];
  /** Beat-sheet refrainLine, locked before prose. */
  refrainLine?: string;
  /** Beat-sheet recurringMotif, locked before prose. */
  recurringMotif?: string;
  /** Only the cast the idea stage actually locked, not the whole pool. */
  supportingCast?: CraftCastMember[];
}

/** How many pages must carry refrain material before it counts as planted. */
const REFRAIN_MIN_PAGES = 2;
/** A recurring motif that shows up on fewer pages than this is not recurring. */
const MOTIF_MIN_PAGES = 3;
/** More than this many locked supporting figures on the last page = parade. */
const FINALE_MAX_SUPPORTING_CAST = 1;
/** Words shorter than this carry too little signal to stem reliably. */
const MIN_CONTENT_WORD_LENGTH = 5;
/** Prefix length used as a poor-man's German stemmer (knickt/knickte/Knicken). */
const STEM_LENGTH = 5;
/** A page carries a phrase when at least this many of its stems appear. */
const STEMS_PER_PAGE_HIT = 2;
/** A supporting figure may play its catchphrase once; twice is a tic. */
const CATCHPHRASE_ECHO_LIMIT = 2;
/** Widest dimension gaps to brief per round. More instructions = shallower edits. */
const MAX_DIMENSION_ISSUES = 3;

/**
 * German function words that would otherwise dominate the stem set. Kept short
 * on purpose: the length filter above already removes most of them, and an
 * over-eager list starts deleting genuine motif nouns.
 */
const GERMAN_STOPWORD_STEMS = new Set([
  "aber", "alle", "allem", "allen", "aller", "alles", "also", "andere",
  "auch", "beim", "dann", "dass", "dein", "deine", "denn", "dere", "derer",
  "dies", "diese", "doch", "dort", "durch", "eine", "einem", "einen", "einer",
  "eines", "etwa", "etwas", "euch", "euer", "fuer", "ganz", "gege", "gegen",
  "haben", "hatte", "hier", "immer", "jede", "jeder", "jedes", "jetzt", "kann",
  "kein", "keine", "koenn", "machen", "mehr", "mein", "meine", "muss", "nach",
  "nicht", "noch", "nur", "oder", "ohne", "schon", "sein", "seine", "selbst",
  "sich", "sind", "soll", "sondern", "ueber", "unse", "unser", "viel", "vom",
  "von", "vor", "waere", "wann", "warum", "was", "weil", "weit", "welche",
  "wenn", "werden", "wieder", "wird", "wird", "wo", "wollen", "wurde",
]);

function normalizeForStems(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Distinctive word stems of a phrase: lowercase, umlaut-folded, function words
 * and short words removed, truncated to a prefix so German inflection
 * (knickt / knickte / Knicken) still matches.
 */
export function contentStems(phrase: string): string[] {
  const words = normalizeForStems(phrase).split(/\s+/).filter(Boolean);
  const stems = new Set<string>();
  for (const word of words) {
    if (word.length < MIN_CONTENT_WORD_LENGTH) continue;
    if (GERMAN_STOPWORD_STEMS.has(word)) continue;
    const stem = word.slice(0, STEM_LENGTH);
    if (GERMAN_STOPWORD_STEMS.has(stem)) continue;
    stems.add(stem);
  }
  return [...stems];
}

/**
 * Number of pages on which a phrase's material shows up. Deliberately fuzzy:
 * a verbatim-only check would flag run eefd3600's page-4 inversion of its own
 * refrain ("Er machte KEINEN Schritt nach links. Er machte einen Schritt nach
 * vorne.") as missing, when that variation is the best craft in the story.
 */
export function pagesCarryingPhrase(chapters: CraftChapter[], phrase: string): number {
  const stems = contentStems(phrase);
  if (stems.length === 0) return 0;
  // A one-or-two-stem phrase cannot clear a two-stem bar; fall back to "any".
  const required = Math.min(STEMS_PER_PAGE_HIT, stems.length);
  let pages = 0;
  for (const chapter of chapters) {
    const normalized = normalizeForStems(chapter.content);
    const hits = stems.filter((stem) => normalized.includes(stem)).length;
    if (hits >= required) pages += 1;
  }
  return pages;
}

function namePresent(content: string, name: string): boolean {
  const normalizedName = normalizeForStems(name);
  if (!normalizedName) return false;
  // ANY token, not the longest one. Pool characters carry a title in front of
  // the name — "Zauberer Merlin", "Magierin Luna", "Schmied Konrad" — and the
  // title is the longer word, while the prose uses the bare name. Matching on
  // the longest token therefore missed every titled figure in the cast.
  const tokens = normalizedName.split(/\s+/).filter((token) => token.length >= 4);
  if (tokens.length === 0) return false;
  const haystack = normalizeForStems(content);
  return tokens.some((token) => haystack.includes(token));
}

export function analyzeStoryCraft(input: CraftAnalysisInput): CraftIssue[] {
  const chapters = (input.chapters || []).filter((chapter) => String(chapter?.content || "").trim());
  if (chapters.length === 0) return [];
  const issues: CraftIssue[] = [];

  const refrain = String(input.refrainLine || "").trim();
  if (refrain) {
    const pages = pagesCarryingPhrase(chapters, refrain);
    if (pages < REFRAIN_MIN_PAGES) {
      issues.push({
        code: "refrain-missing",
        message: `Refrain "${refrain}" wurde geplant, taucht aber nur auf ${pages} von ${chapters.length} Leseseiten auf.`,
        repairHint:
          `Bringe den Refrain "${refrain}" ein zweites und drittes Mal — wörtlich oder als klar erkennbare Variation — `
          + "an einer Stelle, an der er die Handlung kommentiert, und einmal im Finale als Auszahlung. "
          + "Ersetze dafür bestehende schwache Sätze; die Geschichte darf nicht länger werden.",
      });
    }
  }

  const motif = String(input.recurringMotif || "").trim();
  if (motif) {
    const pages = pagesCarryingPhrase(chapters, motif);
    if (pages < MOTIF_MIN_PAGES) {
      issues.push({
        code: "motif-thin",
        message: `Leitmotiv "${motif}" trägt nur ${pages} von ${chapters.length} Leseseiten.`,
        repairHint:
          `Verankere das Leitmotiv (${motif}) auf mindestens drei Leseseiten mit einem konkreten sinnlichen Detail — `
          + "kein erklärender Satz, sondern dasselbe Objekt/Geräusch in verändertem Zustand.",
      });
    }
  }

  const cast = (input.supportingCast || []).filter((member) => String(member?.name || "").trim());
  if (cast.length > 0) {
    const finalChapter = chapters[chapters.length - 1];
    const inFinale = cast.filter((member) => namePresent(finalChapter.content, member.name));
    if (inFinale.length > FINALE_MAX_SUPPORTING_CAST) {
      issues.push({
        code: "finale-crowded",
        message: `Finale ist mit ${inFinale.length} Nebenfiguren besetzt (${inFinale.map((m) => m.name).join(", ")}).`,
        repairHint:
          `Das Finale gehört den Hauptfiguren. Nimm ${inFinale.slice(1).map((m) => m.name).join(", ")} `
          + "von der letzten Leseseite die Sprechrolle und lass die Hauptfiguren die letzte Handlung und den letzten Satz tragen.",
      });
    }

    const wholeStory = chapters.map((chapter) => chapter.content).join("\n");
    const quotedLines = extractQuotedLines(wholeStory);
    for (const member of cast) {
      const catchphrase = String(member.catchphrase || "").trim();
      if (!catchphrase) continue;
      if (!namePresent(wholeStory, member.name)) continue;
      const catchphraseStems = contentStems(catchphrase);
      if (catchphraseStems.length < 2) continue;
      // Counting a character's OWN lines would need speaker attribution, which
      // German prose makes unreliable (the line usually precedes "sagte er").
      // Counting catchphrase echoes needs none: in a ~900-word story a
      // supporting figure who plays their slogan twice is a jukebox, not a
      // character. Run c5d98e71 had Merlin deliver "Magie liegt nicht im
      // Zauberstab. Sie liegt in dir." verbatim on two different pages while
      // changing nothing about the plot.
      const echoes = quotedLines.filter((line) => {
        const normalized = normalizeForStems(line);
        return catchphraseStems.filter((stem) => normalized.includes(stem)).length >= STEMS_PER_PAGE_HIT;
      }).length;
      if (echoes >= CATCHPHRASE_ECHO_LIMIT) {
        issues.push({
          code: "cast-catchphrase-repeated",
          message: `${member.name} spielt den eigenen Spruch ${echoes}-mal ab, statt zu handeln.`,
          repairHint:
            `Lass ${member.name} die Catchphrase höchstens EINMAL sagen, an der Stelle mit der größten Wirkung. `
            + "Ersetze die übrigen Wiederholungen durch eine Zeile oder Handlung, die den Hauptfiguren ein konkretes "
            + "Problem, einen Hinweis oder eine Komplikation liefert — sonst streiche die Figur aus der Szene.",
        });
      }
    }
  }

  return issues;
}

/** Dialogue lines in German typographic or ASCII quotes. */
export function extractQuotedLines(text: string): string[] {
  const out: string[] = [];
  const patterns = [/„([^“”"]{3,300})[“”]/g, /"([^"]{3,300})"/g];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const line = match[1].trim();
      if (line) out.push(line);
    }
  }
  return out;
}

export interface HumorPageVerdict {
  page?: number;
  hasKidLaugh?: boolean;
  device?: string;
  missedOpportunity?: string;
}

/**
 * Concrete repair instructions per weak dimension. The pipeline already
 * computes which premium floors a story misses and writes them into
 * `qualityGateFailureReason` — but that string only ever reached a log line.
 * The repair prompt got the validator's generic `mustFixBefore95` prose and
 * never the specific diagnosis, so "voiceDistinctiveness 8.0 below 8.2" turned
 * into no instruction at all.
 */
const DIMENSION_REPAIR_HINTS: Record<string, string> = {
  iconicCharacters:
    "Gib jeder Hauptfigur EIN wiedererkennbares körperliches Handlungsmuster, das nur sie hat (was tun ihre Hände, wenn sie nervös ist?) und zeige es mindestens zweimal an verschiedenen Stellen.",
  voiceDistinctiveness:
    "Die Figuren klingen zu ähnlich. Gib ihnen unterschiedliche Satzlängen und Sprechhaltungen: eine Figur fragt, die andere behauptet; eine spricht in kurzen Stücken, die andere in einem Bogen. Danach muss man jede Zeile ohne Sprecherangabe zuordnen können.",
  endingPayoff:
    "Der Schluss zahlt nicht ein. Nimm ein konkretes Detail aus der ersten Hälfte und lass es im letzten Absatz sichtbar wiederkehren — verändert, nicht wiederholt. Kein zusammenfassender Satz.",
  keyMomentPayoff:
    "Der Wendepunkt bleibt unbezahlt. Zeige die Folge der entscheidenden Handlung als sichtbare Veränderung an Objekt, Ort oder Figur, nicht als Gefühlsbeschreibung.",
  emotionalEngine:
    "Der emotionale Motor läuft zu leise. Zeige einmal früh, was die Hauptfigur konkret zu verlieren hat — an einem Gegenstand oder einer Gewohnheit, nicht an einem benannten Gefühl.",
  chapterEndPull:
    "Die Leseseiten enden zu geschlossen. Mindestens zwei Seiten müssen auf einer offenen Frage, einer Drohung oder einem unfertigen Bild enden statt auf einer abgeschlossenen Aussage.",
  pageTurnDrive:
    "Zu wenig Sog. Ziehe je eine Information, die aktuell zu früh erklärt wird, eine Seite nach hinten, damit das Kind weiterblättern muss, um sie zu bekommen.",
  rereadValue:
    "Zu wenig Grund für ein zweites Lesen. Pflanze ein Detail, das beim ersten Lesen beiläufig wirkt und nach dem Ende eine zweite Bedeutung bekommt.",
};

/**
 * Turns the validator's own verdict into instructions a repair pass can act on:
 * which page has no laugh and where one would fit, and which measured dimension
 * sits below its premium floor.
 *
 * Costs nothing — the validation call runs on every story regardless.
 */
export function buildValidatorCraftIssues(input: {
  humorPerPage?: HumorPageVerdict[];
  dimensionScores?: Record<string, unknown>;
  /** Dimension -> premium floor, as enforced by the release gate. */
  dimensionFloors?: Record<string, number>;
}): CraftIssue[] {
  const issues: CraftIssue[] = [];

  const pages = Array.isArray(input.humorPerPage) ? input.humorPerPage : [];
  const laughless = pages.filter((page) => page && page.hasKidLaugh === false);
  // One quiet page in five is normal pacing; a story is only humourless when
  // most of it is. The validator's own cap uses "4 of 5", which is too late to
  // be useful as a repair trigger — half the book is the honest threshold.
  if (pages.length > 0 && laughless.length * 2 >= pages.length) {
    const spots = laughless
      .filter((page) => String(page.missedOpportunity || "").trim())
      .slice(0, 4)
      .map((page) => `Seite ${page.page}: ${String(page.missedOpportunity).trim()}`);
    issues.push({
      code: "humor-missing",
      message: `${laughless.length} von ${pages.length} Leseseiten haben nichts, worüber ein Kind laut lacht.`,
      repairHint: [
        "Setze auf mindestens der Hälfte der Seiten EINEN echten Lacher — eine Figur, die selbstbewusst falsch liegt, ein komisches Missverständnis, Slapstick, eine freche harmlose Bemerkung oder ein Running Gag.",
        spots.length > 0 ? `Konkrete Stellen: ${spots.join(" | ")}` : "",
        "Der Humor darf Spannung und Gefahr NICHT entschärfen — er sitzt daneben, nicht darüber. Tausche dafür bestehende Sätze; die Geschichte wird nicht länger.",
      ].filter(Boolean).join(" "),
    });
  }

  // A weak story trips most floors at once — run e7b2d09c missed eight of nine
  // on its first validation. Handing a repair pass eight instructions produces
  // eight shallow edits, so keep only the widest gaps and let the next round
  // pick up what is still open. Humour is exempt from the cap: it is
  // structurally different work and the one thing every brief keeps asking for.
  const scores = input.dimensionScores || {};
  const floors = input.dimensionFloors || {};
  const gaps: Array<{ dimension: string; raw: number; floor: number; gap: number }> = [];
  for (const [dimension, floor] of Object.entries(floors)) {
    const raw = Number((scores as any)[dimension] ?? NaN);
    if (!Number.isFinite(raw) || raw >= floor) continue;
    if (!DIMENSION_REPAIR_HINTS[dimension]) continue;
    gaps.push({ dimension, raw, floor, gap: floor - raw });
  }
  gaps.sort((left, right) => right.gap - left.gap || left.dimension.localeCompare(right.dimension));

  for (const { dimension, raw, floor } of gaps.slice(0, MAX_DIMENSION_ISSUES)) {
    issues.push({
      code: "dimension-below-floor",
      message: `${dimension} liegt bei ${raw} und damit unter dem Premium-Wert ${floor}.`,
      repairHint: DIMENSION_REPAIR_HINTS[dimension],
    });
  }

  return issues;
}

/**
 * Prompt block for a repair pass. Returns an empty string when the story is
 * craft-clean, so a caller can splice it in unconditionally.
 */
export function buildCraftRepairBrief(issues: CraftIssue[]): string {
  if (issues.length === 0) return "";
  return [
    "CRAFT-BEFUND (deterministisch gemessen, PRIORITÄT vor stilistischer Feinarbeit):",
    ...issues.map((issue, index) => `${index + 1}. ${issue.message}\n   -> ${issue.repairHint}`),
    "Diese Punkte zuerst beheben. Sie kosten keine zusätzliche Länge — tausche schwache Sätze gegen tragende.",
  ].join("\n");
}

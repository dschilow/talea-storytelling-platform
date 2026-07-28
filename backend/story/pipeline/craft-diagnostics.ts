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
  | "cast-catchphrase-only";

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
  // Match on the longest name token so "Magierin Luna" is still found when the
  // prose only writes "Luna".
  const longest = normalizedName
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0];
  if (!longest || longest.length < 3) return false;
  return normalizeForStems(content).includes(longest);
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
    for (const member of cast) {
      const catchphrase = String(member.catchphrase || "").trim();
      if (!catchphrase) continue;
      if (!namePresent(wholeStory, member.name)) continue;
      const quotedLines = extractQuotedLines(wholeStory);
      if (quotedLines.length === 0) continue;
      const catchphraseStems = contentStems(catchphrase);
      if (catchphraseStems.length < 2) continue;
      const otherLines = quotedLines.filter((line) => {
        const normalized = normalizeForStems(line);
        const hits = catchphraseStems.filter((stem) => normalized.includes(stem)).length;
        return hits < STEMS_PER_PAGE_HIT;
      });
      // Every quoted line in the whole story echoes this one catchphrase: the
      // figure is a sound effect, not a character.
      if (otherLines.length === 0) {
        issues.push({
          code: "cast-catchphrase-only",
          message: `${member.name} spricht ausschließlich Varianten des eigenen Spruchs.`,
          repairHint:
            `Gib ${member.name} eine Zeile, die NICHT der Catchphrase entspricht und die den Hauptfiguren `
            + "ein konkretes Problem, einen Hinweis oder eine Komplikation liefert — sonst streiche die Figur aus der Szene.",
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

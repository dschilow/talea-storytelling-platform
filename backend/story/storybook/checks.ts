/**
 * Storybook Pipeline — deterministic checks.
 *
 * Counting and matching only; free and instant. Two lessons from storybook-v1
 * shape what is (and is not) in here:
 *
 *   1. Hard gates only for facts: a missing hero, a pool character who never
 *      appears, a brought artifact that is forgotten, a moral lecture on the
 *      last page, a wrong page count, a parental block. Those are objectively
 *      wrong and a rewrite can fix them.
 *   2. No style quotas. v1 counted connectives per paragraph and the writer
 *      answered with a subordinate clause in nearly every sentence (run
 *      6683b402, 21 of them in 1087 words). Style belongs to the critic, who
 *      reads like an editor instead of like a regex.
 */

import type { LengthBudget } from "./craft";
import type { StoryBrief } from "./context";
import type { CheckIssue, CheckReport, StoryPlan, StorybookPage } from "./types";

function report(issues: CheckIssue[]): CheckReport {
  const hard = issues.filter((issue) => issue.severity === "hard");
  const soft = issues.filter((issue) => issue.severity === "soft");
  return { ok: hard.length === 0, hard, soft };
}

export function countWords(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

export function splitSentences(text: string): string[] {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function normalizeForSearch(value: string): string {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("de-DE");
}

/** Title and profession words that are not a name on their own ("Hexe Griselda" is found by "Griselda"). */
const TITLE_WORDS = new Set([
  "der", "die", "das", "den", "dem", "des", "und", "von",
  "hexe", "kobold", "räuber", "raeuber", "räuberhauptmann", "könig", "koenig", "königin", "prinz", "prinzessin",
  "frau", "herr", "bäcker", "baecker", "müller", "fee", "drache", "zauberer", "magierin", "ritter", "kapitän",
  "detektiv", "professor", "gelehrter", "lehrerin", "postbote", "polizist", "feuerwehrfrau", "schmied", "diener",
  "magd", "wirtin", "händler", "graf", "tante", "oma", "opa", "onkel", "frosch", "eichhörnchen", "troll",
  "astronautin", "hirtenjunge", "bauerntochter", "weise", "alte", "kleine", "große", "schwarzmagier", "stiefmutter",
]);

/** The distinctive parts of a name, the way prose refers to people ("Kobold Kicher" → "Kicher"). */
export function nameTokens(name: string): string[] {
  const parts = String(name || "")
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((part) => part.length >= 3);
  const distinctive = parts.filter((part) => !TITLE_WORDS.has(part.toLocaleLowerCase("de-DE")));
  return [...new Set(distinctive.length > 0 ? distinctive : parts)];
}

export function mentions(text: string, name: string): boolean {
  const haystack = normalizeForSearch(text);
  return nameTokens(name).some((token) => {
    const needle = normalizeForSearch(token);
    // Word-start match so "Kicher" matches "Kichers" but "Ann" does not match "Kanne".
    return new RegExp(`(^|[^\\p{L}])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "u").test(haystack);
  });
}

/** The artifact's head noun, e.g. "Kompass der Winde" → "kompass". */
export function artifactHeadToken(name: string): string {
  const words = String(name || "").split(/\s+/).map((word) => word.replace(/[^\p{L}]/gu, "")).filter(Boolean);
  const capitalised = words.filter((word) => /^\p{Lu}/u.test(word) && word.length >= 4);
  return normalizeForSearch(capitalised[0] || words[0] || "");
}

export function containsBlockedTerm(text: string, blockedTerms: string[]): string | null {
  const haystack = normalizeForSearch(text);
  for (const term of blockedTerms) {
    const needle = normalizeForSearch(term).trim();
    if (needle && haystack.includes(needle)) return term;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export function checkPlan(plan: StoryPlan | null, brief: StoryBrief): CheckReport {
  const issues: CheckIssue[] = [];
  if (!plan) return report([{ code: "plan_missing", severity: "hard", message: "Der Plan konnte nicht gelesen werden." }]);
  const pages = brief.budget.pages;

  if (!plan.title) issues.push({ code: "title_missing", severity: "hard", message: "Der Plan hat keinen Titel." });
  if (plan.pages.length !== pages) {
    issues.push({ code: "page_count", severity: "hard", message: `Der Plan hat ${plan.pages.length} Seiten, gebraucht werden genau ${pages}.` });
  }
  for (const page of plan.pages) {
    const missing = [
      !page.action && "action",
      !page.picture && "picture",
      !page.turn && "turn",
    ].filter(Boolean);
    if (missing.length > 0) {
      issues.push({ code: "page_incomplete", severity: "hard", message: `Seite ${page.page}: es fehlt ${missing.join(", ")}.`, page: page.page });
    }
  }

  for (const hero of plan.heroes) {
    const onPages = plan.pages.filter((page) => page.onPage.includes(hero.id)).length;
    if (onPages === 0) {
      issues.push({ code: "hero_absent", severity: "hard", message: `${hero.name} kommt auf keiner Seite vor (onPage).` });
    }
    if (!hero.contribution) {
      issues.push({ code: "hero_no_contribution", severity: "hard", message: `${hero.name} hat keinen eigenen Beitrag zur Lösung.` });
    }
  }

  if (brief.candidates.length > 0 && plan.cast.length === 0) {
    issues.push({
      code: "cast_empty",
      severity: "hard",
      message: "Keine Figur aus dem Figurenpool besetzt. Besetze mindestens eine Figur aus der Liste (per id) mit einer echten Aufgabe.",
    });
  }
  for (const member of plan.cast) {
    const onPages = plan.pages.filter((page) => page.onPage.includes(member.id)).length;
    if (onPages === 0) {
      issues.push({ code: "cast_absent", severity: "hard", message: `${member.name} ist besetzt, kommt aber auf keiner Seite vor.` });
    } else if (onPages === 1) {
      issues.push({ code: "cast_thin", severity: "soft", message: `${member.name} erscheint nur auf einer Seite — eine Nebenfigur braucht mindestens zwei Auftritte.` });
    }
    if (!member.want) issues.push({ code: "cast_no_want", severity: "soft", message: `${member.name} hat keinen eigenen Wunsch.` });
  }

  const brought = brief.artifacts.find((artifact) => artifact.broughtBy);
  if (brought && plan.artifact?.id !== brought.id) {
    issues.push({ code: "brought_artifact_missing", severity: "hard", message: `Das mitgebrachte Artefakt „${brought.name}“ fehlt im Plan.` });
  }

  if (plan.setups.length === 0) {
    issues.push({ code: "no_setup", severity: "soft", message: "Kein vorbereitetes Detail, das sich später auszahlt." });
  }
  for (const setup of plan.setups) {
    if (setup.paysOffOnPage <= setup.plantedOnPage) {
      issues.push({ code: "setup_order", severity: "soft", message: `„${setup.what}“ wird nicht vor seiner Auszahlung gezeigt.` });
    }
  }
  if (plan.runningGag.beats.length < 3) {
    issues.push({ code: "gag_incomplete", severity: "soft", message: "Der Laufgag hat weniger als drei Stellen." });
  }
  if (plan.refrain && countWords(plan.refrain) > 9) {
    issues.push({ code: "refrain_long", severity: "soft", message: `Der Satz zum Mitsprechen ist mit ${countWords(plan.refrain)} Wörtern zu lang.` });
  }
  if (!plan.ending.lastLine) {
    issues.push({ code: "no_last_line", severity: "soft", message: "Es fehlt die Schlusspointe." });
  }

  const blocked = containsBlockedTerm(JSON.stringify(plan), brief.blockedTerms);
  if (blocked) issues.push({ code: "blocked_term", severity: "hard", message: `Der gesperrte Begriff „${blocked}“ kommt im Plan vor.` });

  return report(issues);
}

// ---------------------------------------------------------------------------
// Prose
// ---------------------------------------------------------------------------

const FORBIDDEN_ENDINGS = [
  /(sie|er|wir|alle) (lernten|lernte|hatten gelernt),? dass/i,
  /das größte geschenk/i,
  /wahre (magie|freundschaft|stärke)/i,
  /mit mut und zusammenhalt/i,
  /(war|alles war) (alles )?nur ein traum/i,
  /seit diesem tag wusste[n]? (er|sie|es)/i,
  /und die moral/i,
  /the (real|true) magic/i,
  /they learned that/i,
];

const CHARACTER_SHEET_RE =
  /^[„"']?\s*(?:Der |Die |Das )?\p{Lu}[\p{L}]+(?:\s+\p{Lu}[\p{L}]+)?\s+(?:ist\s+(?:ein|eine|der|die|das)\s|trägt\s+(?:ein|eine|einen)\s)[^.!?]{25,}[.!?]$/u;

export interface ProseCheckInput {
  pages: StorybookPage[];
  budget: LengthBudget;
  plan: StoryPlan;
  brief: StoryBrief;
}

export function checkProse(input: ProseCheckInput): CheckReport {
  const issues: CheckIssue[] = [];
  const { pages, budget, plan, brief } = input;
  const fullText = pages.map((page) => page.content).join("\n\n");
  const totalWords = countWords(fullText);

  if (pages.length !== budget.pages) {
    issues.push({ code: "wrong_page_count", severity: "hard", message: `${pages.length} Seiten statt genau ${budget.pages}.` });
  }
  if (totalWords < budget.totalWordsMin * 0.8) {
    issues.push({ code: "too_short", severity: "hard", message: `Die Geschichte hat ${totalWords} Wörter; gebraucht werden ${budget.totalWordsMin}–${budget.totalWordsMax} (je Seite ${budget.wordsPerPageMin}–${budget.wordsPerPageMax}).` });
  } else if (totalWords > budget.totalWordsMax * 1.3) {
    issues.push({ code: "too_long", severity: "hard", message: `Die Geschichte hat ${totalWords} Wörter; höchstens ${budget.totalWordsMax} (je Seite ${budget.wordsPerPageMin}–${budget.wordsPerPageMax}). Kürzen, ohne Handlung zu verlieren.` });
  }

  for (const page of pages) {
    const words = countWords(page.content);
    if (words < budget.wordsPerPageMin * 0.5) {
      issues.push({ code: "page_thin", severity: "soft", message: `Seite ${page.order}: nur ${words} Wörter.`, page: page.order });
    } else if (words > budget.wordsPerPageMax * 1.6) {
      issues.push({ code: "page_heavy", severity: "soft", message: `Seite ${page.order}: ${words} Wörter — zu viel für eine Bilderbuchseite.`, page: page.order });
    }

    const sentences = splitSentences(page.content);
    let run = 0;
    let worst = 0;
    for (const sentence of sentences) {
      run = countWords(sentence) <= 3 ? run + 1 : 0;
      worst = Math.max(worst, run);
    }
    if (worst >= 3) {
      issues.push({ code: "fragment_staccato", severity: "soft", message: `Seite ${page.order}: ${worst} Ein-bis-drei-Wort-Sätze hintereinander.`, page: page.order });
    }
    const dump = sentences.find((sentence) => CHARACTER_SHEET_RE.test(sentence));
    if (dump) {
      issues.push({ code: "character_sheet", severity: "soft", message: `Seite ${page.order}: „${dump.slice(0, 90)}“ ist ein Steckbrief, kein Erzählsatz.`, page: page.order });
    }
  }

  for (const hero of brief.heroes) {
    if (!mentions(fullText, hero.name)) {
      issues.push({ code: "hero_missing", severity: "hard", message: `${hero.name} kommt im Text nicht vor.` });
    }
  }
  for (const member of plan.cast) {
    if (!mentions(fullText, member.name)) {
      issues.push({ code: "cast_missing", severity: "hard", message: `${member.name} (aus dem Figurenpool besetzt) kommt im Text nicht vor.` });
    }
  }

  if (plan.artifact) {
    const head = artifactHeadToken(plan.artifact.name);
    const present = head.length >= 3 && normalizeForSearch(fullText).includes(head);
    if (!present) {
      issues.push({
        code: "artifact_missing",
        severity: plan.artifact.carried ? "hard" : "soft",
        message: `Das Artefakt „${plan.artifact.name}“ kommt im Text nicht vor.`,
      });
    }
  }

  if (plan.refrain) {
    const needle = normalizeForSearch(plan.refrain).replace(/[^\p{L}\p{N} ]/gu, "").trim();
    const haystack = normalizeForSearch(fullText).replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ");
    const count = needle ? haystack.split(needle).length - 1 : 0;
    if (count < 2) {
      issues.push({ code: "refrain_missing", severity: "soft", message: `Der Satz zum Mitsprechen „${plan.refrain}“ steht nur ${count}× im Text (geplant: 3×).` });
    }
  }

  const lastPage = pages[pages.length - 1]?.content || "";
  if (FORBIDDEN_ENDINGS.some((pattern) => pattern.test(lastPage))) {
    issues.push({ code: "moral_ending", severity: "hard", message: "Die letzte Seite spricht eine Lehre aus. Das Ende muss ein Bild oder eine Pointe sein.", page: pages.length });
  }

  if (/\[object Object\]|\{\{|\}\}|\bundefined\b|\bNaN\b|SEITE\s+\d+|TITEL\s*:/.test(fullText)) {
    issues.push({ code: "serialization_artifact", severity: "hard", message: "Im Text stehen technische Reste (Platzhalter, Seitenmarker)." });
  }

  const blocked = containsBlockedTerm(fullText, brief.blockedTerms);
  if (blocked) issues.push({ code: "blocked_term", severity: "hard", message: `Der gesperrte Begriff „${blocked}“ steht im Text.` });

  return report(issues);
}

/** One instruction line per issue, hard ones first. */
export function issuesToNotes(issues: CheckIssue[], max = 8): string[] {
  return [...issues]
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "hard" ? -1 : 1))
    .slice(0, max)
    .map((issue) => issue.message);
}

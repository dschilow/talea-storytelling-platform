/**
 * Storybook Pipeline — deterministic checks.
 *
 * Everything here is counting and regex. It costs nothing, it runs in
 * milliseconds, and it catches the exact failures a child notices:
 * too many new names, missing cause-and-effect, fragment staccato, a character
 * who appears without ever being introduced.
 *
 * Two rules keep this honest:
 *
 *   1. Plan checks run BEFORE the expensive writer call. A defect caught in the
 *      card costs nothing; the same defect caught after the draft costs a
 *      repair pass.
 *   2. Nothing here ever measures dialogue percentage. Chasing a dialogue quota
 *      is what turned the old engine's prose into ping-pong fragments.
 */

import { CAUSAL_CONNECTIVES } from "./style-contract";
import type { CheckIssue, CheckReport, KidLogicCard, StorybookPage } from "./types";
import type { LengthBudget } from "./style-contract";

function report(issues: CheckIssue[]): CheckReport {
  const hard = issues.filter((issue) => issue.severity === "hard");
  const soft = issues.filter((issue) => issue.severity === "soft");
  return { ok: hard.length === 0, hard, soft };
}

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 2;
}

const VAGUE_QUESTION = /^(schafft|wird|kann|ob)\b|was passiert (jetzt|nun|dann)|wie geht (es|'s) weiter|gelingt/i;

/**
 * Validates the Kinderlogik-Karte. A card that fails here means the story was
 * never going to be understandable, so we fix the plan rather than the prose.
 */
export function checkPlan(card: KidLogicCard | null, budget: LengthBudget): CheckReport {
  const issues: CheckIssue[] = [];
  if (!card) {
    return report([{ code: "plan_missing", severity: "hard", message: "Die Planungskarte konnte nicht gelesen werden." }]);
  }

  // --- the causal chain: the whole point of the card ---------------------
  const chainRules: Array<{ field: keyof KidLogicCard["kette"]; needle: RegExp; label: string }> = [
    { field: "will", needle: /\bwill\b|\bmöchte\b|\bbraucht\b/i, label: "will" },
    { field: "aber", needle: /^aber\b|\baber\b|\bdoch\b/i, label: "aber" },
    { field: "also", needle: /^also\b|\balso\b|\bdeshalb\b|\bdarum\b/i, label: "also" },
    { field: "dadurch", needle: /^dadurch\b|\bdadurch\b|\bdeswegen\b|\bjetzt\b/i, label: "dadurch" },
    { field: "entweder", needle: /\boder\b|\bentweder\b/i, label: "entweder/oder" },
    { field: "waehlt", needle: /\bweil\b|\bdenn\b/i, label: "wählt … weil" },
    { field: "ende", needle: /\b(ende|schluss|zuletzt|schließlich|am ende)\b/i, label: "ende" },
  ];

  const chain = card.kette || ({} as KidLogicCard["kette"]);
  for (const rule of chainRules) {
    const value = String((chain as any)[rule.field] || "");
    if (!nonEmpty(value)) {
      issues.push({
        code: `chain_missing_${String(rule.field)}`,
        severity: "hard",
        message: `Die Kette hat kein Glied "${rule.label}". Ohne dieses Glied kann ein Kind der Handlung nicht folgen.`,
      });
      continue;
    }
    if (!rule.needle.test(value)) {
      issues.push({
        code: `chain_weak_${String(rule.field)}`,
        severity: "soft",
        message: `Das Kettenglied "${rule.label}" trägt sein Verbindungswort nicht: „${value.slice(0, 80)}“`,
      });
    }
  }

  // --- the magic must leave a mark --------------------------------------
  if (!nonEmpty(card.wunderregel?.regel)) {
    issues.push({ code: "rule_missing", severity: "hard", message: "Es gibt keine Wunderregel." });
  }
  if (!nonEmpty(card.wunderregel?.sichtbareFolge)) {
    issues.push({
      code: "rule_invisible",
      severity: "hard",
      message: "Die Wunderregel hat keine sichtbare Folge. Was man nicht sehen kann, gibt es für ein Kind nicht.",
    });
  }

  // --- three escalating beats -------------------------------------------
  const beats = Array.isArray(card.dreierSchritt) ? card.dreierSchritt.filter(nonEmpty) : [];
  if (beats.length < 3) {
    issues.push({ code: "escalation_incomplete", severity: "hard", message: "Der Dreierschritt hat weniger als drei Stufen." });
  } else if (new Set(beats.map((b) => b.trim().toLowerCase())).size < 3) {
    issues.push({ code: "escalation_repeats", severity: "hard", message: "Zwei Stufen des Dreierschritts sind identisch — es gibt keine Steigerung." });
  }

  // --- payoff scaffolding ------------------------------------------------
  for (const [field, label] of [
    ["umkehrung", "Umkehrung"],
    ["preis", "Preis"],
    ["schlussbild", "Schlussbild"],
    ["ankerObjekt", "Ankerobjekt"],
    ["refrain", "Refrain"],
  ] as const) {
    if (!nonEmpty((card as any)[field])) {
      issues.push({ code: `missing_${field}`, severity: "hard", message: `Es fehlt: ${label}.` });
    }
  }

  const refrain = String(card.refrain || "").trim();
  if (refrain) {
    const words = refrain.split(/\s+/).length;
    if (words > 8) {
      issues.push({ code: "refrain_too_long", severity: "soft", message: `Der Refrain ist mit ${words} Wörtern zu lang zum Mitsprechen.` });
    }
    if (/wenn .* dann|jedes mal|weil .* dann/i.test(refrain)) {
      issues.push({
        code: "refrain_explains",
        severity: "soft",
        message: "Der Refrain erklärt die Magie, statt Figurensprache zu sein.",
      });
    }
  }

  // --- the running gag ---------------------------------------------------
  const gagSpots = Array.isArray(card.laufgag?.stellen) ? card.laufgag.stellen.filter(nonEmpty) : [];
  if (gagSpots.length < 3) {
    issues.push({ code: "gag_incomplete", severity: "hard", message: "Der Laufgag hat weniger als drei Stellen." });
  } else if (new Set(gagSpots.map((s) => s.trim().toLowerCase())).size < 3) {
    issues.push({ code: "gag_repeats", severity: "soft", message: "Der Laufgag ist drei Mal derselbe — beim dritten Mal muss er anders sein." });
  }

  // --- page questions ----------------------------------------------------
  const pages = Array.isArray(card.seiten) ? card.seiten : [];
  if (pages.length !== budget.pages) {
    issues.push({
      code: "page_count",
      severity: "hard",
      message: `Die Karte hat ${pages.length} Seiten, gebraucht werden ${budget.pages}.`,
    });
  }
  for (const page of pages) {
    if (!nonEmpty(page?.was)) {
      issues.push({ code: "page_empty", severity: "hard", message: `Seite ${page?.nr}: kein sichtbares Geschehen.`, page: page?.nr });
    }
    const question = String(page?.frage || "").trim();
    if (!nonEmpty(question)) {
      issues.push({ code: "page_question_missing", severity: "hard", message: `Seite ${page?.nr}: keine Frage am Seitenende.`, page: page?.nr });
    } else if (VAGUE_QUESTION.test(question)) {
      issues.push({
        code: "page_question_vague",
        severity: "soft",
        message: `Seite ${page?.nr}: die Frage „${question}“ ist zu allgemein. Sie muss konkret sein.`,
        page: page?.nr,
      });
    }
  }

  // --- every figure is introduced ----------------------------------------
  const figures = Array.isArray(card.figuren) ? card.figuren : [];
  if (figures.length === 0) {
    issues.push({ code: "figures_missing", severity: "hard", message: "Die Karte nennt keine Figuren." });
  }
  for (const figure of figures) {
    if (!nonEmpty(figure?.werSieSind)) {
      issues.push({
        code: "figure_no_intro",
        severity: "hard",
        message: `Für ${figure?.name || "eine Figur"} fehlt der Satz, wer das ist.`,
      });
    }
    if (!nonEmpty(figure?.willWas)) {
      issues.push({
        code: "figure_no_want",
        severity: "soft",
        message: `${figure?.name || "Eine Figur"} hat keinen eigenen Wunsch.`,
      });
    }
  }

  if (!nonEmpty(card.titel)) issues.push({ code: "title_missing", severity: "hard", message: "Kein Titel." });
  if (!nonEmpty(card.kurzbeschreibung)) {
    issues.push({ code: "description_missing", severity: "hard", message: "Keine Kurzbeschreibung." });
  } else if (/lernt|lernen|botschaft|moral|erkennt, dass/i.test(card.kurzbeschreibung)) {
    issues.push({ code: "description_moralises", severity: "soft", message: "Die Kurzbeschreibung erklärt eine Lehre statt eines Wunsches." });
  }

  return report(issues);
}

// ---------------------------------------------------------------------------
// Prose checks
// ---------------------------------------------------------------------------

const CONNECTIVE_RE = new RegExp(`\\b(${CAUSAL_CONNECTIVES.join("|")})\\b`, "i");
const FORBIDDEN_ENDINGS = [
  /sie lernten,? dass/i,
  /das größte geschenk/i,
  /wahre magie/i,
  /mit mut und zusammenhalt/i,
  /war alles nur ein traum/i,
  /seit diesem tag wusste[n]? (er|sie|es)/i,
];

export function splitSentences(text: string): string[] {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function splitParagraphs(text: string): string[] {
  return String(text || "")
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function countWords(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

/** Capitalised tokens that are not sentence-initial — a crude but effective proper-noun probe. */
function properNounsIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const sentence of splitSentences(text)) {
    // Strip leading quote marks so a name opening a line of speech still counts
    // as sentence-initial rather than as a new name.
    const cleaned = sentence.replace(/^[„"»'\-–—\s]+/, "");
    const tokens = cleaned.split(/\s+/);
    tokens.forEach((token, index) => {
      const word = token.replace(/[^\wÄÖÜäöüß-]/g, "");
      if (word.length < 3) return;
      if (index === 0) return;
      if (!/^[A-ZÄÖÜ]/.test(word)) return;
      // German capitalises all nouns, so a whitelist of story-relevant common
      // nouns would be endless. Instead we only count words that never appear
      // lowercase anywhere in the text AND are not preceded by an article.
      const prev = (tokens[index - 1] || "").toLowerCase().replace(/[^\wäöüß]/g, "");
      if (["der", "die", "das", "ein", "eine", "einen", "einem", "einer", "eines", "den", "dem", "des", "im", "am", "zum", "zur", "vom", "beim", "ins"].includes(prev)) return;
      found.add(word);
    });
  }
  return found;
}

export interface ProseCheckInput {
  pages: StorybookPage[];
  budget: LengthBudget;
  card: KidLogicCard;
  /** Names that are allowed from page 1 without a fresh introduction. */
  knownNames: string[];
}

export function checkProse(input: ProseCheckInput): CheckReport {
  const issues: CheckIssue[] = [];
  const { pages, budget, card } = input;
  const fullText = pages.map((page) => page.content).join("\n\n");

  // --- length -------------------------------------------------------------
  const totalWords = countWords(fullText);
  if (totalWords < budget.totalWordsMin * 0.8) {
    issues.push({
      code: "too_short",
      severity: "hard",
      message: `Die Geschichte hat ${totalWords} Wörter, erwartet werden ${budget.totalWordsMin}–${budget.totalWordsMax}.`,
    });
  } else if (totalWords > budget.totalWordsMax * 1.25) {
    issues.push({
      code: "too_long",
      severity: "soft",
      message: `Die Geschichte hat ${totalWords} Wörter, erwartet werden ${budget.totalWordsMin}–${budget.totalWordsMax}.`,
    });
  }

  if (pages.length !== budget.pages) {
    issues.push({ code: "wrong_page_count", severity: "hard", message: `${pages.length} Leseseiten statt ${budget.pages}.` });
  }

  // --- per page -----------------------------------------------------------
  const introduced = new Set(input.knownNames.map((name) => name.split(/\s+/)[0]));
  const seenNames = new Set<string>(introduced);

  for (const page of pages) {
    const paragraphs = splitParagraphs(page.content);
    const sentences = splitSentences(page.content);

    // Cause and effect: a page whose paragraphs never say WHY is a page a child
    // hears as a list of unrelated events.
    const paragraphsWithoutConnective = paragraphs.filter((p) => !CONNECTIVE_RE.test(p));
    if (paragraphsWithoutConnective.length > Math.max(1, Math.floor(paragraphs.length * 0.34))) {
      issues.push({
        code: "no_causality",
        severity: "hard",
        message: `Seite ${page.order}: ${paragraphsWithoutConnective.length} von ${paragraphs.length} Absätzen enthalten kein Verbindungswort (weil/deshalb/also/aber/denn). Die Handlung wirkt wie eine Aufzählung.`,
        page: page.order,
      });
    }

    // Fragment staccato — the single worst habit of the previous engine.
    let run = 0;
    let worstRun = 0;
    for (const sentence of sentences) {
      if (countWords(sentence) <= 3) {
        run += 1;
        worstRun = Math.max(worstRun, run);
      } else {
        run = 0;
      }
    }
    if (worstRun >= 3) {
      issues.push({
        code: "fragment_staccato",
        severity: "hard",
        message: `Seite ${page.order}: ${worstRun} Ein-bis-Drei-Wort-Sätze hintereinander. Das ist Erwachsenen-Thriller-Ton, kein Kinderbuch.`,
        page: page.order,
      });
    }

    const longest = sentences.reduce((max, sentence) => Math.max(max, sentence.length), 0);
    if (longest > budget.maxSentenceChars) {
      issues.push({
        code: "sentence_too_long",
        severity: "soft",
        message: `Seite ${page.order}: längster Satz ${longest} Zeichen (max ${budget.maxSentenceChars}).`,
        page: page.order,
      });
    }

    // New names per page.
    const pageNames = [...properNounsIn(page.content)].filter((name) => !seenNames.has(name));
    if (pageNames.length > budget.maxNewNamesPerPage) {
      issues.push({
        code: "too_many_new_names",
        severity: "soft",
        message: `Seite ${page.order}: ${pageNames.length} neue Namen (${pageNames.slice(0, 5).join(", ")}), erlaubt sind ${budget.maxNewNamesPerPage}.`,
        page: page.order,
      });
    }
    pageNames.forEach((name) => seenNames.add(name));

    if (page.content.trim().length < budget.pageCharsMin * 0.6) {
      issues.push({
        code: "page_too_thin",
        severity: "soft",
        message: `Seite ${page.order}: nur ${page.content.trim().length} Zeichen.`,
        page: page.order,
      });
    }
  }

  // --- named figures must be introduced ------------------------------------
  const figures = Array.isArray(card.figuren) ? card.figuren : [];
  for (const figure of figures) {
    const name = String(figure?.name || "").trim();
    if (!name) continue;
    const firstToken = name.split(/\s+/)[0];
    if (input.knownNames.some((known) => known.split(/\s+/)[0] === firstToken)) continue;

    const index = fullText.indexOf(firstToken);
    if (index < 0) continue; // never appears — that is fine, the writer dropped them
    // Look at the sentence carrying the first mention: it must say who this is,
    // i.e. contain a comma-clause or a descriptive apposition.
    const window = fullText.slice(Math.max(0, index - 140), index + 200);
    const introSentence = splitSentences(window).find((sentence) => sentence.includes(firstToken)) || "";
    const hasIntro = /,/.test(introSentence) && introSentence.length > firstToken.length + 25;
    if (!hasIntro) {
      issues.push({
        code: "figure_unintroduced",
        severity: "soft",
        message: `„${name}“ taucht auf, ohne dass in demselben Satz steht, wer das ist.`,
      });
    }
  }

  // --- refrain -------------------------------------------------------------
  const refrain = String(card.refrain || "").trim();
  if (refrain.length > 3) {
    const needle = refrain.replace(/[.!?…„“"»«]/g, "").trim().toLowerCase();
    const haystack = fullText.replace(/[.!?…„“"»«]/g, "").toLowerCase();
    let count = 0;
    let from = 0;
    while (needle && from < haystack.length) {
      const at = haystack.indexOf(needle, from);
      if (at < 0) break;
      count += 1;
      from = at + needle.length;
    }
    if (count < 3) {
      issues.push({
        code: "refrain_missing",
        severity: count === 0 ? "hard" : "soft",
        message: `Der Refrain „${refrain}“ steht nur ${count}× im Text, gebraucht werden 3×.`,
      });
    }
  }

  // --- anchor object opens and closes --------------------------------------
  const anchor = String(card.ankerObjekt || "").trim().toLowerCase();
  if (anchor.length > 2) {
    const anchorHead = anchor.split(/\s+/).slice(-1)[0].replace(/[^\wäöüß]/g, "");
    const lastPage = pages[pages.length - 1]?.content?.toLowerCase() || "";
    if (anchorHead.length > 3 && !lastPage.includes(anchorHead.slice(0, Math.max(4, anchorHead.length - 2)))) {
      issues.push({
        code: "anchor_missing_at_end",
        severity: "soft",
        message: `Das Ankerobjekt „${card.ankerObjekt}“ kommt auf der letzten Seite nicht vor — der Kreis schließt sich nicht.`,
        page: pages.length,
      });
    }
  }

  // --- moral endings -------------------------------------------------------
  const lastPageText = pages[pages.length - 1]?.content || "";
  for (const pattern of FORBIDDEN_ENDINGS) {
    if (pattern.test(lastPageText)) {
      issues.push({
        code: "moral_ending",
        severity: "hard",
        message: "Die letzte Seite spricht eine Lehre aus. Das Ende muss ein Bild sein.",
        page: pages.length,
      });
      break;
    }
  }

  // --- serialization leftovers ---------------------------------------------
  if (/\[object Object\]|\{\{|\}\}|undefined|NaN\b/.test(fullText)) {
    issues.push({ code: "serialization_artifact", severity: "hard", message: "Im Text stehen technische Platzhalter oder Fehlwerte." });
  }

  return report(issues);
}

/** Turns issues into one short instruction line each for a targeted repair. */
export function issuesToRepairNotes(issues: CheckIssue[], max = 6): string[] {
  return issues.slice(0, max).map((issue) => issue.message);
}

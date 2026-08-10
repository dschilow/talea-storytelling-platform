/**
 * Storybook Pipeline — pure parsing and evaluation.
 *
 * Deliberately free of any LLM client, database or Encore import. Everything in
 * here is the part of the pipeline that decides whether a story is usable, so
 * it has to be unit-testable without infrastructure standing up first.
 */

import type { CheckIssue, JudgeAnswers, JudgeReport, KidLogicCard, StorybookPage } from "./types";

const PAGE_MARKER = /^\s*SEITE\s+(\d+)\s*:?\s*$/i;

/** Splits a marker-delimited draft into pages. Order is taken from the marker. */
export function parsePageBlocks(raw: string): Array<{ order: number; content: string }> {
  const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: Array<{ order: number; content: string }> = [];
  let order = 0;
  let buffer: string[] = [];

  const flush = () => {
    if (order > 0) {
      const content = buffer.join("\n").trim();
      if (content) blocks.push({ order, content });
    }
  };

  for (const line of lines) {
    const marker = line.match(PAGE_MARKER);
    if (marker) {
      flush();
      order = Number(marker[1]);
      buffer = [];
      continue;
    }
    if (order > 0) buffer.push(line);
  }
  flush();

  return blocks;
}

/**
 * Parses the plain-text draft. Tolerant on purpose: the story matters, the
 * formatting does not, and a whole generation must never die on a stray marker.
 */
export function parseDraft(
  raw: string,
  expectedPages: number
): { title: string; description: string; pages: StorybookPage[] } {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();

  const titleMatch = text.match(/^\s*TITEL\s*:\s*(.+)$/im);
  const descMatch = text.match(/^\s*BESCHREIBUNG\s*:\s*(.+)$/im);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const description = descMatch ? descMatch[1].trim() : "";

  let blocks = parsePageBlocks(text);

  // No markers at all — split the body into even blocks so a usable story still
  // ships instead of the run dying on a formatting slip.
  if (blocks.length === 0) {
    const body = text
      .replace(/^\s*TITEL\s*:.*$/im, "")
      .replace(/^\s*BESCHREIBUNG\s*:.*$/im, "")
      .trim();
    const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const perPage = Math.max(1, Math.ceil(paragraphs.length / Math.max(1, expectedPages)));
    blocks = [];
    for (let index = 0; index < expectedPages; index += 1) {
      const slice = paragraphs.slice(index * perPage, (index + 1) * perPage);
      if (slice.length === 0) break;
      blocks.push({ order: index + 1, content: slice.join("\n\n") });
    }
  }

  // Renumber: a skipped marker must not leave a hole the reader trips over.
  const pages: StorybookPage[] = blocks
    .sort((a, b) => a.order - b.order)
    .map((block, index) => ({
      order: index + 1,
      title: `Leseseite ${index + 1}`,
      content: block.content.trim(),
    }));

  return { title, description, pages };
}

/** Parses the edit stage's reply into replacement page contents. */
export function parseEditedPages(raw: string): Map<number, string> {
  return new Map(parsePageBlocks(raw).map((block) => [block.order, block.content]));
}

/**
 * Picks the pages worth touching. Story-wide defects map onto the pages where
 * they can actually be fixed, and the result is capped at three — rewriting the
 * whole book in a "targeted" pass is how a repair turns into a seventh draft.
 */
export function resolveTargetPages(issues: CheckIssue[], pageCount: number): number[] {
  const targets = new Set<number>();

  for (const issue of issues) {
    if (typeof issue.page === "number" && issue.page >= 1 && issue.page <= pageCount) {
      targets.add(issue.page);
      continue;
    }
    switch (issue.code) {
      case "refrain_missing":
        // The refrain needs an early plant, a middle beat and the transformed
        // return — one page each.
        targets.add(1);
        targets.add(Math.max(1, Math.ceil(pageCount / 2)));
        targets.add(pageCount);
        break;
      case "figure_unexplained":
      case "figure_unintroduced":
      case "want_unreadable":
      case "want_drifted":
        targets.add(1);
        break;
      case "change_unreadable":
      case "moral_ending":
      case "anchor_missing_at_end":
        targets.add(pageCount);
        break;
      case "cause_unreadable":
      case "no_causality":
        targets.add(Math.max(1, Math.ceil(pageCount / 2)));
        break;
      case "no_laugh":
      case "repetition_missing":
        targets.add(pageCount >= 2 ? 2 : 1);
        break;
      default:
        break;
    }
  }

  return [...targets].sort((a, b) => a - b).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Judge evaluation
// ---------------------------------------------------------------------------

/** Loose overlap check — the judge paraphrases, so exact matching would be noise. */
function sharesContent(a: string, b: string): boolean {
  const norm = (value: string) =>
    new Set(
      String(value || "")
        .toLowerCase()
        .split(/[^a-zäöüß0-9]+/)
        .filter((token) => token.length > 3)
    );
  const left = norm(a);
  const right = norm(b);
  if (left.size === 0 || right.size === 0) return false;
  let hits = 0;
  for (const token of left) if (right.has(token)) hits += 1;
  return hits >= Math.min(2, Math.ceil(Math.min(left.size, right.size) * 0.25));
}

const NOT_IN_TEXT = /steht nicht|nicht drin|unklar|weiß nicht|keine angabe|nicht erkennbar|wird nicht/i;

/**
 * Compares what a first-time reader could extract against what the plan
 * promised. This replaces a seventeen-dimension self-score that once rated a
 * story 8.2/10 which a real seven-year-old understood nothing of.
 */
export function evaluateJudgeAnswers(answers: JudgeAnswers, card: KidLogicCard): JudgeReport {
  const issues: CheckIssue[] = [];

  // 1) Did the want survive into the prose?
  if (!answers.wollte || NOT_IN_TEXT.test(answers.wollte)) {
    issues.push({
      code: "want_unreadable",
      severity: "hard",
      message:
        "Aus dem Text geht nicht hervor, was die Hauptfigur eigentlich will. Der Wunsch muss in den ersten Sätzen stehen und anfassbar sein.",
    });
  } else if (!sharesContent(answers.wollte, card.kette?.will || "")) {
    issues.push({
      code: "want_drifted",
      severity: "soft",
      message: `Der Text vermittelt einen anderen Wunsch („${answers.wollte.slice(0, 90)}“) als geplant.`,
    });
  }

  // 2) Cause and effect.
  if (!answers.schiefgegangen || NOT_IN_TEXT.test(answers.schiefgegangen)) {
    issues.push({
      code: "cause_unreadable",
      severity: "hard",
      message: "Aus dem Text geht nicht hervor, WARUM es schiefgeht. Die Ursache muss auf der Seite stehen, auf der sie passiert.",
    });
  }

  // 3) The character actually changed, visibly.
  if (!answers.andersGemacht || NOT_IN_TEXT.test(answers.andersGemacht)) {
    issues.push({
      code: "change_unreadable",
      severity: "hard",
      message: "Man sieht im Text nicht, was die Hauptfigur am Ende anders macht. Die Umkehrung muss als Handlung sichtbar sein.",
    });
  }

  // 4) Repetition — the engine of suspense at this age.
  const repeats = Array.isArray(answers.wiederholung)
    ? answers.wiederholung.filter((entry) => String(entry || "").trim())
    : [];
  if (repeats.length < 2) {
    issues.push({
      code: "repetition_missing",
      severity: "soft",
      message: "Ein Leser findet keine erkennbare Wiederholung. Refrain und Dreierschritt müssen als Muster hörbar sein.",
    });
  }

  // 5) Humour.
  if (!answers.lachstelle || /^keine?$/i.test(String(answers.lachstelle).trim())) {
    issues.push({
      code: "no_laugh",
      severity: "soft",
      message: "Der Text enthält keine Stelle, an der ein Kind lacht. Der Laufgag muss körperlich und sichtbar werden.",
    });
  }

  // 6) Unintroduced figures — the exact defect that survived three validation
  //    rounds in the old engine because it was only ever renamed.
  const unexplained = String(answers.unerklaerteFigur || "").trim();
  if (unexplained && !/^keine?$/i.test(unexplained)) {
    issues.push({
      code: "figure_unexplained",
      severity: "hard",
      message: `„${unexplained}“ taucht auf, ohne dass im Text steht, wer das ist. Ein Satz mitten in der Handlung muss das klären.`,
    });
  }

  // 7) The sentence a first-time reader stumbled over.
  const confusing = String(answers.unverstaendlicherSatz || "").trim();
  if (confusing && !/^kein(er|e|s)?$/i.test(confusing)) {
    issues.push({
      code: "sentence_unclear",
      severity: "soft",
      message: `Dieser Satz war beim ersten Lesen nicht verständlich: „${confusing.slice(0, 140)}“`,
    });
  }

  const score = Number(answers.verstaendlichkeit);
  if (Number.isFinite(score) && score <= 2) {
    issues.push({
      code: "comprehension_low",
      severity: "hard",
      message: `Verständlichkeit nur ${score}/5. Kausalkette und Figureneinführungen müssen deutlicher werden.`,
    });
  }

  return {
    answers,
    issues,
    passed: issues.every((issue) => issue.severity !== "hard"),
  };
}

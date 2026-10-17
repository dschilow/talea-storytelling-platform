/**
 * Fact check for text dokus, run by a model of ANOTHER family than the writer.
 *
 * The writer (doku-prompt.ts) is picked for energy, not for caution; in the
 * 2026-10-08 A/B it still slipped now and then ("90 % of milk is water that
 * never stays in the cheese", Tavi probing a wall socket with a tester). The
 * checker only reports concrete problems; fixes are applied deterministically
 * and only where the quoted sentence is found verbatim, so a confused checker
 * cannot rewrite the doku.
 *
 * Encore-free so scripts/doku-live-test.ts can run it.
 */

import type { DokuConfig, DokuSection } from "./generate";
import type { NormalizedDokuOutput } from "./doku-prompt";

export type FactCheckKind = "fact" | "safety" | "quiz" | "guess";

export interface FactCheckIssue {
  ref: string;
  kind: FactCheckKind;
  quote?: string;
  problem: string;
  fix?: string;
}

export interface FactCheckOutcome {
  /** What was changed, for logs and metadata. */
  applied: Array<{ ref: string; kind: FactCheckKind; problem: string; action: "replaced" | "removed" }>;
  /** Issues that could not be applied safely (quote not found, implausible fix). */
  skipped: Array<{ ref: string; kind: FactCheckKind; problem: string; reason: string }>;
}

const MAX_CHANGES = 12;

/** Checker from another family than the writer, so it does not share the writer's blind spots. */
export function resolveFactCheckModel(writerModel: string): { model: string; effort: "low" | "medium" } {
  const override = String(process.env.TALEA_DOKU_FACTCHECK_MODEL || "").trim();
  if (override) return { model: override, effort: "low" };
  return writerModel.startsWith("openai/")
    ? { model: "google/gemini-3.8-flash", effort: "low" }
    : { model: "openai/gpt-6-luna", effort: "medium" };
}

const SYSTEM_PROMPT = `Du bist Faktenprüferin für Kinder-Wissensdokus. Eine Doku ist als Reportage geschrieben: Reporter Tavi besucht Orte und trifft erfundene Fachleute mit echtem Beruf. Diese Erzählform ist gewollt — prüfe sie nicht.

Melde NUR echte Probleme dieser Art:
- fact: eine Aussage, Zahl oder ein Vergleich ist sachlich falsch, stark übertrieben oder wird als sicher dargestellt, obwohl die Forschung uneinig ist.
- safety: eine Stelle könnte Kinder zu gefährlichem Nachmachen verleiten (Strom und Steckdosen, Feuer, Hitze, Chemikalien, Höhen, schwere oder scharfe Werkzeuge, Wasser- oder Luftdruck, wilde Tiere), oder ein Experiment ist ohne Hinweis auf einen Erwachsenen riskant. Harmloses ist KEIN safety-Problem: eine Sprudelflasche schütteln, Milch ins Wasserglas tropfen, kurz ins Eiswasser fassen, Knete, Taschenlampe.
- quiz: bei einer Quizfrage ist die markierte Antwort falsch, mehrere Antworten sind richtig, oder die Frage lässt sich mit dem Text nicht beantworten. Ist nur die Erklärung falsch, melde fact mit quote aus der Erklärung.
- guess: die markierte Antwort oder die Auflösung der Rate-Frage ist falsch.

NICHT melden:
- Stil, Geschmack, Erzählperspektive, erfundene Fachleute und ihre harmlosen Anekdoten.
- Kindgerechte Vereinfachungen, die im Kern stimmen: „50-mal pro Sekunde“ ist richtig genug (kein „Nennfrequenz“ nötig), „Bakterien pupsen Gase aus“ ist erlaubte Kindersprache, gerundete Zahlen mit „etwa“ sind in Ordnung.
- Präzisierungen, die nur ein Fachbuch bräuchte. Melde nur, was eine Fachperson als FALSCH bezeichnen würde. Schulbuch-Modelle sind richtig genug: Magmakammer, „unter der Erde Magma, draußen Lava“, Erdplatten auf weichem Gestein, Sonnenlicht mit allen Regenbogenfarben.
- Harmloses Ausprobieren, das Kinder ohnehin tun: mit Griffel oder Stift schreiben, an einer Probe schnuppern, die die Fachperson reicht, Kleidung anprobieren, etwas Leichtes heben.
- Bildhafte Vergleiche („wie Kletten an der Socke“, „wie eine Stoßwelle“) sind gewollt — nur melden, wenn der Vergleich etwas Falsches über die Sache behauptet.
- Bei offenen Forschungsfragen nur, wenn der Text eine umstrittene Erklärung als sichere Tatsache darstellt.

Melde höchstens die 10 wichtigsten Probleme, safety zuerst.

Für fact und safety: quote = der betroffene Text EXAKT wie in der Doku (zeichengenau kopiert), fix = derselbe Text korrigiert. Der fix bleibt kindgerecht für die Zielgruppe: gleiche Wortwahl und gleicher Ton wie das Original, ungefähr so lang, keine Fachwörter, keine Absicherungsfloskeln („möglicherweise“, „unter anderem“), außer genau diese Unsicherheit ist der Fehler. Ein bildhafter Vergleich des Originals bleibt, wenn er nicht selbst falsch ist. Der fix bringt keine Person, keinen Ort und keinen Gegenstand ins Spiel, der an dieser Stelle noch nicht vorkam. Lässt sich das Problem so nicht reparieren, lass fix leer. Wäre eine korrigierte Wow-Karte nicht mehr verblüffend, lass fix leer — die Karte entfällt dann.

Die Doku muss nach der Korrektur in sich stimmig sein:
- Steht derselbe Fehler an mehreren Stellen (Kapiteltext, Wow-Karte, Quiz-Erklärung, Gecheckt-Punkt, Schlusssatz), melde JEDE Stelle als eigenes Problem mit eigenem quote und fix.
- safety in der Erzählung: quote = ALLE aufeinanderfolgenden Sätze, in denen Tavi die riskante Handlung ausführt oder auf sie reagiert. fix = eine stimmige Ersatzhandlung: Die Fachperson macht das Riskante, Tavi probiert selbst einen sicheren Teil (fühlt, misst, zählt mit, übt am Modell) und erlebt dabei etwas Echtes — nicht nur „ich schaue zu“. Der fix muss zum Satz davor und danach passen.

ref = die Kennung in eckigen Klammern, in der der Satz steht (z.B. "S2", "S3.F1", "S1.A1", "H", "R").

Antworte ausschließlich als JSON: {"issues":[{"ref":"S2","kind":"fact","quote":"…","problem":"…","fix":"…"}]}. Ohne Probleme: {"issues":[]}.`;

const letters = ["A", "B", "C", "D"];

function renderForCheck(doku: NormalizedDokuOutput): string {
  const lines: string[] = [];
  lines.push(`[T] Titel: ${doku.title}`);
  if (doku.hook) lines.push(`[H] ${doku.hook}`);
  if (doku.mainQuestion) lines.push(`[L] Leitfrage: ${doku.mainQuestion}`);
  if (doku.guess) {
    const options = doku.guess.options.map((option, i) => `${letters[i]}) ${option}`).join("  ");
    lines.push(`[G] Rate-Frage: ${doku.guess.question} | ${options} | markiert richtig: ${letters[doku.guess.answerIndex]} | Auflösung: ${doku.guess.reveal ?? ""}`);
  }
  doku.sections.forEach((section, s) => {
    const id = `S${s + 1}`;
    const where = [section.place, section.expert ? `${section.expert.role} ${section.expert.name ?? ""}`.trim() : ""].filter(Boolean).join(", ");
    lines.push("", `[${id}] Kapitel „${section.title}“${where ? ` (${where})` : ""}`, section.content);
    // Fact and comparison on separate lines: a quote spanning both is found in neither slot.
    section.keyFacts.forEach((fact, f) => {
      lines.push(`[${id}.F${f + 1}] Wow-Karte: ${fact.fact}`);
      if (fact.comparison) lines.push(`[${id}.F${f + 1}] Vergleich: ${fact.comparison}`);
    });
    (section.interactive?.quiz?.questions ?? []).forEach((question, q) => {
      const options = question.options.map((option, i) => `${letters[i]}) ${option}`).join("  ");
      lines.push(`[${id}.Q${q + 1}] Quiz: ${question.question} | ${options} | markiert richtig: ${letters[question.answerIndex]} | Erklärung: ${question.explanation ?? ""}`);
    });
    (section.interactive?.activities?.items ?? []).forEach((item, a) => {
      lines.push(
        `[${id}.A${a + 1}] Experiment „${item.title}“: ${item.description} | Material: ${(item.materials ?? []).join(", ")} | Schritte: ${(item.steps ?? []).join(" / ")} | Beobachtung: ${item.observe ?? ""} | Sicherheit: ${item.safetyNote ?? "—"}`,
      );
    });
  });
  if (doku.recap?.length) lines.push("", `[R] Gecheckt: ${doku.recap.join(" / ")}`);
  if (doku.closingLine) lines.push(`[C] ${doku.closingLine}`);
  return lines.join("\n");
}

export function buildFactCheckPayload(doku: NormalizedDokuOutput, config: Pick<DokuConfig, "ageGroup" | "topic">) {
  return {
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `Zielgruppe: ${config.ageGroup} Jahre. Thema: „${config.topic}“.\n\n${renderForCheck(doku)}`,
      },
    ],
    maxTokens: 12000,
  };
}

export function parseFactCheckIssues(raw: unknown): FactCheckIssue[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as any).issues) ? (raw as any).issues : [];
  return list
    .map((entry: any): FactCheckIssue | null => {
      const kind = String(entry?.kind || "").toLowerCase();
      if (kind !== "fact" && kind !== "safety" && kind !== "quiz" && kind !== "guess") return null;
      const problem = String(entry?.problem || "").replace(/\s+/g, " ").trim().slice(0, 400);
      const ref = String(entry?.ref || "").replace(/[\[\]\s]/g, "").toUpperCase();
      if (!problem || !ref) return null;
      const quote = String(entry?.quote || "").trim();
      const fix = String(entry?.fix || "").replace(/\s+/g, " ").trim();
      return { ref, kind, problem, ...(quote ? { quote } : {}), ...(fix ? { fix } : {}) };
    })
    .filter((issue: FactCheckIssue | null): issue is FactCheckIssue => Boolean(issue));
}

type RefParts = { section?: number; item?: "F" | "Q" | "A"; index?: number; top?: string };

function parseRef(ref: string): RefParts {
  const match = ref.match(/^S(\d+)(?:\.([FQA])(\d+))?$/);
  if (match) {
    return {
      section: Number(match[1]) - 1,
      ...(match[2] ? { item: match[2] as "F" | "Q" | "A", index: Number(match[3]) - 1 } : {}),
    };
  }
  return { top: ref };
}

/** Every editable reader-facing string, as getter/setter pairs, in reading order. */
function textSlots(doku: NormalizedDokuOutput, sectionFilter?: number): Array<{ get: () => string; set: (value: string) => void }> {
  const slots: Array<{ get: () => string; set: (value: string) => void }> = [];
  const add = (get: () => string | undefined, set: (value: string) => void) => slots.push({ get: () => get() ?? "", set });
  const sectionSlots = (section: DokuSection) => {
    add(() => section.content, (value) => { section.content = value; });
    for (const fact of section.keyFacts) {
      add(() => fact.fact, (value) => { fact.fact = value; });
      add(() => fact.comparison, (value) => { fact.comparison = value; });
    }
    for (const item of section.interactive?.activities?.items ?? []) {
      add(() => item.description, (value) => { item.description = value; });
      add(() => item.observe, (value) => { item.observe = value; });
      add(() => item.safetyNote, (value) => { item.safetyNote = value; });
      (item.steps ?? []).forEach((_, i) => add(() => item.steps?.[i], (value) => { if (item.steps) item.steps[i] = value; }));
    }
    for (const question of section.interactive?.quiz?.questions ?? []) {
      add(() => question.explanation, (value) => { question.explanation = value; });
    }
  };
  if (sectionFilter !== undefined) {
    const section = doku.sections[sectionFilter];
    if (section) sectionSlots(section);
    return slots;
  }
  add(() => doku.hook, (value) => { doku.hook = value; });
  if (doku.guess) add(() => doku.guess?.reveal, (value) => { if (doku.guess) doku.guess.reveal = value; });
  doku.sections.forEach(sectionSlots);
  (doku.recap ?? []).forEach((_, i) => add(() => doku.recap?.[i], (value) => { if (doku.recap) doku.recap[i] = value; }));
  add(() => doku.closingLine, (value) => { doku.closingLine = value; });
  return slots;
}

/** The checker sometimes copies the labels of renderForCheck ("Wow-Karte: …") into its quote. */
const RENDER_LABEL = /^(?:Wow-Karte|Vergleich|Sicherheit|Beobachtung|Schritte|Material|Quiz|Erklärung|Auflösung|Gecheckt|Experiment|Titel|Leitfrage|Rate-Frage)\s*:\s*/i;
const stripLabel = (text?: string) => (text ?? "").trim().replace(RENDER_LABEL, "").trim();
const DEFAULT_SAFETY_NOTE = "Nur zusammen mit einem Erwachsenen ausprobieren.";

/**
 * Finds the quote in the text, tolerant of whitespace: the checker sees
 * paragraphs and copies a quote that spans two of them with a plain space.
 */
function locateQuote(text: string, quote: string): { start: number; end: number } | null {
  const exact = text.indexOf(quote);
  if (exact >= 0) return { start: exact, end: exact + quote.length };
  const words = quote.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const pattern = new RegExp(words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"));
  const match = pattern.exec(text);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

function plausibleFix(quote: string, fix: string): boolean {
  if (!fix || fix === quote) return false;
  const ratio = fix.length / Math.max(1, quote.length);
  return ratio >= 0.35 && ratio <= 2.2;
}

/** Applies the checker's findings in place. Removals run last, from the back, so indices stay valid. */
export function applyFactCheck(doku: NormalizedDokuOutput, issues: FactCheckIssue[]): FactCheckOutcome {
  const outcome: FactCheckOutcome = { applied: [], skipped: [] };
  const removals: Array<{ issue: FactCheckIssue; section: number; item: "F" | "Q" | "A"; index: number }> = [];

  for (const issue of issues) {
    if (outcome.applied.length + removals.length >= MAX_CHANGES) {
      outcome.skipped.push({ ref: issue.ref, kind: issue.kind, problem: issue.problem, reason: "change limit reached" });
      continue;
    }
    const ref = parseRef(issue.ref);

    if (issue.kind === "guess" || ref.top === "G") {
      const quote = stripLabel(issue.quote);
      const fix = stripLabel(issue.fix);
      if (doku.guess && quote && fix && doku.guess.reveal?.includes(quote) && plausibleFix(quote, fix)) {
        doku.guess.reveal = doku.guess.reveal.replace(quote, fix);
        outcome.applied.push({ ref: issue.ref, kind: issue.kind, problem: issue.problem, action: "replaced" });
      } else if (doku.guess) {
        delete doku.guess;
        outcome.applied.push({ ref: issue.ref, kind: issue.kind, problem: issue.problem, action: "removed" });
      }
      continue;
    }

    if (issue.kind === "quiz") {
      if (ref.section !== undefined && ref.item === "Q" && ref.index !== undefined && doku.sections[ref.section]?.interactive?.quiz?.questions[ref.index]) {
        removals.push({ issue, section: ref.section, item: "Q", index: ref.index });
      } else {
        outcome.skipped.push({ ref: issue.ref, kind: issue.kind, problem: issue.problem, reason: "quiz ref not found" });
      }
      continue;
    }

    // fact / safety: replace the quoted sentence where it occurs.
    const quote = stripLabel(issue.quote);
    const fix = stripLabel(issue.fix);
    if (quote && quote !== "—" && fix && plausibleFix(quote, fix)) {
      const scoped = ref.section !== undefined ? textSlots(doku, ref.section) : [];
      const found = [...scoped, ...textSlots(doku)]
        .map((candidate) => ({ slot: candidate, at: locateQuote(candidate.get(), quote) }))
        .find((candidate) => candidate.at);
      if (found?.at) {
        const text = found.slot.get();
        found.slot.set(text.slice(0, found.at.start) + fix + text.slice(found.at.end));
        outcome.applied.push({ ref: issue.ref, kind: issue.kind, problem: issue.problem, action: "replaced" });
        continue;
      }
    }

    // A risky experiment keeps its place but gets an adult-supervision note.
    const activity =
      ref.section !== undefined && ref.item === "A" && ref.index !== undefined
        ? doku.sections[ref.section]?.interactive?.activities?.items[ref.index]
        : undefined;
    if (activity && issue.kind === "safety") {
      activity.safetyNote = fix && fix.length <= 200 ? fix : DEFAULT_SAFETY_NOTE;
      outcome.applied.push({ ref: issue.ref, kind: issue.kind, problem: issue.problem, action: "replaced" });
      continue;
    }

    // No usable fix: a wrong wow card or experiment goes; prose stays as it is.
    if (ref.section !== undefined && (ref.item === "F" || ref.item === "A") && ref.index !== undefined) {
      removals.push({ issue, section: ref.section, item: ref.item, index: ref.index });
      continue;
    }
    outcome.skipped.push({
      ref: issue.ref,
      kind: issue.kind,
      problem: issue.problem,
      reason: quote ? "quote not found or fix implausible" : "no quote",
    });
  }

  removals
    .sort((a, b) => b.section - a.section || b.index - a.index)
    .forEach(({ issue, section, item, index }) => {
      const target = doku.sections[section];
      if (!target) return;
      if (item === "F") target.keyFacts.splice(index, 1);
      if (item === "Q" && target.interactive?.quiz) {
        target.interactive.quiz.questions.splice(index, 1);
        target.interactive.quiz.enabled = target.interactive.quiz.questions.length > 0;
      }
      if (item === "A" && target.interactive?.activities) {
        target.interactive.activities.items.splice(index, 1);
        target.interactive.activities.enabled = target.interactive.activities.items.length > 0;
      }
      outcome.applied.push({ ref: issue.ref, kind: issue.kind, problem: issue.problem, action: "removed" });
    });

  return outcome;
}

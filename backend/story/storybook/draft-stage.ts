/**
 * Storybook Pipeline — Stage 3: the draft, and Stage 5: the revision.
 *
 * The writer gets the plan in story language (never a JSON dump), the craft
 * rules the critic will later apply, one short style sample for rhythm, and
 * the length per page. Output is plain text with page markers.
 */

import { buildLanguageRules, CRAFT_RULES, isGerman, type AgeBand } from "./craft";
import type { StoryBrief } from "./context";
import type { LlmCallResult, StorybookLlm } from "./llm";
import { parseDraft } from "./parsing";
import type { EditorialReview, StoryPlan, StorybookPage } from "./types";

/**
 * Written for this pipeline, not taken from any book. It demonstrates rhythm
 * only: repetition, a sound word, a visible gag, a deadpan reaction and a
 * page-turn hook — in ten short lines.
 */
const STYLE_SAMPLE_DE = [
  "Der Kuchen war rund, braun und so groß wie ein Wagenrad.",
  "„Den tragen wir zum Fest“, sagte Lotta. „Ganz. Vorsichtig.“",
  "Ben nickte. Dann stolperte er über den Gartenschlauch.",
  "Der Kuchen flog. Der Kuchen drehte sich. Der Kuchen landete — platsch! — mitten auf dem Hut von Herrn Brummel, der gerade über den Zaun schaute.",
  "Herr Brummel sagte nichts. Er leckte nur ganz langsam die Sahne von seiner Nase.",
  "Dann sagte er etwas, womit keiner gerechnet hatte.",
].join("\n");

function bandNote(band: AgeBand): string {
  if (band === "3-5") return "Deine Zuhörer sind drei bis fünf: alles muss man sofort sehen können, Wiederholung ist ein Geschenk, Angst bleibt klein und geborgen.";
  if (band === "9-12") return "Deine Zuhörer sind neun bis zwölf: sie lieben Tempo, Wortwitz und echte Gefahr — aber keine Erwachsenen-Abstraktionen.";
  return "Deine Zuhörer sind sechs bis acht: sie folgen jeder Wendung, solange jeder Schritt aus dem vorigen kommt, und sie lachen laut über Slapstick und Figuren, die sich lächerlich sicher sind.";
}

export function buildWriterSystemPrompt(brief: StoryBrief): string {
  const lines = [
    `Du bist eine der besten Kinderbuchautorinnen und schreibst auf ${brief.languageLabel}. Deine Bilderbücher werden abends hundertmal vorgelesen, und die Kinder sprechen die besten Sätze mit.`,
    bandNote(brief.band),
    "",
    "Deine Lektorin gibt dir einen fertigen Seitenplan. Die Handlung steht. Du machst daraus Szenen, die man sieht, Sätze, die klingen, und Pointen, die sitzen.",
    "",
    "DEIN HANDWERK:",
    ...CRAFT_RULES.map((rule) => `- ${rule}`),
    "",
    "SO KLINGT ES:",
    ...buildLanguageRules(brief.band, brief.languageLabel).map((rule) => `- ${rule}`),
    "",
    "WAS DU NIE TUST:",
    "- Zusammenfassen statt erzählen ('Sie erlebten viele Abenteuer'). Jede Seite ist eine Szene mit Handlung und Stimmen.",
    "- Den Witz erklären, oder Figuren lachen lassen, damit es lustig wirkt.",
    "- Gefühle benennen statt zeigen ('Er war traurig').",
    "- Eine Lehre oder Botschaft aussprechen, besonders am Ende.",
    "- Neue Figuren mit Namen erfinden, die nicht im Plan stehen.",
    "- Etwas voraussetzen, das eine Figur noch nicht wissen oder haben kann.",
  ];
  if (isGerman(brief.config.language)) {
    lines.push("", "STILPROBE aus einer ganz anderen Geschichte (nur Rhythmus und Ton — keine Figuren, Dinge oder Sätze daraus übernehmen):", STYLE_SAMPLE_DE);
  }
  lines.push(
    "",
    "AUSGABEFORMAT — genau so, ohne Markdown, ohne Überschriften, ohne Kommentare:",
    "TITEL: <Titel>",
    "BESCHREIBUNG: <ein Satz, 12–25 Wörter, macht neugierig und verrät nicht das Ende>",
    "SEITE 1",
    "<Text der Seite, in Absätzen>",
    "",
    "SEITE 2",
    "<Text der Seite>",
    "",
    "… bis zur letzten Seite. Die Marker TITEL, BESCHREIBUNG und SEITE bleiben immer deutsch, auch wenn die Geschichte in einer anderen Sprache ist.",
  );
  if (isGerman(brief.config.language)) lines.push("Wörtliche Rede in deutschen Anführungszeichen: „so“.");
  return lines.join("\n");
}

/** The plan, rewritten as a brief a human author would get. */
export function renderPlanForWriter(plan: StoryPlan, brief: StoryBrief): string {
  const lines: string[] = [];
  lines.push(`TITEL: ${plan.title}`);
  lines.push(`WORUM ES GEHT: ${plan.logline}`);
  lines.push(`WAS DIE HELDEN WOLLEN: ${plan.want} — auf dem Spiel steht: ${plan.stakes}`);
  if (plan.worldRule) lines.push(`DIE REGEL DIESER WELT (gilt immer gleich, man sieht sie wirken, niemand erklärt sie lang): ${plan.worldRule}`);
  if (plan.runningGag.what) {
    lines.push(`DER LAUFGAG: ${plan.runningGag.what}`);
    plan.runningGag.beats.forEach((beat, index) => lines.push(`  ${index + 1}. ${beat}`));
    lines.push("  Beim dritten Mal kippt er. Nie erklären.");
  }
  if (plan.refrain) {
    lines.push(`DER SATZ ZUM MITSPRECHEN: „${plan.refrain}“ — dreimal, immer von einer Figur laut gesagt und auf einer eigenen Zeile; beim dritten Mal mit neuer Bedeutung.`);
  }
  if (plan.dramaticIrony) lines.push(`DAS ZUHÖRENDE KIND WEISS MEHR ALS DIE FIGUR: ${plan.dramaticIrony}`);
  if (plan.setups.length > 0) {
    lines.push("VORBEREITEN UND AUSZAHLEN (unauffällig zeigen, später ist es der Schlüssel):");
    for (const setup of plan.setups) lines.push(`  - ${setup.what}: zeigen auf Seite ${setup.plantedOnPage}, zahlt sich aus auf Seite ${setup.paysOffOnPage}`);
  }
  lines.push("");

  lines.push("DIE HELDEN (sie haben die entscheidende Idee und führen sie selbst aus):");
  for (const hero of plan.heroes) {
    const source = brief.heroes.find((entry) => entry.id === hero.id);
    const age = typeof source?.age === "number" && source.age > 0 ? `, ${source.age} Jahre` : "";
    lines.push(`  - ${hero.name}${age}: kann besonders ${hero.strength || "—"}; spricht ${hero.voice || "natürlich"}; Beitrag: ${hero.contribution}`);
  }
  if (plan.cast.length > 0) {
    lines.push("DIE NEBENFIGUREN (aus unserem Figurenpool — genau so heißen sie):");
    for (const member of plan.cast) {
      const candidate = brief.candidates.find((entry) => entry.id === member.id);
      const catchphrase = candidate?.catchphrase ? `; darf höchstens EINMAL sagen: „${candidate.catchphrase}“` : "";
      const look = candidate?.whoTheyAre ? ` (${candidate.whoTheyAre})` : "";
      lines.push(`  - ${member.name}${look}: ${member.role}; will: ${member.want}; spricht: ${member.voice}; typisch: ${member.signature}${catchphrase}`);
    }
    lines.push("  Stell jede Nebenfigur beim ersten Auftritt durch das vor, was sie tut oder sagt, mit ihrem Aussehen in der Bewegung — nicht als Steckbrief.");
  }
  if (plan.artifact) {
    const option = brief.artifacts.find((artifact) => artifact.id === plan.artifact!.id);
    const owner = option?.broughtBy ? brief.heroes.find((hero) => hero.id === option.broughtBy)?.name : undefined;
    lines.push(
      plan.artifact.carried
        ? `DAS MITGEBRACHTE ARTEFAKT: ${plan.artifact.name} — ${owner || "ein Held"} hat es von Anfang an dabei (es wird NICHT gefunden). Es kann genau das: ${option?.rule || plan.artifact.role}. Einsatz: ${plan.artifact.role} (Seite ${plan.artifact.usePage}). Es hilft, die Idee der Kinder entscheidet.`
        : `DAS FUNDSTÜCK: ${plan.artifact.name} — gefunden auf Seite ${plan.artifact.firstPage}, entscheidend benutzt auf Seite ${plan.artifact.usePage}. Es kann genau das: ${option?.rule || plan.artifact.role}. Am Ende bleibt es bei den Kindern. Nenne es immer mit genau diesem Namen.`
    );
  }
  lines.push("");

  lines.push("SEITE FÜR SEITE:");
  for (const page of plan.pages) {
    lines.push(`SEITE ${page.page} — Ort: ${page.place}`);
    lines.push(`  Was passiert: ${page.action}`);
    if (page.heroMoment) lines.push(`  Heldenmoment: ${page.heroMoment}`);
    if (page.humor) lines.push(`  Komik: ${page.humor}`);
    if (page.emotion) lines.push(`  Gefühl (zeigen, nicht benennen): ${page.emotion}`);
    lines.push(page.page === plan.pages.length ? `  Schluss: ${page.turn}` : `  Seitenende (Grund umzublättern): ${page.turn}`);
  }
  lines.push("");
  const sentence = (value: string) => (value && !/[.!?…]$/.test(value.trim()) ? `${value.trim()}.` : value.trim());
  lines.push(`DAS ENDE: ${sentence(plan.ending.resolution)} Das Anfangsbild kehrt zurück: ${sentence(plan.ending.callback)} Letzte Pointe: ${sentence(plan.ending.lastLine)}`);
  return lines.join("\n");
}

function lengthBlock(brief: StoryBrief): string[] {
  const { budget } = brief;
  return [
    "UMFANG (wird nachgezählt):",
    `- Genau ${budget.pages} Seiten.`,
    `- Jede Seite ${budget.wordsPerPageMin}–${budget.wordsPerPageMax} Wörter. Insgesamt ${budget.totalWordsMin}–${budget.totalWordsMax} Wörter.`,
    "- Lieber eine starke Szene pro Seite als drei hastige. Kürzen heißt: Erklärungen weglassen, nicht Handlung.",
  ];
}

export function buildDraftUserPrompt(plan: StoryPlan, brief: StoryBrief, retryNotes: string[] = []): string {
  const lines: string[] = [renderPlanForWriter(plan, brief), ""];
  lines.push(...lengthBlock(brief));
  if (brief.blockedTerms.length > 0) lines.push(`- Diese Begriffe dürfen nirgends vorkommen: ${brief.blockedTerms.join(", ")}`);
  if (retryNotes.length > 0) {
    lines.push("", "DER ERSTE VERSUCH HATTE DIESE FEHLER — diesmal nicht:");
    for (const note of retryNotes) lines.push(`- ${note}`);
  }
  lines.push("", "Schreib jetzt die Geschichte.");
  return lines.join("\n");
}

export function renderStoryForPrompt(title: string, pages: StorybookPage[]): string {
  return [`TITEL: ${title}`, ...pages.map((page) => `SEITE ${page.order}\n${page.content}`)].join("\n\n");
}

export function buildRevisionUserPrompt(input: {
  plan: StoryPlan;
  brief: StoryBrief;
  title: string;
  pages: StorybookPage[];
  review: EditorialReview | null;
  checkNotes: string[];
}): string {
  const { plan, brief, review } = input;
  const lines: string[] = [];
  lines.push("Deine Lektorin hat deinen Entwurf gelesen. Überarbeite die GANZE Geschichte: dieselbe Geschichte, nur besser — keine neue.");
  lines.push("");
  lines.push("DER PLAN (zur Orientierung, gilt weiter):");
  lines.push(renderPlanForWriter(plan, brief));
  lines.push("");
  lines.push("DEIN ENTWURF:");
  lines.push(renderStoryForPrompt(input.title, input.pages));
  lines.push("");

  const must = [
    ...input.checkNotes,
    ...(review?.mustFix || []).map((note) => `Seite ${note.page}: ${note.problem}${note.quote ? ` („${note.quote}“)` : ""} → ${note.fix}`),
  ];
  if (must.length > 0) {
    lines.push("DAS MUSS SICH ÄNDERN (jeder Punkt):");
    for (const note of must) lines.push(`- ${note}`);
    lines.push("");
  }
  if (review?.languageErrors?.length) {
    lines.push("SPRACHFEHLER (korrigieren):");
    for (const error of review.languageErrors) lines.push(`- Seite ${error.page}: „${error.quote}“ → ${error.correction}`);
    lines.push("");
  }
  if (review?.polish?.length) {
    lines.push("DAS MACHT ES NOCH BESSER (wenn es passt):");
    for (const note of review.polish) lines.push(`- Seite ${note.page}: ${note.problem} → ${note.fix}`);
    lines.push("");
  }
  if (review?.keep?.length) {
    lines.push("DAS IST STARK — BEHALTEN (möglichst wörtlich):");
    for (const quote of review.keep) lines.push(`- „${quote}“`);
    lines.push("");
  }
  lines.push(...lengthBlock(brief));
  lines.push("", "Gib die vollständige überarbeitete Geschichte im selben Format aus (TITEL, BESCHREIBUNG, SEITE 1 …).");
  return lines.join("\n");
}

export interface WriterStageResult {
  title: string;
  description: string;
  pages: StorybookPage[];
  call: LlmCallResult;
}

function writerMaxTokens(brief: StoryBrief): number {
  // Prose (~2 tokens per German word) + markers + room for light reasoning.
  return Math.max(6000, Math.ceil(brief.budget.totalWordsMax * 2.4) + 4000);
}

export async function runDraftStage(
  llm: StorybookLlm,
  brief: StoryBrief,
  plan: StoryPlan,
  model: string,
  retryNotes: string[] = []
): Promise<WriterStageResult> {
  const call = await llm({
    stage: retryNotes.length > 0 ? "draft-retry" : "draft",
    role: "writer",
    model,
    system: buildWriterSystemPrompt(brief),
    user: buildDraftUserPrompt(plan, brief, retryNotes),
    json: false,
    maxTokens: writerMaxTokens(brief),
    effort: "low",
    temperature: 0.85,
  });
  const parsed = parseDraft(call.text, brief.budget.pages, { german: isGerman(brief.config.language) });
  return { title: parsed.title || plan.title, description: parsed.description || plan.logline, pages: parsed.pages, call };
}

export async function runRevisionStage(
  llm: StorybookLlm,
  input: { brief: StoryBrief; plan: StoryPlan; title: string; pages: StorybookPage[]; review: EditorialReview | null; checkNotes: string[] },
  model: string
): Promise<WriterStageResult> {
  const call = await llm({
    stage: "revision",
    role: "writer",
    model,
    system: buildWriterSystemPrompt(input.brief),
    user: buildRevisionUserPrompt(input),
    json: false,
    maxTokens: writerMaxTokens(input.brief),
    effort: "low",
    temperature: 0.7,
  });
  const parsed = parseDraft(call.text, input.brief.budget.pages, { german: isGerman(input.brief.config.language) });
  return { title: parsed.title || input.title, description: parsed.description, pages: parsed.pages, call };
}


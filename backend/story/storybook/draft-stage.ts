/**
 * Storybook Pipeline — Stage 3: the draft, and Stage 5: the revision.
 *
 * The writer gets the plan in story language (never a JSON dump), the craft
 * rules the critic will later apply, one short style sample for rhythm, and
 * the length per page. Output is plain text with page markers.
 */

import { buildLanguageRules, buildSlimLanguageRules, CORE_RULES, CRAFT_RULES, isGerman, type AgeBand } from "./craft";
import { heroSeasoning, isLean, type StoryBrief } from "./context";
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
  "„Den tragen wir zu Oma“, sagte Lotta. „Ganz. Vorsichtig.“",
  "Ben nickte. Dann stolperte er über den Gartenschlauch.",
  "Der Kuchen flog. Der Kuchen drehte sich. Der Kuchen landete — platsch! — mitten auf dem Hut von Herrn Brummel, der gerade über den Zaun schaute.",
  "Herr Brummel sagte nichts. Er leckte nur ganz langsam die Sahne von seiner Nase.",
  "Dann sagte er etwas, womit keiner gerechnet hatte.",
].join("\n");

/**
 * Experiment "pictureBook" (2026-09-29): written for this pipeline, not taken
 * from any book. Shows what the short sample cannot: a cascade that grows three
 * times and tips, repetition with a twist, a page turn as surprise, a warm beat.
 */
const STYLE_SAMPLE_PICTUREBOOK_DE = [
  "Der Kürbis war rund. Der Kürbis war orange. Und der Kürbis war viel zu schwer.",
  "„Ich zieh“, sagte Lotta. Sie zog. Der Kürbis blieb liegen.",
  "„Wir ziehen“, sagte Ben. Sie zogen. Der Kürbis blieb liegen.",
  "Da kam Herr Brummel über den Zaun. „Lasst mich mal. Ich bin der stärkste Mann im ganzen Dorf.“",
  "Er zog. Er zog, bis sein Hut davonflog. Er zog, bis seine Hosenträger sangen: Pling! Plong!",
  "Der Kürbis blieb liegen.",
  "Da setzte sich eine kleine Maus oben auf den Kürbis.",
  "(nächste Seite) Und der Kürbis rollte los — mitten in Herrn Brummels Tomaten.",
  "Lotta hielt Bens Hand. Ganz fest. Denn jetzt drehte sich Herr Brummel um.",
  "Er sah die Tomaten. Er sah die Maus. Und dann lachte er so laut, dass die Maus vom Kürbis fiel.",
].join("\n");

function bandNote(band: AgeBand): string {
  if (band === "3-5") return "Deine Zuhörer sind drei bis fünf: alles muss man sofort sehen können, Wiederholung ist ein Geschenk, Angst bleibt klein und geborgen.";
  if (band === "9-12") return "Deine Zuhörer sind neun bis zwölf: sie lieben Tempo, Wortwitz und echte Gefahr — aber keine Erwachsenen-Abstraktionen.";
  return "Deine Zuhörer sind sechs bis acht: sie folgen jeder Wendung, solange jeder Schritt aus dem vorigen kommt, und sie lachen laut über Slapstick und Figuren, die sich lächerlich sicher sind.";
}

export function buildWriterSystemPrompt(brief: StoryBrief, options: { oneShot?: boolean } = {}): string {
  if (options.oneShot) return [
    `Du schreibst ein eigenständiges, warmes Bilderbuch auf ${brief.languageLabel}, das beim Vorlesen lebendig klingt.`,
    bandNote(brief.band),
    "Die Vorgaben der Familie für Alter, Länge, Stimmung und Inhalt gelten. Plane still, dann erzähle chronologisch im Präteritum.",
    "Seite 1: ein ruhiges, malbares Anfangsbild; Ort und Helden kennenlernen. Zeige beim ersten Auftritt kurz, wer eine Figur ist und was sie gerade möchte. Erst am Seitenende kommt die Störung; spätestens Seite 2 ist das Problem klar. Keine nachgereichte Vorgeschichte.",
    "Das Ziel bedeutet den Helden persönlich etwas. Ihre Eigenschaften zeigen sich in Entscheidungen und eigenen Beiträgen, nicht in einem Steckbrief. Auch der Gegenspieler hat einen früh verständlichen Wunsch.",
    "Jeder Versuch verändert die Lage und verursacht den nächsten. Eine sichtbare Gefahr oder Schwierigkeit, keine konkurrierenden Fristen. Intensität und Komik folgen den Wünschen der Familie; stille Geschichten brauchen weder Slapstick noch einen Bösewicht.",
    "Die entscheidende Idee kommt von den Helden und nutzt etwas früh Gezeigtes. Die Lösung ist in einem Kindersatz verständlich. Erwachsene dürfen mithelfen, aber nicht die Lösung übernehmen. Kein Zufall als Rettung.",
    "Jede Seite hat einen klaren Schwerpunkt. Verfolge Orte, Wege, Besitzer und Zustand wichtiger Dinge. Übergänge und Bewegungen müssen nachvollziehbar sein; auch Tiere werden aus Gefahren sichtbar in Sicherheit gebracht.",
    "Kurze und mittlere Sätze wechseln, konkrete Verben, natürliche Dialoge mit eigenen Stimmen. Gefühle durch Verhalten zeigen. Unbekannte Dinge beim ersten Auftreten knapp in Kinderworten erklären. Keine Semikolons, Erwachsenen-Abstraktionen oder erklärten Witze.",
    "Wiederholung schafft Vorfreude: ein verständlicher Satz zum Mitsprechen, mit einer passenden Wendung am Schluss. Seitenenden machen durch ein Ereignis neugierig, nicht durch Erzählerfragen. Ende mit Geborgenheit, einem veränderten Anfangsbild oder einer Pointe, ohne Moralpredigt.",
    "Nur erlaubte Namen. Artefaktregeln bleiben unverändert. Sprache, Wortumfang und Seitenzahl exakt nach Auftrag; keine Füllsätze, keine zusätzlichen Nebenhandlungen.",
    // Sol 6.1 test 2026-09-30: a moral spoken by a character, an invented sibling bond, a character sheet on page 1.
    "Keine Lehre, auch nicht als Satz einer Figur („Magie liegt in dir“). Wie die Helden zueinander stehen, ist nicht bekannt: nenne keine Verwandtschaft oder Freundschaft, zeige Nähe durch gemeinsames Handeln. Kleidung, Haar und Alter der Helden höchstens als beiläufiger Halbsatz, nie als Steckbrief. Der Titel greift ein Ding, Wesen oder einen Satz auf, das in der Geschichte wirklich vorkommt.",
    ...(isGerman(brief.config.language) ? ["Wörtliche Rede: „so“. Kurze Stilprobe (nur Rhythmus, nichts übernehmen):", STYLE_SAMPLE_DE] : []),
    "Ausgabe ohne Markdown: TITEL: …, BESCHREIBUNG: … (12–25 Wörter), danach SEITE 1, Text, SEITE 2, Text usw. Diese Marker bleiben deutsch; alle Inhalte in der gewünschten Sprache. Zusätzliche Kopfzeilen nur wie im Auftrag angegeben.",
  ].join("\n");
  const lines = [
    `Du bist eine der besten Kinderbuchautorinnen und schreibst auf ${brief.languageLabel}. Deine Bilderbücher werden abends hundertmal vorgelesen, und die Kinder sprechen die besten Sätze mit.`,
    bandNote(brief.band),
    "",
    // The one-shot writer invents the story itself; telling it "the plot is
    // fixed" contradicted the task it gets in the same call.
    options.oneShot
      ? "Du erfindest die Geschichte selbst, planst sie Seite für Seite und schreibst sie dann: Szenen, die man sieht, Sätze, die klingen, und Pointen, die sitzen."
      : "Deine Lektorin gibt dir einen fertigen Seitenplan. Die Handlung steht. Du machst daraus Szenen, die man sieht, Sätze, die klingen, und Pointen, die sitzen.",
    "",
    "DEIN HANDWERK:",
    ...(brief.experiment?.slim || isLean(brief) ? CORE_RULES : CRAFT_RULES).map((rule) => `- ${rule}`),
    "",
    "SO KLINGT ES:",
    ...(brief.experiment?.slim || isLean(brief) ? buildSlimLanguageRules(brief.languageLabel) : buildLanguageRules(brief.band, brief.languageLabel)).map((rule) => `- ${rule}`),
    "",
    "WAS DU NIE TUST:",
    "- Zusammenfassen statt erzählen ('Sie erlebten viele Abenteuer'). Jede Seite ist eine Szene mit Handlung und Stimmen.",
    "- Den Witz erklären, oder Figuren lachen lassen, damit es lustig wirkt.",
    "- Gefühle benennen statt zeigen ('Er war traurig').",
    "- Eine Lehre oder Botschaft aussprechen, besonders am Ende.",
    "- Neue Figuren mit Namen erfinden, die nicht im Plan stehen.",
    "- Etwas voraussetzen, das eine Figur noch nicht wissen oder haben kann.",
    "- Dieselbe Verlegenheitsgeste immer wieder ('presste die Lippen zusammen', 'hielt den Atem an', 'ließ die Schultern sinken'). Jede Figur zeigt Gefühle auf ihre eigene Art, und nicht in jedem Absatz.",
    "",
    "BEVOR DU SCHREIBST, prüfe im Kopf Seite für Seite: Wo ist jede Figur? Wer hält welches Ding? Wie weit ist die Frist? Passt der Anfang jeder Seite zum Ende der vorigen?",
  ];
  if (isGerman(brief.config.language)) {
    lines.push("", "STILPROBE aus einer ganz anderen Geschichte (nur Rhythmus und Ton — keine Figuren, Dinge oder Sätze daraus übernehmen):", brief.experiment?.pictureBook ? STYLE_SAMPLE_PICTUREBOOK_DE : STYLE_SAMPLE_DE);
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
  if (plan.obstacleMotive) lines.push(`WARUM DER GEGENSPIELER DAS TUT (früh zeigen, Seite 1 oder 2): ${plan.obstacleMotive}`);
  if (plan.props.length > 0) {
    lines.push("DIE WICHTIGEN DINGE (jedes ist immer an einem bestimmten Ort und wechselt ihn nur sichtbar):");
    for (const prop of plan.props) lines.push(`  - ${prop.thing}: am Anfang ${prop.start}; zuerst auf Seite ${prop.firstPage}`);
  }
  if (plan.worldRule) {
    lines.push(`DIE REGEL DIESER WELT (gilt immer gleich, man sieht sie wirken, niemand erklärt sie lang): ${plan.worldRule}`);
    if (plan.ruleIntro) lines.push(`  So versteht das Kind sie, BEVOR sie gebraucht wird: ${plan.ruleIntro}`);
  }
  if (plan.solutionWhy) lines.push(`WARUM DIE LÖSUNG KLAPPT (muss am Ende für ein Kind sofort einleuchten): ${plan.solutionWhy}`);
  if (plan.runningGag.what) {
    lines.push(`DER LAUFGAG: ${plan.runningGag.what}`);
    plan.runningGag.beats.forEach((beat, index) => lines.push(`  ${index + 1}. ${beat}`));
    lines.push("  Beim dritten Mal kippt er. Nie erklären.");
  }
  if (plan.refrain) {
    lines.push(`DER SATZ ZUM MITSPRECHEN: „${plan.refrain}“ — dreimal, beim dritten Mal mit neuer Bedeutung. Jedes Mal hört man, WER ihn ruft und warum gerade jetzt („…“, rief Adrian.) — nie als Satz ohne Sprecher.`);
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
    const seasoning = source ? heroSeasoning(source) : "";
    if (seasoning) lines.push(`    Würze, höchstens EINMAL beiläufig und nie als Lösung: ${seasoning}`);
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
    if (page.after) lines.push(`  Stand am Seitenende (die nächste Seite beginnt genau hier): ${page.after}`);
    lines.push(page.page === plan.pages.length ? `  Schluss: ${page.turn}` : `  Seitenende (Grund umzublättern): ${page.turn}`);
  }
  lines.push("");
  const sentence = (value: string) => (value && !/[.!?…]$/.test(value.trim()) ? `${value.trim()}.` : value.trim());
  lines.push(`DAS ENDE: ${sentence(plan.ending.resolution)} Das Anfangsbild kehrt zurück: ${sentence(plan.ending.callback)} Letzte Pointe: ${sentence(plan.ending.lastLine)}`);
  return lines.join("\n");
}

export function lengthBlock(brief: StoryBrief): string[] {
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
  lines.push("Sagt die Lektorin, etwas komme aus dem Nichts (eine Eigenart, ein Trick, ein Ding): Zeig es auf einer frühen Seite in einem kurzen, sichtbaren Moment — mit seinem Grund. Das ist Pflicht, auch wenn der Plan es nicht vorsah.");
  lines.push("Prüf zum Schluss jede Seite: Niemand ist an zwei Orten zugleich oder tut zwei Dinge, die sich ausschließen (erst das Tuch festbinden und im selben Moment im Korb sitzen). Deine Änderungen dürfen keine neuen Widersprüche erzeugen.");
  lines.push("Jede Seite behält Absätze: neue Zeile bei jedem Sprecherwechsel und nach jedem Bildwechsel — nie ein einziger Textblock.");
  lines.push("BEIM ÜBERARBEITEN NICHT: neue Erzählerfragen am Seitenende, neue Figuren, Erklärsätze statt Szenen.");
  lines.push("");
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

/** Hidden reasoning shares max_tokens with the prose; xhigh needs real room. */
const WRITER_REASONING_HEADROOM = 30000;

function writerMaxTokens(brief: StoryBrief): number {
  // Prose (~2 tokens per German word) + markers + room for deep reasoning:
  // Measured 2026-09-28: xhigh/high drafts cost 8-10x, took 4-5 min and in
  // about one run in four spent the whole budget thinking without writing a
  // line — with no better stories than "medium" (the plan and its review
  // carry the structure). The headroom stays for the occasional long think.
  return Math.max(6000, Math.ceil(brief.budget.totalWordsMax * 2.4) + 4000) + WRITER_REASONING_HEADROOM;
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
    effort: isLean(brief) ? "low" : "medium",
    timeoutMs: 300_000,
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
    effort: isLean(input.brief) ? "low" : "medium",
    timeoutMs: 300_000,
    temperature: 0.7,
  });
  const parsed = parseDraft(call.text, input.brief.budget.pages, { german: isGerman(input.brief.config.language) });
  return { title: parsed.title || input.title, description: parsed.description, pages: parsed.pages, call };
}


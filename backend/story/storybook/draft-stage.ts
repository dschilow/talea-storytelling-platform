/**
 * Storybook Pipeline — Stage 2: the draft. ONE call.
 *
 * The old engine wrote the same story seven times (draft, retry, rebalance,
 * polish, rebalance, chapter-repair, polish) and still failed its own gate.
 * 67% of its spend was rework. Here the writer gets a plan it can actually
 * hold in its head and writes once.
 *
 * The prompt is deliberately small — roughly 2.5k tokens. What reaches the
 * writer is story language: who wants what, what happens on which page, the
 * joke, the refrain, and how to write sentences. No screenplay jargon, no
 * twenty-six competing contracts, no JSON schema for prose.
 *
 * Output is plain text with page markers rather than JSON: a model that has to
 * escape German typographic quotes inside JSON strings spends attention on
 * syntax that belongs in the prose.
 */

import type { StoryConfig } from "../generate";
import { callWriter, type LlmCallResult } from "./llm";
import { parseDraft } from "./parsing";
import { languageName, type AgeBand, type LengthBudget } from "./style-contract";
export { parseDraft } from "./parsing";

import type {
  KidLogicCard,
  StorybookArtifact,
  StorybookCastMember,
  StorybookHero,
  StorybookPage,
} from "./types";

export interface DraftStageInput {
  config: StoryConfig;
  card: KidLogicCard;
  heroes: StorybookHero[];
  cast: StorybookCastMember[];
  artifact?: StorybookArtifact;
  band: AgeBand;
  budget: LengthBudget;
  styleContract: string;
  writerModel: string;
  /** Notes from a failed first attempt. */
  repairNotes?: string[];
}

export interface DraftStageResult {
  title: string;
  description: string;
  pages: StorybookPage[];
  raw: string;
  call: LlmCallResult;
}

export function buildDraftSystemPrompt(band: AgeBand, languageLabel: string): string {
  return [
    `Du bist Kinderbuchautorin und schreibst eine Vorlesegeschichte auf ${languageLabel}.`,
    "",
    "Du bekommst einen fertigen Plan. Du erfindest die Handlung nicht neu — du schreibst sie schön.",
    "Deine ganze Aufmerksamkeit gehört den Sätzen: dass sie klingen, dass sie tragen, dass ein Kind",
    "nach jedem Absatz weiß, warum das jetzt passiert ist.",
    "",
    "Das Handwerk, an dem du dich misst: eine Maus erfindet ein Monster, um nicht gefressen zu werden,",
    "und benutzt am Ende denselben Trick gegen das Monster selbst. Ein Kater ruft „ich helfe“ und macht",
    "dabei alles kaputt. Das ist das Niveau: eine einzige klare Regel, dreimal ausgespielt, beim dritten",
    "Mal anders — und dazwischen jemand, der sich lächerlich sicher ist.",
    "",
    band === "3-5"
      ? "Deine Zuhörer sind drei bis fünf. Alles muss man sich sofort vorstellen können."
      : band === "9-12"
        ? "Deine Zuhörer sind neun bis zwölf. Sie vertragen Zwischentöne, aber keine leeren Abstraktionen."
        : "Deine Zuhörer sind sechs bis acht. Sie können folgen — aber nur, wenn jeder Schritt aus dem vorigen kommt.",
    "",
    "AUSGABEFORMAT (nur das, kein Markdown, kein JSON):",
    "TITEL: <Titel>",
    "BESCHREIBUNG: <ein vollständiger Satz, 12-25 Wörter, konkret, ohne Moral>",
    "SEITE 1",
    "<Absätze>",
    "",
    "SEITE 2",
    "<Absätze>",
    "",
    "… und so weiter. Keine Seitenüberschriften außer der Zeile SEITE <Zahl>. Keine Kapitelnamen.",
  ].join("\n");
}

function heroSheet(hero: StorybookHero): string {
  const bits: string[] = [`${hero.name}`];
  if (typeof hero.age === "number") bits.push(`${hero.age} Jahre`);
  const description = String(hero.description || "").replace(/\s+/g, " ").trim();
  if (description) bits.push(description.slice(0, 160));
  const narrative = hero.narrativeProfile && typeof hero.narrativeProfile === "object" ? hero.narrativeProfile : null;
  const voice = String(narrative?.voice || narrative?.speakingStyle || "").trim();
  if (voice) bits.push(`spricht ${voice}`);
  const quirk = String(narrative?.quirk || "").trim();
  if (quirk) bits.push(quirk);
  return `- ${bits.join(", ")}`;
}

function castSheet(member: StorybookCastMember): string {
  const bits: string[] = [`- ${member.name}: ${member.whoTheyAre}. Will: ${member.wants}.`];
  if (member.speechStyle && member.speechStyle.length > 0) bits.push(`Ton: ${member.speechStyle.join(", ")}.`);
  if (member.quirk) bits.push(`Macht immer: ${member.quirk}.`);
  if (member.catchphrase) bits.push(`Darf GENAU EINMAL sagen: „${member.catchphrase}“${member.catchphraseContext ? ` (${member.catchphraseContext})` : ""}.`);
  return bits.join(" ");
}

export function buildDraftUserPrompt(input: DraftStageInput): string {
  const { card, budget, config } = input;
  const lines: string[] = [];

  lines.push(`GESCHICHTE: ${card.titel}`);
  lines.push(`Worum es geht: ${card.kurzbeschreibung}`);
  lines.push("");

  lines.push("DER ROTE FADEN — so hängt alles zusammen. Genau diese Kette muss ein Kind nacherzählen können:");
  lines.push(`  ${card.kette?.will}`);
  lines.push(`  ${card.kette?.aber}`);
  lines.push(`  ${card.kette?.also}`);
  lines.push(`  ${card.kette?.dadurch}`);
  lines.push(`  ${card.kette?.entweder}`);
  lines.push(`  ${card.kette?.waehlt}`);
  lines.push(`  ${card.kette?.ende}`);
  lines.push("");

  lines.push("DIE REGEL DIESER WELT:");
  lines.push(`  ${card.wunderregel?.regel}`);
  lines.push(`  Man sieht jedes Mal: ${card.wunderregel?.sichtbareFolge}`);
  lines.push("  Sie wird zwei Mal sichtbar ausprobiert, bevor sie im Finale zählt. Niemand erklärt sie — man sieht sie wirken.");
  lines.push("");

  lines.push("DIE DREI STUFEN (jede schlimmer und lustiger als die vorige):");
  card.dreierSchritt?.forEach((beat, index) => lines.push(`  ${index + 1}. ${beat}`));
  lines.push(`  Umkehrung am Schluss: ${card.umkehrung}`);
  lines.push(`  Preis, den die Hauptfigur zahlt: ${card.preis}`);
  lines.push(`  Schlussbild: ${card.schlussbild}`);
  lines.push("");

  lines.push(`DER REFRAIN: „${card.refrain}“`);
  lines.push("  Drei Mal. Einmal beiläufig, einmal unter Druck, einmal am Schluss mit neuer Bedeutung.");
  lines.push("  Immer von einer Figur gesprochen, immer auf einer eigenen kurzen Zeile.");
  lines.push("");

  lines.push(`DER LAUFGAG (${card.laufgag?.typ}): ${card.laufgag?.beschreibung}`);
  card.laufgag?.stellen?.forEach((spot, index) => lines.push(`  ${index + 1}. ${spot}`));
  lines.push("  Der Witz steht in der Handlung, nie im Erzählerkommentar. Nie erklären.");
  lines.push("");

  lines.push("DIE SEITEN — jede Seite endet so, dass ein Kind weiterblättern will:");
  for (const page of card.seiten || []) {
    lines.push(`  SEITE ${page.nr}: ${page.was}`);
    lines.push(`    offene Frage am Seitenende: ${page.frage}`);
  }
  lines.push("");

  lines.push("HAUPTFIGUREN — sie haben die entscheidende Idee und führen sie selbst aus:");
  for (const hero of input.heroes) lines.push(heroSheet(hero));
  lines.push("");

  if (input.cast.length > 0) {
    lines.push("NEBENFIGUREN — sie machen es schwerer. Keine von ihnen erklärt die Lösung:");
    for (const member of input.cast) lines.push(castSheet(member));
    lines.push("");
  }

  const figuresNeedingIntro = (card.figuren || []).filter(
    (figure) => !input.heroes.some((hero) => hero.name.split(/\s+/)[0] === String(figure.name || "").split(/\s+/)[0])
  );
  if (figuresNeedingIntro.length > 0) {
    // Hand over the FACTS, never a finished sentence.
    //
    // This block used to print `werSieSind` verbatim — "Räuber Rolf trägt eine
    // Augenklappe, eine geflickte Lederweste und einen rostigen Krummsäbel" —
    // under the heading "one sentence says who the figure is". A model given a
    // complete, correct sentence and told to write one sentence copies it. Run
    // 6683b402 pasted five such lines into a past-tense story, present tense
    // and all, and every one of them stopped the narration dead.
    lines.push("DIESE FIGUREN KENNT DAS KIND NOCH NICHT. Führ jede über eine HANDLUNG ein, nie über einen Steckbrief.");
    lines.push("  Die Merkmale unten sind Material, kein Satz. Verwende sie nicht als eigenen Vorstellungssatz,");
    lines.push("  sondern arbeite sie in das ein, was die Figur beim ersten Auftritt tut oder sagt.");
    lines.push("  Verboten ist jeder Satz der Form „<Name> ist ein …“ oder „<Name> trägt …“.");
    for (const figure of figuresNeedingIntro) {
      const traits = String(figure.werSieSind || "")
        .replace(/^\s*(?:Der |Die |Das )?[^,]*?\b(?:ist|sind|trägt|hat)\b\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
      lines.push(`- ${figure.name} — Merkmale: ${traits || figure.werSieSind}`);
    }
    lines.push("");
  }

  if (input.artifact) {
    lines.push(`FUNDSTÜCK: ${input.artifact.name} — ${input.artifact.storyRole}`);
    lines.push("  Es taucht auf, wird einmal benutzt und bleibt am Ende da. Es löst nichts allein.");
    lines.push("");
  }

  lines.push(input.styleContract);
  lines.push("");

  lines.push("UMFANG:");
  lines.push(`- Genau ${budget.pages} Seiten, jede ${budget.pageCharsMin}–${budget.pageCharsMax} Zeichen.`);
  lines.push(`- Insgesamt ${budget.totalWordsMin}–${budget.totalWordsMax} Wörter.`);
  lines.push("- 4 bis 6 Absätze pro Seite.");
  lines.push("- Direkte Rede gehört dazu, wo sie etwas bewegt. Zähle keine Prozente — schreib die Szene.");
  if (String(config.language || "de").toLowerCase().startsWith("de")) {
    lines.push("- Wörtliche Rede in deutschen Anführungszeichen: „so“.");
  }

  if (input.repairNotes && input.repairNotes.length > 0) {
    lines.push("");
    lines.push("DER ERSTE VERSUCH HATTE DIESE FEHLER — vermeide sie diesmal:");
    for (const note of input.repairNotes) lines.push(`- ${note}`);
  }

  lines.push("");
  lines.push("Schreib jetzt die Geschichte.");

  return lines.join("\n");
}

export async function runDraftStage(input: DraftStageInput): Promise<DraftStageResult> {
  const call = await callWriter({
    system: buildDraftSystemPrompt(input.band, languageName(input.config.language)),
    user: buildDraftUserPrompt(input),
    model: input.writerModel,
    maxTokens: Math.max(2200, Math.ceil(input.budget.totalWordsMax * 2.6)),
    json: false,
    temperature: 0.9,
  });

  const parsed = parseDraft(call.text, input.budget.pages);
  return {
    title: parsed.title || input.card.titel,
    description: parsed.description || input.card.kurzbeschreibung,
    pages: parsed.pages,
    raw: call.text,
    call,
  };
}

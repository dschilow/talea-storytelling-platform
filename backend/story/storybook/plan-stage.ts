/**
 * Storybook Pipeline — Stage 1: the Kinderlogik-Karte.
 *
 * The single highest-leverage artifact in the pipeline. Before one word of
 * prose exists, the premise is personalised onto the actual heroes and written
 * out as a causal chain in six connected sentences of child language.
 *
 * If that chain cannot be filled with "weil / aber / also / dadurch", the
 * premise is dead and no writer call is worth paying for. The old engine paid
 * for seven prose passes on a story whose chain had two unfillable links.
 */

import type { StoryConfig } from "../generate";
import { callSupport, parseJsonObject, type LlmCallResult } from "./llm";
import { buildStyleContract, languageName, type AgeBand, type LengthBudget } from "./style-contract";
import type {
  KidLogicCard,
  ResolvedPremise,
  StorybookArtifact,
  StorybookCastMember,
  StorybookHero,
} from "./types";

const GAG_EXPLANATIONS: Record<string, string> = {
  selbstbewusst_falsch:
    "Eine Figur ist felsenfest von etwas überzeugt, das offensichtlich falsch ist, und handelt danach.",
  koerperliche_eskalation:
    "Eine kleine Schweinerei wird von Mal zu Mal größer, bis sie absurd ist.",
  das_ding_hoert_nicht_auf:
    "Ein Gegenstand macht immer wieder dasselbe — jedes Mal im schlechtestmöglichen Moment.",
  erwachsener_merkt_nichts:
    "Ein Erwachsener übersieht seelenruhig genau das, was jedes Kind sofort sieht.",
  woertlich_genommen:
    "Jemand befolgt eine Anweisung exakt wörtlich und richtet damit Chaos an.",
};

function heroLine(hero: StorybookHero): string {
  const bits: string[] = [hero.name];
  if (typeof hero.age === "number") bits.push(`${hero.age} Jahre`);

  const description = String(hero.description || "").replace(/\s+/g, " ").trim();
  if (description) bits.push(description.slice(0, 180));

  const narrative = hero.narrativeProfile && typeof hero.narrativeProfile === "object" ? hero.narrativeProfile : null;
  const voice = String(narrative?.voice || narrative?.speakingStyle || "").trim();
  const quirk = String(narrative?.quirk || "").trim();
  if (voice) bits.push(`spricht ${voice}`);
  if (quirk) bits.push(quirk);

  // Strongest two personality traits become the friction/strength the story
  // can actually dramatise. Anything below 20 is noise at this age.
  const traits = hero.personalityTraits && typeof hero.personalityTraits === "object" ? hero.personalityTraits : null;
  if (traits) {
    const ranked = Object.entries(traits)
      .map(([key, value]) => {
        const numeric = typeof value === "number" ? value : Number((value as any)?.value);
        return { key, numeric: Number.isFinite(numeric) ? numeric : 0 };
      })
      .filter((entry) => entry.numeric >= 20)
      .sort((a, b) => b.numeric - a.numeric)
      .slice(0, 2)
      .map((entry) => entry.key);
    if (ranked.length > 0) bits.push(`stark in: ${ranked.join(", ")}`);
  }

  return `- ${bits.join(" — ")}`;
}

function castLine(member: StorybookCastMember): string {
  const bits: string[] = [`- ${member.name} (${member.roleNeed})`];
  bits.push(`wer: ${member.whoTheyAre}`);
  bits.push(`will: ${member.wants}`);
  if (member.catchphrase) {
    bits.push(`Spruch (HÖCHSTENS EINMAL in der ganzen Geschichte): „${member.catchphrase}“`);
  }
  if (member.quirk) bits.push(`Marotte: ${member.quirk}`);
  if (member.speechStyle && member.speechStyle.length > 0) bits.push(`Ton: ${member.speechStyle.join(", ")}`);
  return bits.join(" | ");
}

function wishLines(config: StoryConfig): string[] {
  const lines: string[] = [];
  if (config.tone) lines.push(`Ton: ${config.tone}`);
  if (typeof config.humorLevel === "number") lines.push(`Humor-Wunsch: ${config.humorLevel}/3`);
  if (typeof config.suspenseLevel === "number") lines.push(`Spannungs-Wunsch: ${config.suspenseLevel}/3`);
  if (config.hasTwist) lines.push("Eine überraschende Wendung ist gewünscht — früh andeuten, nicht aus dem Nichts.");
  if (config.allowRhymes) lines.push("Reim/Rhythmus erwünscht: der Refrain darf sich reimen.");
  if (config.requireHappyEnd) lines.push("Das Ende muss gut ausgehen.");
  if (config.requireMoral) lines.push("Eine Botschaft ist erwünscht — sie wird GEZEIGT, nie ausgesprochen.");
  if (config.allowFamousCharacters) {
    lines.push("Bekannte Märchenfiguren (gemeinfrei) dürfen als Gäste auftreten, die Hauptfiguren bleiben die Helden.");
  }
  if (config.learningMode?.enabled && config.learningMode.subjects?.length) {
    lines.push(`Nebenbei lernen: ${config.learningMode.subjects.join(", ")} — eingebaut in die Handlung, kein Unterricht.`);
  }
  const wish = String(config.customPrompt || "").replace(/\s+/g, " ").trim();
  if (wish) lines.push(`Wunsch des Kindes/der Eltern: ${wish.slice(0, 400)}`);
  if (config.parentalGuidance) {
    lines.push(`Sicherheitsvorgabe: ${String(config.parentalGuidance).replace(/\s+/g, " ").trim().slice(0, 300)}`);
  }
  return lines;
}

export interface PlanStageInput {
  config: StoryConfig;
  resolved: ResolvedPremise;
  heroes: StorybookHero[];
  cast: StorybookCastMember[];
  artifact?: StorybookArtifact;
  band: AgeBand;
  budget: LengthBudget;
  /** Set on a retry so the planner knows what to fix. */
  repairNotes?: string[];
}

export interface PlanStageResult {
  card: KidLogicCard | null;
  raw: string;
  call: LlmCallResult;
}

export function buildPlanSystemPrompt(): string {
  return [
    "Du bist Dramaturg für Kinderbücher und planst eine Geschichte, bevor sie geschrieben wird.",
    "Du schreibst KEINE Prosa. Du füllst eine Planungskarte aus.",
    "",
    "Die wichtigste Regel: Ein Kind muss die Kette WILL → ABER → ALSO → DADURCH → ENTWEDER → WÄHLT → ENDE",
    "hören und verstehen können. Jedes Feld beginnt mit seinem Verbindungswort und ist EIN kurzer Satz",
    "in Kindersprache. Keine Fachwörter, keine Drehbuchbegriffe, keine Abstraktionen.",
    "",
    "Verboten in der Karte:",
    "- Wünsche, die man nicht anfassen kann („einen Fehler ungeschehen machen“, „Mut finden“).",
    "  Richtig ist immer ein Ding oder ein erreichbares Ziel („die Schuhe rechtzeitig zum Spiel bringen“).",
    "- Ein Gegenspieler, der nur Langeweile hat. Er braucht einen eigenen Wunsch, der mit dem Kind kollidiert.",
    "- Eine Wunderregel ohne sichtbare Folge. Wenn man die Wirkung nicht sehen kann, gibt es sie für ein Kind nicht.",
    "- Seitenfragen wie „Schafft er es?“ oder „Was passiert jetzt?“. Die Frage muss konkret sein:",
    "  „Wer klopft an die Tür?“, „Reicht der letzte Knoten?“",
    "",
    "Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Kein Markdown, keine Erklärung.",
  ].join("\n");
}

export function buildPlanUserPrompt(input: PlanStageInput): string {
  const { config, budget } = input;
  const { premise, variant, directives } = input.resolved;
  const lang = languageName(config.language);
  const gagHint = GAG_EXPLANATIONS[variant.gag] || GAG_EXPLANATIONS[premise.gagType] || "";

  const lines: string[] = [];

  lines.push("AUFGABE: Übertrage die feste Prämisse unten auf diese Kinder und fülle die Planungskarte.");
  lines.push("Die Prämisse ist gesetzt. Du erfindest keine neue Geschichte — du machst diese hier zu IHRER Geschichte.");
  lines.push("");

  lines.push("PRÄMISSE (Struktur, fest):");
  lines.push(`- Situation: ${premise.situation}`);
  lines.push(`- Was das Kind will: ${premise.childWant}`);
  lines.push(`- Was auf dem Spiel steht: ${premise.whyItHurts}`);
  lines.push(`- Wunderregel: ${premise.wonderRule.rule}`);
  lines.push(`- Sichtbare Folge jedes Einsatzes: ${premise.wonderRule.visibleSideEffect}`);
  lines.push(`- Dreierschritt: 1) ${premise.escalation[0]} 2) ${premise.escalation[1]} 3) ${premise.escalation[2]}`);
  lines.push(`- Umkehrung am Schluss: ${premise.reversal}`);
  lines.push(`- Preis, den das Kind zahlt: ${premise.price}`);
  lines.push(`- Schlussbild: ${premise.closingImage}`);
  lines.push(`- Laufgag-Typ: ${variant.gag}${gagHint ? ` — ${gagHint}` : ""}`);
  lines.push("");

  lines.push("DIESE FASSUNG (überschreibt die Prämisse an genau diesen Stellen):");
  for (const directive of directives) lines.push(`- ${directive}`);
  lines.push("Die Struktur bleibt. Die Oberfläche ist neu. Nichts aus der Prämisse darf im Widerspruch dazu stehen bleiben.");
  lines.push("");

  lines.push("HAUPTFIGUREN (das sind die Helden, sie treffen jede wichtige Entscheidung selbst):");
  for (const hero of input.heroes) lines.push(heroLine(hero));
  lines.push("");

  if (input.cast.length > 0) {
    lines.push("NEBENFIGUREN (dürfen es schwerer machen, nie die Lösung erklären):");
    for (const member of input.cast) lines.push(castLine(member));
    lines.push("");
  }

  if (input.artifact) {
    lines.push("FUNDSTÜCK (taucht auf und wird EINMAL benutzt, löst aber nichts allein):");
    lines.push(`- ${input.artifact.name}: ${input.artifact.storyRole}`);
    lines.push("");
  }

  lines.push("RAHMEN:");
  lines.push(`- Sprache: ${lang}`);
  lines.push(`- Genre: ${config.genre} | Ort: ${config.setting}`);
  lines.push(`- Alter: ${config.ageGroup}`);
  lines.push(`- ${budget.pages} Leseseiten, insgesamt ${budget.totalWordsMin}–${budget.totalWordsMax} Wörter`);
  const wishes = wishLines(config);
  if (wishes.length > 0) {
    for (const wish of wishes) lines.push(`- ${wish}`);
  }
  lines.push("");

  if (input.repairNotes && input.repairNotes.length > 0) {
    lines.push("DIESE PUNKTE WAREN BEIM LETZTEN VERSUCH FALSCH — behebe sie:");
    for (const note of input.repairNotes) lines.push(`- ${note}`);
    lines.push("");
  }

  lines.push("ANTWORTE MIT GENAU DIESEM JSON:");
  lines.push(
    JSON.stringify(
      {
        titel: "kurzer Titel, der neugierig macht, mit dem Namen der Hauptfigur",
        kurzbeschreibung: "ein Satz, 12-25 Wörter, konkret: Wunsch + Hindernis. Keine Moral.",
        kette: {
          will: "NAME will ...",
          aber: "Aber ...",
          also: "Also ...",
          dadurch: "Dadurch ... (schlimmer als vorher)",
          entweder: "Jetzt kann NAME nur noch ... oder ...",
          waehlt: "NAME wählt ..., weil ...",
          ende: "Am Ende ...",
        },
        wunderregel: { regel: "in einem Satz, so wie ein Kind sie nacherzählen würde", sichtbareFolge: "was man jedes Mal sieht" },
        dreierSchritt: ["erster Versuch", "zweiter Versuch, schlimmer", "dritter Versuch, am schlimmsten und am lustigsten"],
        umkehrung: "dieselbe Handlung wie am Anfang, aber jetzt mit mehr Einsatz",
        preis: "das konkrete Ding, das die Hauptfigur hergibt",
        schlussbild: "das Anfangsobjekt, verändert",
        ankerObjekt: "das eine Ding, das am Anfang und am Ende vorkommt (nur der Gegenstand, 1-3 Wörter)",
        refrain: "3-6 Wörter, die eine Figur laut sagt, zum Mitsprechen. Keine Erklärung der Magie.",
        laufgag: {
          typ: variant.gag,
          beschreibung: "was genau lustig ist",
          stellen: ["erstes Mal", "zweites Mal", "drittes Mal — anders als vorher"],
        },
        seiten: Array.from({ length: budget.pages }, (_, index) => ({
          nr: index + 1,
          was: "was auf dieser Seite sichtbar passiert",
          frage: "konkrete offene Frage am Seitenende",
        })),
        figuren: [{ name: "Name", werSieSind: "ein Satz, wer das ist", willWas: "was diese Figur will" }],
      },
      null,
      1
    )
  );
  lines.push("");
  lines.push("figuren enthält ALLE Figuren mit Namen — Hauptfiguren und Nebenfiguren.");
  lines.push(`seiten enthält genau ${budget.pages} Einträge.`);
  lines.push("Die letzte Seitenfrage darf offen klingen, muss aber konkret sein.");

  return lines.join("\n");
}

export async function runPlanStage(input: PlanStageInput): Promise<PlanStageResult> {
  const call = await callSupport({
    system: buildPlanSystemPrompt(),
    user: buildPlanUserPrompt(input),
    maxTokens: 1800,
    json: true,
    temperature: 0.7,
  });

  const card = parseJsonObject<KidLogicCard>(call.text);
  return { card, raw: call.text, call };
}

/**
 * The style contract is built here so the writer prompt can stay a thin
 * assembly step. Exported for the draft stage and for tests.
 */
export function styleContractFor(band: AgeBand, budget: LengthBudget, config: StoryConfig): string {
  return buildStyleContract(band, budget, languageName(config.language));
}

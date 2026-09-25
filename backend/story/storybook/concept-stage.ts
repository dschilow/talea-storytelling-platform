/**
 * Storybook Pipeline — Stage 1: three pitches.
 *
 * Concept is where picture books are won or lost. storybook-v1 drew its
 * premise from a hand-written bank and swapped objects, places and units
 * independently; the combinatorics produced premises no child could follow
 * ("a sailing sled on the water that ties a knot into its rope on every ride").
 *
 * Here the support model pitches three genuinely different stories, each on a
 * different proven engine (craft.ts), built around THESE heroes, a cast chosen
 * from the character pool and — depending on the wizard — an artifact. The
 * plan stage then picks the strongest and fixes its weaknesses.
 */

import { CRAFT_RULES, rankEngines, type StoryEngine } from "./craft";
import { artifactSheet, briefHeader, broughtArtifact, castSheet, heroSheet, wishLines, type StoryBrief } from "./context";
import { parseJsonObject, type LlmCallResult, type StorybookLlm } from "./llm";
import type { StoryPitch } from "./types";

export const PITCH_COUNT = 3;

export function selectEnginesForBrief(brief: StoryBrief, count = 5): StoryEngine[] {
  const flavors = Array.isArray((brief.config as any).emotionalFlavors) ? (brief.config as any).emotionalFlavors : [];
  return rankEngines({ band: brief.band, flavors, recentEngineIds: brief.recentEngineIds, seed: brief.seed }).slice(0, count);
}

export function buildConceptSystemPrompt(): string {
  return [
    "Du bist Programmleiterin eines Kinderbuchverlags. Eure Bücher stehen im Regal neben Der Grüffelo, Pettersson und Findus, Räuber Hotzenplotz, Das NEINhorn, Für Hund und Katze ist auch noch Platz, Wo die wilden Kerle wohnen und Das Sams — und halten mit.",
    "Du kennst die Baupläne dieser Bücher genau. Du entwickelst NEUE Geschichten, die genauso gut funktionieren. Du kopierst nie Figuren, Titel, Sätze oder Handlungen bekannter Bücher.",
    "",
    "Ein Pitch ist nur gut, wenn alles davon stimmt:",
    "- Ein Kind weiß nach EINEM Satz, worum es geht, und will sofort weiterhören.",
    "- Der Wunsch ist anfassbar, das Hindernis sichtbar. Keine unsichtbaren Probleme wie 'Mut finden' oder 'lernen zu teilen'.",
    "- Die Komik kommt aus einer Figur mit Eigenart oder einer Lage, die sich aufschaukelt — etwas, das man zeichnen kann.",
    "- Die Lösung ist eine clevere Idee der Kinder selbst, vorbereitet durch ein frühes, unscheinbares Detail.",
    "- Jede gewählte Nebenfigur will selbst etwas und hat eine Funktion, ohne die die Geschichte nicht funktioniert.",
    "- Die Welt ist logisch: Orte, Wege, Besitz, Zeit und magische Regeln bleiben stimmig.",
    "",
    "HANDWERK, DAS ALLE GROSSEN BILDERBÜCHER TEILEN:",
    ...CRAFT_RULES.map((rule) => `- ${rule}`),
    "",
    "Verboten: Moralpredigten, 'Freundschaft ist das Wichtigste'-Plots, Rettung durch Erwachsene, Zufall als Lösung, Traum-Enden, Figuren, die nur Sprüche aufsagen, echte Gewalt, Schreckbilder für die Kleinsten.",
    "",
    "Antworte ausschließlich mit einem gültigen JSON-Objekt. Alle Textfelder in der Sprache der Geschichte, außer den ids.",
  ].join("\n");
}

export function buildConceptUserPrompt(brief: StoryBrief, engines: StoryEngine[]): string {
  const lines: string[] = [];
  lines.push("AUFGABE: Entwickle drei grundverschiedene Pitches für ein Bilderbuch mit diesen Helden.");
  lines.push("");
  lines.push("RAHMEN:");
  for (const line of briefHeader(brief)) lines.push(`- ${line}`);
  for (const line of wishLines(brief.config)) lines.push(`- ${line}`);
  lines.push("");

  lines.push("DIE HELDEN (sie tragen die Geschichte und haben die entscheidende Idee):");
  for (const hero of brief.heroes) lines.push(heroSheet(hero, brief.heroMemories[hero.id] || []));
  if (brief.heroes.length > 1) {
    lines.push("Jedes Kind bekommt eine eigene, unterschiedliche Stärke und einen eigenen Beitrag zur Lösung.");
  }
  lines.push("Erfinde keine Familiengeschichte, keine Haustiere und keine Geschwister der Helden dazu.");
  lines.push("");

  if (brief.candidates.length > 0) {
    lines.push(`CASTING — Figuren aus dem Figurenpool. Jeder Pitch besetzt 1 bis ${brief.budget.maxCast} davon (per id) mit einer echten Aufgabe:`);
    for (const candidate of brief.candidates) lines.push(castSheet(candidate));
    lines.push("Nutze Eigenart und Stimme dieser Figuren. Erfinde keine weiteren Figuren mit Namen; namenlose Randfiguren (eine Nachbarin, drei Hühner) sind erlaubt.");
    lines.push("");
  } else {
    lines.push("CASTING: Der Figurenpool ist leer. Höchstens eine namenlose Nebenfigur.");
    lines.push("");
  }

  const brought = broughtArtifact(brief);
  if (brought) {
    const owner = brief.heroes.find((hero) => hero.id === brought.broughtBy);
    lines.push("MITGEBRACHTES ARTEFAKT (Pflicht in jedem Pitch):");
    lines.push(artifactSheet(brought));
    lines.push(`${owner?.name || "Ein Held"} hat es von Anfang an dabei — es wird NICHT gefunden. Seine Regel gilt genau so, mit ihren Grenzen. Es hilft an einer entscheidenden Stelle, löst aber nichts allein.`);
    lines.push("");
  } else if (brief.artifacts.length > 0) {
    lines.push("FUNDSTÜCK (optional — nur wenn es natürlich in die Handlung passt; höchstens eins pro Pitch):");
    for (const artifact of brief.artifacts) lines.push(artifactSheet(artifact));
    lines.push("Wenn ein Pitch eines nimmt: Es wird unterwegs gefunden, einmal an einer wichtigen Stelle benutzt (die Idee der Kinder bleibt entscheidend) und bleibt am Ende bei ihnen. Seine Fähigkeiten sind genau die angegebenen.");
    lines.push("");
  }

  lines.push("BAUPLÄNE — jeder Pitch nimmt einen ANDEREN davon:");
  for (const engine of engines) {
    lines.push(`- ${engine.id} — ${engine.name} (bewährt in: ${engine.provenBy})`);
    lines.push(`  So funktioniert er: ${engine.mechanism}`);
    lines.push(`  Komik: ${engine.humor}`);
    lines.push(`  Typischer Fehler, den du vermeidest: ${engine.trap}`);
  }
  lines.push("");

  if (brief.recentStories.length > 0) {
    lines.push("DIESE FAMILIE KENNT SCHON (nichts davon wiederholen — weder Idee noch Hauptgegenstand noch Titelmuster):");
    for (const story of brief.recentStories) lines.push(`- ${story}`);
    lines.push("");
  }

  if (brief.blockedTerms.length > 0) {
    lines.push(`Diese Begriffe dürfen nirgends vorkommen: ${brief.blockedTerms.join(", ")}`);
    lines.push("");
  }

  lines.push("ANTWORTE MIT GENAU DIESEM JSON (drei Einträge in pitches):");
  lines.push(
    JSON.stringify(
      {
        pitches: [
          {
            engine: "id des Bauplans",
            title: "Titel, der neugierig macht (mit Namen eines Helden, kein Doppelpunkt-Untertitel)",
            logline: "Ein Satz: wer will was, was steht im Weg, was ist der Witz daran",
            heroWant: "das anfassbare Ziel",
            stakes: "was konkret verloren geht, wenn es nicht klappt",
            obstacle: { who: "Gegenspieler oder Hindernis", want: "was er/es selbst will", weakness: "seine komische Schwäche" },
            comicEngine: "woraus die Komik entsteht — konkret",
            runningGag: "was dreimal wiederkehrt und beim dritten Mal kippt",
            dramaticIrony: "was das zuhörende Kind weiß, die Figur aber nicht",
            escalation: ["erster Versuch / erste Begegnung", "zweite, größer", "dritte, anders und am knappsten"],
            lowPoint: "der Moment kurz vor Schluss, in dem alles verloren scheint",
            cleverSolution: "die Idee der Kinder, die es löst",
            plantedClue: "das frühe, unscheinbare Detail, das die Lösung möglich macht",
            heroRoles: brief.heroes.map((hero) => ({ heroId: hero.id, strength: "was dieses Kind besonders kann", contribution: "sein Beitrag zur Lösung" })),
            cast: [{ id: "id aus dem Figurenpool", role: "Funktion in der Geschichte" }],
            artifact: brought ? { id: brought.id, use: "wann und wie es hilft" } : null,
            lastPage: "das Schlussbild mit der letzten Pointe",
            whyKidsLoveIt: "ehrlich: warum ein Kind diese Geschichte noch einmal hören will",
          },
        ],
      },
      null,
      1
    )
  );
  return lines.join("\n");
}

function text(value: unknown, max = 600): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Keeps only what the brief allows: known engines, heroes, cast ids and artifacts. */
export function sanitizePitches(raw: any, brief: StoryBrief, engines: StoryEngine[]): StoryPitch[] {
  const list = Array.isArray(raw?.pitches) ? raw.pitches : Array.isArray(raw) ? raw : [];
  const heroIds = new Set(brief.heroes.map((hero) => hero.id));
  const candidateIds = new Set(brief.candidates.map((candidate) => candidate.id));
  const artifactIds = new Set(brief.artifacts.map((artifact) => artifact.id));
  const engineIds = new Set(engines.map((engine) => engine.id));
  const brought = broughtArtifact(brief);

  return list
    .filter((pitch: any) => pitch && typeof pitch === "object" && text(pitch.logline))
    .slice(0, PITCH_COUNT)
    .map((pitch: any): StoryPitch => {
      const cast = (Array.isArray(pitch.cast) ? pitch.cast : [])
        .map((entry: any) => ({ id: text(entry?.id, 120), role: text(entry?.role, 200) }))
        .filter((entry: { id: string }) => candidateIds.has(entry.id))
        .filter((entry: { id: string }, index: number, all: Array<{ id: string }>) => all.findIndex((other) => other.id === entry.id) === index)
        .slice(0, brief.budget.maxCast);
      let artifact = pitch.artifact && artifactIds.has(text(pitch.artifact.id, 120))
        ? { id: text(pitch.artifact.id, 120), use: text(pitch.artifact.use, 300) }
        : null;
      if (brought) artifact = { id: brought.id, use: artifact?.use || text(pitch.artifact?.use, 300) };
      return {
        engine: engineIds.has(text(pitch.engine, 40)) ? text(pitch.engine, 40) : text(pitch.engine, 40) || "frei",
        title: text(pitch.title, 90),
        logline: text(pitch.logline, 400),
        heroWant: text(pitch.heroWant, 300),
        stakes: text(pitch.stakes, 300),
        obstacle: {
          who: text(pitch.obstacle?.who, 200),
          want: text(pitch.obstacle?.want, 200),
          weakness: text(pitch.obstacle?.weakness, 200),
        },
        comicEngine: text(pitch.comicEngine, 300),
        runningGag: text(pitch.runningGag, 300),
        dramaticIrony: text(pitch.dramaticIrony, 300),
        escalation: (Array.isArray(pitch.escalation) ? pitch.escalation : []).map((step: unknown) => text(step, 300)).filter(Boolean).slice(0, 4),
        lowPoint: text(pitch.lowPoint, 300),
        cleverSolution: text(pitch.cleverSolution, 400),
        plantedClue: text(pitch.plantedClue, 300),
        heroRoles: (Array.isArray(pitch.heroRoles) ? pitch.heroRoles : [])
          .map((role: any) => ({ heroId: text(role?.heroId, 120), strength: text(role?.strength, 200), contribution: text(role?.contribution, 300) }))
          .filter((role: { heroId: string }) => heroIds.has(role.heroId)),
        cast,
        artifact,
        lastPage: text(pitch.lastPage, 300),
        whyKidsLoveIt: text(pitch.whyKidsLoveIt, 300),
      };
    });
}

export interface ConceptStageResult {
  pitches: StoryPitch[];
  engines: StoryEngine[];
  call: LlmCallResult;
}

export async function runConceptStage(llm: StorybookLlm, brief: StoryBrief, model: string): Promise<ConceptStageResult> {
  const engines = selectEnginesForBrief(brief);
  const call = await llm({
    stage: "concept",
    role: "support",
    model,
    system: buildConceptSystemPrompt(),
    user: buildConceptUserPrompt(brief, engines),
    json: true,
    maxTokens: 14000,
    effort: "medium",
    temperature: 0.95,
  });
  const pitches = sanitizePitches(parseJsonObject<any>(call.text), brief, engines);
  return { pitches, engines, call };
}

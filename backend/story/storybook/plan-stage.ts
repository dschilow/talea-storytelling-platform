/**
 * Storybook Pipeline — Stage 2: pick the strongest pitch, build the page plan.
 *
 * The plan is the single highest-leverage artifact. A defect caught here costs
 * one cheap support call; the same defect caught after the draft costs a
 * rewrite. So the plan carries everything a picture book needs page by page:
 * what happens, the hero's move, the joke, the feeling, why you turn the page,
 * and the one moment the illustrator should draw.
 */

import { CRAFT_RULES } from "./craft";
import { artifactSheet, briefHeader, broughtArtifact, castSheet, heroSheet, wishLines, type StoryBrief } from "./context";
import { parseJsonObject, type LlmCallResult, type StorybookLlm } from "./llm";
import type { PlanPage, StoryPitch, StoryPlan } from "./types";

/** Where the beats go, for this page count. */
export function pageRhythm(pages: number): string[] {
  if (pages <= 5) {
    return [
      "Seite 1: Wer will was, was steht im Weg — und ein Haken, der neugierig macht. Das unscheinbare Detail für die spätere Lösung wird gezeigt.",
      "Seite 2: Erster und zweiter Versuch, der zweite größer und komischer.",
      `Seite 3: Der dritte Versuch ist anders — und kippt. Am Seitenende scheint alles verloren.`,
      "Seite 4: Die Idee der Kinder (mit dem vorbereiteten Detail) und das Finale.",
      "Seite 5: Auflösung, Rückkehr zum Anfangsbild — verwandelt — und die Schlusspointe.",
    ];
  }
  const lowPoint = pages - 2;
  const finale = pages - 1;
  return [
    "Seite 1: Wer will was, was steht im Weg — und ein Haken, der neugierig macht. Das unscheinbare Detail für die spätere Lösung wird gezeigt.",
    `Seiten 2 bis ${lowPoint - 1}: Der Dreierschritt — drei Versuche oder Begegnungen, jede größer, knapper und komischer; die dritte ist anders. Der Laufgag kehrt wieder.${pages >= 9 ? " Eine Überraschung in der Mitte ändert die Lage." : ""}`,
    `Seite ${lowPoint}: Der Tiefpunkt — es sieht aus, als wäre alles verloren.`,
    `Seite ${finale}: Die Idee der Kinder (mit dem vorbereiteten Detail) und das Finale.`,
    `Seite ${pages}: Auflösung, Rückkehr zum Anfangsbild — verwandelt — und die Schlusspointe.`,
  ];
}

export function buildPlanSystemPrompt(): string {
  return [
    "Du bist die leitende Lektorin eines Kinderbuchverlags. Dein Maßstab sind die besten Bilderbücher: Der Grüffelo, Pettersson und Findus, Räuber Hotzenplotz, Das NEINhorn, Das Sams.",
    "Vor dir liegen drei Pitches. Du wählst den stärksten, reparierst seine Schwächen (gute Einfälle aus den anderen Pitches darfst du übernehmen) und baust daraus den verbindlichen Seitenplan für die Autorin.",
    "",
    "So wählst du — in dieser Reihenfolge:",
    "1. Versteht ein Kind in einem Satz, worum es geht, und will es sofort wissen, wie es ausgeht?",
    "2. Lösen die Kinder es selbst, mit einer vorbereiteten Idee?",
    "3. Gibt es echte Komik mit Aufbau (keine behauptete)?",
    "4. Gibt es Spannung mit etwas Sichtbarem, das droht, und einen Tiefpunkt?",
    "5. Ist jede Nebenfigur nötig und unverwechselbar?",
    "6. Ist die Welt logisch (Wege, Besitz, Zeit, Regeln)? Ist es neu für diese Familie?",
    "",
    "HANDWERK:",
    ...CRAFT_RULES.map((rule) => `- ${rule}`),
    "",
    "Regeln für den Plan:",
    "- Jede Seite hat genau einen Ort. Wenige Orte insgesamt, damit das Kind sich zurechtfindet; jeder Ortswechsel ist in der Handlung begründet.",
    "- 'picture' ist EIN zeichenbarer Moment voller Bewegung (jemand rennt, fällt, zieht, versteckt sich, staunt) — nie Figuren, die nur dastehen. Aufeinanderfolgende Seiten zeigen verschiedene Orte oder Blickwinkel.",
    "- 'turn' ist der konkrete Grund umzublättern. Auf der letzten Seite ist 'turn' die Schlusspointe.",
    "- Jede gewählte Nebenfigur erscheint auf mindestens zwei Seiten und verändert die Handlung. Ihr Spruch höchstens einmal.",
    "- Setups: mindestens zwei Dinge, die früh gezeigt und später ausgezahlt werden.",
    "- Der Satz zum Mitsprechen (refrain) ist für junge Zuhörer ein großes Geschenk: 3 bis 7 Wörter, von einer Figur gesprochen, dreimal, beim dritten Mal mit neuer Bedeutung. Nur weglassen (null), wenn er die Geschichte stören würde.",
    "- Keine unbelegten Behauptungen: Wer etwas weiß, hat es auf einer früheren Seite erfahren. Wer etwas benutzt, hat es dabei.",
    "",
    "Antworte ausschließlich mit einem gültigen JSON-Objekt. Alle Textfelder in der Sprache der Geschichte, außer den ids.",
  ].join("\n");
}

function renderPitch(pitch: StoryPitch, index: number): string {
  return [
    `PITCH ${index} (${pitch.engine}): ${pitch.title}`,
    `  Logline: ${pitch.logline}`,
    `  Wunsch: ${pitch.heroWant} | auf dem Spiel: ${pitch.stakes}`,
    `  Hindernis: ${pitch.obstacle.who} — will: ${pitch.obstacle.want} — Schwäche: ${pitch.obstacle.weakness}`,
    `  Komik: ${pitch.comicEngine} | Laufgag: ${pitch.runningGag}`,
    `  Das Kind weiß mehr: ${pitch.dramaticIrony}`,
    `  Steigerung: ${pitch.escalation.join(" → ")}`,
    `  Tiefpunkt: ${pitch.lowPoint}`,
    `  Lösung: ${pitch.cleverSolution} (vorbereitet durch: ${pitch.plantedClue})`,
    `  Helden: ${pitch.heroRoles.map((role) => `${role.heroId}: ${role.strength} → ${role.contribution}`).join("; ")}`,
    `  Besetzung: ${pitch.cast.map((member) => `${member.id} (${member.role})`).join("; ") || "keine"}`,
    `  Artefakt: ${pitch.artifact ? `${pitch.artifact.id} — ${pitch.artifact.use}` : "keins"}`,
    `  Letzte Seite: ${pitch.lastPage}`,
    `  Warum Kinder es lieben: ${pitch.whyKidsLoveIt}`,
  ].join("\n");
}

export function buildPlanUserPrompt(brief: StoryBrief, pitches: StoryPitch[], repairNotes: string[] = []): string {
  const lines: string[] = [];
  const pages = brief.budget.pages;
  lines.push("RAHMEN:");
  for (const line of briefHeader(brief)) lines.push(`- ${line}`);
  for (const line of wishLines(brief.config)) lines.push(`- ${line}`);
  lines.push("");

  lines.push("DIE HELDEN:");
  for (const hero of brief.heroes) lines.push(heroSheet(hero, brief.heroMemories[hero.id] || []));
  lines.push("Aus früheren Abenteuern höchstens EINE kurze Anspielung, und nur, wenn sie ohne Vorwissen verständlich ist.");
  lines.push("");

  if (brief.candidates.length > 0) {
    lines.push(`FIGURENPOOL (Besetzung nur aus dieser Liste, 1 bis ${brief.budget.maxCast} Figuren, per id):`);
    for (const candidate of brief.candidates) lines.push(castSheet(candidate));
    lines.push("");
  }

  const brought = broughtArtifact(brief);
  if (brought) {
    lines.push("MITGEBRACHTES ARTEFAKT (Pflicht, carried=true, firstPage=1):");
    lines.push(artifactSheet(brought));
    lines.push("");
  } else if (brief.artifacts.length > 0) {
    lines.push("MÖGLICHE FUNDSTÜCKE (optional, höchstens eins; gefunden auf firstPage, entscheidend benutzt auf usePage > firstPage):");
    for (const artifact of brief.artifacts) lines.push(artifactSheet(artifact));
    lines.push("");
  }

  lines.push("DIE PITCHES:");
  pitches.forEach((pitch, index) => lines.push(renderPitch(pitch, index)));
  lines.push("");

  lines.push(`SEITENRHYTHMUS für ${pages} Seiten (Orientierung, keine Zwangsjacke):`);
  for (const beat of pageRhythm(pages)) lines.push(`- ${beat}`);
  lines.push("");

  if (repairNotes.length > 0) {
    lines.push("DEIN LETZTER PLAN HATTE DIESE FEHLER — behebe sie alle:");
    for (const note of repairNotes) lines.push(`- ${note}`);
    lines.push("");
  }

  const heroIds = brief.heroes.map((hero) => hero.id);
  lines.push(`ANTWORTE MIT GENAU DIESEM JSON. pages hat genau ${pages} Einträge. onPage enthält nur ids von Helden oder gewählten Nebenfiguren.`);
  lines.push(
    JSON.stringify(
      {
        chosenPitch: 0,
        whyChosen: "ein Satz",
        title: "endgültiger Titel",
        logline: "ein Satz",
        engine: "id des Bauplans",
        want: "was die Kinder wollen (anfassbar)",
        stakes: "was verloren geht, wenn es nicht klappt",
        worldRule: "die eine magische Regel mit ihrer sichtbaren Folge — oder null",
        refrain: "der Satz zum Mitsprechen — oder null",
        runningGag: { what: "der Laufgag", beats: ["1. Mal", "2. Mal, größer", "3. Mal, gekippt"] },
        dramaticIrony: "was das zuhörende Kind weiß, die Figur aber nicht — und auf welcher Seite",
        setups: [{ what: "vorbereitetes Detail", plantedOnPage: 1, paysOffOnPage: pages - 1 }],
        heroes: heroIds.map((id) => ({ id, name: "Name", strength: "Stärke", voice: "wie dieses Kind spricht", contribution: "Beitrag zur Lösung" })),
        cast: [{ id: "Pool-id", name: "Name", role: "Funktion", want: "eigener Wunsch", voice: "wie die Figur spricht", signature: "wiederkehrende Geste oder Tick" }],
        artifact: brought
          ? { id: brought.id, name: brought.name, role: "wann und wie es hilft", firstPage: 1, usePage: pages - 1, carried: true }
          : null,
        pages: Array.from({ length: pages }, (_, index) => ({
          page: index + 1,
          place: "Ort",
          action: "was sichtbar passiert (1-3 Sätze)",
          heroMoment: "was ein Held entscheidet oder tut",
          humor: "der komische Moment dieser Seite",
          emotion: "was die Helden fühlen, gezeigt am Körper",
          turn: index + 1 === pages ? "die Schlusspointe" : "der konkrete Grund umzublättern",
          picture: "der eine Moment voller Bewegung für das Bild",
          onPage: heroIds,
        })),
        ending: { resolution: "wie der Wunsch aufgeht", callback: "welches Anfangsbild verwandelt zurückkehrt", lastLine: "die letzte Pointe, höchstens zwei Sätze" },
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

function pageNumber(value: unknown, pages: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= pages ? n : fallback;
}

/** Normalises the model's plan against the brief. Never invents story content. */
export function sanitizePlan(raw: any, brief: StoryBrief, pitches: StoryPitch[]): StoryPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const pages = brief.budget.pages;
  const candidateById = new Map(brief.candidates.map((candidate) => [candidate.id, candidate]));
  const heroById = new Map(brief.heroes.map((hero) => [hero.id, hero]));

  const cast = (Array.isArray(raw.cast) ? raw.cast : [])
    .map((entry: any) => {
      const candidate = candidateById.get(text(entry?.id, 120));
      if (!candidate) return null;
      return {
        id: candidate.id,
        name: candidate.name,
        role: text(entry?.role, 200),
        want: text(entry?.want, 200),
        voice: text(entry?.voice, 200),
        signature: text(entry?.signature, 200),
      };
    })
    .filter((entry: StoryPlan["cast"][number] | null): entry is StoryPlan["cast"][number] => Boolean(entry))
    .filter((entry: StoryPlan["cast"][number], index: number, all: StoryPlan["cast"]) => all.findIndex((other) => other.id === entry.id) === index)
    .slice(0, brief.budget.maxCast);

  const allowedOnPage = new Set([...heroById.keys(), ...cast.map((member: StoryPlan["cast"][number]) => member.id)]);
  const rawPages: any[] = Array.isArray(raw.pages) ? raw.pages : [];
  const planPages: PlanPage[] = rawPages.slice(0, pages + 2).map((page: any, index: number) => ({
    page: index + 1,
    place: text(page?.place, 120),
    action: text(page?.action, 500),
    heroMoment: text(page?.heroMoment, 300),
    humor: text(page?.humor, 300),
    emotion: text(page?.emotion, 200),
    turn: text(page?.turn, 300),
    picture: text(page?.picture, 400),
    onPage: (Array.isArray(page?.onPage) ? page.onPage : []).map((id: unknown) => text(id, 120)).filter((id: string) => allowedOnPage.has(id)),
  }));

  const artifactOption = brief.artifacts.find((artifact) => artifact.id === text(raw.artifact?.id, 120));
  const brought = broughtArtifact(brief);
  let artifact: StoryPlan["artifact"] = null;
  const chosenArtifact = brought || artifactOption;
  if (chosenArtifact && (brought || raw.artifact)) {
    const firstPage = brought ? 1 : pageNumber(raw.artifact?.firstPage, pages, Math.min(2, pages));
    const usePage = pageNumber(raw.artifact?.usePage, pages, Math.max(firstPage, pages - 1));
    artifact = {
      id: chosenArtifact.id,
      name: chosenArtifact.name,
      role: text(raw.artifact?.role, 300),
      firstPage,
      usePage: Math.max(usePage, firstPage),
      carried: Boolean(brought),
    };
  }

  const chosenPitch = Math.max(0, Math.min(pitches.length - 1, Math.round(Number(raw.chosenPitch)) || 0));
  const refrain = text(raw.refrain, 90);
  const worldRule = text(raw.worldRule, 300);
  return {
    title: text(raw.title, 90) || pitches[chosenPitch]?.title || "",
    logline: text(raw.logline, 400) || pitches[chosenPitch]?.logline || "",
    engine: text(raw.engine, 40) || pitches[chosenPitch]?.engine || "frei",
    chosenPitch,
    whyChosen: text(raw.whyChosen, 300),
    want: text(raw.want, 300),
    stakes: text(raw.stakes, 300),
    worldRule: worldRule && !/^null$/i.test(worldRule) ? worldRule : null,
    refrain: refrain && !/^null$/i.test(refrain) ? refrain : null,
    runningGag: {
      what: text(raw.runningGag?.what, 300),
      beats: (Array.isArray(raw.runningGag?.beats) ? raw.runningGag.beats : []).map((beat: unknown) => text(beat, 200)).filter(Boolean).slice(0, 3),
    },
    dramaticIrony: text(raw.dramaticIrony, 300),
    setups: (Array.isArray(raw.setups) ? raw.setups : [])
      .map((setup: any) => ({
        what: text(setup?.what, 200),
        plantedOnPage: pageNumber(setup?.plantedOnPage, pages, 1),
        paysOffOnPage: pageNumber(setup?.paysOffOnPage, pages, pages - 1),
      }))
      .filter((setup: { what: string }) => setup.what)
      .slice(0, 5),
    heroes: brief.heroes.map((hero) => {
      const entry = (Array.isArray(raw.heroes) ? raw.heroes : []).find((candidate: any) => text(candidate?.id, 120) === hero.id) || {};
      return {
        id: hero.id,
        name: hero.name,
        strength: text(entry.strength, 200),
        voice: text(entry.voice, 200),
        contribution: text(entry.contribution, 300),
      };
    }),
    cast,
    artifact,
    pages: planPages,
    ending: {
      resolution: text(raw.ending?.resolution, 300),
      callback: text(raw.ending?.callback, 300),
      lastLine: text(raw.ending?.lastLine, 300),
    },
  };
}

export interface PlanStageResult {
  plan: StoryPlan | null;
  call: LlmCallResult;
}

export async function runPlanStage(
  llm: StorybookLlm,
  brief: StoryBrief,
  pitches: StoryPitch[],
  model: string,
  repairNotes: string[] = []
): Promise<PlanStageResult> {
  const call = await llm({
    stage: repairNotes.length > 0 ? "plan-repair" : "plan",
    role: "support",
    model,
    system: buildPlanSystemPrompt(),
    user: buildPlanUserPrompt(brief, pitches, repairNotes),
    json: true,
    maxTokens: 16000,
    effort: "medium",
    temperature: 0.7,
  });
  return { plan: sanitizePlan(parseJsonObject<any>(call.text), brief, pitches), call };
}

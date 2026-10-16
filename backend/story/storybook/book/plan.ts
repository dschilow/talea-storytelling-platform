/**
 * Chapter book — reading and checking the pitch, the plan and the plan review.
 *
 * Tolerant parsing (a volume must never die on a stray field) and deterministic
 * plan checks for what can be counted: chapter count, a payoff for every plant,
 * a solution built on at least two plants, a running gag with three beats,
 * varied chapter types, a cast that does not vanish. Taste stays with the critic.
 */

import { containsBlockedTerm } from "../checks";
import type { AgeBand } from "../craft";
import { heartAndWitMode } from "../heart-and-wit";
import { foldUmlauts, mentionsName } from "./catalogue";
import type { BookBudget, BookChapterPlan, BookPitch, BookPlan, BookVillain, HeroDuty, PlanReview, StoryEngine, VillainStyle } from "./types";

const ENGINES: StoryEngine[] = ["heroes", "villain", "guest"];
const VILLAIN_STYLES: VillainStyle[] = ["comic", "misunderstood", "real"];

/** What kind of being a planned figure is (plan.bible.characters[].kind); unknown words are dropped. */
export function parseFigureKind(value: unknown): "person" | "animal" | "creature" | "thing" | undefined {
  const raw = String(value ?? "").trim().toLowerCase();
  if (/^(person|human|mensch|child|kind|adult|erwachsene)/.test(raw)) return "person";
  if (/^(animal|tier)/.test(raw)) return "animal";
  if (/^(creature|wesen|monster|ghost|geist|fabel|magical)/.test(raw)) return "creature";
  if (/^(thing|ding|object|objekt|gegenstand)/.test(raw)) return "thing";
  return undefined;
}

/** The engine of an idea or plan; anything unknown (old plans, a stray word) is the heroes engine. */
export function parseEngine(value: unknown): StoryEngine | undefined {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return undefined;
  if (/^(villain|opponent|antagonist|gegenspieler|bösewicht|boesewicht)/.test(key)) return "villain";
  if (/^(guest|gast|star|companion)/.test(key)) return "guest";
  return ENGINES.includes(key as StoryEngine) ? (key as StoryEngine) : "heroes";
}

/**
 * How the opposing figure may end, by age (the other review of "Die Türlaunische": every opponent so far was
 * understood and answered — fine for the youngest, but a six-year-old also wants a villain who is simply outwitted).
 */
export function villainStyleFor(band: AgeBand): VillainStyle {
  return band === "3-5" ? "misunderstood" : band === "9-12" ? "real" : "comic";
}

function parseVillain(raw: any): BookVillain | null {
  if (!raw || typeof raw !== "object") return null;
  const who = text(raw.who, 120);
  if (!who || /^(null|none|kein|keine)\b/i.test(who)) return null;
  const style = String(raw.style ?? "").trim().toLowerCase();
  return {
    who,
    goal: text(raw.goal, 240),
    plan: text(raw.plan, 400),
    moves: (Array.isArray(raw.moves) ? raw.moves : [])
      .map((move: any) => ({ chapter: int(move?.chapter), move: text(move?.move, 240) }))
      .filter((move: { chapter: number; move: string }) => move.chapter >= 1 && move.move)
      .slice(0, 8),
    weakness: text(raw.weakness, 240),
    exposedBy: int(raw.exposedBy),
    outcome: text(raw.outcome, 240),
    style: VILLAIN_STYLES.includes(style as VillainStyle) ? (style as VillainStyle) : "comic",
  };
}

function parseHeroDuties(raw: any): HeroDuty[] {
  return (Array.isArray(raw) ? raw : [])
    .map((duty: any) => ({
      hero: text(duty?.hero, 80),
      talent: text(duty?.talent, 240),
      talentChapter: int(duty?.talentChapter),
      decision: text(duty?.decision, 240),
      decisionChapter: int(duty?.decisionChapter),
      feelingEnd: text(duty?.feelingEnd, 240),
    }))
    .filter((duty: HeroDuty) => duty.hero)
    .slice(0, 4);
}

function text(value: unknown, max = 600): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function list(value: unknown, max = 20, itemMax = 200): string[] {
  return (Array.isArray(value) ? value : []).map((entry) => text(entry, itemMax)).filter(Boolean).slice(0, max);
}

function int(value: unknown, fallback = 0): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

export function parsePitch(raw: any): BookPitch | null {
  const ideas = (Array.isArray(raw?.ideas) ? raw.ideas : [])
    .map((idea: any) => ({
      title: text(idea?.title, 120),
      premise: text(idea?.premise, 800),
      bigQuestion: text(idea?.bigQuestion, 240),
      wonder: text(idea?.wonder, 240),
      roles: (Array.isArray(idea?.roles) ? idea.roles : []).map((role: any) => ({
        role: text(role?.role, 80),
        castId: role?.castId === null || role?.castId === undefined ? null : text(role.castId, 80) || null,
        why: text(role?.why, 240),
      })).filter((role: { role: string }) => role.role).slice(0, 8),
      ...(parseEngine(idea?.engine) ? { engine: parseEngine(idea?.engine) } : {}),
      ...(text(idea?.engineFigure, 80) && !/^(null|none)$/i.test(text(idea?.engineFigure, 80)) ? { engineFigure: text(idea.engineFigure, 80) } : {}),
      ...(text(idea?.stake, 240) ? { stake: text(idea.stake, 240) } : {}),
    }))
    .filter((idea: { premise: string; title: string }) => idea.premise || idea.title)
    .slice(0, 3);
  if (!ideas.length) return null;
  const choice = Math.min(ideas.length, Math.max(1, int(raw?.choice, 1)));
  return { ideas, choice, why: text(raw?.why, 400) };
}

function chapterPlan(raw: any, n: number): BookChapterPlan {
  return {
    n,
    title: text(raw?.title, 90) || `Kapitel ${n}`,
    type: text(raw?.type, 40).toLowerCase(),
    place: text(raw?.place, 200),
    event: text(raw?.event, 700),
    progress: text(raw?.progress, 300),
    laugh: text(raw?.laugh, 300),
    ...(text(raw?.feeling, 300) ? { feeling: text(raw.feeling, 300) } : {}),
    hook: text(raw?.hook, 300),
    cast: list(raw?.cast, 8, 80),
    plants: list(raw?.plants, 6, 12).map((id) => id.toUpperCase()),
    payoffs: list(raw?.payoffs, 6, 12).map((id) => id.toUpperCase()),
    ...(text(raw?.gagBeat, 300) ? { gagBeat: text(raw.gagBeat, 300) } : {}),
    pictures: list(raw?.pictures, 3, 300),
    ...(text(raw?.opponentScene, 300) && !/^(null|none|keine?|—|-)$/i.test(text(raw?.opponentScene, 300)) ? { opponentScene: text(raw.opponentScene, 300) } : {}),
    ...(/^opponent|^villain|^gegen/i.test(text(raw?.pov, 20)) ? { pov: "opponent" as const } : {}),
  };
}

/** Null when the answer is not a plan at all. Missing pieces are left empty for the checks to report. */
export function parsePlan(raw: any, chapters: number): BookPlan | null {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.chapters) || !raw.bible) return null;
  const b = raw.bible || {};
  const byNumber = new Map<number, any>();
  for (const [index, entry] of raw.chapters.entries()) {
    const n = int(entry?.n, index + 1);
    if (n >= 1 && !byNumber.has(n)) byNumber.set(n, entry);
  }
  const plannedChapters = [...byNumber.keys()].sort((a, c) => a - c).map((n) => chapterPlan(byNumber.get(n), n));
  const opponent = b.opponent && typeof b.opponent === "object" && text(b.opponent.who, 120) && !/^(null|none|kein)/i.test(text(b.opponent.who, 20))
    ? { who: text(b.opponent.who, 160), motive: text(b.opponent.motive, 300), logic: text(b.opponent.logic, 300) }
    : null;
  return {
    title: text(raw.title, 90).replace(/^[„"']|[“"']$/g, ""),
    description: text(raw.description, 300),
    bible: {
      world: text(b.world), home: text(b.home), bigQuestion: text(b.bigQuestion, 300), truth: text(b.truth, 900),
      limits: text(b.limits, 400), workaround: text(b.workaround, 400), stakes: text(b.stakes, 400),
      personalReason: text(b.personalReason, 400), deadline: text(b.deadline, 300), opponent,
      characters: (Array.isArray(b.characters) ? b.characters : []).map((c: any) => ({
        name: text(c?.name, 80), introduction: text(c?.introduction, 240), wants: text(c?.wants, 240), can: text(c?.can, 240), flaw: text(c?.flaw, 240),
        avoids: text(c?.avoids, 240), voice: text(c?.voice, 240), challengedBy: text(c?.challengedBy, 160), finalChoice: text(c?.finalChoice, 240),
        ...(c?.turn && typeof c.turn === "object" && int(c.turn.chapter) >= 1 && text(c.turn.what, 240) ? { turn: { chapter: int(c.turn.chapter), what: text(c.turn.what, 240) } } : {}),
        // 2026-10-16 ("Die rollende Woche"): the identity line and the kind of a figure without a portrait.
        ...(text(c?.look, 200) && !/^(null|none|—|-)$/i.test(text(c?.look, 20)) ? { look: text(c.look, 200) } : {}),
        ...(parseFigureKind(c?.kind) ? { kind: parseFigureKind(c?.kind) } : {}),
      })).filter((c: { name: string }) => c.name).slice(0, 8),
      runningGag: {
        gag: text(b.runningGag?.gag, 300),
        beats: (Array.isArray(b.runningGag?.beats) ? b.runningGag.beats : []).map((beat: any) => ({ chapter: int(beat?.chapter), beat: text(beat?.beat, 240) })).filter((beat: { chapter: number }) => beat.chapter >= 1).slice(0, 6),
      },
      twistChapter: int(b.twistChapter),
      lowPointChapter: int(b.lowPointChapter),
      solution: { how: text(b.solution?.how, 400), uses: list(b.solution?.uses, 6, 12).map((id) => id.toUpperCase()) },
      fixedWordings: (Array.isArray(b.fixedWordings) ? b.fixedWordings : [])
        .map((entry: any) => ({ what: text(entry?.what, 60), text: text(entry?.text, 240) }))
        .filter((entry: { what: string; text: string }) => entry.what && entry.text)
        .slice(0, 5),
      heart: text(b.heart, 300),
      secret: /^(null|none|kein|keine)\b/i.test(text(b.secret, 20)) ? "" : text(b.secret, 300),
      freshEyes: (Array.isArray(b.freshEyes) ? b.freshEyes : [])
        .map((entry: any) => ({ chapter: int(entry?.chapter), moment: text(entry?.moment, 240) }))
        .filter((entry: { chapter: number; moment: string }) => entry.chapter >= 1 && entry.moment)
        .slice(0, 5),
      // 2026-10-16 (plot engine): who drives the book, the villain's own plan, what the listener knows first, what every hero owns.
      engine: parseEngine(b.engine) || "heroes",
      engineFigure: /^(null|none|kein|keine)\b/i.test(text(b.engineFigure, 20)) ? "" : text(b.engineFigure, 120),
      villain: parseVillain(b.villain),
      readerKnowsMore: (Array.isArray(b.readerKnowsMore) ? b.readerKnowsMore : [])
        .map((entry: any) => ({ chapter: int(entry?.chapter), what: text(entry?.what, 240) }))
        .filter((entry: { chapter: number; what: string }) => entry.chapter >= 1 && entry.what)
        .slice(0, 4),
      heroDuties: parseHeroDuties(b.heroDuties),
      stakeVisible: /^(null|none|kein|keine)\b/i.test(text(b.stakeVisible, 20)) ? "" : text(b.stakeVisible, 240),
    },
    setups: (Array.isArray(raw.setups) ? raw.setups : []).map((setup: any, index: number) => ({
      id: (text(setup?.id, 12) || `S${index + 1}`).toUpperCase(),
      what: text(setup?.what, 300),
      planted: int(setup?.planted),
      paidOff: int(setup?.paidOff),
    })).filter((setup: { what: string }) => setup.what).slice(0, 10),
    chapters: plannedChapters.slice(0, Math.max(chapters, plannedChapters.length)),
    castIds: list(raw.castIds, 8, 80),
    artifact: raw.artifact && typeof raw.artifact === "object" && text(raw.artifact.id, 80)
      ? { id: text(raw.artifact.id, 80), foundIn: int(raw.artifact.foundIn, 1), use: text(raw.artifact.use, 300) }
      : null,
    sequelTeasers: list(raw.sequelTeasers, 3, 240),
  };
}

/** Countable defects of a plan, as German edit notes for the revision. */
export function checkBookPlan(plan: BookPlan, budget: BookBudget, input: { heroNames: string[]; castNames: string[]; blockedTerms: string[]; cozy?: boolean; genre?: unknown; band?: AgeBand }): string[] {
  const issues: string[] = [];
  const n = budget.chapters;
  if (!plan.title) issues.push("Der Plan hat keinen Titel.");
  // User rule (2026-09-29): "Alexander, Adrian und der/die/das …" on every book reads like a template.
  const heroPattern = input.heroNames.length >= 2
    && new RegExp(`^${input.heroNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*(?:,|und)\\s*")}\\s+(?:und\\s+)?(?:der|die|das|den)\\b`, "i").test(plan.title);
  if (heroPattern) issues.push(`Der Titel „${plan.title}“ folgt dem Muster „Held, Held und der/die/das …“ — finde einen neugierig machenden Titel wie ein echtes Kinderbuch.`);
  if (plan.chapters.length !== n || plan.chapters.some((chapter, index) => chapter.n !== index + 1)) {
    issues.push(`Der Plan braucht genau ${n} Kapitel, nummeriert 1 bis ${n} (jetzt ${plan.chapters.length}).`);
  }
  const b = plan.bible;
  if (!b.bigQuestion) issues.push("Die Bibel nennt keine große Frage.");
  if (!b.truth) issues.push("Die Bibel nennt keine WAHRHEIT (was wirklich passiert und warum).");
  if (!b.deadline) issues.push("Die Bibel nennt keine Frist.");
  if (!b.stakes || !b.personalReason) issues.push("Es fehlt, was auf dem Spiel steht oder warum es den Helden persönlich wichtig ist.");
  if (!input.cozy && !b.opponent) issues.push("Es gibt keinen Gegenspieler oder kein Hindernis mit eigener Logik.");
  for (const name of [...input.heroNames, ...input.castNames]) {
    if (!b.characters.some((character) => mentionsName(character.name, name))) {
      issues.push(`Für ${name} fehlt das Figurenprofil (will, kann, Eigenheit, weicht aus, Stimme, Entscheidung am Ende).`);
    }
  }
  const missingFields = plan.chapters.filter((chapter) => !chapter.event || !chapter.progress || !chapter.laugh || (!chapter.hook && chapter.n < n));
  if (missingFields.length) issues.push(`Kapitel ${missingFields.map((chapter) => chapter.n).join(", ")}: es fehlt Ereignis, Fortschritt zur großen Frage, Lacher oder Haken.`);
  // A plant needs a later payoff, a payoff an earlier plant.
  for (const setup of plan.setups) {
    if (setup.planted < 1 || setup.planted > n) issues.push(`${setup.id} („${setup.what.slice(0, 60)}“) wird in keinem gültigen Kapitel angelegt.`);
    else if (setup.paidOff <= setup.planted || setup.paidOff > n) issues.push(`${setup.id} („${setup.what.slice(0, 60)}“) braucht eine Auflösung in einem späteren Kapitel als ${setup.planted}.`);
  }
  if (plan.setups.length < 3) issues.push("Weniger als drei angelegte Dinge, die sich später auszahlen — so trägt kein roter Faden über den Band.");
  const known = new Set(plan.setups.map((setup) => setup.id));
  const uses = b.solution.uses.filter((id) => known.has(id));
  if (uses.length < 2) issues.push("Die Lösung muss mindestens zwei früher angelegte Dinge (Setup-ids) nutzen.");
  for (const chapter of plan.chapters) {
    for (const id of chapter.payoffs) {
      const setup = plan.setups.find((entry) => entry.id === id);
      if (!setup) issues.push(`Kapitel ${chapter.n} löst ${id} auf, das nirgends angelegt ist.`);
      else if (setup.planted >= chapter.n) issues.push(`Kapitel ${chapter.n} löst ${id} auf, bevor es angelegt wird.`);
    }
  }
  if (b.runningGag.beats.length < 3) issues.push("Der Running Gag braucht mindestens drei Auftritte in verschiedenen Kapiteln (auftauchen, steigern, kippen) und einen Einsatz im Finale.");
  // 2026-10-15 (Zippel): the misunderstandings a child repeats at dinner are planned, not hoped for.
  // Only for the genres where the full rules apply (heart-and-wit.ts); a space or animal book just gets one moment if it fits.
  const full = heartAndWitMode(input.genre) === "full";
  if (full && (b.freshEyes || []).filter((entry) => entry.chapter <= n).length < 2) issues.push("Plane zwei bis vier Momente mit frischem Blick (freshEyes): Jemand nimmt ein Wort wörtlich, verwechselt etwas, erfindet ein Wort oder zieht einen sturköpfig logischen Fehlschluss, und die Helden erklären — ausformuliert in der Sprache der Geschichte, je mit Kapitel.");
  if (full && !b.heart) issues.push("Es fehlt das Herz der Freundschaft (heart): was sich die Helden und ihr engster Begleiter gegenseitig geben, und der kleine wunde Punkt des Begleiters.");
  for (let index = 2; index < plan.chapters.length; index += 1) {
    const [a, c, d] = [plan.chapters[index - 2], plan.chapters[index - 1], plan.chapters[index]];
    if (a.type && a.type === c.type && c.type === d.type) issues.push(`Kapitel ${a.n}–${d.n} sind dreimal hintereinander „${a.type}“ — variiere die Kapiteltypen.`);
  }
  if (b.twistChapter && (b.twistChapter < Math.floor(n * 0.35) || b.twistChapter > Math.ceil(n * 0.7))) issues.push(`Die Wendung liegt in Kapitel ${b.twistChapter}; sie gehört in die Mitte des Bandes.`);
  if (b.lowPointChapter && (b.lowPointChapter <= b.twistChapter || b.lowPointChapter >= n)) issues.push(`Der Tiefpunkt (Kapitel ${b.lowPointChapter}) muss nach der Wendung und vor dem letzten Kapitel liegen.`);
  const secondHalf = Math.floor(n / 2) + 1;
  for (const name of input.castNames) {
    const on = plan.chapters.filter((chapter) => chapter.cast.some((entry) => mentionsName(entry, name)));
    if (on.length < 2) issues.push(`${name} ist besetzt, steht aber in weniger als zwei Kapiteln auf der Bühne.`);
    else if (!on.some((chapter) => chapter.n >= secondHalf)) issues.push(`${name} verschwindet nach der ersten Hälfte — gib der Figur in der zweiten Hälfte eine Aufgabe.`);
  }
  // "Die segelnden Wörter" (2026-10-15): chapters 1-3 all at one table; the way out began in chapter 4.
  const opening = plan.chapters.slice(0, 3);
  if (!input.cozy && n >= 6 && opening.length === 3 && opening.every((chapter) => chapter.place && samePlace(chapter.place, opening[0].place))) {
    issues.push(`Kapitel 1–3 spielen alle am selben Ort („${opening[0].place.slice(0, 50)}“) — die Helden sollen spätestens in Kapitel 3 aufbrechen oder der Ort verändert sich spürbar.`);
  }
  issues.push(...checkEngine(plan, n, input));
  issues.push(...checkNamedFigures(plan, input));
  issues.push(...checkWonderRules(plan, input.band));
  issues.push(...checkChants(plan));
  const blocked = containsBlockedTerm(JSON.stringify(plan), input.blockedTerms);
  if (blocked) issues.push(`Der gesperrte Begriff „${blocked}“ kommt im Plan vor.`);
  return issues;
}

/**
 * The countable duties of the plot engine (2026-10-16, "Die Türlaunische": nobody worked against the heroes, the
 * listener never knew more than they did, the side characters only helped, and the stake — a door chime — was
 * nothing a child could draw). Whoever drives the book, every hero keeps a talent that turns the plot, the
 * decision at the climax and the feeling at the end: the avatar is the child, never a bystander.
 */
export function checkEngine(plan: BookPlan, n: number, input: { heroNames: string[]; castNames: string[]; cozy?: boolean; band?: AgeBand }): string[] {
  const issues: string[] = [];
  const b = plan.bible;
  const engine = b.engine || "heroes";
  const middle = Math.ceil(n / 2);
  if (!b.stakeVisible) issues.push("Es fehlt der sichtbare Einsatz (stakeVisible): Was geht verloren — als Ding oder Person, die ein Sechsjähriger malen könnte. Kein Klang, kein Gefühl, keine Gewohnheit.");
  if (engine === "villain") {
    const villain = b.villain;
    if (!villain) {
      issues.push("Der Motor des Buchs ist ein Gegenspieler mit eigenem Plan (engine villain), aber die Bibel hat keinen villain-Block (who, goal, plan, moves je Kapitel, weakness, exposedBy, outcome, style).");
    } else {
      const moveChapters = new Set(villain.moves.filter((move) => move.chapter >= 1 && move.chapter <= n).map((move) => move.chapter));
      const sceneChapters = new Set(plan.chapters.filter((chapter) => chapter.opponentScene).map((chapter) => chapter.n));
      const alone = [...moveChapters].filter((chapter) => sceneChapters.has(chapter));
      if (alone.length < 2) issues.push(`${villain.who} handelt in weniger als zwei Kapiteln OHNE die Helden: Plane mindestens zwei Züge (villain.moves) und gib denselben Kapiteln eine kurze opponentScene — das zuhörende Kind soll mehr wissen als die Helden.`);
      if (sceneChapters.size > middle) issues.push(`In ${sceneChapters.size} von ${n} Kapiteln gibt es eine Szene ohne die Helden — höchstens in jedem zweiten; die Helden bleiben die Perspektive.`);
      if (!villain.exposedBy || villain.exposedBy > middle) issues.push(`Die Helden durchschauen den Plan von ${villain.who} ${villain.exposedBy ? `erst in Kapitel ${villain.exposedBy}` : "nie"} — spätestens in Kapitel ${middle} (exposedBy): bis dahin reagieren sie, danach handeln sie und der Gegenspieler muss reagieren.`);
      if (!villain.weakness || !villain.outcome) issues.push(`${villain.who} braucht eine Schwäche (weakness), die die Helden im Finale nutzen, und einen Ausgang (outcome).`);
      if (input.band === "3-5" && villain.style === "real") issues.push(`Für Drei- bis Fünfjährige ist ${villain.who} kein echter Gegner (style real): ein missverstandener oder ein komischer, der überlistet wird.`);
      if (input.cozy) issues.push("Ein gemütliches Buch (cozy) hat keinen Gegenspieler mit Plan — wähle engine heroes oder guest.");
    }
  }
  if (engine === "guest") {
    if (!b.engineFigure) issues.push("Der Motor des Buchs ist ein Gast mit eigener Mission (engine guest), aber engineFigure nennt keine Figur.");
    else if (!b.characters.some((character) => mentionsName(character.name, b.engineFigure!))) issues.push(`Die Motorfigur „${b.engineFigure}“ hat kein Figurenprofil in der Bibel.`);
    if (!b.secret) issues.push("Ein Gast-Buch braucht secret: was der Gast will oder verbirgt und was die Erwachsenen nicht erfahren dürfen.");
  }
  if (engine !== "heroes") {
    const moments = (b.readerKnowsMore || []).filter((moment) => moment.chapter >= 1 && moment.chapter <= n);
    if (!moments.length) issues.push("Plane ein bis zwei Momente (readerKnowsMore), in denen das zuhörende Kind mehr weiß als die Helden — je mit Kapitel, als kurze Szene ohne die Helden (opponentScene).");
  }
  const duties = b.heroDuties || [];
  const climaxFrom = Math.max(b.lowPointChapter || 0, Math.floor(n * 0.6));
  for (const name of input.heroNames) {
    const duty = duties.find((entry) => mentionsName(entry.hero, name));
    if (!duty || !duty.talent || !duty.decision || !duty.feelingEnd) {
      issues.push(`Für ${name} fehlen die Heldenpflichten (heroDuties): eine eigene Fähigkeit oder Gewohnheit, die die Handlung einmal dreht (talent, talentChapter), die Entscheidung am Höhepunkt, die nur ${name} trifft (decision, decisionChapter), und das Gefühl am Ende (feelingEnd).`);
      continue;
    }
    if (duty.talentChapter < 1 || duty.talentChapter > n) issues.push(`${name}: talentChapter muss zwischen 1 und ${n} liegen.`);
    if (duty.decisionChapter < climaxFrom || duty.decisionChapter > n) issues.push(`${name}: die Entscheidung am Höhepunkt (decisionChapter ${duty.decisionChapter || "?"}) gehört in die Kapitel ${climaxFrom}–${n}.`);
  }
  for (const name of input.castNames) {
    const profile = b.characters.find((character) => mentionsName(character.name, name));
    if (profile && (!profile.turn || profile.turn.chapter < 1 || profile.turn.chapter > n)) {
      issues.push(`${name} hilft nur: gib der Figur eine Wendung (turn mit Kapitel) — etwas, das sie TUT und das den Weg der Helden verändert (ein Fehler, ein Eigensinn, ein Geheimnis, ein falscher Rat), nicht nur Hilfe.`);
    }
  }
  return issues;
}

/**
 * Only heroes, the cast and the central someone carry names (2026-10-16, "Die rollende Woche": Rotkäppchen appeared from
 * chapter 3 on, was in no cast and had no picture identity — a different girl on every page). The central someone is the
 * engine figure, the opponent or the villain; when none of them is a figure without a portrait, one such figure (the
 * wonder) may exist. Every figure without a portrait needs its look for the illustrator.
 */
export function checkNamedFigures(plan: BookPlan, input: { heroNames: string[]; castNames: string[] }): string[] {
  const issues: string[] = [];
  const b = plan.bible;
  const known = [...input.heroNames, ...input.castNames];
  const central = [b.engineFigure, b.opponent?.who, b.villain?.who].filter((name): name is string => Boolean(name));
  const extras = b.characters.filter((character) => !known.some((name) => mentionsName(character.name, name) || mentionsName(name, character.name)));
  const centralExtras = extras.filter((character) => central.some((name) => mentionsName(name, character.name) || mentionsName(character.name, name)));
  const others = extras.filter((character) => !centralExtras.includes(character));
  const allowedOthers = centralExtras.length > 0 ? 0 : 1;
  for (const character of others.slice(allowedOthers)) {
    issues.push(`„${character.name}“ ist weder Held noch besetzte Pool-Figur noch der zentrale Jemand: Nur Helden, Besetzung und das Wunder tragen Namen. Gib die Rolle einer besetzten Figur, oder mache sie namenlos („ein Mädchen mit roter Kapuze“) und streiche das Profil.`);
  }
  for (const character of [...centralExtras, ...others.slice(0, allowedOthers)]) {
    if (character.kind === "thing") continue;
    if (!character.look) issues.push(`Für „${character.name}“ fehlt look: die Erscheinung auf Englisch in 10-18 Wörtern (Art, Alter, Statur, Haar oder Fell, Kleidung oder Farben) und kind (person, animal, creature, thing) — ohne sie sieht die Figur auf jedem Bild anders aus.`);
  }
  return issues;
}

/** How many rules the wonder may have (the other AI's review, 2026-10-16: "wieder höchstens zwei Zauberregeln"). */
export function maxWonderRules(band?: AgeBand): number {
  return band === "9-12" ? 3 : 2;
}

/** The rules in bible.limits, one per sentence or semicolon-separated clause; a clause under three words is no rule. */
export function countRules(limits: string): number {
  return String(limits || "")
    .split(/;|(?<=[.!?])\s+(?=[A-ZÄÖÜ„"(])|\s+(?=\d+[.)]\s)/)
    .map((part) => part.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((part) => part.split(/\s+/).filter(Boolean).length >= 3).length;
}

export function checkWonderRules(plan: BookPlan, band?: AgeBand): string[] {
  const count = countRules(plan.bible.limits);
  const max = maxWonderRules(band);
  return count > max ? [`Das Wunder hat ${count} Regeln (limits) — höchstens ${max}: streiche oder verschmelze Regeln; ein kurzer Satz je Regel, mit Semikolon getrennt.`] : [];
}

const CHANT_WORDING = /spruch|chant|reim|rhyme|zauber|formel|spell|motto|vers\b|lied|song|refrain|ruf\b/i;

/** At most one wording the heroes speak together; the other fixed wordings are signs, rules or the closing line. */
export function checkChants(plan: BookPlan): string[] {
  const chants = (plan.bible.fixedWordings || []).filter((wording) => CHANT_WORDING.test(wording.what));
  return chants.length > 1
    ? [`${chants.length} gemeinsame Sprüche oder Reime in fixedWordings („${chants.map((wording) => wording.what).join("“, „")}“) — höchstens einer, und der muss etwas in der Handlung tun; die anderen Wortlaute sind Schilder, Regelsätze oder der Schlusssatz.`]
    : [];
}

const PLACE_STOPWORDS = new Set(["der", "die", "das", "dem", "den", "ein", "eine", "einem", "im", "in", "am", "an", "auf", "bei", "vor", "von", "zu", "zum", "zur", "und", "mit", "the", "of", "at"]);

/** Two place descriptions name the same spot: one holds the other's words, or most words are shared. */
export function samePlace(a: string, b: string): boolean {
  const tokens = (value: string) => new Set(foldUmlauts(value.toLocaleLowerCase("de-DE")).split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !PLACE_STOPWORDS.has(word)));
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return false;
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / Math.min(left.size, right.size) >= 0.5;
}

function score(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n * 10) / 10)) : 0;
}

/** The caps of the review prompt, enforced: a model that writes the checks down still scores kindly. */
export function planScoreCap(checks: Record<string, boolean>): number {
  let cap = 10;
  if (checks.bigQuestionClear === false || checks.answeredInFinale === false) cap = Math.min(cap, 5);
  if (checks.solutionPrepared === false) cap = Math.min(cap, 5);
  if (checks.stakesPersonal === false) cap = Math.min(cap, 6);
  if (checks.opponentLogic === false) cap = Math.min(cap, 6.5);
  if (checks.noEasyWayOut === false) cap = Math.min(cap, 6.5);
  if (checks.gagEscalates === false || checks.setbackChangesPlan === false || checks.climaxNew === false) cap = Math.min(cap, 7);
  if (checks.needBeforeClimax === false) cap = Math.min(cap, 7.5);
  if (checks.orientation === false || checks.rulesSimple === false) cap = Math.min(cap, 7);
  if (checks.heartAndWit === false) cap = Math.min(cap, 7.5);
  if (checks.heroesDistinct === false || checks.placesClear === false) cap = Math.min(cap, 7.5);
  // 2026-10-16 ("Der Regen sagt rückwärts" was reviewed at 8.7): a bigger figure who could solve it, stakes dropped
  // at the end, a setback from the weather, a joke that only works on paper, a someone without a want.
  if (checks.nobodyBiggerSolves === false) cap = Math.min(cap, 6.5);
  if (checks.stakesKept === false) cap = Math.min(cap, 6);
  if (checks.setbackByHero === false || checks.worksByEar === false) cap = Math.min(cap, 7);
  if (checks.someoneWants === false) cap = Math.min(cap, 7.5);
  // 2026-10-16 (plot engine, "Die Türlaunische" was reviewed at 5 and written anyway): a stake nobody can draw, a villain
  // who never acts alone, heroes who never see through the plan, a finale not decided by a hero, side characters who only
  // help, the heroes' own traits as the premise again, the same inner lesson as last time.
  if (checks.stakesPaintable === false) cap = Math.min(cap, 6);
  if (checks.villainActs === false || checks.heroDecides === false) cap = Math.min(cap, 6.5);
  if (checks.heroesSeeThrough === false || checks.traitsNotPremise === false) cap = Math.min(cap, 7);
  if (checks.castCausesTurns === false || checks.readerKnowsMore === false || checks.freshArc === false) cap = Math.min(cap, 7.5);
  return cap;
}

/**
 * The plan gate (2026-10-16): "Die Türlaunische" was reviewed at overall 5 and logic 5, revised once without a second
 * look, and written. A plan under this score after its revision is reviewed again and revised a second time; only
 * then do the chapters start. Measured cost of a review and a revision together: about 1 ct.
 */
export const PLAN_GATE_SCORE = 7;
export const PLAN_MAX_REVISIONS = 2;

/** A plan passes the gate when its review is missing (never block on a failed critic) or scores at least the gate without must-fix notes. */
export function planPassesGate(review: PlanReview | null, issues: string[]): boolean {
  if (!review) return issues.length === 0;
  return review.scores.overall >= PLAN_GATE_SCORE && review.mustFix.length === 0 && issues.length === 0;
}

export function parsePlanReview(raw: any): PlanReview | null {
  if (!raw || typeof raw !== "object" || !raw.checks || !raw.scores) return null;
  const checks: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw.checks)) {
    if (typeof value === "boolean") checks[key] = value;
    else if (/^(true|ja|yes)$/i.test(String(value))) checks[key] = true;
    else if (/^(false|nein|no)$/i.test(String(value))) checks[key] = false;
  }
  const s = raw.scores || {};
  return {
    checks,
    scores: {
      redThread: score(s.redThread), suspense: score(s.suspense), humor: score(s.humor),
      characters: score(s.characters), logic: score(s.logic), overall: Math.min(score(s.overall), planScoreCap(checks)),
    },
    mustFix: (Array.isArray(raw.mustFix) ? raw.mustFix : [])
      .map((note: any) => ({ chapter: Number.isFinite(Number(note?.chapter)) && note?.chapter !== null ? int(note.chapter) : null, problem: text(note?.problem, 400) }))
      .filter((note: { problem: string }) => note.problem)
      .slice(0, 8),
    weaknesses: (Array.isArray(raw.weaknesses) ? raw.weaknesses : [])
      .map((note: any) => ({
        chapter: Number.isFinite(Number(note?.chapter)) && note?.chapter !== null ? int(note.chapter) : null,
        problem: text(note?.problem, 400),
        severity: (String(note?.severity || "").toLowerCase() === "high" ? "high" : "low") as "high" | "low",
      }))
      .filter((note: { problem: string }) => note.problem)
      .slice(0, 4),
    verdict: text(raw.verdict, 400),
  };
}

/**
 * Applies a partial revision (only changed bible fields, changed chapters,
 * a new setup list) to the raw plan object; parsing happens afterwards.
 */
export function mergePlanRevision(rawPlan: any, revision: any): any {
  if (!rawPlan || !revision || typeof revision !== "object") return rawPlan;
  const merged: any = { ...rawPlan };
  for (const key of ["title", "description", "sequelTeasers", "artifact", "castIds"]) {
    if (revision[key] !== undefined) merged[key] = revision[key];
  }
  if (revision.bible && typeof revision.bible === "object") merged.bible = { ...(rawPlan.bible || {}), ...revision.bible };
  if (Array.isArray(revision.setups) && revision.setups.length) merged.setups = revision.setups;
  if (Array.isArray(revision.chapters) && revision.chapters.length) {
    const changed = new Map<number, any>();
    for (const chapter of revision.chapters) {
      const n = Math.round(Number(chapter?.n));
      if (Number.isFinite(n)) changed.set(n, chapter);
    }
    const base: any[] = Array.isArray(rawPlan.chapters) ? rawPlan.chapters : [];
    const numbers = new Set<number>(base.map((chapter, index) => Math.round(Number(chapter?.n)) || index + 1));
    merged.chapters = base.map((chapter, index) => {
      const n = Math.round(Number(chapter?.n)) || index + 1;
      return changed.has(n) ? { ...chapter, ...changed.get(n), n } : chapter;
    });
    // A revision may add a missing chapter.
    for (const [n, chapter] of changed) if (!numbers.has(n)) merged.chapters.push({ ...chapter, n });
    merged.chapters.sort((a: any, b: any) => Number(a?.n) - Number(b?.n));
  }
  return merged;
}
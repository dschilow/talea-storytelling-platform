/**
 * Chapter book — reading and checking the pitch, the plan and the plan review.
 *
 * Tolerant parsing (a volume must never die on a stray field) and deterministic
 * plan checks for what can be counted: chapter count, a payoff for every plant,
 * a solution built on at least two plants, a running gag with three beats,
 * varied chapter types, a cast that does not vanish. Taste stays with the critic.
 */

import { containsBlockedTerm } from "../checks";
import { mentionsName } from "./catalogue";
import type { BookBudget, BookChapterPlan, BookPitch, BookPlan, PlanReview } from "./types";

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
    hook: text(raw?.hook, 300),
    cast: list(raw?.cast, 8, 80),
    plants: list(raw?.plants, 6, 12).map((id) => id.toUpperCase()),
    payoffs: list(raw?.payoffs, 6, 12).map((id) => id.toUpperCase()),
    ...(text(raw?.gagBeat, 300) ? { gagBeat: text(raw.gagBeat, 300) } : {}),
    pictures: list(raw?.pictures, 3, 300),
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
        name: text(c?.name, 80), wants: text(c?.wants, 240), can: text(c?.can, 240), flaw: text(c?.flaw, 240),
        avoids: text(c?.avoids, 240), voice: text(c?.voice, 240), challengedBy: text(c?.challengedBy, 160), finalChoice: text(c?.finalChoice, 240),
      })).filter((c: { name: string }) => c.name).slice(0, 8),
      runningGag: {
        gag: text(b.runningGag?.gag, 300),
        beats: (Array.isArray(b.runningGag?.beats) ? b.runningGag.beats : []).map((beat: any) => ({ chapter: int(beat?.chapter), beat: text(beat?.beat, 240) })).filter((beat: { chapter: number }) => beat.chapter >= 1).slice(0, 6),
      },
      twistChapter: int(b.twistChapter),
      lowPointChapter: int(b.lowPointChapter),
      solution: { how: text(b.solution?.how, 400), uses: list(b.solution?.uses, 6, 12).map((id) => id.toUpperCase()) },
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
export function checkBookPlan(plan: BookPlan, budget: BookBudget, input: { heroNames: string[]; castNames: string[]; blockedTerms: string[]; cozy?: boolean }): string[] {
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
  const blocked = containsBlockedTerm(JSON.stringify(plan), input.blockedTerms);
  if (blocked) issues.push(`Der gesperrte Begriff „${blocked}“ kommt im Plan vor.`);
  return issues;
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
  if (checks.gagEscalates === false) cap = Math.min(cap, 7);
  return cap;
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
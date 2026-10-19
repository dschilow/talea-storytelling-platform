import type { StoryBrief } from "../storybook/context";
import { countWords } from "../storybook/checks";
import { cleanProse, normalizeGermanQuotes, parsePageBlocks } from "../storybook/parsing";
import type { WonderDraft, WonderPlan, WonderReview } from "./types";

const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const texts = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);

/** Precise diagnostics let the planner repair chapter references without rewriting the story. */
export function setupProblems(raw: unknown, chapters: number): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return ["setups: Mindestens ein früh vorbereiteter, später eingelöster Hinweis erforderlich."];
  const issues: string[] = [];
  for (const [i, s] of raw.entries()) {
    const prefix = `setups[${i}]`;
    if (!s || !text(s.what)) issues.push(`${prefix}: Beschreibe den bereits im Kapitelplan vorbereiteten Hinweis in what.`);
    if (!Number.isInteger(s?.plantedOnPage) || s.plantedOnPage < 1 || s.plantedOnPage > chapters) issues.push(`${prefix}: plantedOnPage=${JSON.stringify(s?.plantedOnPage) ?? "fehlt"}; erforderlich ist eine ganze Kapitelnummer von 1 bis ${chapters}.`);
    if (!Number.isInteger(s?.paysOffOnPage) || s.paysOffOnPage < 1 || s.paysOffOnPage > chapters) issues.push(`${prefix}: paysOffOnPage=${JSON.stringify(s?.paysOffOnPage) ?? "fehlt"}; erforderlich ist eine ganze Kapitelnummer von 1 bis ${chapters}.`);
    if (Number.isInteger(s?.plantedOnPage) && Number.isInteger(s?.paysOffOnPage) && s.paysOffOnPage <= s.plantedOnPage) issues.push(`${prefix}: Auflösung in Kapitel ${s.paysOffOnPage} muss NACH der Vorbereitung in Kapitel ${s.plantedOnPage} liegen. Eine Vorführung und ihre unmittelbare Wirkung im selben Kapitel gehören nicht in setups.`);
  }
  return issues;
}

export function planProblems(raw: unknown, brief: StoryBrief, packageIds: string[]): string[] {
  if (!raw || typeof raw !== "object") return ["Plan muss ein JSON-Objekt sein."];
  const p = raw as WonderPlan;
  const issues: string[] = [];
  for (const key of ["title", "logline", "want", "stakes", "ruleDemonstration", "easyWayOut"] as const) if (!text(p[key])) issues.push(`${key} fehlt.`);
  if (!(p.worldRule === null || text(p.worldRule)) || !(p.learningCore === null || text(p.learningCore))) issues.push("worldRule/learningCore muss Text oder null sein.");
  if (!(p.packageId === null || packageIds.includes(p.packageId))) issues.push("Vorlage passt nicht zur Konfiguration oder wurde bereits verwendet.");
  if (!Array.isArray(p.ideas) || p.ideas.length !== 3 || p.ideas.some(i => !i || ![i.hook, i.comicEngine, i.whyTheseHeroes].every(text))) issues.push("Genau drei konkrete Ideen erforderlich.");
  if (![1, 2, 3].includes(p.chosenIdea)) issues.push("chosenIdea muss 1, 2 oder 3 sein.");
  if (!Array.isArray(p.heroes) || p.heroes.length !== brief.heroes.length || brief.heroes.some(h => !p.heroes?.some(v => v?.id === h.id && v.name === h.name && [v.voice, v.choice, v.contribution].every(text)))) issues.push("Alle Avatare brauchen ihre eigene Stimme, Entscheidung und Handlung; IDs und Namen bleiben unverändert.");
  const guests = Array.isArray(p.guests) ? p.guests : [];
  if (!Array.isArray(p.guests) || guests.length > brief.budget.maxCast) issues.push("Ungültige Anzahl Nebenfiguren.");
  const names = new Set(brief.heroes.map(h => h.name.toLocaleLowerCase()));
  const ids = new Set(brief.heroes.map(h => h.id));
  for (const g of guests) {
    if (!g || ![g.id, g.name, g.species, g.appearance, g.want, g.voice, g.role].every(text)) { issues.push("Nebenfigur unvollständig."); continue; }
    const pool = brief.candidates.find(c => c.id === g.id);
    if (pool ? pool.name !== g.name || pool.species !== g.species : !/^guest:[a-z0-9-]+$/.test(g.id)) issues.push(`Ungültige Identität ${g.id}.`);
    if (ids.has(g.id) || names.has(g.name.toLocaleLowerCase())) issues.push("Doppelte Figurenidentität.");
    ids.add(g.id); names.add(g.name.toLocaleLowerCase());
  }
  if (!Array.isArray(p.scenes) || p.scenes.length !== brief.budget.pages) issues.push(`Genau ${brief.budget.pages} Kapitel erforderlich.`);
  for (const [i, s] of (Array.isArray(p.scenes) ? p.scenes : []).entries()) {
    if (!s || s.chapter !== i + 1 || ![s.title, s.place, s.action, s.cause, s.change, s.humor, s.end, s.after].every(text) || !texts(s.onStage) || s.onStage.length === 0 || s.onStage.some(id => !ids.has(id))) issues.push(`Kapitel ${i + 1} ist unvollständig oder hat unbekannte Figuren.`);
  }
  issues.push(...setupProblems(p.setups, brief.budget.pages));
  if (!p.ending || ![p.ending.resolution, p.ending.emotionalAction, p.ending.callback].every(text)) issues.push("Ende ist unvollständig.");
  const brought = brief.artifacts.find(a => a.broughtBy);
  if (brought && p.artifact?.id !== brought.id) issues.push("Mitgebrachtes Artefakt fehlt.");
  if (p.artifact !== null) {
    const a = p.artifact;
    const known = brief.artifacts.find(v => v.id === a?.id);
    if (!a || !known || a.name !== known.name || !text(a.role) || a.carried !== Boolean(known.broughtBy) || !Number.isInteger(a.firstPage) || !Number.isInteger(a.usePage) || a.firstPage < 1 || a.usePage < a.firstPage || a.usePage > brief.budget.pages || (known.broughtBy && a.firstPage !== 1)) issues.push("Artefakt oder seine Einführung ist ungültig.");
  }
  return [...new Set(issues)];
}

export function readDraft(raw: string, plan: WonderPlan, language?: string): WonderDraft {
  const blocks = parsePageBlocks(raw);
  if (blocks.length !== plan.scenes.length || blocks.some((b, i) => b.order !== i + 1)) throw new Error("Die Ausgabe muss jedes geplante Kapitel genau einmal in Reihenfolge enthalten.");
  const title = raw.match(/^TITEL:\s*(.+)$/m)?.[1]?.trim();
  const description = raw.match(/^BESCHREIBUNG:\s*(.+)$/m)?.[1]?.trim();
  if (!title || !description) throw new Error("Titel oder Beschreibung fehlt.");
  return { title, description, pages: blocks.map(b => ({ order: b.order, title: plan.scenes[b.order - 1].title, content: language === "de" ? normalizeGermanQuotes(cleanProse(b.content)) : cleanProse(b.content) })) };
}

export function mergeRevision(draft: WonderDraft, raw: string, requested: number[], language?: string): WonderDraft {
  const blocks = parsePageBlocks(raw);
  if (blocks.length !== requested.length || new Set(blocks.map(b => b.order)).size !== requested.length || blocks.some(b => !requested.includes(b.order))) throw new Error("Überarbeitung muss genau die angeforderten Kapitel enthalten.");
  return { ...draft, pages: draft.pages.map(p => {
    const replacement = blocks.find(b => b.order === p.order);
    return replacement ? { ...p, content: language === "de" ? normalizeGermanQuotes(cleanProse(replacement.content)) : cleanProse(replacement.content) } : p;
  }) };
}

export function draftProblems(draft: WonderDraft, brief: StoryBrief): string[] {
  const issues: string[] = [];
  const all = draft.pages.map(p => p.content).join("\n\n");
  const words = countWords(all);
  // Modest tolerance preserves a strong scene instead of padding it to a quota.
  if (words < brief.budget.totalWordsMin * 0.85 || words > brief.budget.totalWordsMax * 1.15) issues.push(`Umfang ${words} Wörter, benötigt etwa ${brief.budget.totalWordsMin}–${brief.budget.totalWordsMax}.`);
  if (draft.pages.some(p => countWords(p.content) < 35)) issues.push("Ein Kapitel ist nur ein Fragment.");
  if (new Set(draft.pages.map(p => p.content)).size !== draft.pages.length) issues.push("Ein Kapitel wurde doppelt ausgegeben.");
  const visible = `${draft.title}\n${draft.description}\n${all}\n${draft.pages.map(p => p.title).join("\n")}`.toLocaleLowerCase();
  for (const term of brief.blockedTerms) if (visible.includes(term.toLocaleLowerCase())) issues.push(`Ein gesperrter Begriff kommt im Vorlesetext vor: ${term}.`);
  if (/```|\b(?:heroId|comicEngine|onStage)\s*[":]/.test(all)) issues.push("Planungsdaten oder Code im Vorlesetext.");
  return issues;
}

export function reviewProblems(raw: unknown, draft: WonderDraft, brief: StoryBrief): string[] {
  if (!raw || typeof raw !== "object") return ["Lektorat fehlt."];
  const r = raw as WonderReview;
  const issues: string[] = [];
  if (!r.comprehension || !["goal", "obstacle", "solution"].every(k => r.comprehension[k as keyof typeof r.comprehension] === null || text(r.comprehension[k as keyof typeof r.comprehension]))) issues.push("Verständnisprüfung unvollständig.");
  for (const key of ["heroActions", "laughs", "keep", "issues"] as const) {
    if (!Array.isArray(r[key])) { issues.push(`${key} fehlt.`); continue; }
    for (const item of r[key]) {
      if (!item || !Number.isInteger(item.page) || !text(item.quote) || item.quote.length < 8 || !draft.pages.find(p => p.order === item.page)?.content.includes(item.quote)) issues.push(`Unbelegtes Zitat in ${key}.`);
    }
  }
  if (Array.isArray(r.heroActions) && (r.heroActions.some(a => !brief.heroes.some(h => h.id === a?.heroId)) || new Set(r.heroActions.map(a => a?.heroId)).size !== r.heroActions.length)) issues.push("Ungültige Avatarbelege.");
  if (Array.isArray(r.issues) && r.issues.some(i => !i || !["blocker", "improve"].includes(i.severity) || !["logic", "character", "humor", "language", "wish", "safety"].includes(i.kind) || !text(i.problem) || !text(i.fix))) issues.push("Befund unvollständig.");
  if (Array.isArray(r.issues) && r.issues.some(i => i?.affectedPages !== undefined && (!Array.isArray(i.affectedPages) || !i.affectedPages.includes(i.page) || i.affectedPages.some(p => !Number.isInteger(p) || !draft.pages.some(d => d.order === p))))) issues.push("Ungültige betroffene Kapitel.");
  if (!text(r.readAgainReason)) issues.push("Begründung der Lesewirkung fehlt.");
  return [...new Set(issues)];
}

export function editorialBlockers(review: WonderReview, brief: StoryBrief): string[] {
  return [
    ...review.issues.filter(i => i.severity === "blocker").map(i => i.problem),
    ...Object.entries(review.comprehension).filter(([, v]) => !v).map(([k]) => `Nicht aus dem Text verständlich: ${k}.`),
    ...brief.heroes.filter(h => !review.heroActions.some(a => a.heroId === h.id)).map(h => `${h.name} hat keinen belegten eigenen Beitrag.`),
  ];
}

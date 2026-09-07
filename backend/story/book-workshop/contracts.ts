import Ajv from "ajv";
import type { BookBrief, BookPlan, BookReview, Evidence, Manuscript } from "./types";

const text = { type: "string", minLength: 1, maxLength: 12000 };
const id = { type: "string", minLength: 1, maxLength: 200 };
const number = { type: "integer", minimum: 1, maximum: 32 };
const strings = { type: "array", items: id, uniqueItems: true, maxItems: 32 };
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items: unknown, maxItems = 32) => ({ type: "array", items, maxItems });
const nullable = (schema: unknown) => ({ anyOf: [schema, { type: "null" }] });
const evidence = obj({ page: number, quote: text });
const evidenceList = { ...arr(evidence, 4), minItems: 1 };
const answer = nullable(obj({ answer: text, evidence: evidenceList }));
const score = { type: "integer", minimum: 1, maximum: 5 };
export const planSchema = obj({
  premise: text, childWants: text, whyItMatters: text, worldRule: nullable(text), castIds: strings, artifactId: nullable(id),
  heroActions: arr(obj({ heroId: id, contribution: text })), places: { ...strings, minItems: 1 },
  beats: arr(obj({ page: number, place: text, action: text, cause: text, result: text })), ending: text,
});
export const manuscriptSchema = obj({ title: text, description: text, pages: arr(obj({
  order: number, text, illustration: obj({ scene: text, castIds: strings, artifactVisible: { type: "boolean" } }),
})) });
export const reviewSchema = obj({
  comprehension: obj({ want: answer, obstacle: answer, solution: answer, outcome: answer }),
  scores: obj({ clarity: score, causality: score, agency: score, readAloud: score, engagement: score, humor: score }),
  issues: arr(obj({ severity: { enum: ["blocker", "suggestion"] }, page: number, problem: text, fix: text }), 12),
  heroActions: arr(obj({ heroId: id, evidence: evidenceList })),
  imageIssues: arr(obj({ page: number, problem: text }), 12),
  developments: arr(obj({ heroId: id, trait: id, change: { type: "integer", minimum: 1, maximum: 3 }, description: text, evidence: evidenceList }), 32),
  artifactEvidence: nullable(obj({ discovery: evidence, use: evidence })),
});
const ajv = new Ajv({ allErrors: true });
const validators = { plan: ajv.compile(planSchema), manuscript: ajv.compile(manuscriptSchema), review: ajv.compile(reviewSchema) };
export function parseContract<T>(kind: keyof typeof validators, raw: string): T {
  const value: unknown = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  const validate = validators[kind];
  if (!validate(value)) throw new Error(`Invalid ${kind}: ${ajv.errorsText(validate.errors).slice(0, 400)}`);
  return value as T;
}
export function readingBudget(brief: Pick<BookBrief, "ageBand" | "length" | "heroes">) {
  const pages = brief.length === "short" ? 6 : brief.length === "long" ? 10 : 8;
  const wordsPerPage = { "3-5": [30, 55], "6-8": [60, 95], "9-12": [90, 135], "13+": [120, 180] }[brief.ageBand];
  return { pages, minWords: pages * wordsPerPage[0], maxWords: pages * wordsPerPage[1],
    supportingCast: Math.max(0, (brief.ageBand === "3-5" ? 3 : brief.ageBand === "6-8" ? 4 : 6) - brief.heroes.length) };
}
export function checkPlan(plan: BookPlan, brief: BookBrief): string[] {
  const budget = readingBudget(brief), issues: string[] = [];
  const candidates = new Set(brief.candidates.map(p => p.id));
  if (plan.castIds.some(id => !candidates.has(id)) || plan.castIds.length > budget.supportingCast) issues.push("Invalid or excessive supporting cast");
  const actions = plan.heroActions.map(a => a.heroId);
  if (new Set(actions).size !== actions.length || actions.length !== brief.heroes.length || brief.heroes.some(h => !actions.includes(h.id))) issues.push("Every chosen avatar needs one planned contribution");
  if (plan.beats.length !== budget.pages || plan.beats.some((b, i) => b.page !== i + 1 || !plan.places.includes(b.place))) issues.push("Pages and places must match the plan");
  if (plan.artifactId && !brief.artifacts.some(a => a.id === plan.artifactId)) issues.push("Invented artifact ID");
  const brought = brief.artifacts.find(a => a.broughtBy);
  if (brought && plan.artifactId !== brought.id) issues.push("The selected brought artifact is required");
  return issues;
}
const normalized = (s: string): string => s.normalize("NFKC").replace(/\s+/g, " ").trim();
export function grounded(e: Evidence, book: Manuscript): boolean {
  return normalized(e.quote).length >= 8 && normalized(book.pages[e.page - 1]?.text || "").includes(normalized(e.quote));
}
export function checkManuscript(book: Manuscript, plan: BookPlan, brief: BookBrief): string[] {
  const budget = readingBudget(brief), issues: string[] = [];
  const text = book.pages.map(p => p.text).join("\n"), count = text.trim().split(/\s+/u).length;
  if (book.pages.length !== budget.pages || book.pages.some((p, i) => p.order !== i + 1)) issues.push("Incorrect or missing reading pages");
  if (count < budget.minWords || count > budget.maxWords) issues.push(`Word count ${count}, expected ${budget.minWords}-${budget.maxWords}`);
  const identities = new Set([...brief.heroes.map(h => h.id), ...plan.castIds]);
  if (book.pages.some(p => p.illustration.castIds.some(id => !identities.has(id)))) issues.push("Illustration uses an uncast identity");
  if (book.pages.some(p => p.illustration.castIds.length > 4)) issues.push("Split the picture staging into at most four visible characters, keeping every hero in the story");
  if (!plan.artifactId && book.pages.some(p => p.illustration.artifactVisible)) issues.push("Illustration invents an artifact");
  if (/\{\{[^}]+\}\}|\[object Object\]|<\/?(?:system|assistant)>/.test(text)) issues.push("Serialization debris in prose");
  for (const term of brief.blockedTerms) {
    if (term.trim() && normalized(book.title + " " + book.description + " " + text).toLocaleLowerCase().includes(normalized(term).toLocaleLowerCase())) issues.push("Parental blocked term present");
  }
  return issues;
}
export function checkReview(review: BookReview, book: Manuscript, brief: BookBrief, plan: BookPlan): string[] {
  const issues: string[] = [];
  for (const [key, answer] of Object.entries(review.comprehension)) {
    if (!answer || answer.evidence.some(e => !grounded(e, book))) issues.push(`Unproven comprehension: ${key}`);
  }
  for (const key of ["clarity", "causality", "agency", "readAloud", "engagement"] as const) {
    if (review.scores[key] < 4) issues.push(`${key}: ${review.scores[key]}/5`);
  }
  if (Number(brief.wishes.humorLevel ?? 1) >= 2 && review.scores.humor < 4) issues.push("Requested humor is not delivered");
  for (const issue of review.issues.filter(i => i.severity === "blocker")) issues.push(`Page ${issue.page}: ${issue.problem} Fix: ${issue.fix}`);
  for (const issue of review.imageIssues) issues.push(`Image page ${issue.page}: ${issue.problem}`);
  for (const hero of brief.heroes) {
    const actions = review.heroActions.filter(a => a.heroId === hero.id);
    if (actions.length !== 1 || actions[0].evidence.some(e => !grounded(e, book))) issues.push(`Missing evidenced contribution: ${hero.name}`);
  }
  if (plan.artifactId && (!review.artifactEvidence || !grounded(review.artifactEvidence.discovery, book) || !grounded(review.artifactEvidence.use, book) || review.artifactEvidence.discovery.page > review.artifactEvidence.use.page)) issues.push("Artifact discovery/use not demonstrated in final prose");
  return issues;
}

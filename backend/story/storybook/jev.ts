/**
 * Storybook Pipeline — the second reader (Jev).
 *
 * The vision check (gpt-6-luna) counts figures and limbs but lets through what a
 * parent sees at once: a child with a dragon tail, a girl with wings, the same
 * boy twice. Measured 2026-10-15 on 430 stored pictures: of eight children with a
 * tail, wings or dinosaur legs the old check flagged one; Jev, a "decision
 * model" (typesafe/jev-1.14, $0.042 per million input tokens, no text out, ~0.6 s),
 * flagged all eight — and every one of its other hits was confirmed by eye.
 *
 * It answers narrow yes/no questions with a probability, so it is used as a
 * second opinion that only ADDS findings to the existing report:
 *   - a human with animal parts            → hard (never printed when it persists)
 *   - the same figure twice, fused bodies  → soft (redraw, still printable)
 *   - writing in the picture               → the existing "no text" rule
 * Questions that did not work (arms and legs counted: noise at every threshold;
 * "does the picture match the text": 19 of 24) are deliberately not asked.
 *
 * Pure module: the network call is an injected port, so tests and the local
 * harness run without it. A failing port never changes a verdict.
 */

import type { VisualEntity } from "./illustration-stage";
import type { LlmCallResult } from "./llm";

export const JEV_MODEL = "typesafe/jev-1.14";

/** noul: yes/no with a probability. box (Jev 1.14): where one thing is in the picture. */
export interface JevQuestion {
  type: "noul" | "box";
  instructions: string;
}

/**
 * Where Jev saw a finding: edges as fractions of the picture from its top-left corner, and Jev's confidence (0–1).
 * Jev always answers a box question with a box, even when nothing is there, so boxes are only asked for findings
 * that fired. Measured 2026-11-03 on rejected pictures: wrong boxes scored at most 0.31, right ones mostly 0.4–0.8.
 */
export interface JevBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
  confidence: number;
}

/** What the port returns: one probability per yes/no question and one box per box question that was asked. */
export interface JevReply {
  answers: Record<string, number>;
  boxes?: Record<string, JevBox>;
  costUSD: number;
  inputTokens: number;
  durationMs: number;
}

export type JevPort = (request: { imageUrl: string; questions: Record<string, JevQuestion> }) => Promise<JevReply>;

export interface JevScores {
  hybrid: number;
  twins: number;
  fused: number;
  mirror: number;
  text: number;
  /** One figure carries features of two characters (a child's hair and clothes on a creature with big ears). */
  blend: number;
  /** Two figures wear the same distinctive garment (the librarian's vest on a hero). */
  garment: number;
}

/**
 * Cut-offs from the 430-picture probe. hybrid: eight of eight hits at 0.7 were real,
 * none on pictures with a talking fox. twins/fused: 0.65 / 0.75 were real except in
 * mirrors and puddles, which is what `mirror` is asked for.
 * blend/garment (2026-10-16, book "Die hüpfenden Geräusche": Adrian's hair and shirt on the sack creature scored
 * hybrid 0.08, the librarian's vest on Alexander fused 0.51 — both printed): over 97 stored pictures blend >= 0.85 hit
 * 6 (the creature picture plus five heroes with pointed elf ears: the same fault, milder), garment >= 0.9 hit 1 (the
 * vest picture); one kitchen scene of two boys in T-shirts reached 0.85, hence 0.9.
 */
export const JEV_THRESHOLDS = { hybrid: 0.7, twins: 0.65, fused: 0.75, text: 0.75, mirror: 0.5, blend: 0.85, garment: 0.9 } as const;

const QUESTIONS: Record<keyof JevScores, JevQuestion> = {
  hybrid: { type: "noul", instructions: "A human child in the picture has animal body parts such as a tail, scales, claws, a snout or dinosaur legs." },
  twins: { type: "noul", instructions: "Two of the figures look like the same person: same face, same hair and same clothes." },
  fused: { type: "noul", instructions: "A character's legs or arms are fused into one shape or merge with another figure's body." },
  mirror: { type: "noul", instructions: "The picture shows a mirror, a reflection in water or glass, or a window with figures behind it." },
  text: { type: "noul", instructions: "The picture contains readable written words or letters." },
  blend: { type: "noul", instructions: "One figure mixes features of two different characters, for example a child's hair, face or clothes together with an animal creature's ears, fur or snout." },
  garment: { type: "noul", instructions: "Two different figures wear the same distinctive garment, such as the same vest, jacket or hat." },
};

/** A cast that is meant to be half animal (mermaid, centaur): the question would only produce noise. */
const MEANT_HYBRID = /\b(mermaid|merman|merfolk|centaur|faun|satyr|sphinx|werewolf|werwolf|meerjungfrau|zentaur|mischwesen|hybrid|half[- ](?:human|animal|dragon|fox|cat|bird|fish))\b/i;
/** Twins and look-alike packs are meant to look the same. */
const MEANT_ALIKE = /\b(twins?|zwillinge?|identical|look-?alikes?|clones?|klone?|triplets?|drillinge?)\b/i;
/**
 * A garment the scene itself puts on everybody. Figurenwelt pilot "Ein Seehund auf dem Kapitänssitz" (2026-11-03):
 * "Pia helps Nora and Ben with their lifejackets" scored garment 0.92 and 0.96 on a printed picture.
 */
const SHARED_GARMENT = /\b(life ?jackets?|life ?vests?|buoyancy aids?|rettungswesten?|schwimmwesten?|uniforms?|uniformen?|costumes?|kostüme?|raincoats?|rain jackets?|regenjacken?|helmets?|helme?|pyjamas?|pajamas?|schlafanzüge?)\b/i;

/**
 * The questions to ask for one picture; a question that cannot apply to this cast (or to this scene, when given) is
 * left out.
 */
export function jevQuestionsFor(drawn: VisualEntity[], scene = ""): Record<string, JevQuestion> {
  const text = drawn.map((entity) => `${entity.species} ${entity.appearance} ${entity.tag || ""}`).join(" ");
  const questions: Record<string, JevQuestion> = { fused: QUESTIONS.fused, mirror: QUESTIONS.mirror, text: QUESTIONS.text };
  if (!MEANT_HYBRID.test(text)) questions.hybrid = QUESTIONS.hybrid;
  if (!MEANT_ALIKE.test(text)) questions.twins = QUESTIONS.twins;
  const figures = drawn.filter((entity) => entity.kind === "character");
  // A creature next to a human child is where the child's looks leak onto the creature, and the creature's ears onto the child.
  if (!MEANT_HYBRID.test(text) && figures.some((entity) => entity.isHuman) && figures.some((entity) => !entity.isHuman)) questions.blend = QUESTIONS.blend;
  // Twins wear the same clothes on purpose; with one figure there is nobody to share a garment with.
  if (!MEANT_ALIKE.test(text) && figures.length >= 2 && !SHARED_GARMENT.test(scene)) questions.garment = QUESTIONS.garment;
  return questions;
}

/** Probabilities for the questions that were asked (the rest read as 0); null when nothing usable came back. */
export function parseJevScores(answers: Record<string, number> | undefined): JevScores | null {
  if (!answers) return null;
  const read = (key: keyof JevScores) => {
    const value = Number(answers[key]);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  };
  const scores: JevScores = { hybrid: read("hybrid"), twins: read("twins"), fused: read("fused"), mirror: read("mirror"), text: read("text"), blend: read("blend"), garment: read("garment") };
  return Object.keys(answers).some((key) => key in QUESTIONS) ? scores : null;
}

export interface JevFindings {
  /** A human figure with animal parts — counted like the checker's own "animal features on humans". */
  hybrid: string[];
  /** Twins and fused bodies — worth a redraw, never a reason to leave the page blank. */
  soft: string[];
  text: boolean;
}

export type JevCheck = Exclude<keyof JevScores, "mirror">;

/**
 * The checks whose probability clears its cut-off. In a mirror, a pond or a window the same person IS there twice, legs
 * end in the water and the reflection wears the same vest; a mixed figure stays one, so blend counts there too.
 */
export function firedJevChecks(scores: JevScores): JevCheck[] {
  const reflection = scores.mirror >= JEV_THRESHOLDS.mirror;
  const checks: JevCheck[] = ["hybrid", "twins", "fused", "blend", "garment", "text"];
  return checks.filter((check) => scores[check] >= JEV_THRESHOLDS[check] && !(reflection && (check === "twins" || check === "fused" || check === "garment")));
}

/** The finding as it goes into the report and the log. */
export const JEV_NOTES: Record<JevCheck, string> = {
  hybrid: "a child with animal body parts (tail, wings, scales or dinosaur legs)",
  twins: "the same figure drawn twice",
  fused: "bodies fused into one shape",
  blend: "a figure mixes features of two characters (a child's hair or clothes with animal ears or fur)",
  garment: "two figures wear the same garment",
  text: "text visible",
};

export function interpretJev(scores: JevScores): JevFindings {
  const fired = firedJevChecks(scores);
  const note = (check: JevCheck) => `${JEV_NOTES[check]} [jev ${Math.round(scores[check] * 100)}%]`;
  return {
    hybrid: fired.includes("hybrid") ? [note("hybrid")] : [],
    soft: fired.filter((check) => check !== "hybrid" && check !== "text").map(note),
    text: fired.includes("text"),
  };
}

/** One object per box question; for a doubled figure the box takes in both copies. */
const BOX_INSTRUCTIONS: Record<JevCheck, string> = {
  hybrid: "The animal body part (tail, wings, scales, claws, snout or dinosaur legs) on the human child.",
  twins: "The figure that is drawn twice, both copies.",
  fused: "The place where legs, arms or bodies merge into one shape.",
  blend: "The figure that mixes features of two different characters.",
  garment: "The figures that wear the same distinctive garment.",
  text: "The readable written words, letters or logo.",
};

/** Box questions for the findings that fired, keyed like the checks; empty when nothing fired. */
export function jevBoxQuestionsFor(scores: JevScores): Record<string, JevQuestion> {
  return Object.fromEntries(firedJevChecks(scores).map((check) => [check, { type: "box" as const, instructions: BOX_INSTRUCTIONS[check] }]));
}

export interface JevReading {
  /** null when the reply carried none of the questions. */
  scores: JevScores | null;
  boxes?: Record<string, JevBox>;
  /** Every call, for the cost ledger. */
  replies: JevReply[];
}

/**
 * One second reading: the yes/no questions, then, only when a finding fired, where Jev saw it (≈ 0.001 ct a box).
 * The box call is separate, so a failure of the early box feature never costs the yes/no answers. Throws only when
 * the first call fails; the caller treats that as "no second opinion".
 */
export async function readWithJev(port: JevPort, imageUrl: string, drawn: VisualEntity[], scene = ""): Promise<JevReading> {
  const first = await port({ imageUrl, questions: jevQuestionsFor(drawn, scene) });
  const scores = parseJevScores(first.answers);
  const questions = scores ? jevBoxQuestionsFor(scores) : {};
  if (!Object.keys(questions).length) return { scores, replies: [first] };
  try {
    const located = await port({ imageUrl, questions });
    return { scores, ...(located.boxes && Object.keys(located.boxes).length ? { boxes: located.boxes } : {}), replies: [first, located] };
  } catch {
    return { scores, replies: [first] };
  }
}

/** One Jev call in the cost ledger's shape (input tokens only; Jev's output is free). */
export function jevCallResult(reply: JevReply): LlmCallResult {
  return {
    text: JSON.stringify(reply.boxes ? { ...reply.answers, boxes: reply.boxes } : reply.answers),
    modelUsed: JEV_MODEL,
    usage: { prompt: reply.inputTokens, completion: 0, total: reply.inputTokens, costUSD: reply.costUSD },
    durationMs: reply.durationMs,
  };
}

/** A box answer ({type:"box", box:{top,bottom,left,right}, confidence}); undefined when it is not a usable box. */
export function parseJevBox(answer: unknown): JevBox | undefined {
  const raw = answer as { box?: Record<string, unknown>; confidence?: unknown } | undefined;
  const [top, bottom, left, right] = (["top", "bottom", "left", "right"] as const).map((edge) => Number(raw?.box?.[edge]));
  if (![top, bottom, left, right].every((value) => Number.isFinite(value) && value >= 0 && value <= 1) || top >= bottom || left >= right) return undefined;
  const confidence = Number(raw?.confidence);
  return { top, bottom, left, right, confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0 };
}

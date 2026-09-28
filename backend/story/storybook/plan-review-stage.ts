/**
 * Storybook Pipeline — Stage 2b: the plan read by the critic before anyone writes.
 *
 * Batch 2026-09-28T10-54: the weak stories failed in the plan, not in the
 * prose — a solution nobody can picture (a ribbon, a post, fluff and a hat),
 * a rule shown too late. The revision after the draft could not repair that
 * (draft 5.2 → final 5.2). The same critic reading the plan costs a fraction
 * of a revision and sends the defect back while it is still one JSON edit.
 */

import { renderPlanForWriter } from "./draft-stage";
import type { StoryBrief } from "./context";
import { parseJsonObject, type LlmCallResult, type StorybookLlm } from "./llm";
import type { StoryPlan } from "./types";

export interface PlanReview {
  verdict: "ok" | "fix";
  problems: string[];
}

export function buildPlanReviewSystemPrompt(brief: StoryBrief): string {
  return [
    "Du bist Lektorin eines Kinderbuchverlags und liest den Seitenplan, BEVOR die Autorin schreibt.",
    `Die Zuhörer sind ${brief.band} Jahre alt und hören die Geschichte nur — sie sehen die Bilder, aber keine Pläne oder Zeichnungen.`,
    "Prüfe NUR Dinge, die man später mit schönen Sätzen nicht mehr retten kann:",
    "1. Lösung: Kann sich ein Kind die Lösung sofort vorstellen und in einem Satz nacherzählen? Mechanik aus Fäden, Hebeln, Knoten oder mehreren Gegenständen, die man nur mit Zeichnung versteht, ist ein Fehler.",
    "2. Die Kinder lösen es selbst: Ihre Idee, vorbereitet durch etwas, das früher gezeigt wurde — nicht der Zufall, nicht der Gegenspieler, der von allein stolpert.",
    "3. Regel/Magie: Wird sie gezeigt, BEVOR sie gebraucht wird, und bleibt sie gleich?",
    "4. Kontinuität: Passt der Stand am Ende jeder Seite ('Stand am Seitenende') zum Anfang der nächsten? Hat jeder, was er benutzt? Springt jemand ohne Grund an einen anderen Ort?",
    "5. Frist: genau eine, eindeutig, rückt sichtbar näher, wird einmal eingelöst. Die Folge ist logisch: Ein Kind versteht, WARUM das Schlimme passiert, wenn die Frist abläuft.",
    "6. Gegenspieler: Versteht ein Kind früh, warum er das tut? Die Schwäche, die die Lösung ausnutzt (er folgt jedem Duft, tanzt jeden Schritt nach …), wird früh gezeigt UND begründet — sonst kommt die Lösung aus dem Nichts.",
    "6b. Entdeckung: Die vorbereitete Beobachtung der Helden BEWIRKT die Lösung. Wenn die Lösung auch ohne sie klappt, ist sie Deko — ein Fehler.",
    "7. Herz: Versteht ein Kind, warum das Ziel den Helden wichtig ist?",
    "8. Refrain: Versteht ein Kind, wer ihn sagt und warum gerade dann?",
    "Kleinigkeiten, Stil und Wortwahl sind NICHT dein Thema.",
    "verdict ist 'fix' nur bei einem echten Fehler aus dieser Liste. Jedes Problem: welche Seite, was genau, und ein konkreter Vorschlag, wie der Plan es löst — höchstens vier.",
    "Antworte ausschließlich mit JSON: {\"verdict\": \"ok\" oder \"fix\", \"problems\": [\"Seite N: Problem → Vorschlag\"]}",
  ].join("\n");
}

export function sanitizePlanReview(raw: any): PlanReview | null {
  if (!raw || typeof raw !== "object") return null;
  const problems = (Array.isArray(raw.problems) ? raw.problems : [])
    .map((item: unknown) => String(item ?? "").replace(/\s+/g, " ").trim().slice(0, 400))
    .filter(Boolean)
    .slice(0, 4);
  const verdict = raw.verdict === "fix" && problems.length > 0 ? "fix" : "ok";
  return { verdict, problems: verdict === "fix" ? problems : [] };
}

export interface PlanReviewStageResult {
  review: PlanReview | null;
  call: LlmCallResult;
}

export async function runPlanReviewStage(llm: StorybookLlm, brief: StoryBrief, plan: StoryPlan, model: string): Promise<PlanReviewStageResult> {
  const call = await llm({
    stage: "plan-review",
    role: "critic",
    model,
    system: buildPlanReviewSystemPrompt(brief),
    user: `DER SEITENPLAN:\n\n${renderPlanForWriter(plan, brief)}`,
    json: true,
    maxTokens: 6000,
    effort: "low",
    temperature: 0.2,
  });
  return { review: sanitizePlanReview(parseJsonObject<any>(call.text)), call };
}

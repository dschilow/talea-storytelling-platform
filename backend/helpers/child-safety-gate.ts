/**
 * Encore-side child-safety gate: the deterministic screen plus one cheap moderation read
 * (see child-safety.ts). Fails open on infrastructure errors — a moderation outage must
 * never lock a child out — but never on a decision.
 *
 * TALEA_CHILD_SAFETY_GATE=off disables the LLM read (the deterministic screen stays).
 */

import { APIError } from "encore.dev/api";
import { callOpenRouterChatCompletion } from "../story/openrouter-generation";
import {
  buildModerationRequest,
  parseModeration,
  screenInput,
  type ModerationDecision,
  type SafetySurface,
} from "./child-safety";

const MODERATION_MODEL = "openai/gpt-6-luna";

/** Tavi answers a child in distress itself — a canned refusal would be the wrong reply. */
const DISTRESS_CATEGORY = /self|suicid|selbst|medikament|tablet|overdose|harm|geheim|secret|stranger|fremd|personal|daten|distress|bully|mobb/i;

export async function checkChildSafeInput(params: {
  text: string;
  surface: SafetySurface;
  ageBand?: string;
}): Promise<ModerationDecision> {
  const text = String(params.text || "").trim();
  if (!text) return { action: "allow" };

  const screened = screenInput(text, params.surface);
  if (screened.action === "block") return { action: "block", category: screened.category, message: screened.message };
  if (process.env.TALEA_CHILD_SAFETY_GATE === "off") return { action: "allow" };

  try {
    const { system, user } = buildModerationRequest(text, params.surface, params.ageBand);
    const result = await callOpenRouterChatCompletion({
      model: MODERATION_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      responseFormat: "json_object",
      maxTokens: 400,
      reasoning: { effort: "low", exclude: true },
      signal: AbortSignal.timeout(8_000),
    });
    const content = String(result.data?.choices?.[0]?.message?.content || "");
    const decision = parseModeration(content);
    if (!decision) {
      console.warn("[child-safety] unreadable moderation reply; allowing");
      return { action: "allow" };
    }
    if (decision.action === "block" && params.surface === "tavi-message" && DISTRESS_CATEGORY.test(decision.category || "")) {
      return { action: "allow" };
    }
    return decision;
  } catch (err) {
    console.warn("[child-safety] moderation unavailable; allowing", (err as Error)?.message || err);
    return { action: "allow" };
  }
}

/** Throws a friendly invalid-argument error for text that must not reach a generator. */
export async function assertChildSafeInput(params: {
  text: string | undefined | null;
  surface: SafetySurface;
  ageBand?: string;
}): Promise<void> {
  const decision = await checkChildSafeInput({ text: params.text || "", surface: params.surface, ageBand: params.ageBand });
  if (decision.action === "block") {
    console.warn("[child-safety] blocked input", { surface: params.surface, category: decision.category });
    throw APIError.invalidArgument(decision.message || "Dieser Wunsch passt leider nicht zu Talea.");
  }
}

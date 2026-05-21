/**
 * v12 §P/§Q (and §O follow-up) — strategy-specific repair prompt directives.
 *
 * Pure string builder: given a router strategy, return the directive block
 * that the chapter-repair prompt prepends before the generic gate list. The
 * block constrains what the LLM may touch, so a localized problem
 * (expansion, helper-explains, moralizing finale) does not get rewritten as
 * a whole-story polish.
 *
 * Lives in its own importsafe module so smoke tests can verify the wording.
 */
import type { DevModeRepairStrategy } from "./repair-router";

export function buildStrategyDirectivesBlock(
  strategy: DevModeRepairStrategy | undefined,
): string | null {
  if (!strategy || strategy === "none") return null;
  switch (strategy) {
    case "expansion_repair":
      // Spec §P — only thicken the load-bearing beats.
      return [
        "STRATEGY: §P EXPANSION REPAIR.",
        "The chapter is structurally weak, not stylistically thin. Do not pad with decoration.",
        "You may only strengthen:",
        "  1. personalCost — make what the child risks/gives up visible as a concrete object, sound, promise, or habit.",
        "  2. visible damage at the irreversible middle — make the worsening sensory, not abstract.",
        "  3. final decision — make the deciding action come from a named hero, not from a helper.",
        "  4. closing image — leave a picture, not a moral sentence.",
        "Do NOT add a new subplot, a new helper, a new locale, or a new magic rule. Do not invent backstory.",
      ].join("\n");
    case "whole_story_compression_repair":
      // Spec §Q — cut explanation first, never structural beats.
      return [
        "STRATEGY: §Q COMPRESSION REPAIR.",
        "Cut first, in this order:",
        "  1. second descriptions of the same setting or feeling.",
        "  2. repeated reactions (the same character noticing the same thing twice).",
        "  3. explanation sentences that tell what the reader already saw.",
        "  4. helper commentary that adds nothing structurally.",
        "  5. soft transitions between paragraphs that only restate the previous beat.",
        "NEVER cut:",
        "  - the hook,",
        "  - the first on-page test of the magic/wonder rule,",
        "  - the wrong first attempt,",
        "  - the irreversible middle and its visible damage,",
        "  - the personal cost,",
        "  - the final hero decision,",
        "  - the closing image.",
        "Output the chapter shorter, not differently structured.",
      ].join("\n");
    case "agency_repair":
      // Spec §O — helper explains/solves; rewrite so heroes decide.
      return [
        "STRATEGY: §O AGENCY REPAIR.",
        "A helper currently explains or performs the decisive beat. Rewrite so:",
        "  - the named heroes (not the helper) notice, test, decide, or act.",
        "  - the helper may complicate, ask, fail, pressure, or hand over a prop — but never explain the answer.",
        "  - the final action in the chapter is performed by a named hero.",
        "Do not change the plot. Only redistribute the decisive beat.",
      ].join("\n");
    case "voice_punchup":
      // Spec §O — heroes sound interchangeable.
      return [
        "STRATEGY: §O VOICE PUNCHUP.",
        "The two main heroes sound interchangeable. Rewrite 6–10 lines so each hero's voice carries a distinct rhythm, first reaction, body action, or word choice — consistent with the VOICE BIBLE above.",
        "Do not change the plot, the chapter length, the dialogue percentage, or the structural beats.",
      ].join("\n");
    case "ending_image_repair":
      // Spec §O — closing line moralizes.
      return [
        "STRATEGY: §O ENDING IMAGE REPAIR.",
        "The closing line of this chapter currently states a lesson. Rewrite it as a concrete sensory image: an object, an action, a sound, a small movement.",
        "Do not summarize what the heroes learned. Leave the picture and stop.",
      ].join("\n");
    case "whole_story_pull_repair":
      return [
        "STRATEGY: PULL REPAIR.",
        "Multiple non-final chapter endings lack a forward pull. Sharpen this chapter's endPull into a concrete pull: danger, decision, question, new rule, or funny aftershock.",
      ].join("\n");
    case "whole_story_dialog_rebalance":
      return [
        "STRATEGY: DIALOG REBALANCE.",
        "Replace narration with conflict-bearing speaker turns. Each new line must carry action, relationship, tension, subtext, or comic timing — never filler chatter.",
      ].join("\n");
    case "scene_card_repair_then_rewrite":
      return [
        "STRATEGY: SCENE-CARD-DRIVEN REWRITE.",
        "The chapter's structural anchors (irreversible middle or personal cost) are missing or weak. Restore them as the spine of the repair — every other change is subordinate.",
      ].join("\n");
    default:
      return null;
  }
}

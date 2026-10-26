import type { StoryBrief } from "../storybook/context";

/** Shared editorial priorities; formats change space and rhythm, not character agency. */
export function unifiedCraft(brief: StoryBrief, format: "read-aloud" | "picture-book" | "chapter-book" = "read-aloud"): string {
  const calm = brief.config.suspenseLevel === 0;
  return [
    "SHARED TALEA STORY METHOD",
    `Choose the idea for the figure's supplied want, fear and comic contradiction. The protagonist's decision changes the situation and a later choice changes the ending. ${calm ? "In a calm story, a tiny misunderstanding and a small generous or trusting choice are enough; do not demand a painful sacrifice or a crisis." : "A mistake or stubborn assumption has a concrete consequence; the final choice asks something of the protagonist."} Every avatar contributes a different effective action; a guest protagonist keeps their own decisive choice.`,
    "Before writing each scene, silently trace: previous decision -> concrete consequence -> changed situation -> next decision. A later attempt changes the relationship, information or stakes; it is not the same test with a different object. The quiet moment changes what somebody does next.",
    "Keep one small continuity ledger in mind: who is where, who holds each relevant object, what each figure knows, the exact wonder rule, and which promises remain open. Show transfers and travel when a listening child needs them. Close the protagonist's original want, title promise and planted clues at the end.",
    "A rule takes effect on its FIRST qualifying occurrence. Check every earlier test against the ending condition; a near-success must visibly fail BEFORE triggering it. Do not retroactively add a condition or an exception. The simplest ordinary solution is either possible and used, or visibly blocked by the existing situation.",
    "Let dialogue do two things: pursue an immediate intention and reveal a difference between figures. Let narration carry space, action and one telling observation. Preserve a figure's individual logic, not a repeated catchphrase quota. Humour grows from that logic and a consequence, with room for the listener to get it.",
    "Do not add adults, a near-discovery, a deadline, a third attempt or an extra magic object just to fill a template. Use them when they matter to this figure and this situation. Respect the requested calm, genre and safety boundaries.",
    format === "picture-book"
      ? `FORMAT: ${brief.budget.pages} short picture-book spreads. Stay within ${brief.budget.wordsPerPageMin}-${brief.budget.wordsPerPageMax} spoken words per spread. Each spread has one visual change and a reason to turn the page; let pictures carry appearance. Do not squeeze several chapter scenes into a spread. Keep the audible causal bridge and the protagonist's choice.`
      : format === "chapter-book"
        ? "FORMAT: a volume for several evenings. The whole volume has one driving question, a consequential middle turn and a prepared finale. Each chapter moves that question and a relationship forward; vary the scene shape. A gentle hook is a change or a new question, not danger on every page. Keep the logbook from the released prose binding for later batches."
        : "FORMAT: a complete read-aloud story. Give arrival, escalation, the quiet choice and the resolution room to play as scenes. The exact length budget is binding; short means a smaller adventure, not a synopsis.",
    brief.band === "3-5" ? "For three to five: the wonder has one immediately visible effect, with no stack of conditional rules. Gentle repetition changes the action; a sleepy story may end in a soft smile instead of a loud gag." : "",
  ].filter(Boolean).join("\n");
}

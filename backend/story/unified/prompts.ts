import { METHOD_EN, placeChoices } from "../episode/craft";
import { episodeCastFocus } from "../episode/cast-focus";
import { oneShotSystemPrompt } from "../episode/prompts";
import { broughtArtifact, type StoryBrief } from "../storybook/context";
import { heroSheetEn, castSheetEn, artifactSheetEn, wishLinesEn } from "../storybook/oneshot-prompt-en";
import { learningWriterLinesEn } from "../storybook/learning";
import { unifiedCraft } from "./craft";
import type { UnifiedFormat } from "./engine";

/** Retain the Originals voice and output contract, replace the plot template. */
export function unifiedSystemPrompt(brief: StoryBrief, format: UnifiedFormat): string {
  return oneShotSystemPrompt(brief).replace(METHOD_EN, unifiedCraft(brief, format));
}

export function unifiedUserPrompt(brief: StoryBrief, format: UnifiedFormat, revision?: { raw: string; notes: string[] }): string {
  const { budget } = brief;
  const lines = [
    "Invent, plan silently and write one complete Talea story. Consider three genuinely different premises and choose the one a child would want to retell. Build it around the leading figure's supplied want and contradiction; the scene progression follows decisions and their consequences.",
    `LANGUAGE: ${brief.languageLabel}. LISTENERS: ${brief.band}. FORMAT: ${format}.`,
    `Exactly ${budget.pages} numbered units using the required KAPITEL markers. ${budget.wordsPerPageMin}-${budget.wordsPerPageMax} spoken words per unit; ${budget.totalWordsMin}-${budget.totalWordsMax} in total. ${format === "picture-book" ? "Each unit is one short picture-book spread, not a compressed chapter." : "Each unit contains living scenes, not a synopsis."}`,
    ...wishLinesEn(brief.config, "story"),
    ...episodeCastFocus(brief),
    "AVATARS:", ...brief.heroes.map(hero => heroSheetEn(hero, brief.heroMemories[hero.id] || [])),
    "CANONICAL POOL: keep identity, supplied motivation and individual logic; give each selected figure a necessary role, and leave unused figures out. Cast one to the allowed maximum, not everyone.",
    ...brief.candidates.map(castSheetEn),
    `At most ${budget.maxCast} pool figures. At most ${brief.band === "3-5" ? 1 : 2} new named figures; list every new figure in the required header with its concrete English appearance. No extra adult merely to create a discovery scene.`,
    "Choose an opening in the figure's own world that makes the wish matter. The comic setback changes the next attempt. A quiet reaction changes the protagonist's next choice. Prepare the ending through something the listener has already seen. No fixed quota of misunderstandings or attempts.",
    `Fresh setting possibilities, only when they fit the family's chosen setting and this figure: ${placeChoices(brief.config.genre, brief.seed).join("; ")}.`,
    ...learningWriterLinesEn(brief.config, { form: "story", band: brief.band, units: budget.pages }),
  ];
  const brought = broughtArtifact(brief);
  if (brought) lines.push("MANDATORY BROUGHT ARTIFACT: present from the start, with its exact existing rule and owner.", artifactSheetEn(brought));
  else if (brief.artifacts.length) lines.push("OPTIONAL FIND: choose at most one only when it serves this story, under its exact existing rule.", ...brief.artifacts.map(artifactSheetEn));
  if (brief.recentStories.length) lines.push("THE FAMILY ALREADY KNOWS: choose a different main object, conflict, solution and title pattern.", ...brief.recentStories.slice(0, 6));
  if (brief.blockedTerms.length) lines.push(`These blocked terms must not appear: ${brief.blockedTerms.join(", ")}.`);
  lines.push("Before returning, read once as a first-time listener: follow each object and person, test the wonder rule at every occurrence including the first apparent success, and close the original want. Return only the specified header and numbered text.");
  if (revision) lines.push("REPAIR THIS EXISTING MANUSCRIPT. Keep premise, cast, title, rule and strong scenes. Correct these concrete defects:", ...revision.notes.map(n => `- ${n}`), "PREVIOUS VERSION:", revision.raw);
  return lines.join("\n");
}

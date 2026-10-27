import type { StoryConfig } from "../generate";

export const UNIFIED_PIPELINE_ID = "talea-unified-v1";
export type TaleaStoryFormat = "read-aloud" | "picture-book" | "chapter-book";

/** Experimental opt-in only. No production route calls this candidate yet. */
export function unifiedEnabled(value = process.env.TALEA_STORY_PIPELINE): boolean {
  return String(value || "").trim().toLowerCase() === "unified";
}
export function storyFormat(config: Pick<StoryConfig, "storybookMode" | "storybookEngine">): TaleaStoryFormat {
  if (config.storybookEngine === "chapter-book-v1") return "chapter-book";
  if (["storybook-v1", "storybook-v2", "book-workshop-v1"].includes(config.storybookEngine || "") || config.storybookMode && !config.storybookEngine) return "picture-book";
  return "read-aloud";
}

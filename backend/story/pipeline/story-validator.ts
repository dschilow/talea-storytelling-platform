import type { CastSet, SceneDirective, StoryDraft } from "./types";

export interface StoryValidationIssue {
  chapter: number;
  code: string;
  message: string;
}

export function validateStoryDraft(input: {
  draft: StoryDraft;
  directives: SceneDirective[];
  cast: CastSet;
}): { issues: StoryValidationIssue[]; score: number } {
  const { draft, directives, cast } = input;
  const issues: StoryValidationIssue[] = [];

  for (const directive of directives) {
    const chapter = draft.chapters.find(ch => ch.chapter === directive.chapter);
    if (!chapter) continue;

    const textLower = chapter.text.toLowerCase();
    const characterSlots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));

    for (const slot of characterSlots) {
      const name = findCharacterName(cast, slot);
      if (!name) continue;
      if (!textLower.includes(name.toLowerCase())) {
        issues.push({ chapter: directive.chapter, code: "MISSING_CHARACTER", message: `Missing ${name} in chapter` });
      }
    }

    if (directive.charactersOnStage.some(slot => slot.includes("ARTIFACT"))) {
      const artifactName = cast.artifact?.name?.toLowerCase();
      if (artifactName && !textLower.includes(artifactName)) {
        issues.push({ chapter: directive.chapter, code: "MISSING_ARTIFACT", message: "Artifact not mentioned in chapter" });
      }
    }
  }

  const score = Math.max(0, 10 - issues.length);
  return { issues, score };
}

function findCharacterName(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? null;
}

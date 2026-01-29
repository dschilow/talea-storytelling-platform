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
  language?: string;
  lengthTargets?: { wordMin: number; wordMax: number };
}): { issues: StoryValidationIssue[]; score: number } {
  const { draft, directives, cast, language, lengthTargets } = input;
  const issues: StoryValidationIssue[] = [];

  for (const directive of directives) {
    const chapter = draft.chapters.find(ch => ch.chapter === directive.chapter);
    if (!chapter) continue;

    const textLower = chapter.text.toLowerCase();
    const wordCount = countWords(chapter.text);
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

    const leak = detectInstructionLeak(textLower, language);
    if (leak) {
      issues.push({ chapter: directive.chapter, code: "INSTRUCTION_LEAK", message: leak });
    }

    if (hasBannedCanonPhrase(textLower, language)) {
      issues.push({ chapter: directive.chapter, code: "CANON_REPETITION", message: "Canon integration phrasing too explicit/repetitive" });
    }

    if (lengthTargets) {
      if (wordCount < lengthTargets.wordMin) {
        issues.push({ chapter: directive.chapter, code: "TOO_SHORT", message: `Chapter too short (${wordCount} words)` });
      } else if (wordCount > lengthTargets.wordMax) {
        issues.push({ chapter: directive.chapter, code: "TOO_LONG", message: `Chapter too long (${wordCount} words)` });
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

function detectInstructionLeak(textLower: string, language?: string): string | null {
  const forbiddenSnippets = [
    "tie the scene",
    "without breaking canon",
    "canon anchor line",
    "walking the same path in chapter",
    "have always been part of this tale",
    "scene directive",
    "return json",
    "final chapter:",
  ];

  if (forbiddenSnippets.some(snippet => textLower.includes(snippet))) {
    return "Instruction text leaked into chapter";
  }

  if (language === "de" && textLower.includes("chapter ")) {
    return "English instruction fragment detected";
  }

  return null;
}

function hasBannedCanonPhrase(textLower: string, language?: string): boolean {
  const bannedGerman = [
    "gehoeren seit jeher",
    "gehören seit jeher",
    "ganz selbstverstaendlich dabei",
    "ganz selbstverständlich dabei",
    "gehören seit jeher zu diesem märchen",
  ];
  const bannedEnglish = [
    "have always been part of this tale",
    "always been part of this tale",
    "naturally belong here",
  ];

  const list = language === "de" ? bannedGerman : bannedEnglish;
  return list.some(phrase => textLower.includes(phrase));
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

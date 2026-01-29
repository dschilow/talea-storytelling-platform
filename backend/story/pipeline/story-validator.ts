import type { CastSet, SceneDirective, StoryBible, StoryDraft } from "./types";

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
  storyBible?: StoryBible;
}): { issues: StoryValidationIssue[]; score: number } {
  const { draft, directives, cast, language, lengthTargets, storyBible } = input;
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

    if (directive.continuityMust?.length) {
      const continuityIssues = checkContinuityMust(directive.continuityMust, textLower, language);
      continuityIssues.forEach(message => issues.push({ chapter: directive.chapter, code: "CONTINUITY_MISS", message }));
    }

    if (directive.openLoopsToAddress?.length) {
      const hit = directive.openLoopsToAddress.some(loop => containsKeyword(textLower, loop));
      if (!hit) {
        issues.push({ chapter: directive.chapter, code: "OPEN_LOOP_MISS", message: "Open loop not addressed" });
      }
    }

    if (storyBible) {
      const throughline = hasThroughline(textLower, storyBible);
      if (!throughline) {
        issues.push({ chapter: directive.chapter, code: "THROUGHLINE_MISSING", message: "Chapter does not touch core goal/problem/mystery" });
      }
    }

    const actionIssues = checkCharacterActions({
      textLower,
      cast,
      characterSlots,
      language,
    });
    actionIssues.forEach(message => issues.push({ chapter: directive.chapter, code: "MISSING_ACTION", message }));

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
    "kanonischer hinweis",
    "canon hint",
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

function checkContinuityMust(items: string[], textLower: string, language?: string): string[] {
  const issues: string[] = [];
  items.forEach((item) => {
    if (item.startsWith("ENTRY:") || item.startsWith("EXIT:")) {
      const payload = item.split(":")[1]?.trim() || "";
      const name = payload.split(" - ")[0]?.trim();
      if (name && !textLower.includes(name.toLowerCase())) {
        issues.push((language === "de" ? "Entry/Exit fehlt: " : "Entry/Exit missing: ") + name);
      }
      const reason = payload.split(" - ")[1];
      if (reason && !containsKeyword(textLower, reason)) {
        issues.push((language === "de" ? "Entry/Exit Grund fehlt fuer: " : "Entry/Exit reason missing for: ") + name);
      }
    }
  });
  return issues;
}

function hasThroughline(textLower: string, bible: StoryBible): boolean {
  const keywords = [
    ...extractKeywords(bible.coreGoal),
    ...extractKeywords(bible.coreProblem),
    ...extractKeywords(bible.mysteryOrQuestion),
  ];
  if (keywords.length === 0) return true;
  return keywords.some(word => textLower.includes(word));
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(token => token.replace(/[^a-zäöüß]/g, ""))
    .filter(token => token.length >= 4);
}

function containsKeyword(textLower: string, phrase: string): boolean {
  const tokens = extractKeywords(phrase);
  return tokens.length === 0 ? false : tokens.some(token => textLower.includes(token));
}

function checkCharacterActions(input: {
  textLower: string;
  cast: CastSet;
  characterSlots: string[];
  language?: string;
}): string[] {
  const { textLower, cast, characterSlots, language } = input;
  const issues: string[] = [];
  const verbs = language === "de"
    ? ["geht", "läuft", "sagt", "fragt", "lacht", "ruft", "nimmt", "gibt", "hilft", "zeigt", "findet", "spuert", "schaut", "nickt", "denkt", "hoert"]
    : ["walks", "says", "asks", "laughs", "calls", "takes", "gives", "helps", "shows", "finds", "feels", "looks", "nods", "thinks", "hears"];

  for (const slot of characterSlots) {
    const name = findCharacterName(cast, slot);
    if (!name) continue;
    const nameLower = name.toLowerCase();
    if (!textLower.includes(nameLower)) {
      issues.push((language === "de" ? "Figur fehlt: " : "Missing character: ") + name);
      continue;
    }
    const sentences = textLower.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const hasAction = sentences.some(sentence => sentence.includes(nameLower) && verbs.some(v => sentence.includes(v)));
    if (!hasAction) {
      issues.push((language === "de" ? "Keine Handlung fuer: " : "No action for: ") + name);
    }
  }

  return issues;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

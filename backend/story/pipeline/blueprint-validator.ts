import type { BlueprintValidationIssue, BlueprintValidationResult, StoryBlueprintV8 } from "./types";

const EXPECTED_ARCS = ["SETUP", "DISCOVERY", "TURNING_POINT", "DARKEST_MOMENT", "LANDING"] as const;
const SUSPICIOUS_ENDINGS = new Set([
  "und",
  "oder",
  "aber",
  "weil",
  "dass",
  "denn",
  "wenn",
  "als",
  "kur",
  "verr",
  "rich",
]);
const GENERIC_BLUEPRINT_PATTERNS = [
  /muessen auf das reagieren, was in /i,
  /macht einen deutlichen schritt oder eine geste/i,
  /\bein belauschtes geheimnis\b/i,
  /\bdoppelter bluff\b/i,
  /\bnaechsten hinweis erreichen\b/i,
  /\bden plan in wenigen minuten neu ordnen\b/i,
  /sorgt fuer ein erstes schmunzeln/i,
  /taucht am ende leicht veraendert wieder auf/i,
];

export function validateV8Blueprint(input: {
  blueprint: any;
  chapterCount: number;
  ageMax: number;
  wordsPerChapter: { min: number; max: number };
}): BlueprintValidationResult {
  const issues: BlueprintValidationIssue[] = [];
  const strictChildMode = input.ageMax <= 8;
  const blueprint = input.blueprint as Partial<StoryBlueprintV8> | null | undefined;

  const push = (
    code: string,
    message: string,
    chapter?: number,
    severity: "ERROR" | "WARNING" = "ERROR",
  ) => {
    issues.push({ code, message, chapter, severity });
  };

  if (!blueprint || typeof blueprint !== "object") {
    push("BLUEPRINT_NOT_OBJECT", "Blueprint response is not a JSON object.");
    return { valid: false, issues };
  }

  if (!hasMeaningfulText(blueprint.title)) push("TITLE_MISSING", "Blueprint title is missing.");
  if (!hasMeaningfulText(blueprint.teaser)) push("TEASER_MISSING", "Blueprint teaser is missing.");
  if (blueprint.tense !== "preterite") push("TENSE_INVALID", `Blueprint tense must be "preterite", got "${String(blueprint.tense || "")}".`);
  if (!hasMeaningfulText(blueprint.pov_character)) push("POV_MISSING", "Blueprint POV character is missing.");

  const chapters = Array.isArray(blueprint.chapters) ? blueprint.chapters : [];
  if (chapters.length !== input.chapterCount) {
    push("CHAPTER_COUNT_INVALID", `Expected ${input.chapterCount} chapters, got ${chapters.length}.`);
  }

  chapters.forEach((chapter, index) => {
    const chapterNo = Number(chapter?.chapter || index + 1);
    if (chapterNo !== index + 1) {
      push("CHAPTER_ORDER_INVALID", `Chapter order is invalid at slot ${index + 1}.`, chapterNo);
    }

    if (strictChildMode) {
      const expectedArc = EXPECTED_ARCS[index];
      if (expectedArc && chapter?.arc_label !== expectedArc) {
        push("ARC_LABEL_INVALID", `Chapter ${index + 1} should use arc_label "${expectedArc}".`, chapterNo);
      }
    }

    const activeCharacters = Array.isArray(chapter?.active_characters) ? chapter.active_characters.filter(Boolean) : [];
    if (activeCharacters.length === 0) {
      push("ACTIVE_CHARACTERS_MISSING", `Chapter ${chapterNo} has no active characters.`, chapterNo);
    } else if (activeCharacters.length > 2) {
      push("ACTIVE_CHARACTERS_OVER_LIMIT", `Chapter ${chapterNo} has more than 2 active characters.`, chapterNo);
    }

    if (!hasMeaningfulText(chapter?.location)) push("LOCATION_MISSING", `Chapter ${chapterNo} is missing location.`, chapterNo);
    if (!hasMeaningfulText(chapter?.goal)) push("GOAL_MISSING", `Chapter ${chapterNo} is missing goal.`, chapterNo);
    if (!hasMeaningfulText(chapter?.obstacle)) push("OBSTACLE_MISSING", `Chapter ${chapterNo} is missing obstacle.`, chapterNo);
    if (!hasMeaningfulText(chapter?.key_emotion)) push("KEY_EMOTION_MISSING", `Chapter ${chapterNo} is missing key emotion.`, chapterNo);
    if (!hasMeaningfulText(chapter?.chapter_hook)) push("CHAPTER_HOOK_MISSING", `Chapter ${chapterNo} is missing chapter hook.`, chapterNo);

    const keyScene = chapter?.key_scene || {};
    if (!hasMeaningfulText(keyScene.what_happens)) push("KEY_SCENE_WHAT_MISSING", `Chapter ${chapterNo} key_scene.what_happens is missing.`, chapterNo);
    if (!hasMeaningfulText(keyScene.playable_moment)) push("KEY_SCENE_PLAYABLE_MISSING", `Chapter ${chapterNo} key_scene.playable_moment is missing.`, chapterNo);
    if (!hasMeaningfulText(keyScene.quotable_line)) push("KEY_SCENE_QUOTABLE_MISSING", `Chapter ${chapterNo} key_scene.quotable_line is missing.`, chapterNo);

    const wordTarget = Number(chapter?.word_target);
    if (!Number.isFinite(wordTarget) || wordTarget < input.wordsPerChapter.min || wordTarget > input.wordsPerChapter.max) {
      push(
        "WORD_TARGET_INVALID",
        `Chapter ${chapterNo} word_target ${String(chapter?.word_target)} is outside ${input.wordsPerChapter.min}-${input.wordsPerChapter.max}.`,
        chapterNo,
      );
    }

    for (const [field, value] of [
      ["location", chapter?.location],
      ["goal", chapter?.goal],
      ["obstacle", chapter?.obstacle],
      ["key_scene.what_happens", keyScene.what_happens],
      ["key_scene.playable_moment", keyScene.playable_moment],
      ["chapter_hook", chapter?.chapter_hook],
    ] as Array<[string, unknown]>) {
      if (looksSuspiciouslyTruncated(value)) {
        push("FIELD_TRUNCATED", `Chapter ${chapterNo} field "${field}" looks truncated.`, chapterNo);
      }
      if (field !== "location" && looksTooAbstract(value)) {
        push("FIELD_TOO_ABSTRACT", `Chapter ${chapterNo} field "${field}" is too abstract. Define concrete story physics children can picture.`, chapterNo);
      }
    }
  });

  const humorBeats = Array.isArray(blueprint.humor_beats) ? blueprint.humor_beats : [];
  const humorChapters = new Set(
    humorBeats
      .map((beat: any) => Number(beat?.chapter))
      .filter((chapter: number) => Number.isFinite(chapter) && chapter > 0),
  );
  if (humorChapters.size < 2) {
    push("HUMOR_DISTRIBUTION_WEAK", "Humor beats must cover at least 2 different chapters.");
  }
  for (const beat of humorBeats) {
    if (looksTooAbstract(beat?.description)) {
      push("HUMOR_BEAT_TOO_ABSTRACT", `Humor beat for chapter ${String(beat?.chapter || "?")} is too abstract.`, Number(beat?.chapter) || undefined);
    }
  }

  const repeatedQuotes = findRepeatedSceneLines(chapters.map(chapter => chapter?.key_scene?.quotable_line), 3);
  if (repeatedQuotes.length > 0) {
    push("QUOTABLE_LINE_REPEATED", "Blueprint repeats the same quotable_line too often across chapters.");
  }

  const repeatedPlayableMoments = findRepeatedSceneLines(chapters.map(chapter => chapter?.key_scene?.playable_moment), 2);
  if (repeatedPlayableMoments.length > 0) {
    push("PLAYABLE_MOMENT_REPEATED", "Blueprint repeats the same playable_moment across chapters.");
  }

  const errorAndRepair = blueprint.error_and_repair;
  if (!errorAndRepair || typeof errorAndRepair !== "object") {
    push("ERROR_AND_REPAIR_MISSING", "error_and_repair is missing.");
  } else {
    if (Number(errorAndRepair.error_chapter) !== 3) {
      push("ERROR_CHAPTER_INVALID", `error_and_repair.error_chapter must be 3, got ${String(errorAndRepair.error_chapter)}.`);
    }
    if (Number(errorAndRepair.repair_chapter) !== input.chapterCount) {
      push("REPAIR_CHAPTER_INVALID", `error_and_repair.repair_chapter must be ${input.chapterCount}, got ${String(errorAndRepair.repair_chapter)}.`);
    }
    for (const [field, value] of [
      ["who", errorAndRepair.who],
      ["error", errorAndRepair.error],
      ["inner_reason", errorAndRepair.inner_reason],
      ["body_signal", errorAndRepair.body_signal],
      ["repair", errorAndRepair.repair],
    ] as Array<[string, unknown]>) {
      if (!hasMeaningfulText(value)) {
        push("ERROR_AND_REPAIR_FIELD_MISSING", `error_and_repair.${field} is missing.`);
      }
    }
  }

  const povCharacter = normalizeName(blueprint.pov_character);
  if (povCharacter) {
    const povCount = chapters.filter(chapter =>
      (Array.isArray(chapter?.active_characters) ? chapter.active_characters : [])
        .map(normalizeName)
        .includes(povCharacter),
    ).length;
    if (povCount < Math.min(4, input.chapterCount)) {
      push("POV_PRESENCE_TOO_LOW", `POV character "${blueprint.pov_character}" is active in only ${povCount} chapters.`);
    }
  }

  const growthChild = normalizeName(errorAndRepair?.who);
  if (growthChild) {
    const growthChapters = [3, 4, input.chapterCount];
    for (const chapterNo of growthChapters) {
      const chapter = chapters.find(ch => Number(ch?.chapter) === chapterNo);
      const activeCharacters = Array.isArray(chapter?.active_characters) ? chapter.active_characters.map(normalizeName) : [];
      if (!activeCharacters.includes(growthChild)) {
        push("GROWTH_CHILD_MISSING", `Growth child "${errorAndRepair?.who}" must be active in chapter ${chapterNo}.`, chapterNo);
      }
    }
  }

  const iconicScene = blueprint.iconic_scene;
  if (!iconicScene || !Number.isFinite(Number(iconicScene.chapter)) || !hasMeaningfulText(iconicScene.description)) {
    push("ICONIC_SCENE_MISSING", "iconic_scene is missing or incomplete.");
  } else if (looksTooAbstract(iconicScene.description)) {
    push("ICONIC_SCENE_TOO_ABSTRACT", "iconic_scene must describe a concrete physical moment children can replay.");
  }

  return {
    valid: issues.every(issue => issue.severity !== "ERROR"),
    issues,
  };
}

export function formatBlueprintValidationIssues(issues: BlueprintValidationIssue[]): string {
  return issues
    .map((issue) => `- ${issue.chapter ? `Chapter ${issue.chapter}: ` : ""}${issue.message}`)
    .join("\n");
}

function hasMeaningfulText(value: unknown): boolean {
  return String(value || "").replace(/\s+/g, " ").trim().length >= 6;
}

function normalizeName(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function looksSuspiciouslyTruncated(value: unknown): boolean {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length < 10) return false;
  if (/[.!?"”]$/.test(text)) return false;
  const tokens = text.split(/\s+/);
  const lastToken = String(tokens[tokens.length - 1] || "").toLowerCase();
  if (!lastToken) return true;
  if (SUSPICIOUS_ENDINGS.has(lastToken)) return true;
  if (lastToken.length <= 3 && tokens.length >= 4) return true;
  if (/[([{'"-]$/.test(text)) return true;
  return false;
}

function looksTooAbstract(value: unknown): boolean {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length < 10) return false;
  return GENERIC_BLUEPRINT_PATTERNS.some((pattern) => pattern.test(text));
}

function findRepeatedSceneLines(values: unknown[], minCount: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = normalizeSceneLine(value);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .map(([text]) => text);
}

function normalizeSceneLine(value: unknown): string {
  return String(value || "")
    .replace(/["“”]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

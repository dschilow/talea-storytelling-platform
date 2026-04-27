import type { BlueprintValidationIssue, BlueprintValidationResult, StoryBlueprintV8 } from "./types";
import { ENDING_PATTERN_MAP, type EndingPatternName } from "./ending-patterns";

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
  /\bnaechsten hinweis finden\b/i,
  /\bder spur folgen\b/i,
  /\bnur die spur finden\b/i,
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

  if (strictChildMode) {
    validateReaderContract((blueprint as any).reader_contract, push);
  }

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

  // Sprint 1 (MT1): Concrete-Anker-Map is mandatory — at least 3 entries mapping
  // abstract themes to concrete, graspable story-physics (e.g. "trust" → "a star-shaped
  // screw Adrian places in Alexander's hand"). Rejects responses where this is missing.
  const concreteAnchors = (blueprint as any).concrete_anchors;
  if (!concreteAnchors || typeof concreteAnchors !== "object" || Array.isArray(concreteAnchors)) {
    push(
      "CONCRETE_ANCHORS_MISSING",
      "concrete_anchors is missing. Provide an object mapping at least 3 abstract themes (e.g. \"trust\", \"forgiveness\", \"courage\") to concrete story-physics (e.g. \"a star-shaped screw handed over\"). Abstract themes must be grounded.",
    );
  } else {
    const entries = Object.entries(concreteAnchors).filter(
      ([key, value]) => hasMeaningfulText(key) && hasMeaningfulText(value),
    );
    if (entries.length < 3) {
      push(
        "CONCRETE_ANCHORS_TOO_FEW",
        `concrete_anchors must have at least 3 meaningful entries, got ${entries.length}. Each abstract theme needs a concrete story-physics counterpart.`,
      );
    }
    for (const [abstract, anchor] of entries) {
      if (looksTooAbstract(anchor)) {
        push(
          "CONCRETE_ANCHOR_TOO_ABSTRACT",
          `concrete_anchors["${abstract}"] = "${String(anchor).slice(0, 60)}..." is itself too abstract. It must name a specific, physical, child-visible object or action.`,
        );
      }
    }
  }

  // Sprint 3 (MT4): Ending-Pattern is mandatory. Blueprint picks one of 8 curated
  // patterns; writer will realize it in the final chapter, gate verifies it.
  const endingPattern = (blueprint as any).ending_pattern;
  if (!hasMeaningfulText(endingPattern)) {
    push(
      "ENDING_PATTERN_MISSING",
      "ending_pattern is missing. Pick exactly one: return_home_changed, shared_moment, object_transformed, revealed_truth, warm_callback, resolved_conflict_quiet, circle_closed, promise_kept.",
    );
  } else if (!ENDING_PATTERN_MAP.has(String(endingPattern).trim() as EndingPatternName)) {
    push(
      "ENDING_PATTERN_INVALID",
      `ending_pattern "${endingPattern}" is not one of the 8 curated patterns. Valid: ${[...ENDING_PATTERN_MAP.keys()].join(", ")}.`,
    );
  }

  // Sprint 1 (MT2): Antagonist-DNA is mandatory whenever the story has an antagonist.
  // Detection: any chapter active_characters contains a name not in growth_child / pov_character
  // and the narrative uses obstacle-phrases suggesting an opponent.
  const antagonistDna = (blueprint as any).antagonist_dna;
  const hasPotentialAntagonist = detectPotentialAntagonist(chapters, blueprint);
  if (hasPotentialAntagonist || antagonistDna) {
    if (!antagonistDna || typeof antagonistDna !== "object" || Array.isArray(antagonistDna)) {
      push(
        "ANTAGONIST_DNA_MISSING",
        "antagonist_dna is missing. Story has an antagonist — provide { name, motive, weakness, first_action, speech_tic }. No more 'appeared out of nowhere' villains.",
      );
    } else {
      for (const field of ["name", "motive", "weakness", "first_action", "speech_tic"] as const) {
        if (!hasMeaningfulText(antagonistDna[field])) {
          push(
            "ANTAGONIST_DNA_FIELD_MISSING",
            `antagonist_dna.${field} is missing or too short. Each DNA field must be a concrete, actionable sentence.`,
          );
        }
      }
      if (hasMeaningfulText(antagonistDna.motive) && looksTooAbstract(antagonistDna.motive)) {
        push(
          "ANTAGONIST_MOTIVE_TOO_ABSTRACT",
          "antagonist_dna.motive is too abstract. Motive must be a specific, concrete want (e.g. \"wants to steal every clock in town before midnight\"), not \"wants power\".",
        );
      }
      // Sprint 4 (S4.3): showdown enforcement — antagonist name must appear in
      // the final chapter's active_characters list or in the chapter's plot fields.
      if (hasMeaningfulText(antagonistDna.name)) {
        const finalChapter = chapters[chapters.length - 1];
        const antaName = String(antagonistDna.name).toLowerCase();
        const finalActives: string[] = Array.isArray(finalChapter?.active_characters)
          ? finalChapter.active_characters.map((a: any) => String(a).toLowerCase())
          : [];
        const finalSupporting: string[] = Array.isArray(finalChapter?.supporting_characters)
          ? finalChapter.supporting_characters.map((a: any) => String(a).toLowerCase())
          : [];
        const finalScenePieces = [
          finalChapter?.goal,
          finalChapter?.obstacle,
          finalChapter?.chapter_hook,
          finalChapter?.key_scene?.what_happens,
          finalChapter?.key_scene?.playable_moment,
          finalChapter?.key_scene?.quotable_line,
        ]
          .filter((s) => typeof s === "string")
          .join(" ")
          .toLowerCase();
        const inFinalActives = finalActives.some((a) => a.includes(antaName));
        const inFinalSupporting = finalSupporting.some((a) => a.includes(antaName));
        const inFinalText = finalScenePieces.includes(antaName);
        if (!inFinalActives && !inFinalSupporting && !inFinalText) {
          push(
            "ANTAGONIST_NO_SHOWDOWN",
            `antagonist_dna.name "${antagonistDna.name}" missing from final chapter — story has no showdown. Add to active_characters or to the final chapter's goal/obstacle/key_scene.`,
          );
        }
      }
    }
  }

  // Sprint 4 (S4.2): refrain_line validation. Optional in schema for backward
  // compatibility, but if provided, must be 2-6 words and short enough to be memorable.
  const refrainLine = (blueprint as any).refrain_line;
  if (refrainLine !== undefined && refrainLine !== null && refrainLine !== "") {
    const text = String(refrainLine).trim();
    if (text.length < 4) {
      push(
        "REFRAIN_TOO_SHORT",
        `refrain_line "${text}" is too short. Aim for a 2-6-word phrase that can recur ≥3× memorably.`,
      );
    } else {
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length > 8) {
        push(
          "REFRAIN_TOO_LONG",
          `refrain_line is ${words.length} words. Refrains should be 2-6 words for memorability (Gruffalo principle).`,
        );
      }
    }
  }

  // Sprint 5 (S5.2): iconic_motif structural validation if provided.
  const iconicMotif = (blueprint as any).iconic_motif;
  if (iconicMotif !== undefined && iconicMotif !== null) {
    if (typeof iconicMotif !== "object" || Array.isArray(iconicMotif)) {
      push(
        "ICONIC_MOTIF_INVALID_TYPE",
        "iconic_motif must be an object { object: string, per_chapter_position: string[] }.",
      );
    } else {
      if (!hasMeaningfulText(iconicMotif.object)) {
        push(
          "ICONIC_MOTIF_OBJECT_MISSING",
          "iconic_motif.object missing — needs a concrete recurring item (e.g. 'kleiner glatter Stein').",
        );
      }
      const positions = iconicMotif.per_chapter_position;
      if (!Array.isArray(positions) || positions.length < 3) {
        push(
          "ICONIC_MOTIF_POSITIONS_SPARSE",
          "iconic_motif.per_chapter_position must be an array with ≥3 entries (motif must thread through ≥3 chapters).",
        );
      }
    }
  }

  return {
    valid: issues.every(issue => issue.severity !== "ERROR"),
    issues,
  };
}

function validateReaderContract(
  contract: any,
  push: (code: string, message: string, chapter?: number, severity?: "ERROR" | "WARNING") => void,
): void {
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    push(
      "READER_CONTRACT_MISSING",
      "reader_contract is required for age 5-8 stories. It must make Chapter 1 child-readable before action starts.",
    );
    return;
  }

  const requiredFields = [
    "normal_world",
    "who_we_meet_first",
    "mission_in_child_words",
    "why_it_matters",
    "special_rule",
    "chapter1_question",
  ] as const;

  for (const field of requiredFields) {
    const value = contract[field];
    if (!hasMeaningfulText(value)) {
      push(
        "READER_CONTRACT_FIELD_MISSING",
        `reader_contract.${field} is missing or too short. Chapter 1 needs this for child comprehension.`,
      );
    } else if (looksReaderContractTooAbstract(value)) {
      push(
        "READER_CONTRACT_TOO_ABSTRACT",
        `reader_contract.${field} is too abstract. Use visible objects, actions, and consequences a child can point at.`,
        undefined,
        "WARNING",
      );
    }
  }

  if (isGenericReaderMission(contract.mission_in_child_words)) {
    push(
      "READER_CONTRACT_MISSION_GENERIC",
      "reader_contract.mission_in_child_words cannot be only 'find/follow the next clue/trail'. Name a concrete task plus consequence.",
    );
  }
}

function isGenericReaderMission(value: unknown): boolean {
  const text = String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const clueOnly = /\b(naechsten|nächsten|ersten|letzten)?\s*(hinweis|spur|zeichen|weg)\s*(finden|folgen|erreichen|lesen|suchen)\b/.test(text)
    || /\b(der|die|dem|einer)?\s*(spur|hinweis|zeichen)\s*(folgen|finden|suchen)\b/.test(text);
  const concreteTask = /\b(bringen|retten|reparieren|zurueckbringen|zurückbringen|zurueckgeben|zurückgeben|befreien|beschuetzen|beschützen|oeffnen|öffnen|schliessen|schließen|aufhalten|holen|abgeben|ersetzen|bauen|sammeln)\b/.test(text);
  return clueOnly && !concreteTask;
}

function looksReaderContractTooAbstract(value: unknown): boolean {
  const text = String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (text.length < 12) return false;
  const abstractHits = text.match(/\b(abenteuer|geheimnisvoll|magisch|kraft|gegenkraft|ritual|fluch|artefakt|hinweis|spur|zeichen|energie|ziel)\b/g)?.length ?? 0;
  const concreteHits = text.match(/\b(tuer|tür|fenster|tisch|hof|zimmer|garten|brunnen|eimer|zettel|muenze|münze|schluessel|schlüssel|karte|tasche|rucksack|stein|buch|uhr|kiste|schnur|ball|licht|kreis|weg|baum|bank|brot|becher)\b/g)?.length ?? 0;
  return abstractHits >= 2 && concreteHits === 0;
}

/**
 * Best-effort detection whether the story has a narrative antagonist.
 * Signals: a character appears in multiple chapters as "active" but is not the POV
 * or growth child, or obstacle phrases contain conflict/opposition language.
 */
function detectPotentialAntagonist(chapters: any[], blueprint: any): boolean {
  const povName = normalizeName(blueprint?.pov_character);
  const growthName = normalizeName(blueprint?.error_and_repair?.who);
  const excluded = new Set([povName, growthName].filter(Boolean));

  const recurringActive = new Map<string, number>();
  for (const chapter of chapters) {
    const actives = Array.isArray(chapter?.active_characters) ? chapter.active_characters : [];
    for (const a of actives) {
      const key = normalizeName(a);
      if (!key || excluded.has(key)) continue;
      recurringActive.set(key, (recurringActive.get(key) || 0) + 1);
    }
  }
  for (const count of recurringActive.values()) {
    if (count >= 2) return true;
  }

  const obstaclePattern = /\b(feind|gegner|schurke|boes|villain|antagonist|enemy|opponent|fluch|curse)\b/i;
  return chapters.some(chapter => obstaclePattern.test(String(chapter?.obstacle || "")));
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

import type { CastSet, SceneDirective, StoryDraft, ArtifactArcPlan } from "./types";
import type { WordBudget } from "./word-budget";
import { ALL_BANNED_PHRASES } from "./canon-fusion";
import { findTemplatePhraseMatches } from "./template-phrases";

export interface QualityIssue {
  gate: string;
  chapter: number;
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
}

export interface QualityReport {
  issues: QualityIssue[];
  score: number;
  passedGates: string[];
  failedGates: string[];
}

// ─── Gate 1: Length & Pacing ────────────────────────────────────────────────────
function gateLengthAndPacing(draft: StoryDraft, wordBudget?: WordBudget): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (!wordBudget) return issues;

  const totalWords = draft.chapters.reduce((sum, ch) => sum + countWords(ch.text), 0);
  const hardMin = getHardMinChapterWords(draft, wordBudget);

  if (totalWords < wordBudget.minWords) {
    issues.push({
      gate: "LENGTH_PACING",
      chapter: 0,
      code: "TOTAL_TOO_SHORT",
      message: `Story total ${totalWords} words, minimum ${wordBudget.minWords}`,
      severity: "ERROR",
    });
  } else if (totalWords > wordBudget.maxWords) {
    issues.push({
      gate: "LENGTH_PACING",
      chapter: 0,
      code: "TOTAL_TOO_LONG",
      message: `Story total ${totalWords} words, maximum ${wordBudget.maxWords}`,
      severity: "ERROR",
    });
  }

  for (const ch of draft.chapters) {
    const wc = countWords(ch.text);
    if (hardMin && wc < hardMin) {
      issues.push({
        gate: "LENGTH_PACING",
        chapter: ch.chapter,
        code: "CHAPTER_TOO_SHORT_HARD",
        message: `Chapter ${ch.chapter}: ${wc} words, hard minimum ${hardMin}`,
        severity: "ERROR",
      });
    } else if (wc < wordBudget.minWordsPerChapter) {
      issues.push({
        gate: "LENGTH_PACING",
        chapter: ch.chapter,
        code: "CHAPTER_TOO_SHORT",
        message: `Chapter ${ch.chapter}: ${wc} words, minimum ${wordBudget.minWordsPerChapter}`,
        severity: "WARNING",
      });
    } else if (wc > wordBudget.maxWordsPerChapter) {
      issues.push({
        gate: "LENGTH_PACING",
        chapter: ch.chapter,
        code: "CHAPTER_TOO_LONG",
        message: `Chapter ${ch.chapter}: ${wc} words, maximum ${wordBudget.maxWordsPerChapter}`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 2: Chapter Structure ──────────────────────────────────────────────────
function gateChapterStructure(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const ch of draft.chapters) {
    const text = ch.text;
    const sentences = splitSentences(text);

    if (sentences.length < 3) {
      issues.push({
        gate: "CHAPTER_STRUCTURE",
        chapter: ch.chapter,
        code: "CHAPTER_PLACEHOLDER",
        message: isDE
          ? `Kapitel ${ch.chapter}: Nur ${sentences.length} Saetze, Kapitel wirkt wie Platzhalter`
          : `Chapter ${ch.chapter}: Only ${sentences.length} sentences, chapter reads like a placeholder`,
        severity: "ERROR",
      });
    } else if (sentences.length < 5) {
      issues.push({
        gate: "CHAPTER_STRUCTURE",
        chapter: ch.chapter,
        code: "TOO_FEW_SENTENCES",
        message: isDE
          ? `Kapitel ${ch.chapter}: Nur ${sentences.length} Saetze, mindestens 5 erwartet`
          : `Chapter ${ch.chapter}: Only ${sentences.length} sentences, at least 5 expected`,
        severity: "WARNING",
      });
    }

    const hasDialogue = /[""„‟»«]/.test(text) || /^\s*[—–-]\s/m.test(text);
    if (!hasDialogue) {
      issues.push({
        gate: "CHAPTER_STRUCTURE",
        chapter: ch.chapter,
        code: "NO_DIALOGUE",
        message: isDE
          ? `Kapitel ${ch.chapter}: Kein Dialog gefunden`
          : `Chapter ${ch.chapter}: No dialogue found`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 3: Dialogue Quote ─────────────────────────────────────────────────────
function gateDialogueQuote(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const ch of draft.chapters) {
    const dialogueCount = countDialogueLines(ch.text);
    if (dialogueCount < 2) {
      issues.push({
        gate: "DIALOGUE_QUOTE",
        chapter: ch.chapter,
        code: "TOO_FEW_DIALOGUES",
        message: isDE
          ? `Kapitel ${ch.chapter}: Nur ${dialogueCount} Dialogzeilen, mindestens 2 erwartet`
          : `Chapter ${ch.chapter}: Only ${dialogueCount} dialogue lines, min 2`,
        severity: "WARNING",
      });
    } else if (dialogueCount > 6) {
      issues.push({
        gate: "DIALOGUE_QUOTE",
        chapter: ch.chapter,
        code: "TOO_MANY_DIALOGUES",
        message: isDE
          ? `Kapitel ${ch.chapter}: ${dialogueCount} Dialogzeilen, maximal 6`
          : `Chapter ${ch.chapter}: ${dialogueCount} dialogue lines, max 6`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 4: Character Integration ──────────────────────────────────────────────
function gateCharacterIntegration(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const directive of directives) {
    const ch = draft.chapters.find(c => c.chapter === directive.chapter);
    if (!ch) continue;

    const textLower = ch.text.toLowerCase();
    const characterSlots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));

    for (const slot of characterSlots) {
      const name = findCharacterName(cast, slot);
      if (!name) continue;

      if (!textLower.includes(name.toLowerCase())) {
        issues.push({
          gate: "CHARACTER_INTEGRATION",
          chapter: ch.chapter,
          code: "MISSING_CHARACTER",
          message: isDE ? `Figur fehlt: ${name}` : `Missing character: ${name}`,
          severity: "ERROR",
        });
        continue;
      }

      const hasAction = checkCharacterHasAction(ch.text, name);
      if (!hasAction) {
        issues.push({
          gate: "CHARACTER_INTEGRATION",
          chapter: ch.chapter,
          code: "PASSIVE_CHARACTER",
          message: isDE
            ? `${name} ist nur erwaehnt, hat aber keine aktive Handlung`
            : `${name} is only mentioned, no active action`,
          severity: "WARNING",
        });
      }
    }
  }

  const metaPhrases = [
    "gehoeren seit jeher", "gehören seit jeher",
    "ganz selbstverstaendlich dabei", "ganz selbstverständlich dabei",
    "wie in diesem maerchen", "wie in diesem märchen",
    "have always been part", "naturally belongs here",
    "always been part of this tale",
  ];

  for (const ch of draft.chapters) {
    const textLower = ch.text.toLowerCase();
    for (const phrase of metaPhrases) {
      if (textLower.includes(phrase)) {
        issues.push({
          gate: "CHARACTER_INTEGRATION",
          chapter: ch.chapter,
          code: "META_BELONGING_PHRASE",
          message: isDE
            ? `Verbotene Meta-Aussage ueber Zugehoerigkeit gefunden`
            : `Forbidden meta-belonging phrase detected`,
          severity: "ERROR",
        });
        break;
      }
    }
  }

  return issues;
}

// ─── Gate 5: Cast Lock ──────────────────────────────────────────────────────────
function gateCastLock(
  draft: StoryDraft,
  cast: CastSet,
  language: string,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const allowedNames = new Set<string>();
  for (const sheet of [...cast.avatars, ...cast.poolCharacters]) {
    allowedNames.add(sheet.displayName.toLowerCase());
    const parts = sheet.displayName.toLowerCase().split(/\s+/);
    for (const part of parts) {
      if (part.length > 2) allowedNames.add(part);
    }
  }
  if (cast.artifact?.name) {
    allowedNames.add(cast.artifact.name.toLowerCase());
  }

  const properNameRegex = /\b([A-ZÄÖÜ][a-zäöüß]{2,}(?:\s+[A-ZÄÖÜ][a-zäöüß]{2,})*)\b/g;

  for (const ch of draft.chapters) {
    const matches = ch.text.matchAll(properNameRegex);
    for (const match of matches) {
      const matchIndex = typeof match.index === "number" ? match.index : 0;
      const name = match[1].toLowerCase();
      if (isCommonWord(name, language)) continue;
      if (allowedNames.has(name)) continue;
      const parts = name.split(/\s+/);
      if (parts.some(p => allowedNames.has(p))) continue;
      if (language === "de" && isGermanCommonNounContext(ch.text, matchIndex)) continue;
      if (language === "de" && parts.length === 1 && !isLikelyGermanNameCandidate(ch.text, match[1], matchIndex)) continue;

      const isActor = isLikelyCharacterAction(ch.text, match[1]);
      issues.push({
        gate: "CAST_LOCK",
        chapter: ch.chapter,
        code: isActor ? "UNLOCKED_CHARACTER_ACTOR" : "UNLOCKED_CHARACTER",
        message: isDE
          ? `Neuer Eigenname "${match[1]}" nicht in der erlaubten Figurenliste`
          : `New proper name "${match[1]}" not in allowed character list`,
        severity: isActor ? "ERROR" : "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 6: Repetition Limiter ─────────────────────────────────────────────────
function gateRepetitionLimiter(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const fillerWords = isDE
    ? ["plötzlich", "ploetzlich", "auf einmal", "mit einem mal", "da geschah es"]
    : ["suddenly", "all of a sudden", "in that moment", "just then"];

  const fillerCounts: Record<string, number> = {};
  for (const ch of draft.chapters) {
    const textLower = ch.text.toLowerCase();
    for (const filler of fillerWords) {
      const count = countOccurrences(textLower, filler);
      fillerCounts[filler] = (fillerCounts[filler] ?? 0) + count;
    }
  }

  for (const [filler, count] of Object.entries(fillerCounts)) {
    if (count > 3) {
      issues.push({
        gate: "REPETITION_LIMITER",
        chapter: 0,
        code: "FILLER_OVERUSE",
        message: isDE
          ? `Fuellwort "${filler}" ${count}x verwendet (max 3)`
          : `Filler "${filler}" used ${count}x (max 3)`,
        severity: "WARNING",
      });
    }
  }

  const bannedWordPatterns = isDE
    ? [
        { token: "plötzlich", regex: /\bpl[öo]tzlich\b/gi },
        { token: "irgendwie", regex: /\birgendwie\b/gi },
        { token: "ein bisschen", regex: /\bein\s+bisschen\b/gi },
        { token: "ziemlich", regex: /\bziemlich\b/gi },
        { token: "wirklich", regex: /\bwirklich\b/gi },
        { token: "sehr", regex: /\bsehr\b/gi },
        { token: "Es war einmal", regex: /\bes\s+war\s+einmal\b/gi },
      ]
    : [
        { token: "suddenly", regex: /\bsuddenly\b/gi },
        { token: "really", regex: /\breally\b/gi },
      ];

  for (const ch of draft.chapters) {
    for (const banned of bannedWordPatterns) {
      banned.regex.lastIndex = 0;
      const count = (ch.text.match(banned.regex) ?? []).length;
      if (count === 0) continue;
      issues.push({
        gate: "REPETITION_LIMITER",
        chapter: ch.chapter,
        code: "BANNED_WORD_USED",
        message: isDE
          ? `Kapitel ${ch.chapter}: verbotenes Fuellwort "${banned.token}" ${count}x verwendet`
          : `Chapter ${ch.chapter}: banned filler "${banned.token}" used ${count}x`,
        severity: (ageRange?.max ?? 12) <= 8 ? "ERROR" : "WARNING",
      });
    }
  }

  const sentences = draft.chapters.flatMap((ch, idx) =>
    splitSentences(ch.text).map(s => ({ chapter: idx + 1, text: normalizeForComparison(s) }))
  );

  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      if (sentences[i].chapter === sentences[j].chapter) continue;
      if (sentences[i].text.length < 20) continue;
      if (similarity(sentences[i].text, sentences[j].text) > 0.85) {
        issues.push({
          gate: "REPETITION_LIMITER",
          chapter: sentences[j].chapter,
          code: "DUPLICATE_SENTENCE",
          message: isDE
            ? `Kapitel ${sentences[j].chapter}: Fast identischer Satz wie in Kapitel ${sentences[i].chapter}`
            : `Chapter ${sentences[j].chapter}: Near-duplicate sentence from chapter ${sentences[i].chapter}`,
          severity: "WARNING",
        });
        break;
      }
    }
  }

  return issues;
}

// Gate 7.5: Template Phrase Ban
function gateTemplatePhrases(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const ch of draft.chapters) {
    const matches = findTemplatePhraseMatches(ch.text, language);
    if (matches.length === 0) continue;
    const labels = matches.map(m => m.label).join(", ");
    issues.push({
      gate: "TEMPLATE_PHRASES",
      chapter: ch.chapter,
      code: "TEMPLATE_PHRASE",
      message: isDE
        ? `Template-Phrasen gefunden: ${labels}`
        : `Template phrases detected: ${labels}`,
      severity: "ERROR",
    });
  }

  return issues;
}

// ─── Gate 7: Imagery Balance ────────────────────────────────────────────────────
function gateReadabilityComplexity(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  if (!ageRange) return issues;

  const ageMax = ageRange.max;
  const longSentenceThreshold = ageMax <= 5 ? 13 : ageMax <= 8 ? 18 : 26;
  const maxAvgSentenceWords = ageMax <= 5 ? 10 : ageMax <= 8 ? 14 : 19;
  const maxLongSentenceRatio = ageMax <= 5 ? 0.1 : ageMax <= 8 ? 0.15 : 0.28;

  for (const ch of draft.chapters) {
    const sentences = splitSentences(ch.text);
    if (sentences.length === 0) continue;

    const sentenceWordCounts = sentences.map(s => countWords(s)).filter(n => n > 0);
    if (sentenceWordCounts.length === 0) continue;

    const totalSentenceWords = sentenceWordCounts.reduce((a, b) => a + b, 0);
    const avgSentenceWords = totalSentenceWords / sentenceWordCounts.length;
    const longSentenceCount = sentenceWordCounts.filter(n => n > longSentenceThreshold).length;
    const longSentenceRatio = longSentenceCount / sentenceWordCounts.length;
    const hasVeryLongSentence = sentenceWordCounts.some(n => n >= longSentenceThreshold + 8);

    if (avgSentenceWords > maxAvgSentenceWords) {
      issues.push({
        gate: "READABILITY_COMPLEXITY",
        chapter: ch.chapter,
        code: "SENTENCE_COMPLEXITY_HIGH",
        message: isDE
          ? `Kapitel ${ch.chapter}: Satzlaenge zu hoch (${avgSentenceWords.toFixed(1)} Woerter im Schnitt, max ${maxAvgSentenceWords})`
          : `Chapter ${ch.chapter}: sentence complexity too high (${avgSentenceWords.toFixed(1)} words avg, max ${maxAvgSentenceWords})`,
        severity: ageMax <= 8 ? "ERROR" : "WARNING",
      });
    }

    if (longSentenceRatio > maxLongSentenceRatio) {
      issues.push({
        gate: "READABILITY_COMPLEXITY",
        chapter: ch.chapter,
        code: "LONG_SENTENCE_OVERUSE",
        message: isDE
          ? `Kapitel ${ch.chapter}: zu viele lange Saetze (${Math.round(longSentenceRatio * 100)}%, max ${Math.round(maxLongSentenceRatio * 100)}%)`
          : `Chapter ${ch.chapter}: too many long sentences (${Math.round(longSentenceRatio * 100)}%, max ${Math.round(maxLongSentenceRatio * 100)}%)`,
        severity: ageMax <= 8 ? "ERROR" : "WARNING",
      });
    }

    if (hasVeryLongSentence) {
      issues.push({
        gate: "READABILITY_COMPLEXITY",
        chapter: ch.chapter,
        code: "VERY_LONG_SENTENCE",
        message: isDE
          ? `Kapitel ${ch.chapter}: mindestens ein sehr langer Satz erkannt`
          : `Chapter ${ch.chapter}: at least one very long sentence detected`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

function gateCharacterVoiceDistinctness(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;

  for (const directive of directives) {
    const chapter = draft.chapters.find(ch => ch.chapter === directive.chapter);
    if (!chapter) continue;

    const characterNames = directive.charactersOnStage
      .filter(slot => !slot.includes("ARTIFACT"))
      .map(slot => findCharacterName(cast, slot))
      .filter((name): name is string => Boolean(name));

    if (characterNames.length < 2) continue;

    const speakingCharacters = characterNames.filter(name =>
      hasAttributedDialogueForCharacter(chapter.text, name, language)
    );

    if (speakingCharacters.length < 2) {
      issues.push({
        gate: "CHARACTER_VOICE",
        chapter: chapter.chapter,
        code: "VOICE_INDISTINCT",
        message: isDE
          ? `Kapitel ${chapter.chapter}: zu wenig klar unterscheidbare Sprecher (${speakingCharacters.length}/${characterNames.length})`
          : `Chapter ${chapter.chapter}: not enough clearly distinct speakers (${speakingCharacters.length}/${characterNames.length})`,
        severity: ageMax <= 8 || characterNames.length >= 3 ? "ERROR" : "WARNING",
      });
    }

    const roleLabelCount = countRoleLabelNamePairs(chapter.text);
    if (roleLabelCount > 4) {
      issues.push({
        gate: "CHARACTER_VOICE",
        chapter: chapter.chapter,
        code: "ROLE_LABEL_OVERUSE",
        message: isDE
          ? `Kapitel ${chapter.chapter}: Rollenbezeichnungen mit Namen zu oft wiederholt (${roleLabelCount}x)`
          : `Chapter ${chapter.chapter}: role labels repeated with names too often (${roleLabelCount}x)`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

function gateImageryBalance(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;

  const metaphorPatterns = isDE
    ? [/wie\s+(?:ein|eine|der|die|das)\s+\w+/gi, /als\s+(?:ob|wäre|würde)/gi]
    : [/like\s+(?:a|an|the)\s+\w+/gi, /as\s+(?:if|though)/gi];

  for (const ch of draft.chapters) {
    let metaphorCount = 0;
    for (const pattern of metaphorPatterns) {
      const matches = ch.text.match(pattern);
      metaphorCount += matches?.length ?? 0;
    }

    if (metaphorCount > 4) {
      issues.push({
        gate: "IMAGERY_BALANCE",
        chapter: ch.chapter,
        code: "METAPHOR_OVERLOAD",
        message: isDE
          ? `Kapitel ${ch.chapter}: ${metaphorCount} Metaphern/Vergleiche (max 4 pro Kapitel)`
          : `Chapter ${ch.chapter}: ${metaphorCount} metaphors/similes (max 4 per chapter)`,
        severity: ageMax <= 8 ? "ERROR" : "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 8: Tension Arc ────────────────────────────────────────────────────────
function gateTensionArc(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (draft.chapters.length < 4) return issues;
  const isDE = language === "de";

  const chapterLengths = draft.chapters.map(ch => countWords(ch.text));
  const avgLength = chapterLengths.reduce((a, b) => a + b, 0) / chapterLengths.length;

  const secondToLast = draft.chapters[draft.chapters.length - 2];
  if (secondToLast) {
    const stl = countWords(secondToLast.text);
    if (stl < avgLength * 0.7) {
      issues.push({
        gate: "TENSION_ARC",
        chapter: secondToLast.chapter,
        code: "WEAK_CLIMAX",
        message: isDE
          ? `Vorletzes Kapitel (Hoehepunkt) ist zu kurz (${stl} Woerter vs. Durchschnitt ${Math.round(avgLength)})`
          : `Penultimate chapter (climax) is too short (${stl} words vs avg ${Math.round(avgLength)})`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 9: Artifact Arc ───────────────────────────────────────────────────────
function gateArtifactArc(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const artifactName = cast.artifact?.name?.toLowerCase();
  if (!artifactName) return issues;

  const hasArtifactDirective = directives.some(d =>
    d.charactersOnStage.includes("SLOT_ARTIFACT_1") || d.artifactUsage?.toLowerCase().includes("artefakt")
  );
  if (!hasArtifactDirective) return issues;

  let artifactMentionCount = 0;
  let firstMention = -1;
  let lastMention = -1;

  for (const ch of draft.chapters) {
    const textLower = ch.text.toLowerCase();
    const count = countOccurrences(textLower, artifactName);
    if (count > 0) {
      artifactMentionCount += count;
      if (firstMention === -1) firstMention = ch.chapter;
      lastMention = ch.chapter;
    }
  }

  if (artifactMentionCount < 2) {
    issues.push({
      gate: "ARTIFACT_ARC",
      chapter: 0,
      code: "ARTIFACT_UNDERUSED",
      message: isDE
        ? `Artefakt "${cast.artifact.name}" nur ${artifactMentionCount}x erwaehnt (mind. 2 aktive Szenen)`
        : `Artifact "${cast.artifact.name}" only mentioned ${artifactMentionCount}x (need 2+ active scenes)`,
      severity: "WARNING",
    });
  }

  const totalChapters = draft.chapters.length;
  if (firstMention > 2 && totalChapters >= 4) {
    issues.push({
      gate: "ARTIFACT_ARC",
      chapter: firstMention,
      code: "ARTIFACT_LATE_INTRO",
      message: isDE
        ? `Artefakt erst in Kapitel ${firstMention} eingefuehrt (soll in Kapitel 1-2)`
        : `Artifact introduced in chapter ${firstMention} (should be ch 1-2)`,
      severity: "WARNING",
    });
  }

  return issues;
}

// ─── Gate 10: Ending Payoff ─────────────────────────────────────────────────────
function gateEndingPayoff(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  const lastChapter = draft.chapters[draft.chapters.length - 1];
  if (!lastChapter) return issues;

  const lastText = lastChapter.text;
  const wordCount = countWords(lastText);

  if (wordCount < 80) {
    issues.push({
      gate: "ENDING_PAYOFF",
      chapter: lastChapter.chapter,
      code: "ENDING_TOO_SHORT",
      message: isDE
        ? `Letztes Kapitel zu kurz (${wordCount} Woerter) fuer ein befriedigendes Ende`
        : `Last chapter too short (${wordCount} words) for a satisfying ending`,
      severity: "WARNING",
    });
  }

  const lastSentences = splitSentences(lastText);
  const lastSentence = lastSentences[lastSentences.length - 1] ?? "";

  const cliffhangerPatterns = isDE
    ? [/\?\s*$/, /\.\.\.\s*$/, /doch dann\s*$/, /was wuerde\s/, /was würde\s/]
    : [/\?\s*$/, /\.\.\.\s*$/, /but then\s*$/, /what would\s/];

  for (const pattern of cliffhangerPatterns) {
    if (pattern.test(lastSentence.trim())) {
      issues.push({
        gate: "ENDING_PAYOFF",
        chapter: lastChapter.chapter,
        code: "CLIFFHANGER_ENDING",
        message: isDE
          ? `Letztes Kapitel endet mit Cliffhanger statt warmem Abschluss`
          : `Last chapter ends with cliffhanger instead of warm resolution`,
        severity: ageMax <= 8 ? "ERROR" : "WARNING",
      });
      break;
    }
  }

  const endingUnresolvedPatterns = isDE
    ? [
        /\bungewiss\b/i,
        /\bunbekannt\b/i,
        /\boffen\b/i,
        /\bam naechsten morgen\b/i,
        /\bam nächsten morgen\b/i,
        /\bneue[nr]?\s+r[aä]tsel\b/i,
        /\bbald\b/i,
      ]
    : [
        /\buncertain\b/i,
        /\bunknown\b/i,
        /\bopen\b/i,
        /\bnext morning\b/i,
        /\bnew puzzle\b/i,
        /\bsoon\b/i,
      ];

  const closingWindow = lastSentences.slice(Math.max(0, lastSentences.length - 3)).join(" ");
  if (endingUnresolvedPatterns.some(pattern => pattern.test(closingWindow))) {
    issues.push({
      gate: "ENDING_PAYOFF",
      chapter: lastChapter.chapter,
      code: "ENDING_UNRESOLVED",
      message: isDE
        ? "Letzter Abschnitt oeffnet neue Unsicherheit statt klaren warmen Abschluss."
        : "Final section opens new uncertainty instead of a clear warm closure.",
      severity: ageMax <= 8 ? "ERROR" : "WARNING",
    });
  }

  const warmClosurePatterns = isDE
    ? [/\bzu hause\b/i, /\bsicher\b/i, /\bgeschafft\b/i, /\bgeborgen\b/i, /\bfriedlich\b/i, /\bzusammen\b/i]
    : [/\bhome\b/i, /\bsafe\b/i, /\bwe did it\b/i, /\btogether\b/i, /\bpeaceful\b/i];

  if (!warmClosurePatterns.some(pattern => pattern.test(lastText))) {
    issues.push({
      gate: "ENDING_PAYOFF",
      chapter: lastChapter.chapter,
      code: "ENDING_WARMTH_MISSING",
      message: isDE
        ? "Im Schluss fehlt ein klarer warmer Anker (z. B. sicher/zu Hause/zusammen)."
        : "Ending lacks a clear warm anchor (e.g., safe/home/together).",
      severity: ageMax <= 8 ? "ERROR" : "WARNING",
    });
  }

  return issues;
}

// ─── Gate: Instruction Leak ─────────────────────────────────────────────────────
function gateInstructionLeak(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const forbiddenSnippets = [
    "tie the scene", "without breaking canon", "canon anchor line",
    "kanonischer hinweis", "canon hint", "walking the same path in chapter",
    "have always been part of this tale", "scene directive", "return json",
    "final chapter:", "strict rules", "stricte regeln", "szenen-vorgabe",
    "erlaubte namen", "gib json", "kapiteltext",
    "sichtbare aktion:", "sichtbare handlung:", "aktion fortgesetzt:",
    "visible action:", "action continued:",
  ];

  for (const ch of draft.chapters) {
    const textLower = ch.text.toLowerCase();
    for (const snippet of forbiddenSnippets) {
      if (textLower.includes(snippet)) {
        issues.push({
          gate: "INSTRUCTION_LEAK",
          chapter: ch.chapter,
          code: "INSTRUCTION_LEAK",
          message: isDE
            ? `Anweisungstext im Kapitel ${ch.chapter} gefunden`
            : `Instruction text leaked into chapter ${ch.chapter}`,
          severity: "ERROR",
        });
        break;
      }
    }

    // Check for meta-narration sentence starters (structural beat labels as prose)
    const metaNarrationPatterns = isDE
      ? [/\b(?:Ihr|Das|Ein)\s+(?:Ziel|Hindernis)\s+war\b/i, /\bMini-Problem:/i]
      : [/\b(?:Her|The|An)\s+(?:goal|obstacle)\s+was\b/i, /\bMini-problem:/i];
    for (const pattern of metaNarrationPatterns) {
      if (pattern.test(ch.text)) {
        issues.push({
          gate: "INSTRUCTION_LEAK",
          chapter: ch.chapter,
          code: "META_NARRATION",
          message: isDE
            ? `Meta-Erzählung in Kapitel ${ch.chapter}: Strukturelle Labels als Prosa`
            : `Meta-narration in chapter ${ch.chapter}: structural labels as prose`,
          severity: "ERROR",
        });
        break;
      }
    }

    if (isDE && /\bchapter\s+\d/i.test(ch.text)) {
      issues.push({
        gate: "INSTRUCTION_LEAK",
        chapter: ch.chapter,
        code: "ENGLISH_LEAK",
        message: `Englisches Fragment in deutschem Kapitel ${ch.chapter}`,
        severity: "ERROR",
      });
    }

    const filteredPlaceholderPatterns = isDE
      ? [/\[[^\]]*gefiltert[^\]]*\]/i, /\binhalt[-\s]?gefiltert\b/i, /\[redacted\]/i]
      : [/\[[^\]]*filtered[^\]]*\]/i, /\bcontent[-\s]?filtered\b/i, /\[redacted\]/i];
    if (filteredPlaceholderPatterns.some(pattern => pattern.test(ch.text))) {
      issues.push({
        gate: "INSTRUCTION_LEAK",
        chapter: ch.chapter,
        code: "FILTER_PLACEHOLDER",
        message: isDE
          ? `Kapitel ${ch.chapter}: Filter-/Redaktionsplatzhalter im Fliesstext gefunden`
          : `Chapter ${ch.chapter}: filter/redaction placeholder found in narrative text`,
        severity: "ERROR",
      });
    }
  }

  return issues;
}

// ─── Gate 12: Canon Fusion Check ────────────────────────────────────────────────
function gateCanonFusion(draft: StoryDraft, cast: CastSet, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const chapter of draft.chapters) {
    const textLower = chapter.text.toLowerCase();
    for (const phrase of ALL_BANNED_PHRASES) {
      if (textLower.includes(phrase.toLowerCase())) {
        issues.push({
          gate: "CANON_FUSION",
          chapter: chapter.chapter,
          code: "META_PHRASE_DETECTED",
          message: isDE
            ? `Verbotene Meta-Phrase: "${phrase}"`
            : `Forbidden meta-phrase: "${phrase}"`,
          severity: "ERROR",
        });
      }
    }
  }

  // Extra regex patterns for belonging language
  const extraPatterns = isDE
    ? [
        /als\s+(?:ob|wäre|hätte)\s+(?:er|sie|es)\s+schon\s+immer/gi,
        /geh[öo]r(?:te|en)\s+(?:schon|seit)\s+(?:immer|jeher|langem)/gi,
      ]
    : [
        /as\s+(?:if|though)\s+(?:they|he|she)\s+had\s+always/gi,
        /belonged?\s+here\s+(?:since|from\s+the\s+start)/gi,
      ];

  for (const chapter of draft.chapters) {
    for (const pattern of extraPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(chapter.text)) {
        issues.push({
          gate: "CANON_FUSION",
          chapter: chapter.chapter,
          code: "META_BELONGING_PATTERN",
          message: isDE
            ? `Meta-Zugehoerigkeitsmuster in Kapitel ${chapter.chapter} erkannt`
            : `Meta-belonging pattern in chapter ${chapter.chapter}`,
          severity: "WARNING",
        });
        break;
      }
    }
  }

  return issues;
}

// ─── Gate 13: Active Character Presence ─────────────────────────────────────────
function gateActivePresence(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const actionVerbsDE = [
    "sagte", "rief", "fragte", "flüsterte", "lachte", "nickte",
    "griff", "nahm", "hob", "legte", "stellte", "drehte", "sprang",
    "rannte", "ging", "lief", "schaute", "blickte", "lächelte",
    "stand", "setzte", "zog", "drückte", "öffnete", "schloss",
    "warf", "fing", "hielt", "gab", "zeigte", "kletterte",
    "seufzte", "brummte", "kicherte", "jubelte", "staunte",
    "beschloss", "entschied", "entdeckte", "bemerkte", "sang",
    "tanzte", "hüpfte", "stolperte", "schrie",
  ];

  const actionVerbsEN = [
    "said", "called", "asked", "whispered", "laughed", "nodded",
    "grabbed", "took", "lifted", "placed", "turned", "jumped",
    "ran", "walked", "looked", "smiled", "stood", "sat", "pulled",
    "pushed", "opened", "closed", "threw", "caught", "held",
    "gave", "showed", "climbed", "sighed", "grumbled", "giggled",
    "cheered", "decided", "discovered", "noticed", "sang", "danced",
    "hopped", "stumbled", "shouted",
  ];

  const actionVerbs = isDE ? actionVerbsDE : actionVerbsEN;

  for (const directive of directives) {
    const ch = draft.chapters.find(c => c.chapter === directive.chapter);
    if (!ch) continue;

    const characterSlots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));

    for (const slot of characterSlots) {
      const name = findCharacterName(cast, slot);
      if (!name) continue;

      const textLower = ch.text.toLowerCase();
      if (!textLower.includes(name.toLowerCase())) continue;

      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const hasAction = actionVerbs.some(verb => {
        const pattern = new RegExp(`${escapedName}[^.!?]{0,40}${verb}`, "i");
        return pattern.test(ch.text);
      });

      const dialoguePattern = new RegExp(
        `[""„‟»«][^""„‟»«]{3,}[""„‟»«][^.!?]{0,30}${escapedName}|${escapedName}[^.!?]{0,30}[""„‟»«]`,
        "i"
      );
      const hasDialogue = dialoguePattern.test(ch.text);

      if (!hasAction && !hasDialogue) {
        issues.push({
          gate: "ACTIVE_PRESENCE",
          chapter: ch.chapter,
          code: "PASSIVE_CHARACTER",
          message: isDE
            ? `${name} in Kapitel ${ch.chapter}: keine aktive Handlung und kein Dialog`
            : `${name} in chapter ${ch.chapter}: no active action and no dialogue`,
          severity: "WARNING",
        });
      }
    }
  }

  return issues;
}

// ─── Additional 10.0 Gates ──────────────────────────────────────────────────────
function gateCharacterFocusLoad(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const maxActive = (ageRange?.max ?? 12) <= 8 ? 3 : 4;
  const idealActive = (ageRange?.max ?? 12) <= 8 ? 2 : 3;

  for (const directive of directives) {
    const chapter = draft.chapters.find(ch => ch.chapter === directive.chapter);
    if (!chapter) continue;

    const chapterText = chapter.text;
    const characterNames = directive.charactersOnStage
      .filter(slot => !slot.includes("ARTIFACT"))
      .map(slot => findCharacterName(cast, slot))
      .filter((name): name is string => Boolean(name));

    if (characterNames.length === 0) continue;

    const activeNames = characterNames.filter(name => {
      if (!chapterText.toLowerCase().includes(name.toLowerCase())) return false;
      return checkCharacterHasAction(chapterText, name) || hasAttributedDialogueForCharacter(chapterText, name, language);
    });

    if (activeNames.length > maxActive) {
      issues.push({
        gate: "CHARACTER_FOCUS",
        chapter: chapter.chapter,
        code: "TOO_MANY_ACTIVE_CHARACTERS",
        message: isDE
          ? `Kapitel ${chapter.chapter}: ${activeNames.length} aktive Figuren (max ${maxActive}). Fokus enger setzen: ${activeNames.join(", ")}`
          : `Chapter ${chapter.chapter}: ${activeNames.length} active characters (max ${maxActive}). Tighten focus: ${activeNames.join(", ")}`,
        severity: "ERROR",
      });
    } else if (activeNames.length === maxActive) {
      issues.push({
        gate: "CHARACTER_FOCUS",
        chapter: chapter.chapter,
        code: "FOCUS_DENSITY_HIGH",
        message: isDE
          ? `Kapitel ${chapter.chapter}: ${maxActive} aktive Figuren. Ideal sind meist ${idealActive}-${maxActive}.`
          : `Chapter ${chapter.chapter}: ${maxActive} active characters. Ideal is usually ${idealActive}-${maxActive}.`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

function gateGlobalCharacterLoad(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  if (ageMax > 8) return issues;

  const maxDistinctActive = 4;
  const activeByName = new Map<string, Set<number>>();

  for (const directive of directives) {
    const chapter = draft.chapters.find(ch => ch.chapter === directive.chapter);
    if (!chapter) continue;

    const chapterNames = directive.charactersOnStage
      .filter(slot => !slot.includes("ARTIFACT"))
      .map(slot => findCharacterName(cast, slot))
      .filter((name): name is string => Boolean(name));

    for (const name of chapterNames) {
      if (!chapter.text.toLowerCase().includes(name.toLowerCase())) continue;
      const isActive =
        checkCharacterHasAction(chapter.text, name) ||
        hasAttributedDialogueForCharacter(chapter.text, name, language);
      if (!isActive) continue;

      if (!activeByName.has(name)) activeByName.set(name, new Set<number>());
      activeByName.get(name)!.add(chapter.chapter);
    }
  }

  const distinctActive = Array.from(activeByName.keys());
  if (distinctActive.length > maxDistinctActive) {
    issues.push({
      gate: "GLOBAL_CHARACTER_LOAD",
      chapter: 0,
      code: "GLOBAL_CAST_OVERLOAD",
      message: isDE
        ? `Zu viele aktiv erkennbare Figuren fuer 6-8 Jahre (${distinctActive.length}, max ${maxDistinctActive}): ${distinctActive.join(", ")}`
        : `Too many actively distinct characters for age 6-8 (${distinctActive.length}, max ${maxDistinctActive}): ${distinctActive.join(", ")}`,
      severity: "ERROR",
    });
  }

  return issues;
}

function gateStakesAndLowpoint(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  if (draft.chapters.length === 0) return issues;

  const firstTwoText = draft.chapters
    .filter(ch => ch.chapter <= 2)
    .map(ch => ch.text)
    .join(" ");

  const stakesPatterns = isDE
    ? [
        /wenn\s+wir[^.!?]{0,90}dann/i,
        /wenn\s+[^.!?]{0,80}nicht\s+schaff/i,
        /sonst[^.!?]{0,80}(verlieren|bleiben|schaffen|geht|schlie(?:s|ß)t)/i,
      ]
    : [
        /if\s+we[^.!?]{0,90}then/i,
        /if\s+we[^.!?]{0,80}don't\s+(make|reach|find|solve)/i,
        /otherwise[^.!?]{0,80}(lose|miss|fail|stuck)/i,
      ];

  const hasExplicitStakes = stakesPatterns.some(pattern => pattern.test(firstTwoText));
  if (!hasExplicitStakes) {
    issues.push({
      gate: "STAKES_LOWPOINT",
      chapter: 1,
      code: "MISSING_EXPLICIT_STAKES",
      message: isDE
        ? "Fruehe Stakes fehlen: klare Konsequenz in Kapitel 1-2 ergaenzen (\"Wenn wir es nicht schaffen, dann ...\")."
        : "Early stakes missing: add a clear consequence in chapters 1-2 (\"If we fail, then ...\").",
      severity: "ERROR",
    });
  }

  const lowpointCandidates = draft.chapters.filter(ch => ch.chapter === 3 || ch.chapter === 4);
  const setbackPatterns = isDE
    ? [
        /scheiter|fehl(?!erlos)|falsch|verlor|blockier|geschlossen|schlie(?:s|ß)t|bricht|sackgasse|nicht\s+weiter|zu\s+sp(?:ae|ä)t/i,
      ]
    : [
        /fail|wrong|lost|blocked|closed|collapse|dead\s*end|can't\s+go\s+on|too\s+late/i,
      ];
  const emotionPatterns = isDE
    ? [/zitter|schluck|magen|bauch|traute?\s+sich\s+nicht|zweifel|angst|herz/i]
    : [/trembl|swallow|stomach|doubt|fear|heart/i];

  let lowpointChapter: StoryDraft["chapters"][number] | null = null;
  let lowpointHasEmotion = false;
  for (const chapter of lowpointCandidates) {
    const hasSetback = setbackPatterns.some(pattern => pattern.test(chapter.text));
    if (!hasSetback) continue;
    lowpointChapter = chapter;
    lowpointHasEmotion = emotionPatterns.some(pattern => pattern.test(chapter.text));
    break;
  }

  if (!lowpointChapter) {
    issues.push({
      gate: "STAKES_LOWPOINT",
      chapter: 4,
      code: "MISSING_LOWPOINT",
      message: isDE
        ? "Kapitel 3/4 hat keinen klaren Tiefpunkt mit echtem Rueckschlag."
        : "Chapter 3/4 has no clear low point with a real setback.",
      severity: "ERROR",
    });
  } else if (!lowpointHasEmotion) {
    issues.push({
      gate: "STAKES_LOWPOINT",
      chapter: lowpointChapter.chapter,
      code: "LOWPOINT_EMOTION_THIN",
      message: isDE
        ? `Kapitel ${lowpointChapter.chapter}: Rueckschlag vorhanden, aber innere Gefuehlsreaktion zu schwach.`
        : `Chapter ${lowpointChapter.chapter}: setback present, but internal emotional reaction is too weak.`,
      severity: ageMax <= 8 ? "ERROR" : "WARNING",
    });
  }

  if (lowpointChapter) {
    const lowpointSoftenerPatterns = isDE
      ? [
          /\bkein(?:e|en)?\s+katastrophe\b/i,
          /\bnur\s+ein\s+kleiner\s+schreck\b/i,
          /\bnichts\s+schlimmes\b/i,
          /\bohne\s+echte\s+folgen\b/i,
          /\bnur\s+eine?\s+kleine?\s+verzoegerung\b/i,
          /\bnur\s+eine?\s+kleine?\s+verzögerung\b/i,
        ]
      : [
          /\bnot\s+a\s+disaster\b/i,
          /\bjust\s+a\s+small\s+scare\b/i,
          /\bnothing\s+serious\b/i,
          /\bwithout\s+real\s+consequences\b/i,
          /\bjust\s+a\s+small\s+delay\b/i,
        ];

    if (lowpointSoftenerPatterns.some(pattern => pattern.test(lowpointChapter.text))) {
      issues.push({
        gate: "STAKES_LOWPOINT",
        chapter: lowpointChapter.chapter,
        code: "LOWPOINT_TOO_SOFT",
        message: isDE
          ? `Kapitel ${lowpointChapter.chapter}: Tiefpunkt wird sofort verharmlost; fuege einen echten Preis/Verlust ein.`
          : `Chapter ${lowpointChapter.chapter}: low point is immediately softened; add a real cost/loss.`,
        severity: ageMax <= 8 ? "ERROR" : "WARNING",
      });
    }
  }

  return issues;
}

function gateRhythmVariation(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const chapter of draft.chapters) {
    const sentences = splitSentences(chapter.text);
    if (sentences.length < 6) continue;

    const lengths = sentences.map(sentence => countWords(sentence)).filter(n => n > 0);
    const shortCount = lengths.filter(n => n <= 7).length;
    const mediumCount = lengths.filter(n => n >= 8 && n <= 14).length;
    const longCount = lengths.filter(n => n >= 15).length;

    if (shortCount === 0 || mediumCount === 0) {
      issues.push({
        gate: "RHYTHM_VARIATION",
        chapter: chapter.chapter,
        code: "RHYTHM_FLAT",
        message: isDE
          ? `Kapitel ${chapter.chapter}: Satzrhythmus zu gleichfoermig (kurze und mittlere Saetze mischen).`
          : `Chapter ${chapter.chapter}: sentence rhythm too flat (mix short and medium sentences).`,
        severity: "WARNING",
      });
    }

    if ((ageRange?.max ?? 12) <= 8 && longCount > Math.ceil(lengths.length * 0.28)) {
      issues.push({
        gate: "RHYTHM_VARIATION",
        chapter: chapter.chapter,
        code: "RHYTHM_TOO_HEAVY",
        message: isDE
          ? `Kapitel ${chapter.chapter}: zu viele laengere Saetze fuer 6-8 Jahre.`
          : `Chapter ${chapter.chapter}: too many longer sentences for age 6-8.`,
        severity: "ERROR",
      });
    }

    const comparisonPatterns = isDE
      ? [/\bwie\s+(?:ein|eine|der|die|das)\b/gi, /\bals\s+ob\b/gi]
      : [/\blike\s+(?:a|an|the)\b/gi, /\bas\s+if\b/gi];
    let comparisonCount = 0;
    for (const pattern of comparisonPatterns) {
      pattern.lastIndex = 0;
      comparisonCount += chapter.text.match(pattern)?.length ?? 0;
    }

    if (comparisonCount > Math.ceil(sentences.length / 3)) {
      issues.push({
        gate: "RHYTHM_VARIATION",
        chapter: chapter.chapter,
        code: "IMAGERY_DENSITY_HIGH",
        message: isDE
          ? `Kapitel ${chapter.chapter}: Bildsprache zu dicht (${comparisonCount} Vergleiche bei ${sentences.length} Saetzen).`
          : `Chapter ${chapter.chapter}: imagery too dense (${comparisonCount} comparisons for ${sentences.length} sentences).`,
        severity: (ageRange?.max ?? 12) <= 8 ? "ERROR" : "WARNING",
      });
    }
  }

  return issues;
}

function gateChildEmotionArc(
  draft: StoryDraft,
  cast: CastSet,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  const avatarNames = cast.avatars.map(a => a.displayName).filter(Boolean);
  if (avatarNames.length === 0) return issues;

  const fullText = draft.chapters.map(ch => ch.text).join(" ");
  const innerMarkers = isDE
    ? "(?:denkt|fuehlt|spuert|fragt\\s+sich|zweifelt|zittert|schluckt|hat\\s+Angst|mutig)"
    : "(?:thinks|feels|wonders|doubts|trembles|swallows|is\\s+afraid|brave)";
  const mistakeMarkers = isDE
    ? "(?:Fehler|falsch|stolper|scheiter|zu\\s+schnell|zu\\s+frueh|verga[ßs])"
    : "(?:mistake|wrong|stumble|fail|too\\s+fast|too\\s+early|forgot)";
  const repairMarkers = isDE
    ? "(?:korrigier|macht\\s+es\\s+besser|versucht\\s+es\\s+anders|hilft|rettet|entscheidet|entschied)"
    : "(?:correct|does\\s+it\\s+better|tries\\s+another\\s+way|helps|saves|decides|decided)";

  let hasChildErrorCorrectionArc = false;

  for (const name of avatarNames) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hasInnerMoment =
      new RegExp(`${escapedName}[^.!?]{0,90}${innerMarkers}`, "i").test(fullText) ||
      new RegExp(`${innerMarkers}[^.!?]{0,90}${escapedName}`, "i").test(fullText);

    if (!hasInnerMoment) {
      issues.push({
        gate: "CHILD_EMOTION_ARC",
        chapter: 0,
      code: "MISSING_INNER_CHILD_MOMENT",
      message: isDE
        ? `Innere Perspektive fuer ${name} fehlt oder ist zu schwach.`
        : `Inner perspective for ${name} is missing or too weak.`,
      severity: ageMax <= 8 ? "ERROR" : "WARNING",
    });
    }

    const hasMistake = new RegExp(`${escapedName}[^.!?]{0,90}${mistakeMarkers}|${mistakeMarkers}[^.!?]{0,90}${escapedName}`, "i").test(fullText);
    const hasRepair = new RegExp(`${escapedName}[^.!?]{0,90}${repairMarkers}|${repairMarkers}[^.!?]{0,90}${escapedName}`, "i").test(fullText);
    if (hasMistake && hasRepair) {
      hasChildErrorCorrectionArc = true;
    }
  }

  if (!hasChildErrorCorrectionArc) {
    issues.push({
      gate: "CHILD_EMOTION_ARC",
      chapter: 0,
      code: "NO_CHILD_ERROR_CORRECTION_ARC",
      message: isDE
        ? "Fehler-und-Korrektur-Bogen eines Kindes fehlt (Fehlentscheidung -> aktive Korrektur)."
        : "Missing child error-correction arc (bad decision -> active correction).",
      severity: ageMax <= 8 ? "ERROR" : "WARNING",
    });
  }

  return issues;
}

// ─── Gate 14: Artifact Mini-Arc ─────────────────────────────────────────────────
function gateArtifactMiniArc(
  draft: StoryDraft,
  cast: CastSet,
  language: string,
  artifactArc?: ArtifactArcPlan,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const artifactName = cast.artifact?.name?.toLowerCase();

  if (!artifactName || !artifactArc) return issues;

  const chapterMentions: Map<number, number> = new Map();
  for (const ch of draft.chapters) {
    const count = countOccurrences(ch.text.toLowerCase(), artifactName);
    if (count > 0) chapterMentions.set(ch.chapter, count);
  }

  const totalMentions = Array.from(chapterMentions.values()).reduce((a, b) => a + b, 0);

  if (!chapterMentions.has(artifactArc.discoveryChapter)) {
    issues.push({
      gate: "ARTIFACT_MINI_ARC",
      chapter: artifactArc.discoveryChapter,
      code: "MISSING_DISCOVERY",
      message: isDE
        ? `Artefakt "${cast.artifact.name}" fehlt in Entdeckungs-Kapitel ${artifactArc.discoveryChapter}`
        : `Artifact "${cast.artifact.name}" missing from discovery chapter ${artifactArc.discoveryChapter}`,
      severity: "WARNING",
    });
  }

  if (!chapterMentions.has(artifactArc.successChapter)) {
    issues.push({
      gate: "ARTIFACT_MINI_ARC",
      chapter: artifactArc.successChapter,
      code: "MISSING_SUCCESS",
      message: isDE
        ? `Artefakt "${cast.artifact.name}" fehlt in Erfolgs-Kapitel ${artifactArc.successChapter}`
        : `Artifact "${cast.artifact.name}" missing from success chapter ${artifactArc.successChapter}`,
      severity: "WARNING",
    });
  }

  const activeAppearances = artifactArc.activeChapters.filter(ch => chapterMentions.has(ch));
  if (activeAppearances.length < 2) {
    issues.push({
      gate: "ARTIFACT_MINI_ARC",
      chapter: 0,
      code: "INSUFFICIENT_ACTIVE_CHAPTERS",
      message: isDE
        ? `Artefakt nur in ${activeAppearances.length} aktiven Kapiteln (mind. 2)`
        : `Artifact only in ${activeAppearances.length} active chapters (need 2+)`,
      severity: "WARNING",
    });
  }

  if (totalMentions < 3) {
    issues.push({
      gate: "ARTIFACT_MINI_ARC",
      chapter: 0,
      code: "ARTIFACT_UNDERMENTIONED",
      message: isDE
        ? `Artefakt nur ${totalMentions}x erwaehnt (mind. 3 fuer Mini-Arc)`
        : `Artifact only ${totalMentions}x mentioned (need 3+ for mini-arc)`,
      severity: "WARNING",
    });
  }

  return issues;
}

// ─── Main Runner ────────────────────────────────────────────────────────────────
export function runQualityGates(input: {
  draft: StoryDraft;
  directives: SceneDirective[];
  cast: CastSet;
  language: string;
  ageRange?: { min: number; max: number };
  wordBudget?: WordBudget;
  artifactArc?: ArtifactArcPlan;
}): QualityReport {
  const { draft, directives, cast, language, ageRange, wordBudget, artifactArc } = input;

  const gateRunners: Array<{ name: string; fn: () => QualityIssue[] }> = [
    { name: "LENGTH_PACING", fn: () => gateLengthAndPacing(draft, wordBudget) },
    { name: "CHAPTER_STRUCTURE", fn: () => gateChapterStructure(draft, language) },
    { name: "DIALOGUE_QUOTE", fn: () => gateDialogueQuote(draft, language) },
    { name: "CHARACTER_INTEGRATION", fn: () => gateCharacterIntegration(draft, directives, cast, language) },
    { name: "CHARACTER_FOCUS", fn: () => gateCharacterFocusLoad(draft, directives, cast, language, ageRange) },
    { name: "GLOBAL_CHARACTER_LOAD", fn: () => gateGlobalCharacterLoad(draft, directives, cast, language, ageRange) },
    { name: "CAST_LOCK", fn: () => gateCastLock(draft, cast, language) },
    { name: "REPETITION_LIMITER", fn: () => gateRepetitionLimiter(draft, language, ageRange) },
    { name: "TEMPLATE_PHRASES", fn: () => gateTemplatePhrases(draft, language) },
    { name: "READABILITY_COMPLEXITY", fn: () => gateReadabilityComplexity(draft, language, ageRange) },
    { name: "RHYTHM_VARIATION", fn: () => gateRhythmVariation(draft, language, ageRange) },
    { name: "CHARACTER_VOICE", fn: () => gateCharacterVoiceDistinctness(draft, directives, cast, language, ageRange) },
    { name: "STAKES_LOWPOINT", fn: () => gateStakesAndLowpoint(draft, language, ageRange) },
    { name: "CHILD_EMOTION_ARC", fn: () => gateChildEmotionArc(draft, cast, language, ageRange) },
    { name: "IMAGERY_BALANCE", fn: () => gateImageryBalance(draft, language, ageRange) },
    { name: "TENSION_ARC", fn: () => gateTensionArc(draft, language) },
    { name: "ARTIFACT_ARC", fn: () => gateArtifactArc(draft, directives, cast, language) },
    { name: "ENDING_PAYOFF", fn: () => gateEndingPayoff(draft, language, ageRange) },
    { name: "INSTRUCTION_LEAK", fn: () => gateInstructionLeak(draft, language) },
    // V2 Quality Gates
    { name: "CANON_FUSION", fn: () => gateCanonFusion(draft, cast, language) },
    { name: "ACTIVE_PRESENCE", fn: () => gateActivePresence(draft, directives, cast, language) },
    { name: "ARTIFACT_MINI_ARC", fn: () => gateArtifactMiniArc(draft, cast, language, artifactArc) },
  ];

  const allIssues: QualityIssue[] = [];
  const passedGates: string[] = [];
  const failedGates: string[] = [];

  for (const gate of gateRunners) {
    const gateIssues = gate.fn();
    allIssues.push(...gateIssues);
    const hasErrors = gateIssues.some(i => i.severity === "ERROR");
    if (hasErrors) {
      failedGates.push(gate.name);
    } else {
      passedGates.push(gate.name);
    }
  }

  const errorCount = allIssues.filter(i => i.severity === "ERROR").length;
  const warningCount = allIssues.filter(i => i.severity === "WARNING").length;
  const score = Math.max(0, 10 - errorCount - warningCount * 0.5);

  return { issues: allIssues, score, passedGates, failedGates };
}

export function buildRewriteInstructions(issues: QualityIssue[], language: string): string {
  if (issues.length === 0) return "";
  const isDE = language === "de";
  const issueCodes = new Set(issues.map(issue => issue.code));

  const grouped = new Map<number, QualityIssue[]>();
  for (const issue of issues) {
    const ch = issue.chapter;
    if (!grouped.has(ch)) grouped.set(ch, []);
    grouped.get(ch)!.push(issue);
  }

  const lines: string[] = [];
  if (isDE) {
    lines.push("QUALITAETS-PROBLEME DIE BEHOBEN WERDEN MUESSEN:");
  } else {
    lines.push("QUALITY ISSUES TO FIX:");
  }

  if (issueCodes.has("SENTENCE_COMPLEXITY_HIGH") || issueCodes.has("LONG_SENTENCE_OVERUSE") || issueCodes.has("VERY_LONG_SENTENCE")) {
    lines.push(isDE
      ? "- Lesbarkeit reparieren: lange Schachtelsaetze in kurze Saetze aufteilen, Ziel 6-14 Woerter pro Satz (bei 6-8 Jahren)."
      : "- Fix readability: split long nested sentences into short ones, target 6-14 words per sentence (for age 6-8).");
  }
  if (issueCodes.has("VOICE_INDISTINCT") || issueCodes.has("ROLE_LABEL_OVERUSE")) {
    lines.push(isDE
      ? "- Figurenstimmen schaerfen: mindestens zwei klar erkennbare Sprecher pro Mehrfiguren-Szene, Rollenbezeichnungen nicht dauernd wiederholen."
      : "- Sharpen character voices: at least two clearly distinct speakers per multi-character scene, avoid constant role-label repetition.");
  }
  if (issueCodes.has("TOO_MANY_ACTIVE_CHARACTERS") || issueCodes.has("FOCUS_DENSITY_HIGH")) {
    lines.push(isDE
      ? "- Figurenfokus enger setzen: fuer 6-8 Jahre maximal 3 aktive Figuren (sonst max 4); Nebenfiguren nur kurz im Hintergrund."
      : "- Tighten character focus: for age 6-8 use max 3 active characters (otherwise max 4); keep secondary figures in the background.");
  }
  if (issueCodes.has("GLOBAL_CAST_OVERLOAD")) {
    lines.push(isDE
      ? "- Gesamtcast verschlanken: fuer 6-8 Jahre maximal 4 aktiv erkennbare Figuren in der ganzen Geschichte. Kombiniere Rollen statt neue Figuren einzufuehren."
      : "- Slim down the overall cast: for age 6-8, use at most 4 actively distinct characters in the whole story. Merge roles instead of adding characters.");
  }
  if (issueCodes.has("UNLOCKED_CHARACTER_ACTOR")) {
    lines.push(isDE
      ? "- Cast-Lock strikt einhalten: entferne alle nicht erlaubten Eigennamen mit aktiver Rolle und ersetze sie durch erlaubte Figuren."
      : "- Enforce cast lock strictly: remove any unauthorized proper names with active roles and replace them with allowed characters.");
  }
  if (
    issueCodes.has("MISSING_EXPLICIT_STAKES") ||
    issueCodes.has("MISSING_LOWPOINT") ||
    issueCodes.has("LOWPOINT_EMOTION_THIN") ||
    issueCodes.has("LOWPOINT_TOO_SOFT")
  ) {
    lines.push(isDE
      ? "- Dramaturgie reparieren: frueh eine klare Konsequenz benennen (\"Wenn wir es nicht schaffen, dann ...\") und in Kapitel 3/4 einen echten Tiefpunkt mit Gefuehlsreaktion zeigen."
      : "- Repair dramatic arc: define a clear early consequence (\"If we fail, then ...\") and add a real low point with emotional reaction in chapter 3/4.");
  }
  if (issueCodes.has("RHYTHM_FLAT") || issueCodes.has("RHYTHM_TOO_HEAVY") || issueCodes.has("IMAGERY_DENSITY_HIGH") || issueCodes.has("METAPHOR_OVERLOAD")) {
    lines.push(isDE
      ? "- Sprachrhythmus variieren: kurze, mittlere und wenige laengere Saetze mischen; Bildsprache reduzieren (max. ein Vergleich pro Absatz)."
      : "- Vary language rhythm: mix short, medium, and only a few longer sentences; reduce imagery density (max one comparison per paragraph).");
  }
  if (issueCodes.has("BANNED_WORD_USED")) {
    lines.push(isDE
      ? "- Verbotene Fuellwoerter komplett entfernen (z. B. ploetzlich, irgendwie, ein bisschen, ziemlich, wirklich, sehr, Es war einmal)."
      : "- Remove banned filler words completely (e.g., suddenly, really).");
  }
  if (issueCodes.has("MISSING_INNER_CHILD_MOMENT") || issueCodes.has("NO_CHILD_ERROR_CORRECTION_ARC")) {
    lines.push(isDE
      ? "- Kinder-Emotionsbogen schaerfen: pro Hauptkind mindestens einen inneren Moment und mindestens einen Fehler->Korrektur-Bogen ausarbeiten."
      : "- Strengthen child emotional arc: each main child needs at least one inner moment and at least one mistake->correction beat.");
  }
  if (issueCodes.has("CLIFFHANGER_ENDING") || issueCodes.has("ENDING_UNRESOLVED") || issueCodes.has("ENDING_WARMTH_MISSING")) {
    lines.push(isDE
      ? "- Schluss stabilisieren: keine neue Unsicherheit im letzten Abschnitt; mit warmem Anker enden (z. B. sicher/zu Hause/zusammen)."
      : "- Stabilize ending: avoid introducing new uncertainty in the final section; end on a warm anchor (e.g., safe/home/together).");
  }
  if (issueCodes.has("FILTER_PLACEHOLDER")) {
    lines.push(isDE
      ? "- Platzhalter reparieren: entferne alle Filter-/Redaktionsmarker (z. B. [inhalt-gefiltert]) und ersetze sie durch natuerliche, kindgerechte Formulierungen."
      : "- Fix placeholders: remove all filter/redaction markers (e.g., [content-filtered]) and replace them with natural, child-friendly phrasing.");
  }

  for (const [chapter, chIssues] of grouped) {
    if (chapter === 0) {
      lines.push(isDE ? "\nGesamte Geschichte:" : "\nOverall story:");
    } else {
      lines.push(isDE ? `\nKapitel ${chapter}:` : `\nChapter ${chapter}:`);
    }
    for (const issue of chIssues) {
      lines.push(`  - [${issue.code}] ${issue.message}`);
    }
  }

  return lines.join("\n");
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function hasAttributedDialogueForCharacter(text: string, name: string, language: string): boolean {
  if (!text || !name) return false;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dialogueVerbsDE = "(?:sagte|fragte|fragen|rief|fluesterte|murmelte|antwortete|meinte|erklaerte|schrie|raunte|brummte|seufzte|lachte)";
  const dialogueVerbsEN = "(?:said|asked|called|whispered|muttered|answered|replied|shouted|laughed)";
  const dialogueVerbs = language === "de" ? dialogueVerbsDE : dialogueVerbsEN;

  const patterns = [
    new RegExp(`${escapedName}[^.!?\\n]{0,48}${dialogueVerbs}`, "i"),
    new RegExp(`${dialogueVerbs}[^.!?\\n]{0,24}${escapedName}`, "i"),
    new RegExp(`[""\\u201E\\u201C\\u201D\\u00BB\\u00AB][^""\\u201E\\u201C\\u201D\\u00BB\\u00AB]{3,140}[""\\u201E\\u201C\\u201D\\u00BB\\u00AB][^.!?\\n]{0,32}${escapedName}`, "i"),
    new RegExp(`${escapedName}[^.!?\\n]{0,32}[""\\u201E\\u201C\\u201D\\u00BB\\u00AB]`, "i"),
  ];

  return patterns.some(pattern => pattern.test(text));
}

function countRoleLabelNamePairs(text: string): number {
  if (!text) return 0;
  const pattern = /\b(?:Feuerwehrfrau|Feuerwehrmann|Polizist|Polizistin|Lehrer|Lehrerin|Ritter|Hexe|Zauberer|Koenig|Koenigin)\s+[A-Z][a-z]+\b/g;
  const matches = text.match(pattern);
  return matches?.length ?? 0;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getHardMinChapterWords(draft: StoryDraft, wordBudget?: WordBudget): number | null {
  if (!wordBudget) return null;
  const chapterCount = draft.chapters.length;
  const isMediumOrLong = wordBudget.minMinutes >= 8;
  if (chapterCount >= 4 && isMediumOrLong) return 220;
  if (chapterCount >= 3) return 160;
  return null;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
}

function countDialogueLines(text: string): number {
  const patterns = [
    /[""„‟»«\u201E\u201C\u201D\u00BB\u00AB][^""„‟»«\u201E\u201C\u201D\u00BB\u00AB]{3,}[""„‟»«\u201E\u201C\u201D\u00BB\u00AB]/g,
    /^\s*[—–-]\s+.+$/gm,
    /(?:sagte|rief|fragte|fl[üu]sterte|murmelte|antwortete|meinte|erkl[äa]rte|schrie|raunte|brummte|seufzte|lachte)\s/gi,
    /(?:said|asked|whispered|called|shouted|replied|exclaimed|muttered|answered)\s/gi,
  ];
  let count = 0;
  const seen = new Set<number>();
  for (const p of patterns) {
    p.lastIndex = 0;
    let match;
    while ((match = p.exec(text)) !== null) {
      const lineStart = text.lastIndexOf("\n", match.index) + 1;
      if (!seen.has(lineStart)) {
        seen.add(lineStart);
        count++;
      }
    }
  }
  return count;
}

function checkCharacterHasAction(text: string, name: string): boolean {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const actionPatterns = [
    new RegExp(`${escapedName}\\s+\\w+(?:te|t|en|ete|ierte|te sich)\\b`, "i"),
    new RegExp(`${escapedName}\\s+(?:rief|sagte|fragte|fluesterte|flüsterte|lachte|nickte|schüttelte|griff|nahm|hob|legte|stellte|drehte|sprang|rannte|ging|lief|schaute|blickte|laechelte|lächelte|stand|setzte|zog|drueckte|drückte|oeffnete|öffnete|schloss|warf|fing|hielt)\\b`, "i"),
    new RegExp(`[""\u201E\u201C\u201D\u00BB\u00AB][^""\u201E\u201C\u201D\u00BB\u00AB]+[""\u201E\u201C\u201D\u00BB\u00AB],?\\s*(?:sagte|rief|fragte|fluesterte|flüsterte|murmelte)\\s+${escapedName}`, "i"),
    new RegExp(`${escapedName}\\s+(?:said|asked|whispered|shouted|called|laughed|nodded|grabbed|took|lifted|placed|turned|jumped|ran|walked|looked|smiled|stood|sat|pulled|pushed|opened|closed|threw|caught|held)\\b`, "i"),
  ];

  return actionPatterns.some(p => p.test(text));
}

function isLikelyCharacterAction(text: string, name: string): boolean {
  if (!text || !name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const verbs = [
    "sagte", "rief", "fragte", "antwortete", "meinte", "fluest", "flÃ¼sterte", "murmelte", "schrie", "lachte", "nickte",
    "said", "asked", "replied", "answered", "called", "whispered", "muttered", "shouted", "laughed", "nodded",
  ].join("|");

  const actionPattern = new RegExp(`${escaped}[^.!?]{0,40}\\b(${verbs})\\b|\\b(${verbs})\\b[^.!?]{0,40}${escaped}`, "i");
  if (actionPattern.test(text)) return true;

  const quotePattern = new RegExp(`[""â€žâ€ŸÂ»Â«\u201E\u201C\u201D\u00BB\u00AB][^""â€žâ€ŸÂ»Â«\u201E\u201C\u201D\u00BB\u00AB]{0,120}${escaped}|${escaped}[^""â€žâ€ŸÂ»Â«\u201E\u201C\u201D\u00BB\u00AB]{0,120}[""â€žâ€ŸÂ»Â«\u201E\u201C\u201D\u00BB\u00AB]`, "i");
  return quotePattern.test(text);
}

function findCharacterName(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? null;
}

function countOccurrences(text: string, search: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/[^a-zäöüß\s]/g, "").replace(/\s+/g, " ").trim();
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function isCommonWord(word: string, language: string): boolean {
  const commonDE = new Set([
    "der", "die", "das", "ein", "eine", "aber", "und", "oder", "doch", "noch", "dann",
    "dort", "hier", "jetzt", "ganz", "schon", "auch", "nur", "mehr", "sehr", "viel",
    "alle", "andere", "andere", "weil", "wenn", "wie", "was", "wer", "vom", "zum",
    "mit", "bei", "nach", "vor", "aus", "auf", "für", "über", "durch", "ohne",
    "gegen", "unter", "neben", "zwischen", "hinter", "seit", "bis", "während",
    "morgen", "abend", "nacht", "tag", "wald", "berg", "see", "fluss", "haus",
    "stadt", "dorf", "weg", "tor", "tür", "fenster", "boden", "himmel", "sonne",
    "mond", "stern", "wind", "regen", "schnee", "feuer", "wasser", "erde", "luft",
    "baum", "blume", "gras", "stein", "fels", "gold", "silber", "licht", "schatten",
    "stimme", "hand", "herz", "auge", "kopf", "freude", "angst", "mut", "kraft",
    "mama", "papa", "kind", "freund", "freundin", "bruder", "schwester",
    "koenig", "koenigin", "prinz", "prinzessin", "ritter", "hexe", "drache",
    "könig", "königin",
    "platz", "markt", "garten", "turm", "schloss", "burg", "fenster",
    "treppe", "stufe", "saal", "thron", "kissen", "samtkissen", "tagebuch",
    "brief", "zettel", "note", "seil", "treppenhaus", "zimmer", "hof",
  ]);
  const commonEN = new Set([
    "the", "and", "but", "for", "not", "you", "all", "can", "had", "her",
    "was", "one", "our", "out", "day", "get", "has", "him", "his", "how",
    "its", "may", "new", "now", "old", "see", "way", "who", "did", "got",
    "let", "say", "she", "too", "use", "dad", "mom",
    "then", "than", "when", "what", "that", "this", "with", "from", "will",
    "just", "like", "over", "back", "also", "made", "after", "first",
    "forest", "mountain", "river", "lake", "house", "castle", "garden",
    "tower", "village", "town", "path", "door", "window", "sky", "sun",
    "moon", "star", "wind", "rain", "snow", "fire", "water", "earth",
    "tree", "flower", "stone", "light", "shadow", "voice", "heart", "hand",
    "king", "queen", "prince", "princess", "knight", "witch", "dragon",
  ]);

  const set = language === "de" ? commonDE : commonEN;
  return set.has(word);
}

function isGermanCommonNounContext(text: string, matchIndex: number): boolean {
  const windowStart = Math.max(0, matchIndex - 40);
  const prefix = text.slice(windowStart, matchIndex).toLowerCase();
  const tokens = prefix.split(/[^a-zÃ¤Ã¶Ã¼ÃŸ]+/).filter(Boolean);
  const prev = tokens[tokens.length - 1];
  if (!prev) return false;

  const articles = new Set([
    "der", "die", "das", "den", "dem", "des",
    "ein", "eine", "einen", "einem", "einer", "eines",
    "mein", "meine", "meinen", "meinem", "meiner", "meines",
    "sein", "seine", "seinen", "seinem", "seiner", "seines",
    "ihr", "ihre", "ihren", "ihrem", "ihrer", "ihres",
    "unser", "unsere", "unseren", "unserem", "unserer", "unseres",
    "euer", "eure", "euren", "eurem", "eurer", "eures",
    "dieser", "diese", "dieses", "diesen", "diesem",
    "jeder", "jede", "jedes", "jeden", "jedem",
    "mancher", "manche", "manches", "manchen", "manchem",
  ]);

  return articles.has(prev);
}

function isLikelyGermanNameCandidate(text: string, token: string, matchIndex: number): boolean {
  const normalized = token.trim();
  if (!normalized) return false;

  // Single-word names that repeat are likely real character references.
  if (countWordOccurrences(text, normalized) >= 2) return true;

  // Sentence-initial capitalized nouns are very common in German; ignore one-off hits.
  if (isLikelySentenceStart(text, matchIndex)) {
    const prefix = text.slice(Math.max(0, matchIndex - 28), matchIndex).toLowerCase();
    if (!/(herr|frau|prinz|prinzessin|k(?:oe|ö)nig|k(?:oe|ö)nigin|ritter|fee|hexe|zauberer)\s+$/.test(prefix)) {
      return false;
    }
  }

  return true;
}

function countWordOccurrences(text: string, word: string): number {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = text.match(new RegExp(`\\b${escaped}\\b`, "gi"));
  return matches ? matches.length : 0;
}

function isLikelySentenceStart(text: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  if (i < 0) return true;
  return /[.!?\n]/.test(text[i]);
}

/**
 * STORY POST-PROCESSOR v2.0
 *
 * Validates and cleans AI-generated story output to ensure professional quality.
 * Removes meta-patterns, validates structure, and provides quality scores.
 *
 * Based on:
 * - Professional Storytelling Rules v3.0
 * - GPT-5 Output Quality Guidelines
 * - 12 Priority Optimizations for 10.0 Quality
 */

import {
  FORBIDDEN_OUTPUT_PATTERNS,
  containsMetaPatterns,
  AGE_GROUP_RULES,
  TITLE_RULES,
  SHOW_DONT_TELL,
  ENHANCED_DIALOGUE_RULES,
  getChapterWordTarget,
  getDialogueMinimum,
  REPETITION_DETECTION,
  IMAGE_PROMPT_RULES,
  type AgeGroupRules,
} from './professional-storytelling-rules';

// ============================================================================
// TYPES
// ============================================================================

export interface StoryChapter {
  order: number;
  title: string;
  content: string;
  imageDescription: string;
}

export interface ProcessedStory {
  title: string;
  description: string;
  chapters: StoryChapter[];
  avatarDevelopments?: any[];
  newArtifact?: any;
}

export interface QualityScore {
  overall: number;          // 0-10
  titleScore: number;       // 0-10
  dialogueScore: number;    // 0-10
  showDontTellScore: number; // 0-10
  sentenceLengthScore: number; // 0-10
  sensoryScore: number;     // 0-10
  structureScore: number;   // 0-10
  metaPatternPenalty: number; // 0-10 (higher = more penalties)
  // NEW v2.0 scores
  chapterBalanceScore: number;  // 0-10
  repetitionScore: number;      // 0-10
  imagePromptScore: number;     // 0-10
  issues: string[];
  suggestions: string[];
}

export interface PostProcessingResult {
  story: ProcessedStory;
  qualityScore: QualityScore;
  wasModified: boolean;
  modifications: string[];
}

// ============================================================================
// POST-PROCESSOR CLASS
// ============================================================================

export class StoryPostProcessor {
  private ageGroup: string;
  private rules: AgeGroupRules;

  constructor(ageGroup: string = '6-8') {
    this.ageGroup = ageGroup;
    this.rules = AGE_GROUP_RULES[ageGroup] || AGE_GROUP_RULES['6-8'];
  }

  /**
   * Main processing function - validates and cleans story
   */
  process(story: ProcessedStory): PostProcessingResult {
    const modifications: string[] = [];
    let wasModified = false;

    // Step 1: Clean meta-patterns from all chapters
    const cleanedChapters = story.chapters.map((chapter, idx) => {
      const cleaned = this.cleanMetaPatterns(chapter.content);
      if (cleaned !== chapter.content) {
        wasModified = true;
        modifications.push(`Kapitel ${idx + 1}: Meta-Muster entfernt`);
      }
      return { ...chapter, content: cleaned };
    });

    // Step 1.5: Normalize chapter lengths (clamp to age-group targets)
    const lengthAdjusted = this.normalizeChapterLengths(cleanedChapters);
    if (lengthAdjusted.wasModified) {
      wasModified = true;
      modifications.push(...lengthAdjusted.modifications);
    }

    const adjustedChapters = lengthAdjusted.chapters;

    // Step 2: Clean title if needed
    let cleanedTitle = story.title;
    if (this.isBadTitle(story.title)) {
      cleanedTitle = this.improveTitle(story.title);
      if (cleanedTitle !== story.title) {
        wasModified = true;
        modifications.push(`Titel verbessert: "${story.title}" -> "${cleanedTitle}"`);
      }
    }

    // Step 3: Calculate quality score
    const processedStory: ProcessedStory = {
      ...story,
      title: cleanedTitle,
      chapters: adjustedChapters,
    };

    const qualityScore = this.calculateQualityScore(processedStory);

    return {
      story: processedStory,
      qualityScore,
      wasModified,
      modifications,
    };
  }

  /**
   * Remove forbidden meta-patterns from text
   */
  private cleanMetaPatterns(text: string): string {
    let cleaned = text;

    for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
      // Reset regex state before each use
      pattern.lastIndex = 0;
      cleaned = cleaned.replace(pattern, '');
    }

    // Remove empty lines that may result from cleaning
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Remove lines that are just lists of sensory words
    cleaned = cleaned.replace(/^[\w\s,]+:\s*[\w\s,]+,\s*[\w\s,]+,\s*[\w\s,]+\.?\s*$/gm, '');

    // Remove any sentence that references "Phrase" to avoid meta leakage
    const sentenceParts = cleaned
      .split(/[.!?]+/)
      .map(part => part.trim())
      .filter(Boolean);
    const filteredSentences = sentenceParts.filter(part => !/\bphrase\b/i.test(part));
    if (filteredSentences.length !== sentenceParts.length) {
      cleaned = filteredSentences.join('. ').trim();
    }

    return cleaned.trim();
  }

  private countWords(text: string): number {
    return String(text || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .length;
  }

  private trimToWordLimit(content: string, maxWords: number): string {
    const original = String(content || "").trim();
    if (!original) return original;

    const words = original.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return original;

    let sentences = original.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [original];
    while (sentences.length > 1 && this.countWords(sentences.join(" ")) > maxWords) {
      sentences = sentences.slice(0, -1);
    }

    let trimmed = sentences.join(" ").replace(/\s+/g, " ").trim();
    if (this.countWords(trimmed) > maxWords) {
      trimmed = words.slice(0, maxWords).join(" ").trim() + "...";
    }

    return trimmed;
  }

  private padToMinimum(content: string, minWords: number, chapterIndex: number): string {
    let padded = String(content || "").trim();
    if (!padded) return padded;

    const fillers = [
      "Ein leiser Wind strich vorbei.",
      "Die beiden blickten einander an.",
      "Ihre Schritte wurden ruhiger.",
      "Ein warmes Licht fiel auf den Weg.",
      "Dann machten sie sich wieder auf den Weg.",
      "Sie atmeten tief und gingen weiter.",
      "Ein kurzer Blick genuegte, und sie verstanden sich.",
    ];

    let fillerIndex = chapterIndex % fillers.length;
    let safety = 0;
    while (this.countWords(padded) < minWords && safety < fillers.length * 3) {
      if (!/[.!?]$/.test(padded)) {
        padded += ".";
      }
      padded = `${padded} ${fillers[fillerIndex % fillers.length]}`.trim();
      fillerIndex += 1;
      safety += 1;
    }

    return padded.replace(/\s+/g, " ").trim();
  }

  private normalizeChapterLengths(chapters: StoryChapter[]): {
    chapters: StoryChapter[];
    wasModified: boolean;
    modifications: string[];
  } {
    const wordTarget = getChapterWordTarget(this.ageGroup);
    const modifications: string[] = [];
    let wasModified = false;

    const adjusted = chapters.map((chapter, idx) => {
      let content = String(chapter.content || "").trim();
      if (!content) return chapter;

      let wordCount = this.countWords(content);
      if (wordCount > wordTarget.max) {
        content = this.trimToWordLimit(content, wordTarget.max);
        wordCount = this.countWords(content);
        wasModified = true;
        modifications.push(`Kapitel ${idx + 1}: gekuerzt auf ${wordTarget.max} Woerter`);
      }

      if (wordCount < wordTarget.min) {
        content = this.padToMinimum(content, wordTarget.min, idx);
        wordCount = this.countWords(content);
        wasModified = true;
        modifications.push(`Kapitel ${idx + 1}: aufgefuellt auf ${wordTarget.min} Woerter`);
      }

      if (wordCount > wordTarget.max) {
        content = this.trimToWordLimit(content, wordTarget.max);
      }

      return { ...chapter, content };
    });

    return { chapters: adjusted, wasModified, modifications };
  }

  /**
   * Check if title matches forbidden patterns
   */
  private isBadTitle(title: string): boolean {
    // Check word count
    const wordCount = title.split(/\s+/).length;
    if (wordCount > TITLE_RULES.maxWords + 2) {
      return true;
    }

    // Check forbidden patterns
    for (const pattern of TITLE_RULES.forbiddenPatterns) {
      if (pattern.test(title)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Attempt to improve a bad title
   */
  private improveTitle(title: string): string {
    // Extract the most interesting part
    const parts = title.split(/\s+und\s+(?:das?|die|der)\s+/i);

    if (parts.length > 1) {
      // Take the second part (usually the interesting object)
      const interestingPart = parts[1];

      // Capitalize first letter
      const improved = interestingPart.charAt(0).toUpperCase() + interestingPart.slice(1);

      // Limit to 4 words
      const words = improved.split(/\s+/).slice(0, 4);
      return words.join(' ');
    }

    // If no "und" pattern, just take last 3-4 words
    const words = title.split(/\s+/);
    if (words.length > 4) {
      return words.slice(-4).join(' ');
    }

    return title;
  }

  /**
   * Calculate comprehensive quality score (v2.0 with new metrics)
   */
  private calculateQualityScore(story: ProcessedStory): QualityScore {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // 1. Title Score
    const titleScore = this.scoreTitleQuality(story.title, issues, suggestions);

    // 2. Dialogue Score (now uses ENHANCED_DIALOGUE_RULES)
    const dialogueScore = this.scoreDialogueQuality(story.chapters, issues, suggestions);

    // 3. Show Don't Tell Score
    const showDontTellScore = this.scoreShowDontTell(story.chapters, issues, suggestions);

    // 4. Sentence Length Score
    const sentenceLengthScore = this.scoreSentenceLength(story.chapters, issues, suggestions);

    // 5. Sensory Details Score
    const sensoryScore = this.scoreSensoryDetails(story.chapters, issues, suggestions);

    // 6. Structure Score
    const structureScore = this.scoreStructure(story.chapters, issues, suggestions);

    // 7. Meta Pattern Penalty
    const metaPatternPenalty = this.calculateMetaPenalty(story.chapters, issues);

    // NEW v2.0: Chapter Balance Score
    const chapterBalanceScore = this.scoreChapterBalance(story.chapters, issues, suggestions);

    // NEW v2.0: Repetition Score (bad repetitions)
    const repetitionScore = this.scoreRepetition(story.chapters, issues, suggestions);

    // NEW v2.0: Image Prompt Score
    const imagePromptScore = this.scoreImagePrompts(story.chapters, issues, suggestions);

    // Calculate overall score (updated weights for v2.0)
    const overall = Math.max(0, Math.min(10,
      (titleScore * 0.08) +
      (dialogueScore * 0.18) +
      (showDontTellScore * 0.15) +
      (sentenceLengthScore * 0.12) +
      (sensoryScore * 0.12) +
      (structureScore * 0.15) +
      (chapterBalanceScore * 0.08) +
      (repetitionScore * 0.06) +
      (imagePromptScore * 0.06) -
      (metaPatternPenalty * 0.5)
    ));

    return {
      overall: Math.round(overall * 10) / 10,
      titleScore: Math.round(titleScore * 10) / 10,
      dialogueScore: Math.round(dialogueScore * 10) / 10,
      showDontTellScore: Math.round(showDontTellScore * 10) / 10,
      sentenceLengthScore: Math.round(sentenceLengthScore * 10) / 10,
      sensoryScore: Math.round(sensoryScore * 10) / 10,
      structureScore: Math.round(structureScore * 10) / 10,
      metaPatternPenalty: Math.round(metaPatternPenalty * 10) / 10,
      chapterBalanceScore: Math.round(chapterBalanceScore * 10) / 10,
      repetitionScore: Math.round(repetitionScore * 10) / 10,
      imagePromptScore: Math.round(imagePromptScore * 10) / 10,
      issues,
      suggestions,
    };
  }

  /**
   * Score title quality
   */
  private scoreTitleQuality(title: string, issues: string[], suggestions: string[]): number {
    let score = 10;

    const wordCount = title.split(/\s+/).length;

    // Penalty for too many words
    if (wordCount > TITLE_RULES.maxWords) {
      score -= (wordCount - TITLE_RULES.maxWords) * 1.5;
      issues.push(`Titel zu lang: ${wordCount} Wörter (max ${TITLE_RULES.maxWords})`);
      suggestions.push('Kürze den Titel auf max 4 Wörter');
    }

    // Penalty for forbidden patterns
    for (const pattern of TITLE_RULES.forbiddenPatterns) {
      if (pattern.test(title)) {
        score -= 3;
        issues.push(`Titel folgt generischem Muster`);
        suggestions.push('Wähle einen mysteriösen Objekt- oder Ort-Namen als Titel');
        break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Score dialogue quality (v2.0 with ENHANCED_DIALOGUE_RULES)
   */
  private scoreDialogueQuality(chapters: StoryChapter[], issues: string[], suggestions: string[]): number {
    let score = 10;
    const allText = chapters.map(c => c.content).join('\n');

    // Count dialogues per chapter
    for (let i = 0; i < chapters.length; i++) {
      const chapterDialogues = chapters[i].content.match(/["„"][^""„"]+["„""]/g) || [];
      const minRequired = getDialogueMinimum(this.ageGroup);

      if (chapterDialogues.length < minRequired) {
        score -= 0.8;
        issues.push(`Kapitel ${i + 1}: Nur ${chapterDialogues.length} Dialoge (min: ${minRequired})`);
      }
    }

    // Total dialogue count
    const dialogueMatches = allText.match(/["„"][^""„"]+["„""]/g) || [];
    const dialogueCount = dialogueMatches.length;
    const expectedDialogues = chapters.length * getDialogueMinimum(this.ageGroup);

    if (dialogueCount < expectedDialogues) {
      suggestions.push(`Erhöhe Dialoganzahl auf mindestens ${expectedDialogues} (${getDialogueMinimum(this.ageGroup)}/Kapitel)`);
    }

    // Check for dialogue lists pattern
    const hasDialogueLists = /Dialoge?:\s*\(\d+\)/i.test(allText);
    if (hasDialogueLists) {
      score -= 5;
      issues.push('Dialog-Listen-Format erkannt');
      suggestions.push('Dialoge müssen in die Geschichte eingewoben werden, nicht als Liste');
    }

    // Check dialogue tags variety
    const basicTagCount = (allText.match(/,?\s*(?:sagte|antwortete|meinte|erwiderte)\s/gi) || []).length;
    const totalTagCount = (allText.match(/,?\s*(?:sagte|antwortete|meinte|erwiderte|flüsterte|rief|murmelte|schrie|kicherte|brummte|seufzte|hauchte|stammelte|jubelte|zischte)\s/gi) || []).length;

    if (totalTagCount > 0 && basicTagCount / totalTagCount > 0.5) {
      score -= 2;
      issues.push('Dialog-Tags zu monoton (>50% basic tags)');
      suggestions.push('Variiere Dialog-Tags: flüsterte, rief, murmelte, kicherte...');
    }

    // Check for action beats with dialogues (80% should have action)
    const dialoguesWithAction = (allText.match(/[.!?]\s*["„"][^""„"]+["„""]|["„"][^""„"]+["„""]\s*[^"„""]+[.!?]/g) || []).length;
    const actionBeatRatio = dialogueCount > 0 ? dialoguesWithAction / dialogueCount : 0;

    if (actionBeatRatio < ENHANCED_DIALOGUE_RULES.actionBeatRatio) {
      score -= 1.5;
      issues.push(`Nur ${Math.round(actionBeatRatio * 100)}% Dialoge mit Action-Beats (Ziel: 80%)`);
      suggestions.push('Füge Aktionen vor/nach Dialogen hinzu: "Er rannte los. \"Schnell!\""');
    }

    return Math.max(0, score);
  }

  /**
   * Score show-don't-tell usage
   */
  private scoreShowDontTell(chapters: StoryChapter[], issues: string[], suggestions: string[]): number {
    let score = 10;
    const allText = chapters.map(c => c.content).join('\n');

    let tellingCount = 0;

    for (const pattern of SHOW_DONT_TELL.forbidden) {
      const matches = allText.match(pattern);
      if (matches) {
        tellingCount += matches.length;
      }
    }

    if (tellingCount > 0) {
      score -= Math.min(6, tellingCount * 1.5);
      issues.push(`"Telling" statt "Showing" erkannt: ${tellingCount}x`);
      suggestions.push('Ersetze "hatte Angst" durch "Hände zitterten", etc.');
    }

    // Bonus for body language usage
    const bodyLanguageTerms = Object.values(SHOW_DONT_TELL.bodyLanguage).flat();
    let bodyLanguageCount = 0;
    for (const term of bodyLanguageTerms) {
      if (allText.toLowerCase().includes(term)) {
        bodyLanguageCount++;
      }
    }

    if (bodyLanguageCount >= 5) {
      score = Math.min(10, score + 1);
    }

    return Math.max(0, score);
  }

  /**
   * Score sentence length appropriateness
   */
  private scoreSentenceLength(chapters: StoryChapter[], issues: string[], suggestions: string[]): number {
    let score = 10;
    const allText = chapters.map(c => c.content).join(' ');

    // Split into sentences
    const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceWordCounts = sentences.map(s => s.trim().split(/\s+/).length);

    const shortCount = sentenceWordCounts.filter(c => c <= 7).length;
    const mediumCount = sentenceWordCounts.filter(c => c > 7 && c <= 15).length;
    const longCount = sentenceWordCounts.filter(c => c > 15 && c <= this.rules.maxWordsPerSentence).length;
    const tooLongCount = sentenceWordCounts.filter(c => c > this.rules.maxWordsPerSentence).length;

    const total = sentences.length;

    // Check ratios
    const shortRatio = shortCount / total;
    const mediumRatio = mediumCount / total;

    if (shortRatio < this.rules.shortSentenceRatio * 0.7) {
      score -= 2;
      issues.push(`Zu wenige kurze Sätze für Altersgruppe ${this.ageGroup}`);
      suggestions.push('Mehr kurze, knackige Sätze (3-7 Wörter)');
    }

    if (tooLongCount > total * 0.1) {
      score -= 3;
      issues.push(`${tooLongCount} Sätze zu lang (>${this.rules.maxWordsPerSentence} Wörter)`);
      suggestions.push('Teile lange Sätze in kürzere auf');
    }

    return Math.max(0, score);
  }

  /**
   * Score sensory details usage
   */
  private scoreSensoryDetails(chapters: StoryChapter[], issues: string[], suggestions: string[]): number {
    let score = 10;

    const sensePatterns = {
      sight: /(?:sah|blick|leucht|funkel|glänz|schimmer|strahl|farb|licht|schatten|dunkel|hell)/gi,
      sound: /(?:hört|klang|raschel|knack|knister|flüster|schrei|rief|rausch|summ|brumm|still)/gi,
      touch: /(?:fühl|spür|weich|hart|rau|glatt|warm|kalt|feucht|trocken|wind)/gi,
      smell: /(?:riech|duft|gestank|moder|frisch|würz)/gi,
      taste: /(?:schmeck|süß|sauer|bitter|salz)/gi,
    };

    let totalSenseCount = 0;
    const sensesUsed = new Set<string>();

    for (const chapter of chapters) {
      let chapterSenseCount = 0;

      for (const [sense, pattern] of Object.entries(sensePatterns)) {
        const matches = chapter.content.match(pattern);
        if (matches) {
          chapterSenseCount += matches.length;
          sensesUsed.add(sense);
        }
      }

      if (chapterSenseCount < 3) {
        score -= 0.5;
      }

      totalSenseCount += chapterSenseCount;
    }

    if (sensesUsed.size < 3) {
      score -= 2;
      issues.push(`Nur ${sensesUsed.size} Sinne genutzt`);
      suggestions.push('Nutze mindestens 3 verschiedene Sinne (Sehen, Hören, Fühlen, Riechen, Schmecken)');
    }

    // Check for clichés
    const allText = chapters.map(c => c.content).join(' ').toLowerCase();
    const clichés = [
      'brot und zimt', 'süß wie honig', 'weich wie samt',
      'hart wie stein', 'kalt wie eis', 'heiß wie feuer'
    ];

    for (const cliche of clichés) {
      if (allText.includes(cliche)) {
        score -= 1;
        issues.push(`Klischee gefunden: "${cliche}"`);
      }
    }

    return Math.max(0, score);
  }

  /**
   * Score chapter structure quality
   */
  private scoreStructure(chapters: StoryChapter[], issues: string[], suggestions: string[]): number {
    let score = 10;

    // Check first sentences
    const descriptionStarters = /^(?:Der|Die|Das|Es war|Ein|Eine)/;
    for (let i = 0; i < chapters.length; i++) {
      const firstSentence = chapters[i].content.split(/[.!?]/)[0].trim();

      if (descriptionStarters.test(firstSentence) && !firstSentence.includes('rief') && !firstSentence.includes('rannte')) {
        score -= 0.5;
        if (i === 0) {
          issues.push('Kapitel 1 beginnt mit Beschreibung statt Aktion');
          suggestions.push('Starte mit Aktion: "Adrian rannte...", "Ein Knacken..."');
        }
      }
    }

    // Check for "plötzlich" or equivalents
    const suddenWords = ['plötzlich', 'auf einmal', 'im nächsten moment', 'da', 'dann'];
    let suddenCount = 0;
    const allText = chapters.map(c => c.content).join(' ').toLowerCase();

    for (const word of suddenWords) {
      const matches = allText.match(new RegExp(word, 'gi'));
      if (matches) {
        suddenCount += matches.length;
      }
    }

    if (suddenCount < chapters.length) {
      score -= 1;
      issues.push('Zu wenig Überraschungs-Momente');
      suggestions.push('Füge mehr "plötzlich" oder "auf einmal" Momente hinzu');
    }

    // Check last sentences of chapters 1-4 for tension
    for (let i = 0; i < Math.min(4, chapters.length); i++) {
      const sentences = chapters[i].content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const lastSentence = sentences[sentences.length - 1]?.toLowerCase() || '';

      const hasTension = /(?:näher|dunkel|gefahr|plötzlich|was|wer|wohin|\?|!|hinter|schatten|auge|beobacht)/.test(lastSentence);
      if (!hasTension) {
        score -= 0.3;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Calculate penalty for remaining meta-patterns
   */
  private calculateMetaPenalty(chapters: StoryChapter[], issues: string[]): number {
    let penalty = 0;

    for (const chapter of chapters) {
      const { hasMeta, patterns } = containsMetaPatterns(chapter.content);
      if (hasMeta) {
        penalty += patterns.length * 2;
        issues.push(`Meta-Muster in Kapitel ${chapter.order}: ${patterns.length} gefunden`);
      }
    }

    return Math.min(10, penalty);
  }

  // ============================================================================
  // NEW v2.0 SCORING METHODS
  // ============================================================================

  /**
   * Score chapter balance (word count consistency)
   */
  private scoreChapterBalance(chapters: StoryChapter[], issues: string[], suggestions: string[]): number {
    let score = 10;

    const wordCounts = chapters.map(c => c.content.split(/\s+/).length);
    const minWords = Math.min(...wordCounts);
    const maxWords = Math.max(...wordCounts);
    const variance = maxWords - minWords;

    // Check against age-aware word targets
    const wordTarget = getChapterWordTarget(this.ageGroup);
    const { min: minimum, max: maximum, variance: maxVariance } = wordTarget;

    // Penalty for chapters outside range
    for (let i = 0; i < chapters.length; i++) {
      if (wordCounts[i] < minimum) {
        score -= 1;
        issues.push(`Kapitel ${i + 1} zu kurz: ${wordCounts[i]} Wörter (min: ${minimum})`);
      }
      if (wordCounts[i] > maximum) {
        score -= 0.5;
        issues.push(`Kapitel ${i + 1} zu lang: ${wordCounts[i]} Wörter (max: ${maximum})`);
      }
    }

    // Penalty for high variance
    if (variance > maxVariance) {
      score -= Math.min(3, (variance - maxVariance) * 0.1);
      issues.push(`Kapitel-Längen unausgewogen: Varianz ${variance} Wörter`);
      suggestions.push(`Gleiche die Kapitellängen an (${wordTarget.min}-${wordTarget.max} Wörter)`);
    }

    return Math.max(0, score);
  }

  /**
   * Score for bad repetition patterns
   */
  private scoreRepetition(chapters: StoryChapter[], issues: string[], suggestions: string[]): number {
    let score = 10;
    const allText = chapters.map(c => c.content).join('\n');

    // Check for bad repetition patterns
    for (const pattern of REPETITION_DETECTION.badRepetitionPatterns) {
      pattern.lastIndex = 0;
      const matches = allText.match(pattern);
      if (matches && matches.length > 0) {
        score -= matches.length * 1.5;
        issues.push(`Stilistisch schwache Wiederholung gefunden: ${matches.length}x`);
      }
    }

    // Check for consecutive same-start sentences
    const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let consecutiveSameStart = 0;
    let lastStart = '';

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      const currentStart = trimmed.split(/\s+/)[0]?.toLowerCase() || '';

      if (currentStart === lastStart && currentStart.length > 0) {
        consecutiveSameStart++;
        if (consecutiveSameStart >= REPETITION_DETECTION.maxConsecutiveSameStart) {
          score -= 0.5;
        }
      } else {
        consecutiveSameStart = 0;
      }
      lastStart = currentStart;
    }

    if (score < 8) {
      suggestions.push('Variiere Satzanfänge - vermeide wiederholte "Er/Sie/Es" Starts');
    }

    return Math.max(0, score);
  }

  /**
   * Score image prompt quality
   */
  private scoreImagePrompts(chapters: StoryChapter[], issues: string[], suggestions: string[]): number {
    let score = 10;

    for (let i = 0; i < chapters.length; i++) {
      const prompt = chapters[i].imageDescription || '';

      // Check word count
      const wordCount = prompt.split(/\s+/).length;
      if (wordCount < IMAGE_PROMPT_RULES.wordCount.minimum) {
        score -= 0.5;
        issues.push(`Bild-Prompt Kapitel ${i + 1} zu kurz: ${wordCount} Wörter`);
      }
      if (wordCount > IMAGE_PROMPT_RULES.wordCount.maximum) {
        score -= 0.3;
      }

      // Check for shot type if required
      if (IMAGE_PROMPT_RULES.shotTypeVariety.required) {
        const shotTypes = IMAGE_PROMPT_RULES.shotTypeVariety.types;
        const hasShot = shotTypes.some(type => prompt.toUpperCase().includes(type));
        if (!hasShot) {
          score -= 0.5;
          issues.push(`Bild-Prompt Kapitel ${i + 1}: Kein SHOT TYPE definiert`);
        }
      }

      // Check for German words in English prompt
      const germanPatterns = Object.keys(IMAGE_PROMPT_RULES.languageRules.translatePatterns);
      for (const pattern of germanPatterns) {
        if (prompt.includes(pattern)) {
          score -= 0.3;
          issues.push(`Bild-Prompt Kapitel ${i + 1}: Deutsche Begriffe gefunden`);
          suggestions.push(`Ersetze "${pattern}" durch englische Übersetzung`);
          break;
        }
      }
    }

    // Check for shot type variety if required
    if (IMAGE_PROMPT_RULES.shotTypeVariety.required) {
      const usedShots = new Set<string>();
      for (const chapter of chapters) {
        const prompt = chapter.imageDescription?.toUpperCase() || '';
        for (const type of IMAGE_PROMPT_RULES.shotTypeVariety.types) {
          if (prompt.includes(type)) {
            usedShots.add(type);
            break;
          }
        }
      }

      if (usedShots.size < 3) {
        score -= 1;
        suggestions.push('Variiere SHOT TYPES: WIDE, CLOSE-UP, HERO, DRAMATIC ANGLE');
      }
    }

    return Math.max(0, score);
  }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Quick validation check - returns true if story passes minimum quality
 */
export function validateMinimumQuality(story: ProcessedStory, ageGroup: string = '6-8'): {
  isValid: boolean;
  score: number;
  criticalIssues: string[];
} {
  const processor = new StoryPostProcessor(ageGroup);
  const result = processor.process(story);

  const criticalIssues = result.qualityScore.issues.filter(issue =>
    issue.includes('Meta-Muster') ||
    issue.includes('Dialog-Listen') ||
    issue.includes('Titel zu lang')
  );

  return {
    isValid: result.qualityScore.overall >= 6.0 && criticalIssues.length === 0,
    score: result.qualityScore.overall,
    criticalIssues,
  };
}

/**
 * Get quality rating label
 */
export function getQualityLabel(score: number): string {
  if (score >= 9.5) return '⭐ MEISTERWERK';
  if (score >= 8.5) return '🌟 AUSGEZEICHNET';
  if (score >= 7.5) return '✅ SEHR GUT';
  if (score >= 6.5) return '👍 GUT';
  if (score >= 5.5) return '📝 AKZEPTABEL';
  if (score >= 4.5) return '⚠️ VERBESSERUNGSWÜRDIG';
  return '❌ UNZUREICHEND';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default StoryPostProcessor;

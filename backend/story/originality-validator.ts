// Originality Validator - Ensures generated stories meet originality standards
// Enforces <40% overlap threshold with source fairy tale

export interface OriginalityReport {
  overlapPercentage: number;
  isOriginal: boolean; // True if overlap <= threshold
  threshold: number;
  issues: string[];
  suggestions: string[];
  verdictReason: string;
}

export interface OriginalityConfig {
  maxOverlapPercentage: number; // Default: 40
  minPhraseLength: number; // Default: 3 (for direct copy detection)
  maxDirectCopies: number; // Default: 3
  strictMode: boolean; // If true, lower thresholds
}

export class OriginalityValidator {
  private static readonly DEFAULT_CONFIG: OriginalityConfig = {
    maxOverlapPercentage: 40,
    minPhraseLength: 3,
    maxDirectCopies: 3,
    strictMode: false,
  };

  /**
   * Validate story originality against source template
   * Returns detailed report with pass/fail verdict
   */
  static validate(
    generatedStory: string,
    sourceTemplate: string,
    config: Partial<OriginalityConfig> = {}
  ): OriginalityReport {
    const finalConfig: OriginalityConfig = { ...this.DEFAULT_CONFIG, ...config };

    console.log('[OriginalityValidator] Validating story originality...', {
      storyLength: generatedStory.length,
      templateLength: sourceTemplate.length,
      config: finalConfig,
    });

    // 1. Word overlap analysis
    const overlapData = this.calculateWordOverlap(generatedStory, sourceTemplate);

    // 2. Direct phrase copying detection
    const directCopies = this.findDirectCopies(
      generatedStory,
      sourceTemplate,
      finalConfig.minPhraseLength
    );

    // 3. Structural similarity check
    const structuralSimilarity = this.checkStructuralSimilarity(generatedStory, sourceTemplate);

    // Build report
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check overlap threshold
    if (overlapData.overlapPercentage > finalConfig.maxOverlapPercentage) {
      issues.push(
        `Word overlap ${overlapData.overlapPercentage}% exceeds threshold ${finalConfig.maxOverlapPercentage}%`
      );
      suggestions.push('Rewrite scenes using different vocabulary and sentence structures');
      suggestions.push('Add more original dialogue and descriptive details');
    }

    // Check direct copying
    if (directCopies.length > finalConfig.maxDirectCopies) {
      issues.push(
        `Found ${directCopies.length} direct phrase copies (max allowed: ${finalConfig.maxDirectCopies})`
      );
      suggestions.push('Remove verbatim phrases from the original tale');
      suggestions.push(`Direct copies detected: ${directCopies.slice(0, 3).join('; ')}...`);
    }

    // Check structural similarity (only flag if > 95%, i.e., nearly identical)
    if (structuralSimilarity > 0.95) {
      issues.push(`Story structure too similar to original (${Math.round(structuralSimilarity * 100)}%)`);
      suggestions.push('Rearrange scene order or merge/split events');
      suggestions.push('Apply remix strategies: reverse chronology, perspective shift, etc.');
    }

    // Strict mode additional checks
    if (finalConfig.strictMode) {
      if (overlapData.overlapPercentage > 30) {
        issues.push('[STRICT MODE] Word overlap >30% in strict mode');
      }
      if (overlapData.commonPhrases.length > 5) {
        issues.push('[STRICT MODE] Too many common phrases detected');
      }
    }

    // Determine verdict
    // CRITICAL: Structural similarity threshold is 95% (only fail if nearly identical structure)
    const isOriginal =
      overlapData.overlapPercentage <= finalConfig.maxOverlapPercentage &&
      directCopies.length <= finalConfig.maxDirectCopies &&
      structuralSimilarity <= 0.95;

    const verdictReason = isOriginal
      ? `✅ Story meets originality standards: ${overlapData.overlapPercentage}% overlap, ${directCopies.length} direct copies`
      : `❌ Story fails originality check: ${issues.join('; ')}`;

    console.log('[OriginalityValidator] Validation complete:', {
      isOriginal,
      overlap: overlapData.overlapPercentage,
      directCopies: directCopies.length,
      structuralSimilarity: Math.round(structuralSimilarity * 100),
    });

    return {
      overlapPercentage: overlapData.overlapPercentage,
      isOriginal,
      threshold: finalConfig.maxOverlapPercentage,
      issues,
      suggestions,
      verdictReason,
    };
  }

  /**
   * Calculate word-level overlap between generated story and template
   */
  private static calculateWordOverlap(
    generatedStory: string,
    sourceTemplate: string
  ): {
    overlapPercentage: number;
    uniqueWords: number;
    commonWords: number;
    commonPhrases: string[];
  } {
    const generatedWords = this.tokenize(generatedStory.toLowerCase());
    const templateWords = this.tokenize(sourceTemplate.toLowerCase());

    // Calculate unique word overlap
    const generatedSet = new Set(generatedWords);
    const templateSet = new Set(templateWords);

    let commonCount = 0;
    const commonWords: string[] = [];

    for (const word of generatedSet) {
      if (templateSet.has(word)) {
        commonCount++;
        if (commonWords.length < 20) {
          // Track first 20 common words
          commonWords.push(word);
        }
      }
    }

    const overlapPercentage = Math.round((commonCount / generatedSet.size) * 100);

    return {
      overlapPercentage,
      uniqueWords: generatedSet.size,
      commonWords: commonCount,
      commonPhrases: commonWords,
    };
  }

  /**
   * Find direct copies of N consecutive words
   */
  private static findDirectCopies(text1: string, text2: string, minLength: number): string[] {
    const words1 = this.tokenize(text1.toLowerCase());
    const words2 = this.tokenize(text2.toLowerCase());

    const copies: string[] = [];
    const seenPhrases = new Set<string>();

    for (let i = 0; i <= words1.length - minLength; i++) {
      const phrase = words1.slice(i, i + minLength).join(' ');

      // Skip if already found
      if (seenPhrases.has(phrase)) continue;

      // Check if this phrase exists in text2
      for (let j = 0; j <= words2.length - minLength; j++) {
        const phrase2 = words2.slice(j, j + minLength).join(' ');
        if (phrase === phrase2) {
          copies.push(phrase);
          seenPhrases.add(phrase);
          break;
        }
      }
    }

    return copies;
  }

  /**
   * Check structural similarity (scene count, chapter length distribution)
   */
  private static checkStructuralSimilarity(generatedStory: string, sourceTemplate: string): number {
    // Count sentences as rough proxy for structure
    const generatedSentences = generatedStory.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const templateSentences = sourceTemplate.split(/[.!?]+/).filter(s => s.trim().length > 10);

    // Calculate sentence count similarity
    const sentenceCountDiff = Math.abs(generatedSentences.length - templateSentences.length);
    const maxSentences = Math.max(generatedSentences.length, templateSentences.length);

    const sentenceSimilarity = 1 - sentenceCountDiff / maxSentences;

    // Check paragraph structure
    const generatedParagraphs = generatedStory.split(/\n\n+/).filter(p => p.trim().length > 20);
    const templateParagraphs = sourceTemplate.split(/\n\n+/).filter(p => p.trim().length > 20);

    const paragraphCountDiff = Math.abs(generatedParagraphs.length - templateParagraphs.length);
    const maxParagraphs = Math.max(generatedParagraphs.length, templateParagraphs.length);

    const paragraphSimilarity = maxParagraphs > 0 ? 1 - paragraphCountDiff / maxParagraphs : 0;

    // Average similarity (sentence + paragraph structure)
    const structuralSimilarity = (sentenceSimilarity + paragraphSimilarity) / 2;

    return structuralSimilarity;
  }

  /**
   * Tokenize text into words (removes punctuation, filters short words)
   */
  private static tokenize(text: string): string[] {
    return text
      .replace(/[.,!?;:()\"\']/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3); // Ignore articles, prepositions, etc.
  }

  /**
   * Generate improvement suggestions based on validation results
   */
  static generateImprovementPrompt(report: OriginalityReport): string {
    if (report.isOriginal) {
      return '✅ Story meets originality standards. No changes needed.';
    }

    let prompt = '🔄 STORY REVISION REQUIRED - Originality Issues Detected\n\n';

    prompt += `Current overlap: ${report.overlapPercentage}% (threshold: ${report.threshold}%)\n\n`;

    prompt += '**Issues Found:**\n';
    report.issues.forEach((issue, idx) => {
      prompt += `${idx + 1}. ${issue}\n`;
    });

    prompt += '\n**Required Improvements:**\n';
    report.suggestions.forEach((suggestion, idx) => {
      prompt += `${idx + 1}. ${suggestion}\n`;
    });

    prompt += '\n**Remix Strategies to Apply:**\n';
    prompt += '- Replace standard fairy tale vocabulary with fresh descriptions\n';
    prompt += '- Add new dialogue that reflects character personalities\n';
    prompt += '- Invent original solutions to problems (not from the template)\n';
    prompt += '- Transform settings and obstacles creatively\n';
    prompt += '- Use unexpected character motivations\n\n';

    prompt += '🎯 Goal: Reduce overlap to <' + report.threshold + '% while keeping the emotional core.\n';

    return prompt;
  }

  /**
   * Quick validation check (pass/fail only)
   */
  static quickValidate(generatedStory: string, sourceTemplate: string): boolean {
    const report = this.validate(generatedStory, sourceTemplate);
    return report.isOriginal;
  }

  /**
   * Validate with custom threshold
   */
  static validateWithThreshold(
    generatedStory: string,
    sourceTemplate: string,
    maxOverlap: number
  ): OriginalityReport {
    return this.validate(generatedStory, sourceTemplate, {
      maxOverlapPercentage: maxOverlap,
    });
  }
}

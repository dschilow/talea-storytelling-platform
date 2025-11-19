// Story Remixer - Ensures originality by transforming fairy tale templates
// Applies 6 intelligent remix strategies to prevent copy-paste stories

import type { FairyTaleScene } from "./fairy-tale-selector";

export interface RemixStrategy {
  name: string;
  description: string;
  weight: number; // Higher = more likely to be selected
}

export interface RemixedScene {
  originalSceneNumber: number;
  remixedSceneNumber: number;
  sceneTitle: string;
  sceneDescription: string;
  remixStrategy: string;
  transformationNotes: string;
}

export interface RemixResult {
  appliedStrategies: string[];
  remixedScenes: RemixedScene[];
  originalityScore: number; // 0-100, higher = more original
  transformationSummary: string;
}

export class StoryRemixer {
  /**
   * Available remix strategies with descriptions
   */
  private static readonly STRATEGIES: RemixStrategy[] = [
    {
      name: 'reverse_chronology',
      description: 'Tell the story in reverse order (end → start)',
      weight: 15,
    },
    {
      name: 'perspective_shift',
      description: 'Tell from antagonist or helper perspective instead of protagonist',
      weight: 20,
    },
    {
      name: 'obstacle_swap',
      description: 'Replace original obstacles with creative alternatives',
      weight: 25,
    },
    {
      name: 'setting_transform',
      description: 'Shift setting (forest→city, castle→underwater, etc.)',
      weight: 20,
    },
    {
      name: 'motivation_inversion',
      description: 'Invert character motivations (greedy king→generous, etc.)',
      weight: 15,
    },
    {
      name: 'solution_creativity',
      description: 'Replace standard solutions with unexpected problem-solving',
      weight: 30,
    },
    {
      name: 'genre_mashup',
      description: 'Combine the fairy tale with a RANDOM genre (Sci-Fi, Western, Noir, Steampunk). This creates a unique setting and tone.',
      weight: 25,
    },
    {
      name: 'unreliable_narrator',
      description: 'The narrator is hiding something or telling a biased version. Reveal the truth slowly.',
      weight: 20,
    },
  ];

  /**
   * Apply remix strategies to fairy tale scenes
   * Returns transformation instructions for the AI
   */
  static remixScenes(
    scenes: FairyTaleScene[],
    userAvatarNames: string[],
    targetOriginality: number = 60 // Target originality percentage (0-100)
  ): RemixResult {
    console.log(`[StoryRemixer] Remixing ${scenes.length} scenes, target originality: ${targetOriginality}%`);

    // Select strategies based on target originality
    // ALWAYS include at least one "high impact" strategy (genre_mashup, solution_creativity, obstacle_swap)
    const selectedStrategies = this.selectStrategies(targetOriginality);
    console.log(`[StoryRemixer] Selected strategies: ${selectedStrategies.join(', ')}`);

    const remixedScenes: RemixedScene[] = [];
    let transformationNotes: string[] = [];

    // Apply each strategy to relevant scenes
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const strategy = selectedStrategies[i % selectedStrategies.length]; // Cycle through strategies

      const remixed = this.applyStrategy(scene, strategy, i, userAvatarNames);
      remixedScenes.push(remixed);
      transformationNotes.push(remixed.transformationNotes);
    }

    // Calculate originality score based on applied transformations
    const originalityScore = this.calculateOriginalityScore(selectedStrategies, remixedScenes);

    const transformationSummary = this.generateTransformationSummary(
      selectedStrategies,
      remixedScenes,
      userAvatarNames
    );

    console.log(`[StoryRemixer] Remix complete! Originality score: ${originalityScore}/100`);

    return {
      appliedStrategies: selectedStrategies,
      remixedScenes,
      originalityScore,
      transformationSummary,
    };
  }

  /**
   * Select strategies based on target originality
   */
  private static selectStrategies(targetOriginality: number): string[] {
    // Higher target = more strategies
    let strategyCount: number;

    if (targetOriginality >= 80) {
      strategyCount = 4; // Very original
    } else if (targetOriginality >= 60) {
      strategyCount = 3; // Original
    } else if (targetOriginality >= 40) {
      strategyCount = 2; // Moderately original
    } else {
      strategyCount = 1; // Slightly original
    }

    // Sort strategies by weight (higher = more effective for originality)
    const sortedStrategies = [...this.STRATEGIES].sort((a, b) => b.weight - a.weight);

    // Select top N strategies
    return sortedStrategies.slice(0, strategyCount).map(s => s.name);
  }

  /**
   * Apply a specific remix strategy to a scene
   */
  private static applyStrategy(
    scene: FairyTaleScene,
    strategy: string,
    sceneIndex: number,
    avatarNames: string[]
  ): RemixedScene {
    const avatarPlaceholder = avatarNames.length > 0 ? avatarNames[0] : 'PROTAGONIST';

    let transformationNotes = '';
    let remixedDescription = scene.sceneDescription;

    switch (strategy) {
      case 'reverse_chronology':
        transformationNotes = `Scene ${sceneIndex + 1}: Tell this event in REVERSE chronological order. Start with the outcome, then reveal how it happened. Use flashbacks and retrospective narration.`;
        break;

      case 'perspective_shift':
        transformationNotes = `Scene ${sceneIndex + 1}: Tell this scene from the ANTAGONIST's or HELPER's perspective instead of ${avatarPlaceholder}. Show their thoughts, motivations, and viewpoint. Make the reader understand their side of the story.`;
        break;

      case 'obstacle_swap':
        transformationNotes = `Scene ${sceneIndex + 1}: REPLACE the original obstacle with a creative alternative. Instead of the typical challenge, invent a unique problem that fits the character's personality. Avoid clichés - be inventive!`;
        break;

      case 'setting_transform':
        const settingTransforms = [
          'forest → bustling marketplace',
          'castle → hidden cave system',
          'village → traveling circus',
          'mountain → underground library',
          'beach → floating island',
        ];
        const transform = settingTransforms[sceneIndex % settingTransforms.length];
        transformationNotes = `Scene ${sceneIndex + 1}: TRANSFORM the setting from ${transform}. Adapt the scene's events to fit the new environment. Keep the emotional core but change the physical space completely.`;
        break;

      case 'motivation_inversion':
        transformationNotes = `Scene ${sceneIndex + 1}: INVERT character motivations. If the original character is greedy, make them generous. If they're fearful, make them brave. Keep the plot beats but flip the psychological drivers. This creates fresh character dynamics.`;
        break;

      case 'solution_creativity':
        transformationNotes = `Scene ${sceneIndex + 1}: The protagonist must solve this problem in an UNEXPECTED, CREATIVE way. NO standard fairy tale solutions (magic wands, wishes, traditional tricks). Think outside the box - use the avatar's unique personality traits and skills. Be inventive and surprising!`;
        break;

      case 'genre_mashup':
        const genres = ['Sci-Fi', 'Western', 'Detective Noir', 'Steampunk', 'Cyberpunk', 'Prehistoric'];
        const genre = genres[Math.floor(Math.random() * genres.length)];
        transformationNotes = `Scene ${sceneIndex + 1}: MASHUP with ${genre} genre! Reimagine the scene elements (props, dialogue, setting) to fit a ${genre} aesthetic while keeping the fairy tale plot. Example: A carriage becomes a spaceship or steam-engine.`;
        break;
        
      case 'unreliable_narrator':
        transformationNotes = `Scene ${sceneIndex + 1}: The narrator doubts what they are seeing. Is it magic or a trick? Add ambiguity and mystery. Maybe the characters perceive things differently.`;
        break;

      default:
        transformationNotes = `Scene ${sceneIndex + 1}: Keep the emotional core but tell it in a fresh, original way.`;
    }

    return {
      originalSceneNumber: scene.sceneNumber,
      remixedSceneNumber: sceneIndex + 1,
      sceneTitle: scene.sceneTitle || `Scene ${sceneIndex + 1}`,
      sceneDescription: remixedDescription,
      remixStrategy: strategy,
      transformationNotes,
    };
  }

  /**
   * Calculate originality score based on applied transformations
   */
  private static calculateOriginalityScore(strategies: string[], scenes: RemixedScene[]): number {
    // Base score: number of strategies × 15
    let score = strategies.length * 15;

    // Bonus for high-impact strategies
    const highImpactStrategies = ['solution_creativity', 'perspective_shift', 'obstacle_swap', 'genre_mashup'];
    const highImpactCount = strategies.filter(s => highImpactStrategies.includes(s)).length;
    score += highImpactCount * 10;

    // Bonus for applying different strategies to each scene (variety)
    const uniqueStrategiesPerScene = new Set(scenes.map(s => s.remixStrategy)).size;
    score += uniqueStrategiesPerScene * 5;

    return Math.min(100, score);
  }

  /**
   * Generate comprehensive transformation summary for AI prompt
   */
  private static generateTransformationSummary(
    strategies: string[],
    scenes: RemixedScene[],
    avatarNames: string[]
  ): string {
    const avatarList = avatarNames.join(', ');

    let summary = `🎨 ORIGINALITY ENFORCEMENT - Remix Strategies Applied:\n\n`;

    summary += `CRITICAL: This story is BASED ON a fairy tale template but MUST BE HIGHLY ORIGINAL!\n`;
    summary += `The following ${strategies.length} transformation strategies are MANDATORY:\n\n`;

    // List applied strategies with emphasis
    strategies.forEach((strategy, idx) => {
      const strategyInfo = this.STRATEGIES.find(s => s.name === strategy);
      if (strategyInfo) {
        summary += `${idx + 1}. **${strategyInfo.name.toUpperCase().replace(/_/g, ' ')}**: ${strategyInfo.description}\n`;
      }
    });

    summary += `\n📋 SCENE-BY-SCENE TRANSFORMATION INSTRUCTIONS:\n\n`;

    // Detailed scene instructions
    scenes.forEach((scene, idx) => {
      summary += `**${scene.sceneTitle}**\n`;
      summary += `${scene.transformationNotes}\n\n`;
    });

    summary += `\n🎯 ORIGINALITY REQUIREMENTS:\n`;
    summary += `- Use the fairy tale as INSPIRATION ONLY, not a script to copy\n`;
    summary += `- Every scene must feel FRESH and UNEXPECTED\n`;
    summary += `- Character ${avatarList} must drive the story with their UNIQUE personalities\n`;
    summary += `- Avoid fairy tale clichés (magic wands, standard wishes, predictable outcomes)\n`;
    summary += `- Create NEW dialogue, NEW solutions, NEW emotional moments\n`;
    summary += `- The reader should NOT be able to guess "this is just Rumpelstilzchen with different names"\n\n`;

    summary += `⚠️ VALIDATION: The story will be checked for originality. Overlap >40% with the original tale = REJECTION.\n`;
    summary += `Be creative, be bold, be original! 🚀\n`;

    return summary;
  }

  /**
   * Analyze a generated story for originality (post-generation validation)
   */
  static analyzeOriginality(
    generatedStory: string,
    originalTemplate: string
  ): { overlapPercentage: number; isOriginal: boolean; issues: string[] } {
    // Simple word-overlap analysis (can be enhanced with AI later)
    const generatedWords = this.tokenize(generatedStory.toLowerCase());
    const templateWords = this.tokenize(originalTemplate.toLowerCase());

    // Calculate overlap
    const generatedSet = new Set(generatedWords);
    const templateSet = new Set(templateWords);

    let overlapCount = 0;
    for (const word of generatedSet) {
      if (templateSet.has(word)) {
        overlapCount++;
      }
    }

    const overlapPercentage = Math.round((overlapCount / generatedSet.size) * 100);

    const issues: string[] = [];
    const threshold = 40; // Maximum allowed overlap

    if (overlapPercentage > threshold) {
      issues.push(`High word overlap: ${overlapPercentage}% (threshold: ${threshold}%)`);
      issues.push('Story appears too similar to original template');
    }

    // Check for direct copying of key phrases (3+ consecutive words)
    const directCopies = this.findDirectCopies(generatedStory, originalTemplate, 3);
    if (directCopies.length > 3) {
      issues.push(`Found ${directCopies.length} instances of direct phrase copying`);
    }

    const isOriginal = overlapPercentage <= threshold && directCopies.length <= 3;

    console.log(`[StoryRemixer] Originality analysis: ${overlapPercentage}% overlap, ${directCopies.length} direct copies, original=${isOriginal}`);

    return {
      overlapPercentage,
      isOriginal,
      issues,
    };
  }

  /**
   * Tokenize text into words (removes punctuation)
   */
  private static tokenize(text: string): string[] {
    return text
      .replace(/[.,!?;:()\"\']/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3); // Ignore short words
  }

  /**
   * Find direct copies of N consecutive words
   */
  private static findDirectCopies(text1: string, text2: string, minLength: number): string[] {
    const words1 = this.tokenize(text1.toLowerCase());
    const words2 = this.tokenize(text2.toLowerCase());

    const copies: string[] = [];

    for (let i = 0; i <= words1.length - minLength; i++) {
      const phrase = words1.slice(i, i + minLength).join(' ');

      // Check if this phrase exists in text2
      for (let j = 0; j <= words2.length - minLength; j++) {
        const phrase2 = words2.slice(j, j + minLength).join(' ');
        if (phrase === phrase2) {
          copies.push(phrase);
          break;
        }
      }
    }

    return copies;
  }
}

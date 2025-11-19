// Phase Scoring System
// Bewertet jede Phase der Story-Generierung mit 0.0-10.0

export interface PhaseScore {
  phase: string;
  score: number; // 0.0 - 10.0
  maxScore: number;
  details: Record<string, { score: number; maxScore: number; reason: string }>;
  issues: string[];
  recommendations: string[];
}

export interface OverallScoreReport {
  testId: string;
  timestamp: Date;
  storyId: string;
  storyTitle: string;
  config: any;
  phases: {
    phase0: PhaseScore;
    phase1: PhaseScore;
    phase2: PhaseScore;
    phase3: PhaseScore;
    phase4: PhaseScore;
  };
  overallScore: number;
  summary: string;
}

/**
 * Phase 0: Fairy Tale Selection (0-10)
 * Bewertet ob und wie gut ein Märchen ausgewählt wurde
 */
export function scorePhase0(logData: any): PhaseScore {
  const details: PhaseScore['details'] = {};
  const issues: string[] = [];
  const recommendations: string[] = [];
  let totalScore = 0;

  // Kriterium 1: Wurde ein Märchen ausgewählt? (2 Punkte)
  const fairyTaleSelected = !!logData?.fairyTaleUsed;
  if (fairyTaleSelected) {
    details.selection = { score: 2, maxScore: 2, reason: `Märchen ausgewählt: "${logData.fairyTaleUsed.title}"` };
    totalScore += 2;
  } else {
    details.selection = { score: 0, maxScore: 2, reason: 'Kein Märchen ausgewählt' };
    issues.push('Phase 0 wurde übersprungen - kein Märchen ausgewählt');
    recommendations.push('Aktiviere useFairyTaleTemplate für Märchen-Genres');
  }

  // Kriterium 2: Match Score > 0.7? (3 Punkte)
  if (fairyTaleSelected) {
    const matchScore = logData.fairyTaleUsed?.matchScore || 0;
    if (matchScore >= 0.9) {
      details.matchQuality = { score: 3, maxScore: 3, reason: `Exzellenter Match Score: ${matchScore.toFixed(2)}` };
      totalScore += 3;
    } else if (matchScore >= 0.7) {
      details.matchQuality = { score: 2, maxScore: 3, reason: `Guter Match Score: ${matchScore.toFixed(2)}` };
      totalScore += 2;
      recommendations.push('Match Score könnte höher sein - optimiere Märchen-Auswahl-Algorithmus');
    } else {
      details.matchQuality = { score: 1, maxScore: 3, reason: `Schwacher Match Score: ${matchScore.toFixed(2)}` };
      totalScore += 1;
      issues.push(`Match Score zu niedrig: ${matchScore.toFixed(2)} < 0.7`);
    }
  } else {
    details.matchQuality = { score: 0, maxScore: 3, reason: 'Kein Match Score vorhanden' };
  }

  // Kriterium 3: Match Reason sinnvoll? (2 Punkte)
  if (fairyTaleSelected && logData.fairyTaleUsed?.matchReason) {
    const reasonLength = logData.fairyTaleUsed.matchReason.length;
    if (reasonLength > 50) {
      details.matchReason = { score: 2, maxScore: 2, reason: 'Detaillierte Match-Begründung vorhanden' };
      totalScore += 2;
    } else {
      details.matchReason = { score: 1, maxScore: 2, reason: 'Match-Begründung zu kurz' };
      totalScore += 1;
      recommendations.push('Verbessere Match-Begründungen mit mehr Kontext');
    }
  } else {
    details.matchReason = { score: 0, maxScore: 2, reason: 'Keine Match-Begründung' };
  }

  // Kriterium 4: Passend zu Genre/Alter? (3 Punkte)
  if (fairyTaleSelected) {
    const tale = logData.fairyTaleUsed;
    const config = logData.config || {};

    // Check age appropriateness
    const ageGroup = config.ageGroup || '6-8';
    const ageMin = parseInt(ageGroup.split('-')[0]);
    const taleAge = tale.ageRecommendation || 6;

    const ageDiff = Math.abs(taleAge - ageMin);
    let ageScore = 0;

    if (ageDiff <= 1) {
      ageScore = 1.5;
    } else if (ageDiff <= 2) {
      ageScore = 1;
    } else {
      issues.push(`Alters-Mismatch: Märchen für ${taleAge}+, Story für ${ageGroup}`);
    }

    // Check genre match
    const genre = config.genre || '';
    const genreMatches = genre.toLowerCase().includes('märchen') || genre.toLowerCase().includes('magic');
    const genreScore = genreMatches ? 1.5 : 0;

    if (!genreMatches) {
      issues.push(`Genre-Mismatch: Märchen für nicht-Märchen-Genre "${genre}"`);
    }

    const appropriatenessScore = ageScore + genreScore;
    details.appropriateness = {
      score: appropriatenessScore,
      maxScore: 3,
      reason: `Alters-Diff: ${ageDiff}, Genre-Match: ${genreMatches}`
    };
    totalScore += appropriatenessScore;
  } else {
    details.appropriateness = { score: 0, maxScore: 3, reason: 'Kein Märchen für Prüfung' };
  }

  return {
    phase: 'Phase 0: Fairy Tale Selection',
    score: parseFloat(totalScore.toFixed(1)),
    maxScore: 10,
    details,
    issues,
    recommendations
  };
}

/**
 * Phase 1: Skeleton Generation (0-10)
 * Bewertet die Qualität des generierten Story-Skeletts
 */
export function scorePhase1(logData: any): PhaseScore {
  const details: PhaseScore['details'] = {};
  const issues: string[] = [];
  const recommendations: string[] = [];
  let totalScore = 0;

  const skeleton = logData?.skeleton;
  const usage = logData?.usage;
  const duration = logData?.durationMs || 0;

  // Kriterium 1: Skeleton vollständig? (2 Punkte)
  if (skeleton?.title && skeleton?.chapters && skeleton?.supportingCharacterRequirements) {
    details.completeness = { score: 2, maxScore: 2, reason: 'Skeleton vollständig mit allen Feldern' };
    totalScore += 2;
  } else {
    details.completeness = { score: 0, maxScore: 2, reason: 'Skeleton unvollständig' };
    issues.push('Skeleton fehlt Title, Chapters oder Character Requirements');
  }

  // Kriterium 2: Character Requirements plausibel? (2 Punkte)
  const reqCount = skeleton?.supportingCharacterRequirements?.length || 0;
  if (reqCount >= 2 && reqCount <= 8) {
    details.characterRequirements = {
      score: 2,
      maxScore: 2,
      reason: `${reqCount} Character Requirements - optimale Anzahl`
    };
    totalScore += 2;
  } else if (reqCount > 0) {
    details.characterRequirements = {
      score: 1,
      maxScore: 2,
      reason: `${reqCount} Character Requirements - suboptimal`
    };
    totalScore += 1;
    if (reqCount > 8) {
      issues.push(`Zu viele Character Requirements: ${reqCount} > 8`);
    } else {
      issues.push(`Zu wenige Character Requirements: ${reqCount} < 2`);
    }
  } else {
    details.characterRequirements = { score: 0, maxScore: 2, reason: 'Keine Character Requirements' };
    issues.push('Keine Character Requirements vorhanden');
  }

  // Kriterium 3: Kapitelanzahl passend zur Länge? (2 Punkte)
  const chapterCount = skeleton?.chapters?.length || 0;
  const length = logData?.config?.length || 'medium';

  const expectedChapters = length === 'short' ? [3, 4] : length === 'long' ? [6, 7, 8] : [4, 5, 6];
  const isAppropriate = chapterCount >= expectedChapters[0] && chapterCount <= expectedChapters[expectedChapters.length - 1];

  if (isAppropriate) {
    details.chapterCount = {
      score: 2,
      maxScore: 2,
      reason: `${chapterCount} Kapitel für "${length}" - passend`
    };
    totalScore += 2;
  } else {
    details.chapterCount = {
      score: 1,
      maxScore: 2,
      reason: `${chapterCount} Kapitel für "${length}" - suboptimal`
    };
    totalScore += 1;
    issues.push(`Kapitelanzahl ${chapterCount} passt nicht zu Länge "${length}"`);
  }

  // Kriterium 4: Placeholders korrekt formatiert? (2 Punkte)
  const requirements = skeleton?.supportingCharacterRequirements || [];
  const placeholderIssues = requirements.filter((req: any) => {
    const ph = req.placeholder || '';
    return !ph.match(/^\{\{[A-Z_]+\}\}$/);
  });

  if (requirements.length > 0) {
    if (placeholderIssues.length === 0) {
      details.placeholders = { score: 2, maxScore: 2, reason: 'Alle Placeholders korrekt formatiert' };
      totalScore += 2;
    } else {
      details.placeholders = {
        score: 1,
        maxScore: 2,
        reason: `${placeholderIssues.length}/${requirements.length} Placeholders falsch formatiert`
      };
      totalScore += 1;
      issues.push(`Falsch formatierte Placeholders: ${placeholderIssues.map((r: any) => r.placeholder).join(', ')}`);
    }
  } else {
    details.placeholders = { score: 0, maxScore: 2, reason: 'Keine Placeholders zu prüfen' };
  }

  // Kriterium 5: Dauer < 50s? (2 Punkte)
  if (duration < 40000) {
    details.performance = { score: 2, maxScore: 2, reason: `Exzellente Performance: ${(duration / 1000).toFixed(1)}s` };
    totalScore += 2;
  } else if (duration < 50000) {
    details.performance = { score: 1.5, maxScore: 2, reason: `Gute Performance: ${(duration / 1000).toFixed(1)}s` };
    totalScore += 1.5;
  } else if (duration < 60000) {
    details.performance = { score: 1, maxScore: 2, reason: `Akzeptable Performance: ${(duration / 1000).toFixed(1)}s` };
    totalScore += 1;
    recommendations.push('Phase 1 Dauer optimieren (Ziel: <50s)');
  } else {
    details.performance = { score: 0, maxScore: 2, reason: `Langsame Performance: ${(duration / 1000).toFixed(1)}s` };
    issues.push(`Phase 1 zu langsam: ${(duration / 1000).toFixed(1)}s > 60s`);
  }

  return {
    phase: 'Phase 1: Skeleton Generation',
    score: parseFloat(totalScore.toFixed(1)),
    maxScore: 10,
    details,
    issues,
    recommendations
  };
}

/**
 * Phase 2: Character Matching (0-10)
 * Bewertet die Qualität des Character Matchings
 */
export function scorePhase2(logData: any): PhaseScore {
  const details: PhaseScore['details'] = {};
  const issues: string[] = [];
  const recommendations: string[] = [];
  let totalScore = 0;

  const assignments = logData?.assignments || [];
  const matchedCount = logData?.matchedCount || 0;
  const requirementsCount = logData?.requirementsCount || 0;

  // Kriterium 1: 100% Matches gefunden? (3 Punkte)
  if (matchedCount === requirementsCount && requirementsCount > 0) {
    details.completeness = { score: 3, maxScore: 3, reason: `Alle ${requirementsCount} Requirements gematched` };
    totalScore += 3;
  } else if (matchedCount >= requirementsCount * 0.8) {
    details.completeness = {
      score: 2,
      maxScore: 3,
      reason: `${matchedCount}/${requirementsCount} Requirements gematched (80%+)`
    };
    totalScore += 2;
    recommendations.push('Verbessere Character Pool um 100% Match-Rate zu erreichen');
  } else {
    details.completeness = {
      score: 1,
      maxScore: 3,
      reason: `Nur ${matchedCount}/${requirementsCount} Requirements gematched`
    };
    totalScore += 1;
    issues.push(`Zu wenige Matches: ${matchedCount}/${requirementsCount}`);
  }

  // Kriterium 2: Alter/Geschlecht/Species korrekt? (3 Punkte)
  let attributeScore = 0;
  let attributeChecks = 0;
  let attributeIssues: string[] = [];

  assignments.forEach((assignment: any) => {
    const char = assignment.character;
    const requirement = assignment.requirement;

    if (!char || !requirement) return;

    // Check species
    if (requirement.visualHints) {
      attributeChecks++;
      const hints = requirement.visualHints.toLowerCase();
      const species = char.visualProfile?.species?.toLowerCase() || 'unknown';

      const isAnimal = hints.includes('tier') || hints.includes('animal');
      const isHuman = hints.includes('mensch') || hints.includes('human') || hints.includes('kind');

      if (isAnimal && species !== 'human') {
        attributeScore += 0.5;
      } else if (isHuman && species === 'human') {
        attributeScore += 0.5;
      } else if (!isAnimal && !isHuman) {
        attributeScore += 0.5; // No constraint
      } else {
        attributeIssues.push(`${char.name}: Species-Mismatch (wanted: ${hints}, got: ${species})`);
      }
    }

    // Check age appropriateness
    if (requirement.ageCategory || requirement.ageRangeMin || requirement.ageRangeMax) {
      attributeChecks++;
      const charAge = char.age_category || char.visualProfile?.ageApprox || 'unknown';
      const reqAge = requirement.ageCategory || 'unknown';

      if (reqAge !== 'unknown' && charAge !== 'unknown') {
        if (reqAge === charAge || reqAge === 'any') {
          attributeScore += 0.5;
        } else {
          attributeIssues.push(`${char.name}: Alter-Mismatch (wanted: ${reqAge}, got: ${charAge})`);
        }
      } else {
        attributeScore += 0.25; // Partial credit if no age constraint
      }
    }

    // Check gender
    if (requirement.genderRequirement) {
      attributeChecks++;
      const charGender = char.gender || 'unknown';
      const reqGender = requirement.genderRequirement;

      if (reqGender === 'any' || charGender === 'unknown' || reqGender === charGender) {
        attributeScore += 0.5;
      } else {
        attributeIssues.push(`${char.name}: Geschlecht-Mismatch (wanted: ${reqGender}, got: ${charGender})`);
      }
    }
  });

  const maxAttributeScore = Math.min(3, attributeChecks * 0.5);
  const normalizedAttributeScore = maxAttributeScore > 0 ? (attributeScore / maxAttributeScore) * 3 : 3;

  details.attributeMatching = {
    score: parseFloat(normalizedAttributeScore.toFixed(1)),
    maxScore: 3,
    reason: `${attributeIssues.length} Attribute-Probleme bei ${attributeChecks} Checks`
  };
  totalScore += normalizedAttributeScore;

  if (attributeIssues.length > 0) {
    issues.push(...attributeIssues);
    recommendations.push('Verbessere Attribute-Matching (Alter/Geschlecht/Species)');
  }

  // Kriterium 3: Avatare als Protagonisten? (2 Punkte)
  const avatarAssignments = assignments.filter((a: any) =>
    a.character?.id?.includes('avatar') || a.character?.role === 'protagonist'
  );

  const avatarProtagonists = avatarAssignments.filter((a: any) =>
    a.character?.role === 'protagonist' || a.character?.role === 'sidekick'
  );

  if (avatarAssignments.length > 0) {
    if (avatarProtagonists.length === avatarAssignments.length) {
      details.avatarRoles = {
        score: 2,
        maxScore: 2,
        reason: `Alle ${avatarAssignments.length} Avatare als Protagonist/Sidekick`
      };
      totalScore += 2;
    } else {
      details.avatarRoles = {
        score: 1,
        maxScore: 2,
        reason: `${avatarProtagonists.length}/${avatarAssignments.length} Avatare korrekt zugewiesen`
      };
      totalScore += 1;
      issues.push('Nicht alle Avatare sind Protagonisten/Sidekicks');
    }
  } else {
    details.avatarRoles = { score: 2, maxScore: 2, reason: 'Keine Avatar-Zuweisungen (Pool-only Story)' };
    totalScore += 2;
  }

  // Kriterium 4: Diversität in Species? (1 Punkt)
  const speciesSet = new Set(
    assignments.map((a: any) => a.character?.visualProfile?.species).filter(Boolean)
  );

  if (speciesSet.size >= 2) {
    details.diversity = { score: 1, maxScore: 1, reason: `${speciesSet.size} verschiedene Species` };
    totalScore += 1;
  } else if (speciesSet.size === 1) {
    details.diversity = { score: 0.5, maxScore: 1, reason: 'Nur 1 Species-Typ' };
    totalScore += 0.5;
    recommendations.push('Erhöhe Species-Diversität für interessantere Stories');
  } else {
    details.diversity = { score: 0, maxScore: 1, reason: 'Keine Species-Informationen' };
  }

  // Kriterium 5: Keine Duplikate? (1 Punkt)
  const characterIds = assignments.map((a: any) => a.character?.id).filter(Boolean);
  const uniqueIds = new Set(characterIds);

  if (characterIds.length === uniqueIds.size) {
    details.uniqueness = { score: 1, maxScore: 1, reason: 'Keine Duplikate' };
    totalScore += 1;
  } else {
    details.uniqueness = {
      score: 0,
      maxScore: 1,
      reason: `${characterIds.length - uniqueIds.size} Duplikate gefunden`
    };
    issues.push(`Duplikate in Character Assignments: ${characterIds.length} IDs, ${uniqueIds.size} unique`);
  }

  return {
    phase: 'Phase 2: Character Matching',
    score: parseFloat(totalScore.toFixed(1)),
    maxScore: 10,
    details,
    issues,
    recommendations
  };
}

/**
 * Phase 3: Story Finalization (0-10)
 * Bewertet die Qualität der finalisierten Story
 */
export function scorePhase3(logData: any): PhaseScore {
  const details: PhaseScore['details'] = {};
  const issues: string[] = [];
  const recommendations: string[] = [];
  let totalScore = 0;

  const story = logData?.story;
  const usage = logData?.usage;
  const duration = logData?.durationMs || 0;

  // Kriterium 1: Story vollständig generiert? (2 Punkte)
  if (story?.title && story?.description && story?.chapters) {
    details.completeness = { score: 2, maxScore: 2, reason: 'Story vollständig mit Title, Description, Chapters' };
    totalScore += 2;
  } else {
    details.completeness = { score: 0, maxScore: 2, reason: 'Story unvollständig' };
    issues.push('Story fehlt Title, Description oder Chapters');
  }

  // Kriterium 2: Alle Kapitel vorhanden? (2 Punkte)
  const chapterCount = story?.chapters?.length || 0;
  const expectedChapters = story?.chaptersCount || logData?.expectedChapters || 5;

  if (chapterCount === expectedChapters) {
    details.chapters = { score: 2, maxScore: 2, reason: `Alle ${chapterCount} Kapitel vorhanden` };
    totalScore += 2;
  } else if (chapterCount >= expectedChapters * 0.8) {
    details.chapters = {
      score: 1.5,
      maxScore: 2,
      reason: `${chapterCount}/${expectedChapters} Kapitel (80%+)`
    };
    totalScore += 1.5;
    recommendations.push('Sicherstellen dass alle geplanten Kapitel generiert werden');
  } else {
    details.chapters = {
      score: 1,
      maxScore: 2,
      reason: `Nur ${chapterCount}/${expectedChapters} Kapitel`
    };
    totalScore += 1;
    issues.push(`Zu wenige Kapitel: ${chapterCount}/${expectedChapters}`);
  }

  // Kriterium 3: Avatar Developments korrekt? (2 Punkte)
  const avatarDevelopments = story?.avatarDevelopments || [];

  if (avatarDevelopments.length > 0) {
    const validDevelopments = avatarDevelopments.filter((dev: any) =>
      dev.avatarName && dev.updates && Array.isArray(dev.updates) && dev.updates.length > 0
    );

    if (validDevelopments.length === avatarDevelopments.length) {
      details.avatarDevelopments = {
        score: 2,
        maxScore: 2,
        reason: `${validDevelopments.length} Avatar Developments korrekt`
      };
      totalScore += 2;
    } else {
      details.avatarDevelopments = {
        score: 1,
        maxScore: 2,
        reason: `${validDevelopments.length}/${avatarDevelopments.length} Developments korrekt`
      };
      totalScore += 1;
      issues.push('Einige Avatar Developments sind unvollständig');
    }
  } else {
    details.avatarDevelopments = { score: 0, maxScore: 2, reason: 'Keine Avatar Developments' };
    recommendations.push('Avatar Developments hinzufügen für Persönlichkeitsentwicklung');
  }

  // Kriterium 4: Remix-Originalität (bei Märchen)? (2 Punkte)
  const usedFairyTale = logData?.fairyTaleUsed;

  if (usedFairyTale) {
    // Check if story is not a 1:1 copy
    const storyTitle = story?.title?.toLowerCase() || '';
    const taleTitle = usedFairyTale.title?.toLowerCase() || '';

    const isTitleIdentical = storyTitle === taleTitle;
    const hasTwist = story?.hasTwist || false;
    const remixInstructions = logData?.remixInstructions || '';

    if (!isTitleIdentical && (hasTwist || remixInstructions.length > 100)) {
      details.originality = {
        score: 2,
        maxScore: 2,
        reason: 'Story ist originelle Adaption, nicht 1:1 Kopie'
      };
      totalScore += 2;
    } else if (!isTitleIdentical) {
      details.originality = {
        score: 1.5,
        maxScore: 2,
        reason: 'Story hat eigenen Titel, könnte origineller sein'
      };
      totalScore += 1.5;
      recommendations.push('Füge mehr Remix-Originalität hinzu (Twists, neue Elemente)');
    } else {
      details.originality = {
        score: 1,
        maxScore: 2,
        reason: 'Story-Titel identisch mit Märchen - möglicherweise zu nah am Original'
      };
      totalScore += 1;
      issues.push('Story scheint zu nah am Original-Märchen zu sein');
    }
  } else {
    details.originality = { score: 2, maxScore: 2, reason: 'Originalstory (kein Märchen)' };
    totalScore += 2;
  }

  // Kriterium 5: Sprachqualität? (2 Punkte)
  if (story?.chapters && story.chapters.length > 0) {
    const firstChapter = story.chapters[0];
    const content = firstChapter.content || '';
    const wordCount = content.split(/\s+/).length;

    // Check for minimum content quality
    const hasDialogue = content.includes('"') || content.includes('„');
    const hasVariedSentences = content.split('.').length > 3;
    const hasMinimumLength = wordCount > 100;

    let qualityScore = 0;
    if (hasMinimumLength) qualityScore += 0.7;
    if (hasDialogue) qualityScore += 0.7;
    if (hasVariedSentences) qualityScore += 0.6;

    details.languageQuality = {
      score: parseFloat(qualityScore.toFixed(1)),
      maxScore: 2,
      reason: `Wörter: ${wordCount}, Dialog: ${hasDialogue}, Satz-Vielfalt: ${hasVariedSentences}`
    };
    totalScore += qualityScore;

    if (!hasMinimumLength) {
      issues.push(`Kapitel zu kurz: ${wordCount} Wörter`);
    }
    if (!hasDialogue) {
      recommendations.push('Füge mehr Dialog hinzu für lebendige Erzählung');
    }
  } else {
    details.languageQuality = { score: 0, maxScore: 2, reason: 'Keine Kapitel zum Bewerten' };
  }

  return {
    phase: 'Phase 3: Story Finalization',
    score: parseFloat(totalScore.toFixed(1)),
    maxScore: 10,
    details,
    issues,
    recommendations
  };
}

/**
 * Phase 4: Image Generation (0-10)
 * Bewertet die Qualität der generierten Bilder
 */
export function scorePhase4(logData: any): PhaseScore {
  const details: PhaseScore['details'] = {};
  const issues: string[] = [];
  const recommendations: string[] = [];
  let totalScore = 0;

  const images = logData?.images || [];
  const coverImage = logData?.coverImage;
  const totalImages = logData?.totalImages || 0;
  const successfulImages = logData?.successfulImages || 0;

  // Kriterium 1: Alle Bilder generiert? (3 Punkte)
  if (successfulImages === totalImages && totalImages > 0) {
    details.completion = { score: 3, maxScore: 3, reason: `Alle ${successfulImages} Kapitel-Bilder generiert` };
    totalScore += 3;
  } else if (successfulImages >= totalImages * 0.9) {
    details.completion = {
      score: 2.5,
      maxScore: 3,
      reason: `${successfulImages}/${totalImages} Bilder (90%+)`
    };
    totalScore += 2.5;
    recommendations.push('Fehlerrate bei Bildgenerierung reduzieren');
  } else if (successfulImages >= totalImages * 0.75) {
    details.completion = {
      score: 2,
      maxScore: 3,
      reason: `${successfulImages}/${totalImages} Bilder (75%+)`
    };
    totalScore += 2;
    issues.push(`${totalImages - successfulImages} Bilder fehlgeschlagen`);
  } else {
    details.completion = {
      score: 1,
      maxScore: 3,
      reason: `Nur ${successfulImages}/${totalImages} Bilder erfolgreich`
    };
    totalScore += 1;
    issues.push(`Zu viele fehlgeschlagene Bilder: ${totalImages - successfulImages}`);
  }

  // Kriterium 2: Cover-Bild vorhanden? (2 Punkte)
  if (coverImage?.url) {
    details.coverImage = { score: 2, maxScore: 2, reason: 'Cover-Bild erfolgreich generiert' };
    totalScore += 2;
  } else {
    details.coverImage = { score: 0, maxScore: 2, reason: 'Kein Cover-Bild vorhanden' };
    issues.push('Cover-Bild fehlt oder Generierung fehlgeschlagen');
  }

  // Kriterium 3: Prompts konsistent? (2 Punkte)
  if (images.length > 0) {
    const promptsWithCharacters = images.filter((img: any) =>
      img.prompt && img.prompt.includes('CHARACTERS IN THIS SCENE')
    );

    if (promptsWithCharacters.length === images.length) {
      details.promptConsistency = {
        score: 2,
        maxScore: 2,
        reason: 'Alle Prompts enthalten Character-Konsistenz-Block'
      };
      totalScore += 2;
    } else {
      details.promptConsistency = {
        score: 1,
        maxScore: 2,
        reason: `${promptsWithCharacters.length}/${images.length} Prompts mit Character-Block`
      };
      totalScore += 1;
      recommendations.push('Sicherstellen dass alle Prompts Character-Konsistenz-Information enthalten');
    }
  } else {
    details.promptConsistency = { score: 0, maxScore: 2, reason: 'Keine Prompts zu prüfen' };
  }

  // Kriterium 4: Alters-Darstellung korrekt? (2 Punkte)
  const promptsWithAgeInfo = images.filter((img: any) => {
    const prompt = img.prompt || '';
    return prompt.includes('years old') || prompt.includes('child') || prompt.includes('age');
  });

  if (images.length > 0) {
    if (promptsWithAgeInfo.length >= images.length * 0.8) {
      details.ageConsistency = {
        score: 2,
        maxScore: 2,
        reason: `${promptsWithAgeInfo.length}/${images.length} Prompts mit Alters-Info`
      };
      totalScore += 2;
    } else if (promptsWithAgeInfo.length >= images.length * 0.5) {
      details.ageConsistency = {
        score: 1,
        maxScore: 2,
        reason: `${promptsWithAgeInfo.length}/${images.length} Prompts mit Alters-Info`
      };
      totalScore += 1;
      recommendations.push('Füge mehr Alters-Informationen zu Prompts hinzu');
    } else {
      details.ageConsistency = {
        score: 0.5,
        maxScore: 2,
        reason: `Nur ${promptsWithAgeInfo.length}/${images.length} Prompts mit Alters-Info`
      };
      totalScore += 0.5;
      issues.push('Zu wenige Prompts enthalten Alters-Informationen');
    }
  } else {
    details.ageConsistency = { score: 0, maxScore: 2, reason: 'Keine Prompts zu prüfen' };
  }

  // Kriterium 5: Genre-Kostüme angewendet? (1 Punkt)
  const genreKeywords = ['medieval', 'fantasy', 'magic', 'steampunk', 'tunic', 'breeches', 'vest'];
  const promptsWithGenreCostumes = images.filter((img: any) => {
    const prompt = img.prompt?.toLowerCase() || '';
    return genreKeywords.some(keyword => prompt.includes(keyword));
  });

  if (images.length > 0) {
    if (promptsWithGenreCostumes.length >= images.length * 0.5) {
      details.genreCostumes = {
        score: 1,
        maxScore: 1,
        reason: `${promptsWithGenreCostumes.length}/${images.length} Bilder mit Genre-Kostümen`
      };
      totalScore += 1;
    } else {
      details.genreCostumes = {
        score: 0.5,
        maxScore: 1,
        reason: `Nur ${promptsWithGenreCostumes.length}/${images.length} Bilder mit Genre-Kostümen`
      };
      totalScore += 0.5;
      recommendations.push('Aktiviere Genre-aware Costume Override für alle Märchen-Stories');
    }
  } else {
    details.genreCostumes = { score: 0, maxScore: 1, reason: 'Keine Prompts zu prüfen' };
  }

  return {
    phase: 'Phase 4: Image Generation',
    score: parseFloat(totalScore.toFixed(1)),
    maxScore: 10,
    details,
    issues,
    recommendations
  };
}

/**
 * Erstellt einen Gesamt-Report mit allen Phasen-Scores
 */
export function generateOverallReport(
  testId: string,
  storyId: string,
  storyTitle: string,
  config: any,
  phaseLogs: {
    phase0?: any;
    phase1?: any;
    phase2?: any;
    phase3?: any;
    phase4?: any;
  }
): OverallScoreReport {
  const phase0Score = scorePhase0(phaseLogs.phase0 || {});
  const phase1Score = scorePhase1(phaseLogs.phase1 || {});
  const phase2Score = scorePhase2(phaseLogs.phase2 || {});
  const phase3Score = scorePhase3(phaseLogs.phase3 || {});
  const phase4Score = scorePhase4(phaseLogs.phase4 || {});

  const overallScore = parseFloat(
    ((phase0Score.score + phase1Score.score + phase2Score.score + phase3Score.score + phase4Score.score) / 5).toFixed(2)
  );

  let summary = `Overall Score: ${overallScore}/10.0\n\n`;
  summary += `Phase Breakdown:\n`;
  summary += `- Phase 0 (Fairy Tale Selection): ${phase0Score.score}/10.0\n`;
  summary += `- Phase 1 (Skeleton Generation): ${phase1Score.score}/10.0\n`;
  summary += `- Phase 2 (Character Matching): ${phase2Score.score}/10.0\n`;
  summary += `- Phase 3 (Story Finalization): ${phase3Score.score}/10.0\n`;
  summary += `- Phase 4 (Image Generation): ${phase4Score.score}/10.0\n\n`;

  const allIssues = [
    ...phase0Score.issues,
    ...phase1Score.issues,
    ...phase2Score.issues,
    ...phase3Score.issues,
    ...phase4Score.issues
  ];

  if (allIssues.length > 0) {
    summary += `Critical Issues (${allIssues.length}):\n`;
    allIssues.forEach(issue => summary += `- ${issue}\n`);
  } else {
    summary += `✅ No critical issues detected!\n`;
  }

  return {
    testId,
    timestamp: new Date(),
    storyId,
    storyTitle,
    config,
    phases: {
      phase0: phase0Score,
      phase1: phase1Score,
      phase2: phase2Score,
      phase3: phase3Score,
      phase4: phase4Score
    },
    overallScore,
    summary
  };
}

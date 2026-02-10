import { useState, useCallback } from 'react';
import { useBackend } from './useBackend';
import { AvatarMemory } from '../types/avatar';

export interface MemoryEntry {
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: 'positive' | 'negative' | 'neutral';
  contentType?: 'story' | 'doku' | 'quiz' | 'activity';
  personalityChanges: Array<{
    trait: string;
    change: number;
  }>;
}

function normalizeTraitName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const TRAIT_MAPPING: Record<string, string> = {
  mut: 'courage',
  kreativitat: 'creativity',
  kreativitaet: 'creativity',
  empathie: 'empathy',
  intelligenz: 'logic',
  sozialitat: 'teamwork',
  sozialitaet: 'teamwork',
  energie: 'persistence',
  courage: 'courage',
  creativity: 'creativity',
  empathy: 'empathy',
  logic: 'logic',
  persistence: 'persistence',
  curiosity: 'curiosity',
  vocabulary: 'vocabulary',
  teamwork: 'teamwork',
};

export const useAvatarMemory = () => {
  const backend = useBackend();
  const [loading, setLoading] = useState(false);

  const addMemory = useCallback(
    async (avatarId: string, memoryEntry: MemoryEntry) => {
      try {
        setLoading(true);

        const result = await backend.avatar.addMemory({
          id: avatarId,
          storyId: memoryEntry.storyId,
          storyTitle: memoryEntry.storyTitle,
          experience: memoryEntry.experience,
          emotionalImpact: memoryEntry.emotionalImpact,
          contentType: memoryEntry.contentType,
          personalityChanges: memoryEntry.personalityChanges,
        });

        return {
          success: result.success,
          memoryId: result.memoryId,
        };
      } catch (error) {
        console.error('Error in addMemory:', error);
        return { success: false, error };
      } finally {
        setLoading(false);
      }
    },
    [backend]
  );

  const updatePersonality = useCallback(
    async (
      avatarId: string,
      personalityChanges: Array<{ trait: string; change: number }>,
      reason: string,
      storyId?: string
    ) => {
      try {
        setLoading(true);

        const backendChanges = personalityChanges.map((change) => {
          const normalizedTrait = normalizeTraitName(change.trait);
          return {
            trait: TRAIT_MAPPING[normalizedTrait] || normalizedTrait,
            change: change.change,
          };
        });

        const result = await backend.avatar.updatePersonality({
          id: avatarId,
          changes: backendChanges,
          storyId,
        });

        window.dispatchEvent(
          new CustomEvent('personalityUpdated', {
            detail: { avatarId, updatedTraits: result.updatedTraits, reason },
          })
        );

        return {
          success: true,
          updatedTraits: result.updatedTraits,
          appliedChanges: result.appliedChanges,
        };
      } catch (error) {
        console.error('Error updating personality:', error);
        return { success: false, error };
      } finally {
        setLoading(false);
      }
    },
    [backend]
  );

  const getMemories = useCallback(
    async (avatarId: string): Promise<AvatarMemory[]> => {
      try {
        setLoading(true);
        const result = await backend.avatar.getMemories({ id: avatarId });
        return result.memories;
      } catch (error) {
        console.error('Error getting memories:', error);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [backend]
  );

  const processStoryResponse = useCallback(
    async (avatarId: string, storyId: string, storyTitle: string, userChoice: string, storyContext: string) => {
      try {
        setLoading(true);

        const analysis = analyzeChoiceForPersonality(userChoice, storyContext);

        const memoryEntry: MemoryEntry = {
          storyId,
          storyTitle,
          experience: generateExperienceDescription(userChoice),
          emotionalImpact: analysis.emotionalImpact,
          contentType: 'story',
          personalityChanges: analysis.personalityChanges,
        };

        const memoryResult = await addMemory(avatarId, memoryEntry);

        const personalityResult = await updatePersonality(
          avatarId,
          analysis.personalityChanges,
          `Story choice in "${storyTitle}"`,
          storyId
        );

        return {
          success: memoryResult.success && personalityResult.success,
          memoryId: memoryResult.memoryId,
          personalityChanges: analysis.personalityChanges,
        };
      } catch (error) {
        console.error('Error processing story response:', error);
        return { success: false, error };
      } finally {
        setLoading(false);
      }
    },
    [addMemory, updatePersonality]
  );

  return {
    addMemory,
    updatePersonality,
    getMemories,
    processStoryResponse,
    loading,
  };
};

function analyzeChoiceForPersonality(choice: string, context: string) {
  const personalityChanges: Array<{ trait: string; change: number }> = [];
  let emotionalImpact: 'positive' | 'negative' | 'neutral' = 'neutral';

  const lowerChoice = choice.toLowerCase();
  const lowerContext = context.toLowerCase();
  const text = `${lowerChoice} ${lowerContext}`;

  if (text.includes('story_completed')) {
    personalityChanges.push({ trait: 'creativity', change: 2 });
    personalityChanges.push({ trait: 'empathy', change: 1 });
    emotionalImpact = 'positive';
  }

  if (/(hilf|helfen|mitgefuehl|freund)/.test(text)) {
    personalityChanges.push({ trait: 'empathy', change: 2 });
    personalityChanges.push({ trait: 'teamwork', change: 1 });
    emotionalImpact = 'positive';
  }

  if (/(mutig|kaempf|risiko|abwaeg)/.test(text)) {
    personalityChanges.push({ trait: 'courage', change: 2 });
    personalityChanges.push({ trait: 'persistence', change: 1 });
    emotionalImpact = 'positive';
  }

  if (/(denk|ueberlege|logik|strategie|plan)/.test(text)) {
    personalityChanges.push({ trait: 'logic', change: 2 });
    personalityChanges.push({ trait: 'curiosity', change: 1 });
    emotionalImpact = 'positive';
  }

  if (/(kreativ|neue idee|erfind)/.test(text)) {
    personalityChanges.push({ trait: 'creativity', change: 2 });
    personalityChanges.push({ trait: 'vocabulary', change: 1 });
    emotionalImpact = 'positive';
  }

  return {
    personalityChanges: mergeChanges(personalityChanges),
    emotionalImpact,
  };
}

function mergeChanges(changes: Array<{ trait: string; change: number }>) {
  const merged = new Map<string, number>();

  for (const change of changes) {
    const existing = merged.get(change.trait) || 0;
    merged.set(change.trait, existing + change.change);
  }

  return Array.from(merged.entries()).map(([trait, change]) => ({ trait, change }));
}

function generateExperienceDescription(choice: string) {
  const experiences = [
    `Ich habe mich entschieden: "${choice}" und dabei etwas Neues gelernt.`,
    `Meine Wahl "${choice}" hat mein Denken veraendert.`,
    `Durch "${choice}" habe ich eine neue Perspektive entdeckt.`,
    `Die Erfahrung "${choice}" hat mich weitergebracht.`,
  ];

  return experiences[Math.floor(Math.random() * experiences.length)];
}

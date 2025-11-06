import { useState, useCallback } from 'react';
import { useBackend } from './useBackend';
import { PersonalityTrait, AvatarMemory } from '../types/avatar';

export interface MemoryEntry {
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: 'positive' | 'negative' | 'neutral';
  personalityChanges: Array<{
    trait: string;
    change: number;
  }>;
}

export const useAvatarMemory = () => {
  const backend = useBackend();
  const [loading, setLoading] = useState(false);

  const addMemory = useCallback(async (avatarId: string, memoryEntry: MemoryEntry) => {
    try {
      setLoading(true);

      console.log('📝 Adding memory to database:', avatarId, memoryEntry);

      const result = await backend.avatar.addMemory({
        id: avatarId,
        storyId: memoryEntry.storyId,
        storyTitle: memoryEntry.storyTitle,
        experience: memoryEntry.experience,
        emotionalImpact: memoryEntry.emotionalImpact,
        personalityChanges: memoryEntry.personalityChanges
      });

      console.log('✅ Memory added successfully:', result);

      return {
        success: result.success,
        memoryId: result.memoryId,
      };
    } catch (error) {
      console.error('❌ Error in addMemory:', error);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  }, [backend]);

  const updatePersonality = useCallback(async (
    avatarId: string,
    personalityChanges: Array<{ trait: string; change: number }>,
    reason: string,
    storyId?: string
  ) => {
    try {
      setLoading(true);

      console.log('🎭 PERSONALITY UPDATE START (Backend Only)');
      console.log('Avatar ID:', avatarId);
      console.log('Changes:', personalityChanges);
      console.log('Reason:', reason);
      console.log('Story ID:', storyId);

      // Mapping from German frontend trait names to English backend trait names
      const traitMapping: Record<string, string> = {
        'Mut': 'courage',
        'Kreativität': 'creativity',
        'Empathie': 'empathy',
        'Intelligenz': 'intelligence',
        'Sozialität': 'strength', // Map to closest backend trait
        'Energie': 'adventure', // Map to closest backend trait
      };

      // Convert German trait changes to English backend trait names
      const backendChanges = personalityChanges.map(change => ({
        trait: traitMapping[change.trait] || change.trait.toLowerCase(),
        change: change.change
      }));

      console.log('🔄 Sending personality changes to backend:', backendChanges);

      // Update personality directly via backend API
      const result = await backend.avatar.updatePersonality({
        id: avatarId,
        changes: backendChanges,
        storyId
      });

      console.log('✅ Backend personality update successful:', result);

      // Trigger event to notify UI components to refresh
      window.dispatchEvent(new CustomEvent('personalityUpdated', {
        detail: { avatarId, updatedTraits: result.updatedTraits }
      }));

      return {
        success: true,
        updatedTraits: result.updatedTraits,
        appliedChanges: result.appliedChanges
      };
    } catch (error) {
      console.error('❌ Error updating personality:', error);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  }, [backend]);

  const getMemories = useCallback(async (avatarId: string): Promise<AvatarMemory[]> => {
    try {
      setLoading(true);

      console.log('🔍 Getting memories from database for avatar:', avatarId);

      const result = await backend.avatar.getMemories(avatarId);

      console.log('✅ Retrieved memories from database:', result.memories.length);

      return result.memories;
    } catch (error) {
      console.error('❌ Error getting memories:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [backend]);

  const processStoryResponse = useCallback(async (
    avatarId: string,
    storyId: string,
    storyTitle: string,
    userChoice: string,
    storyContext: string
  ) => {
    try {
      setLoading(true);
      
      // Analyze the story choice and context to determine personality changes
      // This would typically be done by an AI service
      console.log('Processing story response for personality development:', {
        avatarId,
        storyId,
        storyTitle,
        userChoice,
        storyContext
      });
      
      // Mock analysis - in reality this would call an AI service
      const analysis = analyzeChoiceForPersonality(userChoice, storyContext);
      
      // Create memory entry
      const memoryEntry: MemoryEntry = {
        storyId,
        storyTitle,
        experience: generateExperienceDescription(userChoice, analysis),
        emotionalImpact: analysis.emotionalImpact,
        personalityChanges: analysis.personalityChanges
      };
      
      // Add memory
      const memoryResult = await addMemory(avatarId, memoryEntry);
      
      // Update personality
      const personalityResult = await updatePersonality(
        avatarId,
        analysis.personalityChanges,
        `Story choice in "${storyTitle}"`,
        storyId
      );
      
      return {
        success: memoryResult.success && personalityResult.success,
        memoryId: memoryResult.memoryId,
        personalityChanges: analysis.personalityChanges
      };
      
    } catch (error) {
      console.error('Error processing story response:', error);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  }, [addMemory, updatePersonality]);

  return {
    addMemory,
    updatePersonality,
    getMemories,
    processStoryResponse,
    loading
  };
};

// Helper functions for personality analysis
function analyzeChoiceForPersonality(choice: string, context: string) {
  // Mock analysis - in a real implementation, this would use AI
  const personalityChanges = [];
  let emotionalImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
  
  // Simple keyword-based analysis for demonstration
  const lowerChoice = choice.toLowerCase();
  const lowerContext = context.toLowerCase();
  
  console.log('🔍 Analyzing choice for personality:', choice, context);
  
  // Story completion gets general development boost
  if (lowerChoice.includes('story_completed')) {
    personalityChanges.push({ trait: 'Kreativität', change: 2 });
    personalityChanges.push({ trait: 'Empathie', change: 1 });
    emotionalImpact = 'positive';
    console.log('📚 Story completion detected - adding creativity and empathy boost');
  }
  
  if (lowerChoice.includes('hilf') || lowerChoice.includes('helfen')) {
    personalityChanges.push({ trait: 'Empathie', change: 3 });
    personalityChanges.push({ trait: 'Sozialität', change: 2 });
    emotionalImpact = 'positive';
  }
  
  if (lowerChoice.includes('mutig') || lowerChoice.includes('kämpf')) {
    personalityChanges.push({ trait: 'Mut', change: 4 });
    personalityChanges.push({ trait: 'Energie', change: 2 });
    emotionalImpact = 'positive';
  }
  
  if (lowerChoice.includes('denk') || lowerChoice.includes('überlege')) {
    personalityChanges.push({ trait: 'Intelligenz', change: 3 });
    personalityChanges.push({ trait: 'Kreativität', change: 1 });
    emotionalImpact = 'positive';
  }
  
  if (lowerChoice.includes('kreativ') || lowerChoice.includes('neue idee')) {
    personalityChanges.push({ trait: 'Kreativität', change: 5 });
    personalityChanges.push({ trait: 'Intelligenz', change: 2 });
    emotionalImpact = 'positive';
  }
  
  return {
    personalityChanges,
    emotionalImpact
  };
}

function generateExperienceDescription(choice: string, analysis: any): string {
  const experiences = [
    `Ich habe mich entschieden: "${choice}" - Das hat meine Sichtweise verändert.`,
    `Meine Wahl "${choice}" hat mir neue Erkenntnisse gebracht.`,
    `Durch meine Entscheidung "${choice}" habe ich etwas über mich gelernt.`,
    `Die Erfahrung mit "${choice}" wird mich weiter begleiten.`
  ];
  
  return experiences[Math.floor(Math.random() * experiences.length)];
}
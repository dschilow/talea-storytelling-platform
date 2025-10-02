import { useState } from 'react';
import { useBackend } from './useBackend';
import type { Avatar } from '../types/avatar';

export interface PersonalityChange {
  trait: string;
  oldValue: number;
  newValue: number;
  change: number;
  reason: string;
}

export interface AIPersonalityAnalysisResult {
  success: boolean;
  changes: PersonalityChange[];
  summary: string;
  alreadyProcessed?: boolean;
}

export const usePersonalityAI = () => {
  const backend = useBackend();
  const [loading, setLoading] = useState(false);

  const analyzeStoryCompletion = async (
    avatar: Avatar,
    storyId: string,
    storyTitle: string,
    storyContent: string,
    learningMode?: {
      enabled: boolean;
      subjects: string[];
      difficulty: string;
      objectives: string[];
    }
  ): Promise<AIPersonalityAnalysisResult> => {
    try {
      setLoading(true);
      
      console.log('🧠 Starting KI personality analysis for story completion:', {
        avatarId: avatar.id,
        storyId,
        storyTitle
      });

      // Check if avatar already received updates from this story
      try {
        const checkData = await backend.ai.checkPersonalityUpdate({
          avatarId: avatar.id,
          contentId: storyId,
          contentType: 'story'
        });

        if (checkData.hasUpdates) {
          console.log('⚠️ Avatar already received updates from this story');
          return {
            success: false,
            changes: [],
            summary: 'Avatar hat bereits Updates von dieser Geschichte erhalten',
            alreadyProcessed: true
          };
        }
      } catch (checkError) {
        console.log('Check error (continuing anyway):', checkError);
      }

      // Perform KI analysis
      const analysisData = await backend.ai.analyzePersonalityDevelopment({
        avatarId: avatar.id,
        avatarProfile: {
          name: avatar.name,
          description: avatar.description || '',
          currentPersonality: (avatar as any).personalityTraits || {
            'Mut': 50,
            'Kreativität': 50,
            'Empathie': 50,
            'Intelligenz': 50,
            'Sozialität': 50,
            'Energie': 50
          }
        },
        contentType: 'story',
        contentData: {
          title: storyTitle,
          storyContent,
          learningMode: learningMode ? {
            enabled: learningMode.enabled,
            subjects: learningMode.subjects,
            difficulty: learningMode.difficulty,
            objectives: (learningMode as any).learningObjectives || []
          } : undefined
        }
      });
      
      if (analysisData.success && analysisData.changes.length > 0) {
        // Track that this avatar received updates from this story
        try {
          await backend.ai.trackPersonalityUpdate({
            avatarId: avatar.id,
            contentId: storyId,
            contentType: 'story',
            contentTitle: storyTitle,
            changes: analysisData.changes
          });
        } catch (trackError) {
          console.log('Track error (continuing anyway):', trackError);
        }
        
        console.log('✅ KI personality analysis completed:', analysisData.changes.length, 'changes');
      }

      return {
        success: analysisData.success,
        changes: analysisData.changes || [],
        summary: analysisData.summary || 'KI-Analyse abgeschlossen'
      };

    } catch (error) {
      console.error('❌ Error in KI personality analysis:', error);
      return {
        success: false,
        changes: [],
        summary: 'Fehler bei der KI-Analyse'
      };
    } finally {
      setLoading(false);
    }
  };

  const analyzeDokuCompletion = async (
    avatar: Avatar,
    dokuId: string,
    dokuTitle: string,
    dokuSections: Array<{
      title: string;
      content: string;
      topic: string;
    }>,
    learningMode?: {
      enabled: boolean;
      subjects: string[];
      difficulty: string;
      objectives: string[];
    }
  ): Promise<AIPersonalityAnalysisResult> => {
    try {
      setLoading(true);

      console.log('🧠 Starting KI personality analysis for doku completion:', {
        avatarId: avatar.id,
        dokuId,
        dokuTitle
      });

      // Check if already processed
      try {
        const checkData = await backend.ai.checkPersonalityUpdate({
          avatarId: avatar.id,
          contentId: dokuId,
          contentType: 'doku'
        });

        if (checkData.hasUpdates) {
          console.log('⚠️ Avatar already received updates from this doku');
          return {
            success: false,
            changes: [],
            summary: 'Avatar hat bereits Updates von dieser Doku erhalten',
            alreadyProcessed: true
          };
        }
      } catch (checkError) {
        console.log('Check error (continuing anyway):', checkError);
      }

      // Perform KI analysis
      const analysisData = await backend.ai.analyzePersonalityDevelopment({
        avatarId: avatar.id,
        avatarProfile: {
          name: avatar.name,
          description: avatar.description || '',
          currentPersonality: (avatar as any).personalityTraits || {
            'Mut': 50,
            'Kreativität': 50,
            'Empathie': 50,
            'Intelligenz': 50,
            'Sozialität': 50,
            'Energie': 50
          }
        },
        contentType: 'doku',
        contentData: {
          title: dokuTitle,
          dokuSections,
          learningMode
        }
      });
      
      if (analysisData.success && analysisData.changes.length > 0) {
        // Track the update
        try {
          await backend.ai.trackPersonalityUpdate({
            avatarId: avatar.id,
            contentId: dokuId,
            contentType: 'doku',
            contentTitle: dokuTitle,
            changes: analysisData.changes
          });
        } catch (trackError) {
          console.log('Track error (continuing anyway):', trackError);
        }
        
        console.log('✅ KI doku analysis completed:', analysisData.changes.length, 'changes');
      }

      return {
        success: analysisData.success,
        changes: analysisData.changes || [],
        summary: analysisData.summary || 'KI-Analyse abgeschlossen'
      };

    } catch (error) {
      console.error('❌ Error in KI doku analysis:', error);
      return {
        success: false,
        changes: [],
        summary: 'Fehler bei der KI-Analyse'
      };
    } finally {
      setLoading(false);
    }
  };

  const analyzeQuizCompletion = async (
    avatar: Avatar,
    dokuId: string,
    quizTopic: string,
    questions: Array<{
      question: string;
      correctAnswer: string;
      userAnswer: string;
      isCorrect: boolean;
    }>,
    score: number
  ): Promise<AIPersonalityAnalysisResult> => {
    try {
      setLoading(true);

      const quizId = `${dokuId}_quiz_${quizTopic}`;

      console.log('🧠 Starting KI personality analysis for quiz completion:', {
        avatarId: avatar.id,
        quizId,
        quizTopic,
        score
      });

      // Check if already processed
      try {
        const checkData = await backend.ai.checkPersonalityUpdate({
          avatarId: avatar.id,
          contentId: quizId,
          contentType: 'quiz'
        });

        if (checkData.hasUpdates) {
          console.log('⚠️ Avatar already received updates from this quiz');
          return {
            success: false,
            changes: [],
            summary: 'Avatar hat bereits Updates von diesem Quiz erhalten',
            alreadyProcessed: true
          };
        }
      } catch (checkError) {
        console.log('Check error (continuing anyway):', checkError);
      }

      // Perform KI analysis
      const analysisData = await backend.ai.analyzePersonalityDevelopment({
        avatarId: avatar.id,
        avatarProfile: {
          name: avatar.name,
          description: avatar.description || '',
          currentPersonality: (avatar as any).personalityTraits || {
            'Mut': 50,
            'Kreativität': 50,
            'Empathie': 50,
            'Intelligenz': 50,
            'Sozialität': 50,
            'Energie': 50
          }
        },
        contentType: 'quiz',
        contentData: {
          title: `Quiz: ${quizTopic}`,
          quizData: {
            topic: quizTopic,
            questions,
            score
          }
        }
      });
      
      if (analysisData.success && analysisData.changes.length > 0) {
        // Track the update
        try {
          await backend.ai.trackPersonalityUpdate({
            avatarId: avatar.id,
            contentId: quizId,
            contentType: 'quiz',
            contentTitle: `Quiz: ${quizTopic}`,
            changes: analysisData.changes
          });
        } catch (trackError) {
          console.log('Track error (continuing anyway):', trackError);
        }
        
        console.log('✅ KI quiz analysis completed:', analysisData.changes.length, 'changes');
      }

      return {
        success: analysisData.success,
        changes: analysisData.changes || [],
        summary: analysisData.summary || 'KI-Analyse abgeschlossen'
      };

    } catch (error) {
      console.error('❌ Error in KI quiz analysis:', error);
      return {
        success: false,
        changes: [],
        summary: 'Fehler bei der KI-Analyse'
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    analyzeStoryCompletion,
    analyzeDokuCompletion,
    analyzeQuizCompletion,
    loading
  };
};
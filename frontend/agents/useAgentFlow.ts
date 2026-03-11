import { useCallback } from 'react';
import type { AgentResult } from '../types/agent';
import { useAgents, emitAgentEvent } from './AgentContext';
import type { StoryGenerationStep } from '../components/story/StoryGenerationProgress';

/**
 * Maps real StoryGenerationProgress phases to contextual agents.
 * Each generation phase shows the right agent doing the right thing —
 * no static list, no decoration.
 */
export function useStoryAgentFlow() {
  const { showAgent, hideAgent, hideAll, addResult } = useAgents();

  /** Call when generation phase changes. Shows only the relevant agent(s). */
  const onPhaseChange = useCallback((phase: StoryGenerationStep) => {
    // Clear previous agents before showing the new one
    hideAll();

    switch (phase) {
      case 'profiles':
        showAgent('tavi', 'preparing', 'Tavi sammelt deine Wünsche …');
        break;

      case 'memories':
        showAgent('fluesterfeder', 'active', 'Die Flüsterfeder erinnert sich an frühere Abenteuer …');
        emitAgentEvent('story_generation_started', 'fluesterfeder');
        break;

      case 'text':
        showAgent('sternenweber', 'active', 'Der Sternenweber webt dein Abenteuer …');
        emitAgentEvent('story_plan_created', 'sternenweber');
        break;

      case 'validation':
        showAgent('traumwaechter', 'active', 'Der Traumwächter macht alles sanft und passend …');
        emitAgentEvent('content_checked', 'traumwaechter');
        break;

      case 'images':
        showAgent('artefaktschmied', 'active', 'Der Artefaktschmied gestaltet die Bilder deines Abenteuers …');
        break;

      case 'complete':
        showAgent('tavi', 'success', 'Dein Abenteuer ist bereit!');
        emitAgentEvent('story_generation_complete', 'tavi');
        break;
    }
  }, [showAgent, hideAll]);

  /** Call when story is fully ready and user will navigate to reader. */
  const onStoryReady = useCallback(() => {
    hideAll();
  }, [hideAll]);

  return { onPhaseChange, onStoryReady };
}

/**
 * Shows result cards after a story is completed (read to the end).
 */
export function usePostStoryFlow() {
  const { addResult, hideAll, showAgent } = useAgents();

  const showCompletionResults = useCallback((options?: {
    hasMemory?: boolean;
    quizCount?: number;
    artifactName?: string;
    storyId?: string;
  }) => {
    hideAll();

    const results: AgentResult[] = [];

    // Memory saved
    if (options?.hasMemory !== false) {
      results.push({
        agentId: 'fluesterfeder',
        headline: 'Deine Reise wurde im Erinnerungsbuch notiert.',
        body: 'Bei deinem nächsten Abenteuer wird die Flüsterfeder sich daran erinnern.',
        timestamp: Date.now(),
      });
    }

    // Quiz ready
    if (options?.quizCount && options.quizCount > 0) {
      results.push({
        agentId: 'funkenwerkstatt',
        headline: `Die Funkenwerkstatt hat ${options.quizCount} Fragen vorbereitet.`,
        cta: { label: 'Jetzt entdecken', action: 'open-quiz' },
        timestamp: Date.now() + 1,
      });
    }

    // Artifact
    if (options?.artifactName) {
      results.push({
        agentId: 'artefaktschmied',
        headline: `Neue Belohnung: ${options.artifactName}`,
        body: 'Der Artefaktschmied hat etwas aus deinem Abenteuer geformt.',
        timestamp: Date.now() + 2,
      });
    }

    // Next adventure
    results.push({
      agentId: 'pfadfinder',
      headline: 'Der Pfadfinder hat neue Reisen entdeckt.',
      cta: { label: 'Neue Reise starten', action: 'navigate', payload: { to: '/story' } },
      timestamp: Date.now() + 3,
    });

    results.forEach(r => addResult(r));
  }, [addResult, hideAll]);

  return { showCompletionResults };
}

/**
 * Creates parent-facing insight data for Leuchtglas.
 */
export function buildParentInsights(options?: {
  memoriesUsed?: boolean;
  safetyChecked?: boolean;
  traitsUpdated?: string[];
  quizAvailable?: boolean;
}): Array<{ agentId: 'leuchtglas' | 'traumwaechter' | 'fluesterfeder'; text: string }> {
  const insights: Array<{ agentId: 'leuchtglas' | 'traumwaechter' | 'fluesterfeder'; text: string }> = [];

  if (options?.memoriesUsed) {
    insights.push({
      agentId: 'fluesterfeder',
      text: 'Frühere Erlebnisse wurden für diese Geschichte berücksichtigt.',
    });
  }

  if (options?.safetyChecked !== false) {
    insights.push({
      agentId: 'traumwaechter',
      text: 'Inhalt altersgerecht geprüft und angepasst.',
    });
  }

  if (options?.traitsUpdated && options.traitsUpdated.length > 0) {
    insights.push({
      agentId: 'leuchtglas',
      text: `Heute wurde besonders geübt: ${options.traitsUpdated.join(', ')}.`,
    });
  }

  if (options?.quizAvailable) {
    insights.push({
      agentId: 'leuchtglas',
      text: 'Lernfragen stehen bereit, um das Erlebte zu vertiefen.',
    });
  }

  return insights;
}

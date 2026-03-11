import { useCallback } from 'react';
import type { AgentEvent, AgentId } from '../types/agent';
import { useAgents, emitAgentEvent } from './AgentContext';
import { agentsByEvent } from './registry';

interface FlowStep {
  agentId: AgentId;
  event: AgentEvent;
  preparingMessage?: string;
  activeMessage?: string;
  successMessage?: string;
  duration?: number;
}

export function useAgentFlow() {
  const { setAgentState, resetAgent, resetAll } = useAgents();

  const runStep = useCallback(async (step: FlowStep) => {
    setAgentState(step.agentId, 'preparing', step.preparingMessage);
    emitAgentEvent(step.event, step.agentId);

    await wait(400);
    setAgentState(step.agentId, 'active', step.activeMessage);

    if (step.duration) await wait(step.duration);
  }, [setAgentState]);

  const completeStep = useCallback((step: Pick<FlowStep, 'agentId' | 'event'>, message?: string) => {
    setAgentState(step.agentId, 'success', message);
    emitAgentEvent(step.event, step.agentId);
  }, [setAgentState]);

  const runSequence = useCallback(async (
    steps: FlowStep[],
    onStepComplete?: (step: FlowStep, index: number) => void | Promise<void>,
  ) => {
    for (let i = 0; i < steps.length; i++) {
      await runStep(steps[i]);
      if (steps[i].duration) {
        setAgentState(steps[i].agentId, 'success', steps[i].successMessage);
      }
      await onStepComplete?.(steps[i], i);
    }
  }, [runStep, setAgentState]);

  const triggerEvent = useCallback((event: AgentEvent, data?: Record<string, unknown>) => {
    const agents = agentsByEvent(event);
    agents.forEach(a => {
      setAgentState(a.id, 'active');
      emitAgentEvent(event, a.id, data);
    });
  }, [setAgentState]);

  const storyGenerationFlow = useCallback(() => ({
    start: () => {
      setAgentState('sternenweber', 'preparing', 'Der Sternenweber sammelt Ideen …');
      setAgentState('traumwaechter', 'preparing');
      emitAgentEvent('story_generation_started', 'sternenweber');
    },
    planReady: () => {
      setAgentState('sternenweber', 'active', 'Der Sternenweber webt deine nächste Reise …');
      setAgentState('traumwaechter', 'active', 'Der Traumwächter macht alles sanft und passend …');
      emitAgentEvent('story_plan_created', 'sternenweber');
    },
    generating: () => {
      setAgentState('tavi', 'active', 'Tavi kümmert sich darum …');
      setAgentState('sternenweber', 'active', 'Fäden aus Sternenstaub verbinden sich …');
    },
    complete: () => {
      setAgentState('sternenweber', 'success', 'Der Sternenweber hat dein Abenteuer gewoben!');
      setAgentState('traumwaechter', 'success', 'Der Traumwächter ist zufrieden – alles passt!');
      setAgentState('tavi', 'success', 'Alles ist bereit für dich!');
      setAgentState('fluesterfeder', 'active', 'Die Flüsterfeder notiert dein Abenteuer …');
      emitAgentEvent('story_generation_complete', 'sternenweber');
    },
    memorySaved: () => {
      setAgentState('fluesterfeder', 'success', 'Deine Erinnerung ist sicher aufbewahrt.');
      emitAgentEvent('memory_saved', 'fluesterfeder');
    },
    reset: () => {
      resetAgent('tavi');
      resetAgent('sternenweber');
      resetAgent('traumwaechter');
      resetAgent('fluesterfeder');
    },
  }), [setAgentState, resetAgent]);

  const quizFlow = useCallback(() => ({
    start: () => {
      setAgentState('funkenwerkstatt', 'preparing', 'Die Funkenwerkstatt heizt sich auf …');
    },
    generating: () => {
      setAgentState('funkenwerkstatt', 'active', 'Funken der Neugier fliegen umher …');
    },
    complete: () => {
      setAgentState('funkenwerkstatt', 'success', 'Neue Fragen warten auf dich!');
      emitAgentEvent('quiz_created', 'funkenwerkstatt');
    },
    reset: () => resetAgent('funkenwerkstatt'),
  }), [setAgentState, resetAgent]);

  const rewardFlow = useCallback(() => ({
    start: () => {
      setAgentState('artefaktschmied', 'preparing', 'Der Artefaktschmied wählt sein Material …');
    },
    forging: () => {
      setAgentState('artefaktschmied', 'active', 'Der Artefaktschmied formt eine neue Belohnung …');
    },
    complete: () => {
      setAgentState('artefaktschmied', 'success', 'Der Artefaktschmied hat ein Artefakt geschaffen!');
      emitAgentEvent('reward_created', 'artefaktschmied');
    },
    reset: () => resetAgent('artefaktschmied'),
  }), [setAgentState, resetAgent]);

  return {
    runStep,
    completeStep,
    runSequence,
    triggerEvent,
    resetAll,
    storyGenerationFlow,
    quizFlow,
    rewardFlow,
  };
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

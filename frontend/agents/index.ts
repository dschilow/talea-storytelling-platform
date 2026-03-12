// ─── Types ──────────────────────────────────────────────────────
export type {
  AgentId,
  AgentPhase,
  AgentSize,
  AgentFeatureArea,
  AgentAnimationType,
  AgentEvent,
  AgentColorPalette,
  AgentMessages,
  AgentDefinition,
  AgentLiveState,
  AgentResult,
  AgentSession,
  FlowId,
  FlowStep,
  AgentEventPayload,
  // Legacy compat aliases
  AgentState,
  AgentStatusMessages,
  AgentContext,
} from '../types/agent';

// ─── Registry ───────────────────────────────────────────────────
export {
  agentDefinitions,
  agentList,
  getAgent,
  pickMessage,
  getRandomStatusMessage,
} from './registry';

// ─── Context & Hooks ────────────────────────────────────────────
export {
  AgentProvider,
  useAgents,
  useAgent,
  subscribeAgentEvent,
  emitAgentEvent,
} from './AgentContext';

// ─── Flow Hooks ─────────────────────────────────────────────────
export {
  useStoryAgentFlow,
  usePostStoryFlow,
  buildParentInsights,
} from './useAgentFlow';

// ─── Icons ──────────────────────────────────────────────────────
export { AgentIcon } from './icons/AgentIcons';
export {
  Tavi,
  Fluesterfeder,
  Sternenweber,
  Traumwaechter,
  Funkenwerkstatt,
  Artefaktschmied,
  Pfadfinder,
  Leuchtglas,
} from './icons/AgentIcons';

// ─── Animations ─────────────────────────────────────────────────
export { AgentAnimation } from './animations/AgentAnimations';

// ─── UI Components (contextual) ─────────────────────────────────
export { ActiveAgentStack } from './components/ActiveAgentStack';
export { AgentResultCard } from './components/AgentResultCard';
export { AgentResultFeed } from './components/AgentResultFeed';
export { ParentInsightCard } from './components/ParentInsightCard';

// ─── UI Components (building blocks) ────────────────────────────
export { AgentBadge } from './components/AgentBadge';
export { AgentStatusLine } from './components/AgentStatusLine';
export { AgentLoader } from './components/AgentLoader';
export { AgentPulse } from './components/AgentPulse';
export { AgentCard } from './components/AgentCard';
export { AgentInlineHint } from './components/AgentInlineHint';
export { AgentOverlay } from './components/AgentOverlay';
export { TaviHomeGreeting } from './components/TaviHomeGreeting';

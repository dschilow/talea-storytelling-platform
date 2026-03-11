// Types
export type {
  AgentId,
  AgentState,
  AgentSize,
  AgentContext,
  AgentFeatureArea,
  AgentAnimationType,
  AgentEvent,
  AgentColorPalette,
  AgentStatusMessages,
  AgentDefinition,
  AgentRuntimeState,
  AgentEventPayload,
} from '../types/agent';

// Registry
export {
  agentDefinitions,
  agentList,
  primaryAgents,
  agentsByFeature,
  agentsByEvent,
  getAgent,
  getRandomStatusMessage,
} from './registry';

// Context & Hooks
export {
  AgentProvider,
  useAgents,
  useAgent,
  subscribeAgentEvent,
  emitAgentEvent,
} from './AgentContext';
export { useAgentFlow } from './useAgentFlow';

// Icons
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

// Animations
export { AgentAnimation } from './animations/AgentAnimations';

// UI Components
export { AgentBadge } from './components/AgentBadge';
export { AgentStatusLine } from './components/AgentStatusLine';
export { AgentLoader } from './components/AgentLoader';
export { AgentPulse } from './components/AgentPulse';
export { AgentCard } from './components/AgentCard';
export { AgentInlineHint } from './components/AgentInlineHint';
export { AgentOverlay } from './components/AgentOverlay';

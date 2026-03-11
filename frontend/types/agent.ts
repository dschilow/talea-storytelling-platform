export type AgentId =
  | 'tavi'
  | 'fluesterfeder'
  | 'sternenweber'
  | 'traumwaechter'
  | 'funkenwerkstatt'
  | 'artefaktschmied'
  | 'pfadfinder'
  | 'leuchtglas';

export type AgentState =
  | 'idle'
  | 'preparing'
  | 'active'
  | 'success'
  | 'warning'
  | 'completed'
  | 'hidden';

export type AgentSize = 'small' | 'medium' | 'large';

export type AgentContext =
  | 'inline'
  | 'button'
  | 'loading'
  | 'panel'
  | 'reward'
  | 'parent-dashboard'
  | 'story-start'
  | 'story-finish';

export type AgentFeatureArea =
  | 'orchestration'
  | 'memory'
  | 'story-planning'
  | 'safety'
  | 'quiz'
  | 'rewards'
  | 'recommendations'
  | 'parent-insight';

export type AgentAnimationType =
  | 'float-pulse'
  | 'feather-trail'
  | 'star-connect'
  | 'shield-glow'
  | 'spark-bounce'
  | 'crystal-forge'
  | 'compass-spin'
  | 'lens-shimmer';

export type AgentEvent =
  | 'story_generation_started'
  | 'story_plan_created'
  | 'story_generation_complete'
  | 'memory_saved'
  | 'content_checked'
  | 'quiz_created'
  | 'reward_created'
  | 'recommendations_ready'
  | 'parent_summary_ready'
  | 'doku_generation_started'
  | 'doku_generation_complete';

export interface AgentColorPalette {
  primary: string;
  secondary: string;
  glow: string;
  bg: string;
  bgSubtle: string;
  text: string;
  border: string;
  gradient: string;
  darkPrimary: string;
  darkGlow: string;
  darkBg: string;
}

export interface AgentStatusMessages {
  idle: string[];
  preparing: string[];
  active: string[];
  success: string[];
  warning: string[];
}

export interface AgentDefinition {
  id: AgentId;
  name: string;
  title: string;
  role: string;
  description: string;
  tone: string;
  colorPalette: AgentColorPalette;
  animationType: AgentAnimationType;
  statusMessages: AgentStatusMessages;
  visibilityLevel: 'always' | 'contextual' | 'background';
  featureArea: AgentFeatureArea;
  isPrimary: boolean;
  futureCharacterCapable: boolean;
  events: AgentEvent[];
}

export interface AgentRuntimeState {
  agentId: AgentId;
  state: AgentState;
  message?: string;
  progress?: number;
  data?: Record<string, unknown>;
}

export interface AgentEventPayload {
  event: AgentEvent;
  agentId: AgentId;
  timestamp: number;
  data?: Record<string, unknown>;
}

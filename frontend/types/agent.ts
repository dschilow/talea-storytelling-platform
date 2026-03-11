// ─── Agent Identity ───────────────────────────────────────────────

export type AgentId =
  | 'tavi'
  | 'fluesterfeder'
  | 'sternenweber'
  | 'traumwaechter'
  | 'funkenwerkstatt'
  | 'artefaktschmied'
  | 'pfadfinder'
  | 'leuchtglas';

export type AgentSize = 'small' | 'medium' | 'large';

export type AgentAnimationType =
  | 'float-pulse'
  | 'feather-trail'
  | 'star-connect'
  | 'shield-glow'
  | 'spark-bounce'
  | 'crystal-forge'
  | 'compass-spin'
  | 'lens-shimmer';

export type AgentFeatureArea =
  | 'orchestration'
  | 'memory'
  | 'story-planning'
  | 'safety'
  | 'quiz'
  | 'rewards'
  | 'recommendations'
  | 'parent-insight';

// ─── Presentation States ──────────────────────────────────────────
// An agent is either not visible or going through a phase sequence.

export type AgentPhase =
  | 'hidden'     // not rendered at all
  | 'preparing'  // fading in, short teaser text
  | 'active'     // main animation + status line
  | 'success'    // brief celebration, then fades
  | 'result';    // shows result card (stays until dismissed)

// ─── Color & Visual ──────────────────────────────────────────────

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

// ─── Agent Definition (registry) ─────────────────────────────────

export interface AgentMessages {
  preparing: string[];
  active: string[];
  success: string[];
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
  messages: AgentMessages;
  featureArea: AgentFeatureArea;
  isPrimary: boolean;
  targetAudience: 'child' | 'parent' | 'both';
}

// ─── Runtime: what a single agent is doing right now ─────────────

export interface AgentLiveState {
  agentId: AgentId;
  phase: AgentPhase;
  message: string;
}

// ─── Result: the visible output after an agent finished ──────────

export interface AgentResult {
  agentId: AgentId;
  headline: string;
  body?: string;
  cta?: { label: string; action: string; payload?: Record<string, unknown> };
  timestamp: number;
}

// ─── Session: a group of agents working together on one flow ─────

export type FlowId =
  | 'story-generation'
  | 'story-completion'
  | 'quiz-generation'
  | 'reward-reveal'
  | 'recommendations'
  | 'parent-summary'
  | 'doku-generation';

export interface FlowStep {
  agentId: AgentId;
  phase: Exclude<AgentPhase, 'hidden' | 'result'>;
  message: string;
  /** ms to stay in this phase before auto-transitioning (0 = manual) */
  duration: number;
}

export interface AgentSession {
  flowId: FlowId;
  steps: FlowStep[];
  currentIndex: number;
  results: AgentResult[];
  isComplete: boolean;
}

// ─── Events (for loose coupling to backend) ──────────────────────

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

export interface AgentEventPayload {
  event: AgentEvent;
  agentId: AgentId;
  timestamp: number;
  data?: Record<string, unknown>;
}

// ─── Legacy compat aliases (used by existing components) ─────────

export type AgentState = AgentPhase;
export type AgentStatusMessages = AgentMessages & { idle: string[]; warning: string[] };
export type AgentContext =
  | 'inline' | 'button' | 'loading' | 'panel'
  | 'reward' | 'parent-dashboard' | 'story-start' | 'story-finish';

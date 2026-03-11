import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type {
  AgentEvent,
  AgentEventPayload,
  AgentId,
  AgentRuntimeState,
  AgentState,
} from '../types/agent';
import { agentDefinitions, getRandomStatusMessage } from './registry';

type AgentStateMap = Partial<Record<AgentId, AgentRuntimeState>>;

type AgentAction =
  | { type: 'SET_STATE'; agentId: AgentId; state: AgentState; message?: string; progress?: number; data?: Record<string, unknown> }
  | { type: 'RESET'; agentId: AgentId }
  | { type: 'RESET_ALL' };

interface AgentContextValue {
  agents: AgentStateMap;
  setAgentState: (agentId: AgentId, state: AgentState, message?: string) => void;
  resetAgent: (agentId: AgentId) => void;
  resetAll: () => void;
  getAgentState: (agentId: AgentId) => AgentRuntimeState;
  isAgentActive: (agentId: AgentId) => boolean;
  dispatch: (action: AgentAction) => void;
}

type EventListener = (payload: AgentEventPayload) => void;
const eventListeners = new Map<AgentEvent, Set<EventListener>>();

export function subscribeAgentEvent(event: AgentEvent, listener: EventListener) {
  if (!eventListeners.has(event)) eventListeners.set(event, new Set());
  eventListeners.get(event)!.add(listener);
  return () => { eventListeners.get(event)?.delete(listener); };
}

export function emitAgentEvent(event: AgentEvent, agentId: AgentId, data?: Record<string, unknown>) {
  const payload: AgentEventPayload = { event, agentId, timestamp: Date.now(), data };
  eventListeners.get(event)?.forEach(fn => fn(payload));
}

const defaultRuntime = (agentId: AgentId): AgentRuntimeState => ({
  agentId,
  state: 'idle',
  message: getRandomStatusMessage(agentId, 'idle'),
});

function agentReducer(state: AgentStateMap, action: AgentAction): AgentStateMap {
  switch (action.type) {
    case 'SET_STATE': {
      const def = agentDefinitions[action.agentId];
      const stateKey = action.state === 'completed' ? 'success' : action.state === 'hidden' ? 'idle' : action.state;
      const message = action.message ?? getRandomStatusMessage(action.agentId, stateKey as keyof typeof def.statusMessages);
      return {
        ...state,
        [action.agentId]: {
          agentId: action.agentId,
          state: action.state,
          message,
          progress: action.progress,
          data: action.data,
        },
      };
    }
    case 'RESET': {
      const next = { ...state };
      delete next[action.agentId];
      return next;
    }
    case 'RESET_ALL':
      return {};
    default:
      return state;
  }
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agents, dispatch] = useReducer(agentReducer, {});

  const setAgentState = useCallback((agentId: AgentId, state: AgentState, message?: string) => {
    dispatch({ type: 'SET_STATE', agentId, state, message });
  }, []);

  const resetAgent = useCallback((agentId: AgentId) => {
    dispatch({ type: 'RESET', agentId });
  }, []);

  const resetAll = useCallback(() => {
    dispatch({ type: 'RESET_ALL' });
  }, []);

  const getAgentState = useCallback((agentId: AgentId): AgentRuntimeState => {
    return agents[agentId] ?? defaultRuntime(agentId);
  }, [agents]);

  const isAgentActive = useCallback((agentId: AgentId): boolean => {
    const s = agents[agentId]?.state;
    return s === 'preparing' || s === 'active';
  }, [agents]);

  const value = useMemo<AgentContextValue>(() => ({
    agents,
    setAgentState,
    resetAgent,
    resetAll,
    getAgentState,
    isAgentActive,
    dispatch,
  }), [agents, setAgentState, resetAgent, resetAll, getAgentState, isAgentActive]);

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgents() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgents must be used within <AgentProvider>');
  return ctx;
}

export function useAgent(agentId: AgentId) {
  const { getAgentState, setAgentState, resetAgent, isAgentActive } = useAgents();
  const runtime = getAgentState(agentId);
  const definition = agentDefinitions[agentId];

  return useMemo(() => ({
    ...runtime,
    definition,
    isActive: isAgentActive(agentId),
    setState: (state: AgentState, message?: string) => setAgentState(agentId, state, message),
    reset: () => resetAgent(agentId),
  }), [runtime, definition, agentId, isAgentActive, setAgentState, resetAgent]);
}

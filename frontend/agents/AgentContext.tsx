import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type {
  AgentId,
  AgentLiveState,
  AgentPhase,
  AgentResult,
  AgentSession,
  FlowId,
  FlowStep,
} from '../types/agent';
import { pickMessage } from './registry';

// ─── State shape ─────────────────────────────────────────────────

interface AgentStore {
  live: AgentLiveState[];
  results: AgentResult[];
  session: AgentSession | null;
}

const initialState: AgentStore = { live: [], results: [], session: null };

// ─── Actions ─────────────────────────────────────────────────────

type Action =
  | { type: 'SHOW_AGENT'; agentId: AgentId; phase: AgentPhase; message: string }
  | { type: 'HIDE_AGENT'; agentId: AgentId }
  | { type: 'HIDE_ALL' }
  | { type: 'ADD_RESULT'; result: AgentResult }
  | { type: 'DISMISS_RESULT'; index: number }
  | { type: 'CLEAR_RESULTS' }
  | { type: 'SET_SESSION'; session: AgentSession }
  | { type: 'ADVANCE_SESSION' }
  | { type: 'COMPLETE_SESSION'; results: AgentResult[] }
  | { type: 'CLEAR_SESSION' };

function reducer(state: AgentStore, action: Action): AgentStore {
  switch (action.type) {
    case 'SHOW_AGENT': {
      const existing = state.live.findIndex(a => a.agentId === action.agentId);
      const entry: AgentLiveState = {
        agentId: action.agentId,
        phase: action.phase,
        message: action.message,
      };
      const next = [...state.live];
      if (existing >= 0) {
        next[existing] = entry;
      } else {
        if (next.length >= 3) next.shift();
        next.push(entry);
      }
      return { ...state, live: next };
    }
    case 'HIDE_AGENT':
      return { ...state, live: state.live.filter(a => a.agentId !== action.agentId) };
    case 'HIDE_ALL':
      return { ...state, live: [] };
    case 'ADD_RESULT':
      return { ...state, results: [...state.results, action.result] };
    case 'DISMISS_RESULT':
      return { ...state, results: state.results.filter((_, i) => i !== action.index) };
    case 'CLEAR_RESULTS':
      return { ...state, results: [] };
    case 'SET_SESSION':
      return { ...state, session: action.session };
    case 'ADVANCE_SESSION': {
      if (!state.session) return state;
      const next = state.session.currentIndex + 1;
      if (next >= state.session.steps.length) return state;
      return { ...state, session: { ...state.session, currentIndex: next } };
    }
    case 'COMPLETE_SESSION':
      return {
        ...state,
        session: state.session ? { ...state.session, isComplete: true } : null,
        results: [...state.results, ...action.results],
      };
    case 'CLEAR_SESSION':
      return { ...state, session: null };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────

interface AgentContextValue {
  store: AgentStore;
  showAgent: (agentId: AgentId, phase: Exclude<AgentPhase, 'hidden'>, message?: string) => void;
  hideAgent: (agentId: AgentId) => void;
  hideAll: () => void;
  addResult: (result: AgentResult) => void;
  dismissResult: (index: number) => void;
  clearResults: () => void;
  startSession: (flowId: FlowId, steps: FlowStep[], results?: AgentResult[]) => void;
  advanceSession: () => void;
  completeSession: (results?: AgentResult[]) => void;
  clearSession: () => void;
  dispatch: (action: Action) => void;
}

const Ctx = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(reducer, initialState);

  const showAgent = useCallback((agentId: AgentId, phase: Exclude<AgentPhase, 'hidden'>, message?: string) => {
    const msg = message ?? pickMessage(agentId, phase === 'result' ? 'success' : phase);
    dispatch({ type: 'SHOW_AGENT', agentId, phase, message: msg });
  }, []);

  const hideAgent = useCallback((agentId: AgentId) => dispatch({ type: 'HIDE_AGENT', agentId }), []);
  const hideAll = useCallback(() => dispatch({ type: 'HIDE_ALL' }), []);
  const addResult = useCallback((r: AgentResult) => dispatch({ type: 'ADD_RESULT', result: r }), []);
  const dismissResult = useCallback((i: number) => dispatch({ type: 'DISMISS_RESULT', index: i }), []);
  const clearResults = useCallback(() => dispatch({ type: 'CLEAR_RESULTS' }), []);

  const startSession = useCallback((flowId: FlowId, steps: FlowStep[], results?: AgentResult[]) => {
    dispatch({
      type: 'SET_SESSION',
      session: { flowId, steps, currentIndex: 0, results: results ?? [], isComplete: false },
    });
    if (steps.length > 0) {
      dispatch({ type: 'SHOW_AGENT', agentId: steps[0].agentId, phase: steps[0].phase, message: steps[0].message });
    }
  }, []);

  const advanceSession = useCallback(() => dispatch({ type: 'ADVANCE_SESSION' }), []);
  const completeSession = useCallback((results?: AgentResult[]) => dispatch({ type: 'COMPLETE_SESSION', results: results ?? [] }), []);
  const clearSession = useCallback(() => { dispatch({ type: 'CLEAR_SESSION' }); dispatch({ type: 'HIDE_ALL' }); }, []);

  const value = useMemo<AgentContextValue>(() => ({
    store, showAgent, hideAgent, hideAll, addResult, dismissResult, clearResults,
    startSession, advanceSession, completeSession, clearSession, dispatch,
  }), [store, showAgent, hideAgent, hideAll, addResult, dismissResult, clearResults, startSession, advanceSession, completeSession, clearSession]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgents() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAgents must be used within <AgentProvider>');
  return ctx;
}

// Legacy compat
export function useAgent(agentId: AgentId) {
  const { store, showAgent, hideAgent } = useAgents();
  const live = store.live.find(a => a.agentId === agentId);
  return {
    agentId,
    state: live?.phase ?? ('hidden' as AgentPhase),
    message: live?.message,
    isActive: live?.phase === 'preparing' || live?.phase === 'active',
    setState: (phase: AgentPhase, message?: string) => {
      if (phase === 'hidden') hideAgent(agentId);
      else showAgent(agentId, phase, message);
    },
    reset: () => hideAgent(agentId),
  };
}

// Event bus
type EventListener = (payload: { event: string; agentId: AgentId; timestamp: number; data?: Record<string, unknown> }) => void;
const eventListeners = new Map<string, Set<EventListener>>();

export function subscribeAgentEvent(event: string, listener: EventListener) {
  if (!eventListeners.has(event)) eventListeners.set(event, new Set());
  eventListeners.get(event)!.add(listener);
  return () => { eventListeners.get(event)?.delete(listener); };
}

export function emitAgentEvent(event: string, agentId: AgentId, data?: Record<string, unknown>) {
  eventListeners.get(event)?.forEach(fn => fn({ event, agentId, timestamp: Date.now(), data }));
}

import type { MapNode, NodeType, ProgressState } from './TaleaLearningPathTypes';
export type JourneySource = 'story' | 'doku' | 'quiz' | 'audio';
export const initialJourneyProgress = (): ProgressState => ({ doneNodeIds: [], inventoryArtifacts: [], stampsByTag: {}, lastActiveNodeId: null, dailySuggestedNodeIds: [], quizResultsById: {}, pendingNodeActions: [], forkSelectionsByNodeId: {} });
export function startJourneyNode(state: ProgressState, node: MapNode): ProgressState {
  return { ...state, lastActiveNodeId: node.nodeId, pendingNodeActions: [...state.pendingNodeActions.filter((p) => p.nodeId !== node.nodeId), { nodeId: node.nodeId, nodeType: node.type, startedAt: Date.now() }] };
}
export function finishJourneyNode(state: ProgressState, nodeId: string): ProgressState {
  return { ...state, doneNodeIds: [...new Set([...state.doneNodeIds, nodeId])], lastActiveNodeId: nodeId, pendingNodeActions: state.pendingNodeActions.filter((p) => p.nodeId !== nodeId) };
}
export function finishJourneySource(state: ProgressState, source: JourneySource): ProgressState {
  const types: Record<JourneySource, NodeType[]> = { story: ['StoryGate'], doku: ['DokuStop', 'StudioStage'], quiz: ['QuizStop'], audio: ['StudioStage'] };
  const latest = state.pendingNodeActions.filter((node) => types[source].includes(node.nodeType)).sort((a, b) => b.startedAt - a.startedAt)[0];
  return latest ? finishJourneyNode(state, latest.nodeId) : state;
}

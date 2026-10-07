export const DOMAIN_LABELS: Record<string, string> = {
  space: 'Weltraum', nature: 'Natur & Tiere', history: 'Geschichte & Kulturen',
  tech: 'Technik & Erfindungen', body: 'Mensch & Körper', earth: 'Erde & Klima',
  arts: 'Kunst & Musik', logic: 'Logik & Rätsel',
};
export const domainLabel = (id: string) => DOMAIN_LABELS[id] ?? id.replace(/[_-]/g, ' ');

export interface TreasuryArtifact {
  id: string; name: string; description: string; category: string; rarity: string;
  imageUrl?: string; emoji?: string; storyRole?: string; owned: boolean; isCrown: boolean;
  level: number; journeys: number; journeysUntilNextLevel?: number;
}
export interface ShardOffer {
  offerId: string; cost: number; artifacts: Array<Pick<TreasuryArtifact, 'id' | 'name' | 'description' | 'imageUrl' | 'rarity'>>;
}
export interface TreasuryOverview {
  avatarId: string; shards: number; shardsForChoice: number; choiceReady: boolean; totalOwned: number;
  sets: Array<{ id: string; name: string; ownedCount: number; totalCount: number; crownOwned: boolean; completed: boolean; artifacts: TreasuryArtifact[] }>;
  unsortedArtifacts: TreasuryArtifact[]; pendingOffer?: ShardOffer;
}
export function treasuryArtifacts(overview?: TreasuryOverview): TreasuryArtifact[] {
  return [...new Map([...(overview?.sets.flatMap((set) => set.artifacts) ?? []),
    ...(overview?.unsortedArtifacts ?? [])].map((item) => [item.id, item])).values()];
}

export interface CosmosDomain {
  domainId: string; evolutionIndex: number; planetLevel: number; stage: string;
  masteryScore: number; confidenceScore: number; masteryText: string; confidenceText: string;
  evidence: string; activeTopicCount: number;
}
export interface CosmosState { childId: string; domains: CosmosDomain[]; totalStoriesRead: number; totalDokusRead: number }
export interface TopicIsland {
  topicId: string; topicTitle: string; stage: string; mastery: number; confidence: number;
  masteryLabel: string; confidenceLabel: string; recallDueAt: string | null; docsCount: number;
}
export interface TopicTimeline {
  docs: Array<{ contentId: string; type: 'story' | 'doku'; title: string; createdAt: string }>;
  quizAttempts: Array<{ id: string; accuracy: number; correctCount: number; totalCount: number; createdAt: string }>;
  recallTasks: Array<{ id: string; status: string; dueAt: string; score: number | null }>;
}

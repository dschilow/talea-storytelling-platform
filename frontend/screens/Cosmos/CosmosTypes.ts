/**
 * CosmosTypes.ts - Shared types for Talea Lernkosmos.
 */

export type LearningStage = "discovered" | "understood" | "apply" | "retained";

export const LEARNING_STAGES: Record<LearningStage, { label: string }> = {
  discovered: { label: "Entdeckt" },
  understood: { label: "Verstanden" },
  apply: { label: "Anwenden" },
  retained: { label: "Sitzt wirklich" },
};

export type SkillType = "REMEMBER" | "UNDERSTAND" | "COMPARE" | "APPLY" | "TRANSFER";

export const SKILL_TYPES: Record<SkillType, { label: string; description: string }> = {
  REMEMBER: { label: "Erinnern", description: "Fakten abrufen" },
  UNDERSTAND: { label: "Verstehen", description: "Ursache/Wirkung erkennen" },
  COMPARE: { label: "Vergleichen", description: "Einordnen und unterscheiden" },
  APPLY: { label: "Anwenden", description: "Wissen auf neue Situationen uebertragen" },
  TRANSFER: { label: "Transfer", description: "Wissen flexibel einsetzen" },
};

export interface CosmosDomain {
  id: string;
  label: string;
  icon: string;
  planetType:
    | "terrestrial"
    | "oceanic"
    | "icy"
    | "lush"
    | "desert"
    | "volcanic"
    | "gaseous"
    | "crystalline";
  color: string;
  emissiveColor: string;
  orbitRadius: number;
  orbitSpeed: number;
  startAngle: number;
}

export interface DomainProgress {
  domainId: string;
  mastery: number;
  confidence: number;
  stage: LearningStage;
  topicsExplored: number;
  lastActivityAt: string | null;
  recentHighlight?: string;
  evolutionIndex?: number;
  planetLevel?: number;
  masteryText?: string;
  confidenceText?: string;
}

export interface TopicIsland {
  topicId: string;
  topicTitle: string;
  topicKind: "canonical" | "longTail";
  stage: LearningStage;
  mastery: number;
  confidence: number;
  masteryLabel: string;
  confidenceLabel: string;
  lastActivityAt: string | null;
  recallDueAt: string | null;
  lat: number;
  lon: number;
  docsCount: number;
}

export interface TopicTimelineEntry {
  contentId: string;
  type: "doku" | "story";
  title: string;
  createdAt: string;
}

export interface TopicQuizAttempt {
  id: string;
  accuracy: number;
  correctCount: number;
  totalCount: number;
  createdAt: string;
}

export interface TopicRecallTask {
  id: string;
  dueAt: string;
  status: string;
  score: number | null;
  doneAt: string | null;
}

export interface CosmosState {
  childName: string;
  avatarImageUrl?: string;
  domains: DomainProgress[];
  totalStoriesRead: number;
  totalDokusRead: number;
}

export interface PlanetVisuals {
  scale: number;
  emissiveIntensity: number;
  hasAtmosphere: boolean;
  hasRing: boolean;
  hasSatellites: boolean;
  stageMoonCount: number;
  atmosphereOpacity: number;
  orbitStability: number;
  developmentLevel: number;
  ringOpacity: number;
  satelliteCount: number;
  cloudOpacity: number;
  surfaceDetail: number;
  auraOpacity: number;
  lifeSignalStrength: number;
}

export interface EvidenceHighlight {
  id: string;
  childId: string;
  domainId: string;
  type: "quiz" | "recall" | "transfer" | "explain";
  text: string;
  evidenceBasis: string;
  recommendation?: string;
  timestamp: string;
}

export interface CompetencyTrend {
  skillType: SkillType;
  currentLevel: number;
  trend: "rising" | "stable" | "declining";
  dataPoints: Array<{ date: string; value: number }>;
}

export type CameraMode = "system" | "focus" | "detail";

export interface CameraTarget {
  mode: CameraMode;
  focusedDomainId?: string;
  position: [number, number, number];
  lookAt: [number, number, number];
}


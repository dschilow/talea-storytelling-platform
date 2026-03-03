/**
 * CosmosTypes.ts - All types for the Talea Lernkosmos system
 */

// ─── Learning Stages ─────────────────────────────────────────────
export type LearningStage = 'discovered' | 'understood' | 'can_explain' | 'mastered';

export const LEARNING_STAGES: Record<LearningStage, { label: string; minMastery: number; minConfidence: number }> = {
  discovered:   { label: 'Entdeckt',           minMastery: 0,  minConfidence: 0 },
  understood:   { label: 'Verstanden',         minMastery: 25, minConfidence: 15 },
  can_explain:  { label: 'Kann ich erklären',  minMastery: 55, minConfidence: 40 },
  mastered:     { label: 'Sitzt wirklich',     minMastery: 80, minConfidence: 65 },
};

// ─── Cognitive Competencies ──────────────────────────────────────
export type SkillType = 'REMEMBER' | 'UNDERSTAND' | 'COMPARE' | 'TRANSFER' | 'EXPLAIN';

export const SKILL_TYPES: Record<SkillType, { label: string; description: string }> = {
  REMEMBER:   { label: 'Erinnern',    description: 'Fakten abrufen' },
  UNDERSTAND: { label: 'Verstehen',   description: 'Ursache/Wirkung erkennen' },
  COMPARE:    { label: 'Vergleichen', description: 'Einordnen & Unterscheiden' },
  TRANSFER:   { label: 'Anwenden',    description: 'In neuer Situation nutzen' },
  EXPLAIN:    { label: 'Erklären',    description: 'In eigenen Worten wiedergeben' },
};

// ─── Domain Definition ───────────────────────────────────────────
export interface CosmosDomain {
  id: string;
  label: string;
  icon: string;
  planetType:
    | 'terrestrial'
    | 'oceanic'
    | 'icy'
    | 'lush'
    | 'desert'
    | 'volcanic'
    | 'gaseous'
    | 'crystalline';
  color: string;        // hex primary color
  emissiveColor: string; // hex emissive for glow
  orbitRadius: number;   // distance from center star
  orbitSpeed: number;    // radians per second
  startAngle: number;    // initial orbit position
}

// ─── Planet Progress (from backend) ──────────────────────────────
export interface DomainProgress {
  domainId: string;
  mastery: number;      // 0–100
  confidence: number;   // 0–100
  stage: LearningStage;
  topicsExplored: number;
  lastActivityAt: string | null;
  recentHighlight?: string;
}

// ─── Cosmos State (full scene data) ──────────────────────────────
export interface CosmosState {
  childName: string;
  avatarImageUrl?: string;
  domains: DomainProgress[];
  totalStoriesRead: number;
  totalDokusRead: number;
}

// ─── Planet Visual Properties (computed from progress) ───────────
export interface PlanetVisuals {
  scale: number;         // 0.6–1.4 based on mastery
  emissiveIntensity: number; // 0–1.5 based on confidence
  hasAtmosphere: boolean;
  hasRing: boolean;
  hasSatellites: boolean;
  atmosphereOpacity: number;
  orbitStability: number; // 0–1, higher = smoother orbit (less wobble)
  developmentLevel: number; // 0–1 blended progression across mastery/confidence
  ringOpacity: number; // continuous ring visibility
  satelliteCount: number; // 0–5
  cloudOpacity: number; // dynamic cloud layer
  surfaceDetail: number; // roughness / bump influence
  auraOpacity: number; // outer glow around the planet
  lifeSignalStrength: number; // particles/satellites intensity
}

// ─── Evidence Highlight (for parent dashboard) ───────────────────
export interface EvidenceHighlight {
  id: string;
  childId: string;
  domainId: string;
  type: 'quiz' | 'recall' | 'transfer' | 'explain';
  text: string;
  evidenceBasis: string;
  recommendation?: string;
  timestamp: string;
}

// ─── Competency Trend ────────────────────────────────────────────
export interface CompetencyTrend {
  skillType: SkillType;
  currentLevel: number;
  trend: 'rising' | 'stable' | 'declining';
  dataPoints: Array<{ date: string; value: number }>;
}

// ─── Camera States ───────────────────────────────────────────────
export type CameraMode = 'overview' | 'focused';

export interface CameraTarget {
  mode: CameraMode;
  focusedDomainId?: string;
  position: [number, number, number];
  lookAt: [number, number, number];
}

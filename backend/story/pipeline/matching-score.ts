import type { RoleSlot } from "./types";

export interface MatchScoreDetails {
  scores: {
    narrativeFit: number;
    personalitySync: number;
    visualHarmony: number;
    conflictPotential: number;
  };
  finalScore: number;
  notes?: string;
}

export interface CandidateProfile {
  id: string;
  name: string;
  role: string;
  archetype: string;
  visual_profile?: { description?: string; species?: string };
  personality_keywords?: string[];
  total_usage_count?: number;
}

const ROLE_MAP: Record<string, string[]> = {
  PROTAGONIST: ["hero", "protagonist", "guide"],
  ANTAGONIST: ["villain", "antagonist", "obstacle"],
  HELPER: ["helper", "companion", "support"],
  MENTOR: ["mentor", "guide", "elder"],
  TRICKSTER: ["trickster", "mischief"],
  COMIC_RELIEF: ["comic", "jester"],
  GUARDIAN: ["guardian", "protector"],
  CAMEO: ["cameo"],
};

export function scoreCandidate(slot: RoleSlot, candidate: CandidateProfile): MatchScoreDetails {
  const roleMatches = ROLE_MAP[slot.roleType] || [];
  const roleText = `${candidate.role} ${candidate.archetype}`.toLowerCase();
  const roleHit = roleMatches.some(key => roleText.includes(key));

  const archetypePrefs = slot.archetypePreference ?? [];
  const archetypeHit = archetypePrefs.some(pref => roleText.includes(pref.toLowerCase()));

  const narrativeFit = clamp01((roleHit ? 0.6 : 0.2) + (archetypeHit ? 0.4 : 0));

  const personalityKeywords = (candidate.personality_keywords || []).map(k => k.toLowerCase());
  const preferenceKeywords = [...(slot.constraints || []), ...(slot.archetypePreference || [])].map(k => k.toLowerCase());
  const personalityOverlap = intersectionScore(personalityKeywords, preferenceKeywords);
  const personalitySync = clamp01(0.3 + personalityOverlap);

  const visualText = `${candidate.visual_profile?.description ?? ""} ${(candidate.visual_profile?.species ?? "")} ${(slot.visualHints || []).join(" ")}`.toLowerCase();
  const visualHit = (slot.visualHints || []).some(hint => visualText.includes(hint.toLowerCase()));
  const visualHarmony = clamp01((visualHit ? 0.7 : 0.3));

  const conflictPotential = clamp01(slot.roleType === "ANTAGONIST" || slot.roleType === "TRICKSTER" ? 0.9 : 0.5);

  let finalScore = (narrativeFit + personalitySync + visualHarmony + conflictPotential) / 4;

  const usagePenalty = Math.min(0.2, (candidate.total_usage_count || 0) / 100);
  finalScore = clamp01(finalScore - usagePenalty);

  return {
    scores: { narrativeFit, personalitySync, visualHarmony, conflictPotential },
    finalScore,
    notes: roleHit ? "role match" : "weak role match",
  };
}

function intersectionScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(a);
  const hits = b.filter(item => set.has(item)).length;
  return hits / Math.max(1, Math.min(a.length, b.length));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

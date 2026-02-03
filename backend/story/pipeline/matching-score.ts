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
  // V2 Personality fields
  dominant_personality?: string | null;
  secondary_traits?: string[] | null;
  catchphrase?: string | null;
  speech_style?: string[] | null;
  emotional_triggers?: string[] | null;
  quirk?: string | null;
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

/**
 * Maps role types to preferred dominant personality traits.
 * Characters whose dominantPersonality matches get a scoring bonus.
 */
const ROLE_PERSONALITY_PREFERENCES: Record<string, string[]> = {
  PROTAGONIST: ["mutig", "neugierig", "entschlossen", "brave", "curious", "determined"],
  ANTAGONIST: ["frech", "gierig", "listig", "hinterlistig", "machtgierig", "greedy", "cunning", "sly"],
  HELPER: ["hilfsbereit", "treu", "freundlich", "loyal", "helpful", "friendly", "kind"],
  MENTOR: ["weise", "geduldig", "belehrend", "wise", "patient", "teaching"],
  TRICKSTER: ["listig", "frech", "verspielt", "schelmisch", "cunning", "playful", "mischievous"],
  COMIC_RELIEF: ["lustig", "verspielt", "hyperaktiv", "chaotisch", "funny", "playful", "hyperactive"],
  GUARDIAN: ["beschützend", "stark", "wachsam", "mutig", "protective", "strong", "vigilant"],
  CAMEO: [],
};

export function scoreCandidate(slot: RoleSlot, candidate: CandidateProfile): MatchScoreDetails {
  const roleMatches = ROLE_MAP[slot.roleType] || [];
  const roleText = `${candidate.role} ${candidate.archetype}`.toLowerCase();
  const roleHit = roleMatches.some(key => roleText.includes(key));

  const archetypePrefs = slot.archetypePreference ?? [];
  const archetypeHit = archetypePrefs.some(pref => roleText.includes(pref.toLowerCase()));

  const narrativeFit = clamp01((roleHit ? 0.6 : 0.2) + (archetypeHit ? 0.4 : 0));

  // --- Personality Sync: combine keyword overlap + V2 dominant personality matching ---
  const personalityKeywords = (candidate.personality_keywords || []).map(k => k.toLowerCase());
  const preferenceKeywords = [...(slot.constraints || []), ...(slot.archetypePreference || [])].map(k => k.toLowerCase());
  const personalityOverlap = intersectionScore(personalityKeywords, preferenceKeywords);

  // V2: Check if candidate's dominant personality matches the role's preferred traits
  let v2PersonalityBonus = 0;
  const dominant = (candidate.dominant_personality || "").toLowerCase();
  const secondaryTraits = (candidate.secondary_traits || []).map(t => t.toLowerCase());
  const rolePrefs = ROLE_PERSONALITY_PREFERENCES[slot.roleType] || [];

  if (dominant && rolePrefs.length > 0) {
    // Direct match: dominant personality fits the role perfectly
    if (rolePrefs.some(pref => dominant.includes(pref) || pref.includes(dominant))) {
      v2PersonalityBonus += 0.25;
    }
    // Secondary traits match
    const secondaryHits = secondaryTraits.filter(t =>
      rolePrefs.some(pref => t.includes(pref) || pref.includes(t))
    ).length;
    v2PersonalityBonus += Math.min(0.15, secondaryHits * 0.05);
  }

  // V2: Bonus for characters with rich personality data (catchphrase, quirk, speechStyle)
  // These characters will create more distinctive stories
  let richnessBonus = 0;
  if (candidate.catchphrase) richnessBonus += 0.05;
  if (candidate.quirk) richnessBonus += 0.05;
  if (candidate.speech_style?.length) richnessBonus += 0.05;
  if (candidate.emotional_triggers?.length) richnessBonus += 0.03;

  const personalitySync = clamp01(0.3 + personalityOverlap + v2PersonalityBonus + richnessBonus);

  const visualText = `${candidate.visual_profile?.description ?? ""} ${(candidate.visual_profile?.species ?? "")} ${(slot.visualHints || []).join(" ")}`.toLowerCase();
  const visualHit = (slot.visualHints || []).some(hint => visualText.includes(hint.toLowerCase()));
  const visualHarmony = clamp01((visualHit ? 0.7 : 0.3));

  const conflictPotential = clamp01(slot.roleType === "ANTAGONIST" || slot.roleType === "TRICKSTER" ? 0.9 : 0.5);

  let finalScore = (narrativeFit + personalitySync + visualHarmony + conflictPotential) / 4;

  const usagePenalty = Math.min(0.2, (candidate.total_usage_count || 0) / 100);
  finalScore = clamp01(finalScore - usagePenalty);

  const notes: string[] = [];
  if (roleHit) notes.push("role match");
  else notes.push("weak role match");
  if (v2PersonalityBonus > 0) notes.push(`personality fit +${v2PersonalityBonus.toFixed(2)}`);
  if (richnessBonus > 0) notes.push(`rich voice +${richnessBonus.toFixed(2)}`);

  return {
    scores: { narrativeFit, personalitySync, visualHarmony, conflictPotential },
    finalScore,
    notes: notes.join(", "),
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

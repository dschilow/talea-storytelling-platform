/**
 * useCosmosState.ts - Cosmos state with real backend data + robust fallback.
 *
 * Primary source:
 *   GET /avatar/cosmos-state
 * Fallback source:
 *   existing avatar personality traits mapping.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useSelector } from "react-redux";
import { useBackend } from "../../hooks/useBackend";
import { useOptionalChildProfiles } from "../../contexts/ChildProfilesContext";
import type { CosmosState, DomainProgress, LearningStage } from "./CosmosTypes";
import { computeStage } from "./CosmosProgressMapper";
import { COSMOS_DOMAINS } from "./CosmosAssetsRegistry";
import { fetchCosmosState, type CosmosDomainProgressDTO } from "./apiCosmosClient";

const KNOWN_STAGES = new Set<LearningStage>([
  "discovered",
  "understood",
  "apply",
  "retained",
]);

// Map knowledge subcategories to domain IDs.
const KNOWLEDGE_DOMAIN_MAP: Record<string, string> = {
  biology: "nature",
  astronomy: "space",
  history: "history",
  physics: "tech",
  geography: "earth",
  chemistry: "nature",
  mathematics: "logic",
};

// Map base traits to domain IDs (contribution weights).
const TRAIT_DOMAIN_MAP: Record<string, { domain: string; weight: number }[]> = {
  knowledge: [
    { domain: "nature", weight: 0.3 },
    { domain: "space", weight: 0.2 },
    { domain: "history", weight: 0.2 },
    { domain: "tech", weight: 0.15 },
    { domain: "earth", weight: 0.15 },
  ],
  creativity: [{ domain: "arts", weight: 1.0 }],
  curiosity: [
    { domain: "space", weight: 0.5 },
    { domain: "nature", weight: 0.5 },
  ],
  logic: [{ domain: "logic", weight: 1.0 }],
  courage: [{ domain: "history", weight: 1.0 }],
  empathy: [{ domain: "body", weight: 1.0 }],
  teamwork: [{ domain: "earth", weight: 1.0 }],
  vocabulary: [{ domain: "arts", weight: 0.5 }, { domain: "history", weight: 0.5 }],
  persistence: [{ domain: "tech", weight: 1.0 }],
};

function normalizeRemoteStage(input: string, mastery: number, confidence: number): LearningStage {
  if (KNOWN_STAGES.has(input as LearningStage)) {
    return input as LearningStage;
  }
  return computeStage(mastery, confidence);
}

function normalizeRemoteDomain(entry: CosmosDomainProgressDTO): DomainProgress {
  const mastery = Number(entry.masteryScore) || 0;
  const confidence = Number(entry.confidenceScore) || 0;
  return {
    domainId: entry.domainId,
    mastery: Math.max(0, Math.min(100, Math.round(mastery * 10) / 10)),
    confidence: Math.max(0, Math.min(100, Math.round(confidence * 10) / 10)),
    stage: normalizeRemoteStage(entry.stage, mastery, confidence),
    topicsExplored: Number(entry.activeTopicCount) || 0,
    lastActivityAt: entry.lastActivityAt || null,
    recentHighlight: entry.evidence,
    evolutionIndex: Number(entry.evolutionIndex) || 0,
    planetLevel: Number(entry.planetLevel) || 1,
    masteryText: entry.masteryText,
    confidenceText: entry.confidenceText,
  };
}

function buildFallbackDomainProgress(personalityTraits: unknown): DomainProgress[] {
  if (!personalityTraits || typeof personalityTraits !== "object") {
    return COSMOS_DOMAINS.map((domain) => ({
      domainId: domain.id,
      mastery: 0,
      confidence: 0,
      stage: "discovered",
      topicsExplored: 0,
      lastActivityAt: null,
    }));
  }

  const traits = personalityTraits as Record<string, unknown>;
  const domainScores: Record<string, { mastery: number; topicsExplored: number }> = {};
  for (const domain of COSMOS_DOMAINS) {
    domainScores[domain.id] = { mastery: 0, topicsExplored: 0 };
  }

  const knowledgeTrait = traits.knowledge;
  if (knowledgeTrait && typeof knowledgeTrait === "object") {
    const subcategories = (knowledgeTrait as { subcategories?: Record<string, unknown> }).subcategories;
    if (subcategories && typeof subcategories === "object") {
      for (const [subKey, subValue] of Object.entries(subcategories)) {
        const value = Number(subValue) || 0;
        const targetDomain = KNOWLEDGE_DOMAIN_MAP[subKey];
        if (!targetDomain || !domainScores[targetDomain]) continue;
        domainScores[targetDomain].mastery += value;
        if (value > 0) domainScores[targetDomain].topicsExplored += 1;
      }
    }
  }

  for (const [traitId, mappings] of Object.entries(TRAIT_DOMAIN_MAP)) {
    const traitData = traits[traitId];
    let traitValue = 0;
    if (traitData && typeof traitData === "object") {
      traitValue = Number((traitData as { value?: unknown }).value) || 0;
    } else if (typeof traitData === "number") {
      traitValue = traitData;
    }

    if (traitValue <= 0) continue;
    for (const { domain, weight } of mappings) {
      if (!domainScores[domain]) continue;
      domainScores[domain].mastery += traitValue * weight;
    }
  }

  return COSMOS_DOMAINS.map((domain) => {
    const raw = domainScores[domain.id] || { mastery: 0, topicsExplored: 0 };
    const mastery = Math.min(100, (raw.mastery / 200) * 100);
    const confidence = Math.min(100, mastery * 0.75);
    return {
      domainId: domain.id,
      mastery: Math.round(mastery * 10) / 10,
      confidence: Math.round(confidence * 10) / 10,
      stage: computeStage(mastery, confidence),
      topicsExplored: raw.topicsExplored,
      lastActivityAt: null,
    };
  });
}

export function useCosmosState() {
  const backend = useBackend();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const location = useLocation();
  const childProfiles = useOptionalChildProfiles();
  const activeProfileId = childProfiles?.activeProfileId;
  const avatars = useSelector((state: any) => state.avatar.avatars ?? []);

  const mapAvatarId = useMemo(
    () => new URLSearchParams(location.search).get("mapAvatarId"),
    [location.search]
  );

  const [isLoading, setIsLoading] = useState(true);
  const [avatarData, setAvatarData] = useState<any>(null);
  const [remoteDomains, setRemoteDomains] = useState<DomainProgress[] | null>(null);
  const [remoteTotals, setRemoteTotals] = useState<{ storiesRead: number; dokusRead: number } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const selectedAvatar = useMemo(() => {
    if (!Array.isArray(avatars) || avatars.length === 0) return null;
    if (mapAvatarId) {
      const mapped = avatars.find((avatar: any) => avatar.id === mapAvatarId);
      if (mapped) return mapped;
    }
    return avatars[0];
  }, [avatars, mapAvatarId]);

  const refresh = useCallback(() => {
    setReloadTick((value) => value + 1);
  }, []);

  useEffect(() => {
    const handleUpdate = () => refresh();
    window.addEventListener("personalityUpdated", handleUpdate as EventListener);
    window.addEventListener("talea:mapProgress", handleUpdate as EventListener);
    return () => {
      window.removeEventListener("personalityUpdated", handleUpdate as EventListener);
      window.removeEventListener("talea:mapProgress", handleUpdate as EventListener);
    };
  }, [refresh]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!mounted) return;
      setIsLoading(true);
      try {
        if (!selectedAvatar) {
          if (!mounted) return;
          setAvatarData(null);
          setRemoteDomains(null);
          setRemoteTotals(null);
          return;
        }

        let detail = selectedAvatar;
        if (!detail.personalityTraits || !detail.progression) {
          try {
            detail = await backend.avatar.get({ id: selectedAvatar.id });
          } catch {
            // Keep lightweight avatar from Redux if detailed fetch fails.
          }
        }
        if (!mounted) return;
        setAvatarData(detail);

        if (!isLoaded || !isSignedIn || !user?.id) {
          setRemoteDomains(null);
          setRemoteTotals(null);
          return;
        }

        try {
          const token = await getToken();
          const remote = await fetchCosmosState(
            {
              childId: activeProfileId || undefined,
              avatarId: detail.id,
              profileId: activeProfileId || undefined,
            },
            { token }
          );
          if (!mounted) return;
          setRemoteDomains((remote.domains || []).map(normalizeRemoteDomain));
          setRemoteTotals({
            storiesRead: Math.max(0, Number(remote.totalStoriesRead) || 0),
            dokusRead: Math.max(0, Number(remote.totalDokusRead) || 0),
          });
        } catch (error) {
          console.warn("[useCosmosState] Failed to load remote cosmos state, using fallback", error);
          if (!mounted) return;
          setRemoteDomains(null);
          setRemoteTotals(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [
    activeProfileId,
    backend,
    getToken,
    isLoaded,
    isSignedIn,
    refresh,
    reloadTick,
    selectedAvatar,
    user?.id,
  ]);

  const fallbackDomains = useMemo(
    () => buildFallbackDomainProgress(avatarData?.personalityTraits),
    [avatarData?.personalityTraits]
  );

  const domains = useMemo(() => {
    if (remoteDomains && remoteDomains.length > 0) {
      return remoteDomains;
    }
    return fallbackDomains;
  }, [fallbackDomains, remoteDomains]);

  const cosmosState = useMemo<CosmosState>(() => {
    const childName = childProfiles?.activeProfile?.name || "";
    const fallbackStories = avatarData?.progression?.stats?.storiesRead ?? 0;
    const fallbackDokus = avatarData?.progression?.stats?.dokusRead ?? 0;
    const totalStoriesRead = Math.max(
      Number(remoteTotals?.storiesRead) || 0,
      Number(fallbackStories) || 0
    );
    const totalDokusRead = Math.max(
      Number(remoteTotals?.dokusRead) || 0,
      Number(fallbackDokus) || 0
    );
    return {
      childName,
      avatarImageUrl: avatarData?.imageUrl,
      domains,
      totalStoriesRead,
      totalDokusRead,
    };
  }, [
    avatarData?.imageUrl,
    avatarData?.progression?.stats?.dokusRead,
    avatarData?.progression?.stats?.storiesRead,
    childProfiles?.activeProfile?.name,
    domains,
    remoteTotals?.dokusRead,
    remoteTotals?.storiesRead,
  ]);

  return {
    cosmosState,
    isLoading,
    activeAvatarId: selectedAvatar?.id ?? null,
    activeChildId: activeProfileId ?? null,
    refresh,
  };
}

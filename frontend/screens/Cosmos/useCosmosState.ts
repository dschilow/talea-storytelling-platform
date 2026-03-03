/**
 * useCosmosState.ts - Hook that builds CosmosState from existing avatar data
 *
 * MVP Strategy: Maps existing personality traits to cosmos domains.
 * This avoids needing a new backend service immediately.
 * When the cosmos backend is ready, swap the data source here.
 *
 * Trait-to-Domain mapping:
 *   knowledge (+ subcategories) → multiple domains
 *   creativity → art
 *   curiosity → space, nature
 *   logic → logic
 *   courage → history (exploring the unknown)
 *   empathy → body (understanding humans)
 *   teamwork → earth (global cooperation)
 *   vocabulary → art (expression)
 *   persistence → tech (building things)
 */

import { useState, useEffect, useMemo } from 'react';
import { useBackend } from '../../hooks/useBackend';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import { useSelector } from 'react-redux';
import type { CosmosState, DomainProgress, LearningStage } from './CosmosTypes';
import { computeStage } from './CosmosProgressMapper';
import { COSMOS_DOMAINS } from './CosmosAssetsRegistry';

// Map knowledge subcategories to domain IDs
const KNOWLEDGE_DOMAIN_MAP: Record<string, string> = {
  biology: 'nature',
  astronomy: 'space',
  history: 'history',
  physics: 'tech',
  geography: 'earth',
  chemistry: 'nature',
  mathematics: 'logic',
};

// Map base traits to domain IDs (contribution weights)
const TRAIT_DOMAIN_MAP: Record<string, { domain: string; weight: number }[]> = {
  knowledge: [
    { domain: 'nature', weight: 0.3 },
    { domain: 'space', weight: 0.2 },
    { domain: 'history', weight: 0.2 },
    { domain: 'tech', weight: 0.15 },
    { domain: 'earth', weight: 0.15 },
  ],
  creativity: [{ domain: 'art', weight: 1.0 }],
  curiosity: [
    { domain: 'space', weight: 0.5 },
    { domain: 'nature', weight: 0.5 },
  ],
  logic: [{ domain: 'logic', weight: 1.0 }],
  courage: [{ domain: 'history', weight: 1.0 }],
  empathy: [{ domain: 'body', weight: 1.0 }],
  teamwork: [{ domain: 'earth', weight: 1.0 }],
  vocabulary: [{ domain: 'art', weight: 0.5 }, { domain: 'history', weight: 0.5 }],
  persistence: [{ domain: 'tech', weight: 1.0 }],
};

function buildDomainProgress(personalityTraits: any): DomainProgress[] {
  if (!personalityTraits) return COSMOS_DOMAINS.map(d => ({
    domainId: d.id,
    mastery: 0,
    confidence: 0,
    stage: 'discovered' as LearningStage,
    topicsExplored: 0,
    lastActivityAt: null,
  }));

  // Accumulate mastery per domain
  const domainScores: Record<string, { mastery: number; topicsExplored: number }> = {};
  for (const d of COSMOS_DOMAINS) {
    domainScores[d.id] = { mastery: 0, topicsExplored: 0 };
  }

  // 1) Process knowledge subcategories → specific domain mapping
  const knowledgeTrait = personalityTraits.knowledge;
  if (knowledgeTrait && typeof knowledgeTrait === 'object') {
    const subcats = knowledgeTrait.subcategories;
    if (subcats) {
      for (const [subKey, subVal] of Object.entries(subcats)) {
        const val = Number(subVal) || 0;
        const targetDomain = KNOWLEDGE_DOMAIN_MAP[subKey];
        if (targetDomain && domainScores[targetDomain]) {
          domainScores[targetDomain].mastery += val;
          if (val > 0) domainScores[targetDomain].topicsExplored++;
        }
      }
    }
  }

  // 2) Process base traits → weighted domain distribution
  for (const [traitId, mappings] of Object.entries(TRAIT_DOMAIN_MAP)) {
    const traitData = personalityTraits[traitId];
    let traitValue = 0;
    if (traitData && typeof traitData === 'object') {
      traitValue = Number(traitData.value) || 0;
    } else if (typeof traitData === 'number') {
      traitValue = traitData;
    }

    if (traitValue > 0) {
      for (const { domain, weight } of mappings) {
        if (domainScores[domain]) {
          domainScores[domain].mastery += traitValue * weight;
        }
      }
    }
  }

  // 3) Normalize mastery to 0–100 scale
  // Base traits max 100, knowledge subcats max 1000, so we cap reasonably
  return COSMOS_DOMAINS.map((d) => {
    const raw = domainScores[d.id];
    // Soft cap at 200 raw points → 100 mastery
    const mastery = Math.min(100, (raw.mastery / 200) * 100);
    // Confidence derived from mastery with diminishing returns
    // (in the real backend, confidence will be separately tracked)
    const confidence = Math.min(100, mastery * 0.75);
    const stage = computeStage(mastery, confidence);

    return {
      domainId: d.id,
      mastery: Math.round(mastery * 10) / 10,
      confidence: Math.round(confidence * 10) / 10,
      stage,
      topicsExplored: raw.topicsExplored,
      lastActivityAt: null,
    };
  });
}

export function useCosmosState() {
  const backend = useBackend();
  const childProfiles = useOptionalChildProfiles();
  const activeProfileId = childProfiles?.activeProfileId;
  const avatars = useSelector((state: any) => state.avatar.avatars ?? []);

  const [isLoading, setIsLoading] = useState(true);
  const [avatarData, setAvatarData] = useState<any>(null);

  // Fetch first avatar with personality traits
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        if (avatars.length > 0) {
          const first = avatars[0];
          // If we already have personality traits from Redux, use those
          if (first.personalityTraits) {
            setAvatarData(first);
            setIsLoading(false);
            return;
          }

          // Otherwise fetch details
          try {
            const detail = await backend.avatar.get({ id: first.id });
            setAvatarData(detail);
          } catch {
            setAvatarData(first);
          }
        }
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [avatars, backend]);

  const cosmosState = useMemo<CosmosState>(() => {
    const childName = childProfiles?.activeProfile?.name || '';
    const personalityTraits = avatarData?.personalityTraits;
    const domains = buildDomainProgress(personalityTraits);

    return {
      childName,
      avatarImageUrl: avatarData?.imageUrl,
      domains,
      totalStoriesRead: avatarData?.progression?.stats?.storiesRead ?? 0,
      totalDokusRead: avatarData?.progression?.stats?.dokusRead ?? 0,
    };
  }, [avatarData, childProfiles]);

  return { cosmosState, isLoading };
}

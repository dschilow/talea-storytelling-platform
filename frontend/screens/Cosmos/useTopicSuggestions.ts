import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  fetchTopicSuggestions,
  refreshTopicSuggestion,
  selectTopicSuggestion,
  type TopicSuggestionItemDTO,
  type TopicSuggestionsDTO,
} from "./apiCosmosClient";

interface UseTopicSuggestionsOptions {
  domainId?: string | null;
  childId?: string;
  profileId?: string;
  avatarId?: string;
  enabled?: boolean;
}

interface UseTopicSuggestionsResult {
  suggestions: TopicSuggestionsDTO | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastInsertedSuggestionId: string | null;
  prefetch: (force?: boolean) => Promise<TopicSuggestionsDTO | null>;
  refreshOne: () => Promise<TopicSuggestionItemDTO | null>;
  selectSuggestion: (item: TopicSuggestionItemDTO) => Promise<void>;
}

type CacheEntry = {
  value: TopicSuggestionsDTO;
  ts: number;
};

const memoryCache = new Map<string, CacheEntry>();
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const REFRESH_DEBOUNCE_MS = 1200;

function cacheKey(parts: {
  domainId?: string | null;
  childId?: string;
  profileId?: string;
  avatarId?: string;
}): string | null {
  if (!parts.domainId) return null;
  return [
    parts.domainId,
    parts.childId || "-",
    parts.profileId || "-",
    parts.avatarId || "-",
  ].join("::");
}

function isCacheFresh(entry: CacheEntry | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.ts < CACHE_MAX_AGE_MS;
}

function mergeUniqueItems(
  current: TopicSuggestionItemDTO[],
  next: TopicSuggestionItemDTO
): TopicSuggestionItemDTO[] {
  const dedupe = new Map<string, TopicSuggestionItemDTO>();
  for (const item of current) {
    const key = `${item.topicSlug}|${item.topicTitle.toLowerCase()}`;
    dedupe.set(key, item);
  }
  const nextKey = `${next.topicSlug}|${next.topicTitle.toLowerCase()}`;
  dedupe.set(nextKey, next);
  return Array.from(dedupe.values());
}

export function useTopicSuggestions(options: UseTopicSuggestionsOptions): UseTopicSuggestionsResult {
  const { getToken } = useAuth();
  const [suggestions, setSuggestions] = useState<TopicSuggestionsDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInsertedSuggestionId, setLastInsertedSuggestionId] = useState<string | null>(null);
  const refreshGateRef = useRef(0);

  const key = useMemo(
    () =>
      cacheKey({
        domainId: options.domainId,
        childId: options.childId,
        profileId: options.profileId,
        avatarId: options.avatarId,
      }),
    [options.avatarId, options.childId, options.domainId, options.profileId]
  );

  const prefetch = useCallback(
    async (force = false): Promise<TopicSuggestionsDTO | null> => {
      if (!options.domainId || !key) return null;

      setError(null);
      const cached = memoryCache.get(key);
      if (!force && isCacheFresh(cached)) {
        setSuggestions(cached!.value);
        return cached!.value;
      }

      setIsLoading(true);
      try {
        const token = await getToken();
        const loaded = await fetchTopicSuggestions(
          {
            domainId: options.domainId,
            childId: options.childId,
            profileId: options.profileId,
            avatarId: options.avatarId,
          },
          { token }
        );
        memoryCache.set(key, { value: loaded, ts: Date.now() });
        setSuggestions(loaded);
        return loaded;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, key, options.avatarId, options.childId, options.domainId, options.profileId]
  );

  const refreshOne = useCallback(async (): Promise<TopicSuggestionItemDTO | null> => {
    if (!options.domainId || !key) return null;
    const now = Date.now();
    if (now - refreshGateRef.current < REFRESH_DEBOUNCE_MS) {
      return null;
    }
    refreshGateRef.current = now;

    setError(null);
    setIsRefreshing(true);

    const optimisticId = `optimistic_${now}`;
    const optimisticItem: TopicSuggestionItemDTO = {
      suggestionId: optimisticId,
      topicTitle: "Neuer Vorschlag wird erstellt...",
      topicSlug: `${options.domainId}_optimistic_${now}`,
      kind: "broaden",
      difficulty: 1,
      teaserKid: "Einen Moment ...",
      reasonParent: "KI erstellt einen neuen Vorschlag.",
      skillFocus: "understand",
    };

    setSuggestions((prev) => {
      if (!prev) return prev;
      return { ...prev, items: [...prev.items, optimisticItem] };
    });

    try {
      const token = await getToken();
      const result = await refreshTopicSuggestion(
        {
          domainId: options.domainId,
          childId: options.childId,
          profileId: options.profileId,
          avatarId: options.avatarId,
        },
        { token }
      );

      const nextItem = result.item;
      setLastInsertedSuggestionId(nextItem.suggestionId);

      setSuggestions((prev) => {
        const base: TopicSuggestionsDTO = prev || {
          domainId: options.domainId!,
          generatedAt: new Date().toISOString(),
          items: [],
        };
        const withoutOptimistic = base.items.filter((item) => item.suggestionId !== optimisticId);
        const merged = mergeUniqueItems(withoutOptimistic, nextItem);
        const updated: TopicSuggestionsDTO = {
          ...base,
          generatedAt: new Date().toISOString(),
          items: merged,
        };
        memoryCache.set(key, { value: updated, ts: Date.now() });
        return updated;
      });

      return nextItem;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSuggestions((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.filter((item) => item.suggestionId !== optimisticId),
        };
      });
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [getToken, key, options.avatarId, options.childId, options.domainId, options.profileId]);

  const selectSuggestionAndLog = useCallback(
    async (item: TopicSuggestionItemDTO) => {
      if (!options.domainId) return;
      try {
        const token = await getToken();
        await selectTopicSuggestion(
          {
            domainId: options.domainId,
            topicSlug: item.topicSlug,
            topicTitle: item.topicTitle,
            childId: options.childId,
            profileId: options.profileId,
            avatarId: options.avatarId,
          },
          { token }
        );
      } catch (err) {
        console.warn("[useTopicSuggestions] failed to log selection", err);
      }
    },
    [getToken, options.avatarId, options.childId, options.domainId, options.profileId]
  );

  useEffect(() => {
    if (options.enabled === false) return;
    if (!key) return;
    const cached = memoryCache.get(key);
    if (cached && isCacheFresh(cached)) {
      setSuggestions(cached.value);
      return;
    }
    void prefetch(false);
  }, [key, options.enabled, prefetch]);

  return {
    suggestions,
    isLoading,
    isRefreshing,
    error,
    lastInsertedSuggestionId,
    prefetch,
    refreshOne,
    selectSuggestion: selectSuggestionAndLog,
  };
}

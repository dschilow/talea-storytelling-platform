import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { Bookmark, BookmarkCheck, Clock3, Download, RotateCcw, Trash2 } from "lucide-react";

import { useBackend } from "../../../hooks/useBackend";
import { exportStoryAsPDF, isPDFExportSupported } from "../../../utils/pdfExportLoader";
import { fetchCharacterSeries } from "../../../utils/characterSeriesApi";
import type { Story } from "../../../types/story";
import type { CharacterSeriesChoice } from "../wizard-steps/StepCharacterSeries";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import { useOptionalUserAccess } from "@/contexts/UserAccessContext";
import { useOffline } from "@/contexts/OfflineStorageContext";
import type { TaleaCardMenuAction } from "@/components/talea/TaleaCardMenu";

// The server gives up on a generation after 90 minutes (generation-capacity.ts),
// but only marks it when the next story starts. Show it as failed right away.
const STALE_GENERATION_MS = 90 * 60_000;

/**
 * The library shows the first twelve stories as soon as they arrive, then fetches the rest — 50 per request (the
 * endpoint's maximum), three requests at a time. It used to ask for one page after the other, so a family with
 * 150 finished stories waited for four round trips in a row.
 */
const FIRST_PAGE = 12;
const PAGE_SIZE = 50;
const PAGE_PARALLEL = 3;

/**
 * The last load of the library per user and child profile, kept while the app is open: coming back to "Lesen" (or
 * opening a series from it) shows the stories at once and the load only refreshes them behind the scenes. Memory only.
 */
const storiesCache = new Map<string, { stories: Story[]; total: number }>();
const catalogueCache = new Map<string, CharacterSeriesChoice[]>();

/** Pages can overlap when a story is created while the library loads; each story appears once. */
function mergeStories(previous: Story[], page: Story[]): Story[] {
  const seen = new Set(previous.map((story) => story.id));
  return [...previous, ...page.filter((story) => !seen.has(story.id))];
}

/** A title the model returned as raw JSON ('{"title": "…"') is shown as its plain text. */
export function cleanStoryTitle(title: string | undefined | null): string {
  const raw = String(title ?? "").trim();
  const quoted = raw.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"?/i);
  const text = (quoted ? quoted[1] : raw)
    .replace(/\\"/g, '"')
    .replace(/^[\s{\[#*"'`]+/, "")
    .replace(/[\s}\]"'`*,]+$/, "")
    .trim();
  return text || "Geschichte ohne Titel";
}

function presentStory(story: Story): Story {
  const lastActivity = new Date(story.updatedAt || story.createdAt).getTime();
  const isBook = story.metadata?.book?.format === "chapter-book";
  const stale = story.status === "generating" && !isBook && Number.isFinite(lastActivity) && Date.now() - lastActivity > STALE_GENERATION_MS;
  return { ...story, title: cleanStoryTitle(story.title), status: stale ? "error" : story.status };
}

/** All stories of the active child profile, paged in parallel and cached per user and profile. */
export function useStoryLibrary() {
  const backend = useBackend();
  const { user } = useUser();
  const profileId = useOptionalChildProfiles()?.activeProfileId;
  const cacheKey = `${user?.id || ""}:${profileId || ""}`;
  const [stories, setStories] = useState<Story[]>(() => storiesCache.get(cacheKey)?.stories ?? []);
  const [total, setTotal] = useState(() => storiesCache.get(cacheKey)?.total ?? 0);
  const [loading, setLoading] = useState(() => !storiesCache.has(cacheKey));
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const cached = storiesCache.get(cacheKey);
    try {
      setLoadError(null);
      if (cached) {
        // Back on "Lesen": show what was loaded last time at once, the load below refreshes it.
        setStories(cached.stories);
        setTotal(cached.total);
        setLoading(false);
      } else {
        setLoading(true);
        setStories([]);
        setTotal(0);
      }
      const request = (offset: number, limit: number) => backend.story.list({ limit, offset, profileId: profileId || undefined });
      const first = await request(0, FIRST_PAGE);
      if (sequence !== loadSequence.current) return;
      const firstPage = ((first.stories as unknown as Story[]) || []).map(presentStory);
      const total = Number(first.total) || firstPage.length;
      let loaded = mergeStories([], firstPage);
      if (!cached) {
        // Render the first page immediately; the older stories follow as they arrive (the screen sorts by date itself).
        setStories(loaded);
        setTotal(total);
        setLoading(false);
      }
      // The total is known now, so every remaining page can be asked for at once.
      const offsets: number[] = [];
      for (let offset = firstPage.length; firstPage.length > 0 && offset < total; offset += PAGE_SIZE) offsets.push(offset);
      let next = 0;
      const worker = async () => {
        while (next < offsets.length) {
          const response = await request(offsets[next++], PAGE_SIZE);
          if (sequence !== loadSequence.current) return;
          const page = ((response.stories as unknown as Story[]) || []).map(presentStory);
          loaded = mergeStories(loaded, page);
          if (!cached) setStories((previous) => mergeStories(previous, page));
        }
      };
      await Promise.all(Array.from({ length: Math.min(PAGE_PARALLEL, offsets.length) }, worker));
      if (sequence !== loadSequence.current) return;
      storiesCache.set(cacheKey, { stories: loaded, total });
      setStories(loaded);
      setTotal(total);
    } catch (error) {
      console.error("Error loading stories:", error);
      if (sequence === loadSequence.current) setLoadError("Deine Geschichten konnten nicht vollständig geladen werden. Bitte versuche es erneut.");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [backend, profileId, cacheKey]);

  /** Drops the answer of a load that is still running (the screen left or the profile changed). */
  const cancel = useCallback(() => {
    loadSequence.current += 1;
  }, []);

  const clear = useCallback(() => {
    loadSequence.current += 1;
    setStories([]);
    setTotal(0);
    setLoading(false);
  }, []);

  const removeStory = useCallback((storyId: string) => {
    setStories((previous) => previous.filter((story) => story.id !== storyId));
    setTotal((previous) => Math.max(0, previous - 1));
    const cached = storiesCache.get(cacheKey);
    if (cached) storiesCache.set(cacheKey, { stories: cached.stories.filter((story) => story.id !== storyId), total: Math.max(0, cached.total - 1) });
  }, [cacheKey]);

  return { stories, total, loading, loadError, load, cancel, clear, removeStory, profileId };
}

/** The Figurenserien this profile can play, with its own episode counts. null until known (or when it failed). */
export function useCharacterSeriesCatalogue(enabled = true) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const profileId = useOptionalChildProfiles()?.activeProfileId;
  const key = `${user?.id || ""}:${profileId || ""}`;
  const [catalogue, setCatalogue] = useState<CharacterSeriesChoice[] | null>(() => catalogueCache.get(key) ?? null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled || !user?.id) return;
    let active = true;
    const controller = new AbortController();
    setCatalogue(catalogueCache.get(key) ?? null);
    fetchCharacterSeries(getToken, profileId, controller.signal)
      .then((result) => {
        if (!active) return;
        catalogueCache.set(key, result);
        setCatalogue(result);
      })
      .catch((error) => {
        if (active) console.warn("[Library] Character series could not be loaded:", error);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, getToken, key, profileId, user?.id, reloadToken]);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);
  return { catalogue, reload };
}

/** The "…" menu of a story card: offline, PDF (admins), start again (failed) and delete, the same on every shelf. */
export function useStoryActions(onDeleted: (storyId: string) => void) {
  const backend = useBackend();
  const { t } = useTranslation();
  const profileId = useOptionalChildProfiles()?.activeProfileId;
  const { isAdmin } = useOptionalUserAccess();
  const { canUseOffline, isStorySaved, isSaving, toggleStory } = useOffline();
  const [downloadingStoryId, setDownloadingStoryId] = useState<string | null>(null);

  const deleteStory = useCallback(async (story: Story) => {
    if (!window.confirm(`${t("common.delete", "Löschen")} "${story.title}"?`)) return;
    try {
      await backend.story.deleteStory({ id: story.id, profileId: profileId || undefined });
      onDeleted(story.id);
    } catch (error) {
      console.error("Error deleting story:", error);
    }
  }, [backend, onDeleted, profileId, t]);

  const downloadPdf = useCallback(async (story: Story) => {
    if (!isAdmin || !isPDFExportSupported() || story.status !== "complete") return;
    try {
      setDownloadingStoryId(story.id);
      const fullStory = await backend.story.get({ id: story.id, profileId: profileId || undefined });
      if (!fullStory.chapters || fullStory.chapters.length === 0) return;
      await exportStoryAsPDF(fullStory as any);
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setDownloadingStoryId(null);
    }
  }, [backend, isAdmin, profileId]);

  const menuFor = useCallback((story: Story, onRestart?: () => void): TaleaCardMenuAction[] => {
    const saved = isStorySaved(story.id);
    const saving = isSaving(story.id);
    const downloading = downloadingStoryId === story.id;
    return [
      ...(canUseOffline && story.status === "complete"
        ? [{
            label: saved ? "Offline-Speicherung entfernen" : "Offline speichern",
            icon: saving ? React.createElement(Clock3, { className: "h-4 w-4 animate-spin" }) : React.createElement(saved ? BookmarkCheck : Bookmark, { className: "h-4 w-4" }),
            onSelect: () => toggleStory(story.id),
            disabled: saving,
          }]
        : []),
      ...(isAdmin && story.status === "complete"
        ? [{ label: "Als PDF laden", icon: React.createElement(downloading ? Clock3 : Download, { className: downloading ? "h-4 w-4 animate-spin" : "h-4 w-4" }), onSelect: () => void downloadPdf(story), disabled: downloading }]
        : []),
      ...(story.status === "error" && onRestart
        ? [{ label: "Neu erstellen", icon: React.createElement(RotateCcw, { className: "h-4 w-4" }), onSelect: onRestart }]
        : []),
      { label: "Löschen", icon: React.createElement(Trash2, { className: "h-4 w-4" }), onSelect: () => void deleteStory(story), destructive: true },
    ];
  }, [canUseOffline, deleteStory, downloadPdf, downloadingStoryId, isAdmin, isSaving, isStorySaved, toggleStory]);

  return { menuFor, isAdmin };
}

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Check,
  Clapperboard,
  Edit3,
  Eye,
  FileText,
  ImagePlus,
  Layers3,
  Loader2,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Users,
  Wand2,
  X,
} from "lucide-react";

import { getBackendUrl } from "@/config";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import type { StudioCharacter, StudioEpisode, StudioEpisodeScene, StudioSeries } from "@/types/studio";

const headingFont = '"Cormorant Garamond", "Times New Roman", serif';

type ApiInit = { method?: "GET" | "POST" | "PUT"; body?: unknown };
type EpisodeWithScenesResponse = { episode: StudioEpisode; scenes: StudioEpisodeScene[] };
type ComposeEpisodeResponse = EpisodeWithScenesResponse & { combinedText: string };
type StudioWorkspaceView = "library" | "series";
type SeriesOverview = {
  episodeCount: number;
  publishedCount: number;
  characterCount: number;
  latestEpisodeTitle?: string;
  latestEpisodeStatus?: StudioEpisode["status"];
  coverImageUrl?: string;
};

const episodeStatusLabel: Record<StudioEpisode["status"], string> = {
  draft: "Entwurf",
  text_ready: "Text bereit",
  text_approved: "Text akzeptiert",
  scenes_ready: "Szenen bereit",
  images_ready: "Bilder bereit",
  composed: "Composed",
  published: "Veroeffentlicht",
};

function formatDate(value: string | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const TaleaStudioWorkspace: React.FC = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const isDark = resolvedTheme === "dark";

  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<StudioSeries[]>([]);
  const [workspaceView, setWorkspaceView] = useState<StudioWorkspaceView>("library");
  const [editorOpen, setEditorOpen] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [seriesOverview, setSeriesOverview] = useState<Record<string, SeriesOverview>>({});
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<StudioCharacter[]>([]);
  const [episodes, setEpisodes] = useState<StudioEpisode[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showSeriesForm, setShowSeriesForm] = useState(false);
  const [showCharacterForm, setShowCharacterForm] = useState(false);
  const [showEpisodeForm, setShowEpisodeForm] = useState(false);

  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesLogline, setSeriesLogline] = useState("");
  const [seriesDescription, setSeriesDescription] = useState("");
  const [seriesCanon, setSeriesCanon] = useState("");
  const [seriesEditTitle, setSeriesEditTitle] = useState("");
  const [seriesEditLogline, setSeriesEditLogline] = useState("");
  const [seriesEditDescription, setSeriesEditDescription] = useState("");
  const [seriesEditCanon, setSeriesEditCanon] = useState("");
  const [savingSeriesInfo, setSavingSeriesInfo] = useState(false);
  const [characterName, setCharacterName] = useState("");
  const [characterRole, setCharacterRole] = useState("");
  const [characterPrompt, setCharacterPrompt] = useState("");
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingCharacterName, setEditingCharacterName] = useState("");
  const [editingCharacterRole, setEditingCharacterRole] = useState("");
  const [editingCharacterDescription, setEditingCharacterDescription] = useState("");
  const [editingCharacterPrompt, setEditingCharacterPrompt] = useState("");
  const [updatingCharacter, setUpdatingCharacter] = useState(false);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [episodeCharacterIds, setEpisodeCharacterIds] = useState<string[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [episodeEditorText, setEpisodeEditorText] = useState("");
  const [episodeEditorSummary, setEpisodeEditorSummary] = useState("");
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [generatingText, setGeneratingText] = useState(false);
  const [scenes, setScenes] = useState<StudioEpisodeScene[]>([]);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [splitPrompt, setSplitPrompt] = useState("");
  const [splittingScenes, setSplittingScenes] = useState(false);
  const [sceneSavingId, setSceneSavingId] = useState<string | null>(null);
  const [sceneGeneratingId, setSceneGeneratingId] = useState<string | null>(null);
  const [bulkGeneratingImages, setBulkGeneratingImages] = useState(false);
  const [composingEpisode, setComposingEpisode] = useState(false);
  const [combinedEpisodeText, setCombinedEpisodeText] = useState("");
  const [publishingEpisode, setPublishingEpisode] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const selectedSeries = useMemo(
    () => series.find((item) => item.id === selectedSeriesId) || null,
    [series, selectedSeriesId]
  );
  const selectedEpisode = useMemo(
    () => episodes.find((item) => item.id === selectedEpisodeId) || null,
    [episodes, selectedEpisodeId]
  );
  const selectedSeriesOverview = selectedSeriesId ? seriesOverview[selectedSeriesId] : undefined;
  const maxEpisodeNumber = useMemo(
    () => episodes.reduce((maxValue, item) => Math.max(maxValue, item.episodeNumber), 0),
    [episodes]
  );
  const allSceneImagesReady = useMemo(
    () => scenes.length > 0 && scenes.every((scene) => Boolean(scene.imageUrl)),
    [scenes]
  );
  const canCompose = allSceneImagesReady && scenes.length > 0;
  const canPublish = selectedEpisode?.status === "composed";
  const wizardSteps = useMemo(
    () => [
      {
        key: "text",
        label: "1 Text",
        done: Boolean((selectedEpisode?.approvedStoryText || selectedEpisode?.storyText || episodeEditorText).trim()),
      },
      { key: "scenes", label: "2 Szenen", done: scenes.length > 0 },
      { key: "images", label: "3 Bilder", done: allSceneImagesReady },
      {
        key: "compose",
        label: "4 Compose",
        done: selectedEpisode?.status === "composed" || selectedEpisode?.status === "published",
      },
      { key: "publish", label: "5 Publish", done: selectedEpisode?.status === "published" },
    ],
    [
      allSceneImagesReady,
      episodeEditorText,
      scenes.length,
      selectedEpisode?.approvedStoryText,
      selectedEpisode?.status,
      selectedEpisode?.storyText,
    ]
  );

  const palette = useMemo(
    () =>
      isDark
        ? {
            card: "border-[#33465e] bg-[#1d2636]",
            sub: "border-[#3a4f68] bg-[#243245]",
            text: "text-[#e6edf8]",
            muted: "text-[#9fb0c7]",
            input: "border-[#3a4f68] bg-[#1f2c41] text-[#e6edf8]",
          }
        : {
            card: "border-[#e1d3c1] bg-[#fff9f0]",
            sub: "border-[#e3d7c8] bg-[#f8efe2]",
            text: "text-[#253246]",
            muted: "text-[#617387]",
            input: "border-[#e1d3c1] bg-[#f5ebe0] text-[#243246]",
          },
    [isDark]
  );

  const apiCall = async <T,>(path: string, init?: ApiInit): Promise<T> => {
    const token = await getToken();
    const response = await fetch(`${getBackendUrl()}${path}`, {
      method: init?.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  };

  const fetchSeriesOverview = async (seriesId: string): Promise<SeriesOverview> => {
    const [charactersResult, episodesResult] = await Promise.all([
      apiCall<{ characters: StudioCharacter[] }>(`/story/studio/series/${seriesId}/characters`),
      apiCall<{ episodes: StudioEpisode[] }>(`/story/studio/series/${seriesId}/episodes`),
    ]);
    const characterList = charactersResult.characters || [];
    const episodeList = (episodesResult.episodes || []).sort((a, b) => a.episodeNumber - b.episodeNumber);
    const latestEpisode = episodeList[episodeList.length - 1];
    const publishedCount = episodeList.filter((episode) => episode.status === "published").length;

    return {
      episodeCount: episodeList.length,
      publishedCount,
      characterCount: characterList.length,
      latestEpisodeTitle: latestEpisode?.title,
      latestEpisodeStatus: latestEpisode?.status,
      coverImageUrl: characterList.find((character) => Boolean(character.imageUrl))?.imageUrl,
    };
  };

  const refreshAllSeriesOverview = async (seriesList: StudioSeries[]) => {
    if (seriesList.length === 0) {
      setSeriesOverview({});
      return;
    }

    try {
      setOverviewLoading(true);
      const overviewEntries = await Promise.all(
        seriesList.map(async (item) => {
          try {
            const overview = await fetchSeriesOverview(item.id);
            return [item.id, overview] as const;
          } catch {
            return [
              item.id,
              {
                episodeCount: 0,
                publishedCount: 0,
                characterCount: 0,
              } satisfies SeriesOverview,
            ] as const;
          }
        })
      );
      setSeriesOverview(Object.fromEntries(overviewEntries));
    } finally {
      setOverviewLoading(false);
    }
  };

  const refreshSeriesOverviewItem = async (seriesId: string) => {
    try {
      const overview = await fetchSeriesOverview(seriesId);
      setSeriesOverview((prev) => ({ ...prev, [seriesId]: overview }));
    } catch {
      // Keep previous overview data when refresh fails.
    }
  };

  const loadSeries = async () => {
    try {
      setLoading(true);
      const result = await apiCall<{ series: StudioSeries[] }>("/story/studio/series");
      const list = result.series || [];
      setSeries(list);
      setSelectedSeriesId((current) => current ?? list[0]?.id ?? null);
      await refreshAllSeriesOverview(list);
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (seriesId: string) => {
    try {
      setDetailLoading(true);
      const [charactersResult, episodesResult] = await Promise.all([
        apiCall<{ characters: StudioCharacter[] }>(`/story/studio/series/${seriesId}/characters`),
        apiCall<{ episodes: StudioEpisode[] }>(`/story/studio/series/${seriesId}/episodes`),
      ]);
      setCharacters(charactersResult.characters || []);
      const episodeList = episodesResult.episodes || [];
      setEpisodes(episodeList);
      setSelectedEpisodeId((current) =>
        current && episodeList.some((episode) => episode.id === current)
          ? current
          : episodeList[0]?.id ?? null
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const loadScenes = async (seriesId: string, episodeId: string) => {
    try {
      setSceneLoading(true);
      const result = await apiCall<{ scenes: StudioEpisodeScene[] }>(
        `/story/studio/series/${seriesId}/episodes/${episodeId}/scenes`
      );
      setScenes(result.scenes || []);
    } catch {
      setScenes([]);
    } finally {
      setSceneLoading(false);
    }
  };

  useEffect(() => {
    void loadSeries();
  }, []);

  useEffect(() => {
    if (!selectedSeriesId) {
      setCharacters([]);
      setEpisodes([]);
      setSelectedEpisodeId(null);
      setScenes([]);
      setCombinedEpisodeText("");
      setWorkflowError(null);
      return;
    }
    if (editorOpen || workspaceView === "series") {
      void loadDetails(selectedSeriesId);
    }
  }, [editorOpen, selectedSeriesId, workspaceView]);

  useEffect(() => {
    if (!editorOpen) {
      return;
    }
    if (selectedSeriesId && selectedEpisodeId) {
      void loadScenes(selectedSeriesId, selectedEpisodeId);
      return;
    }
    setScenes([]);
    setCombinedEpisodeText("");
  }, [editorOpen, selectedSeriesId, selectedEpisodeId]);

  useEffect(() => {
    if (!selectedEpisode) {
      setEpisodeEditorText("");
      setEpisodeEditorSummary("");
      setCombinedEpisodeText("");
      return;
    }
    setEpisodeEditorText(selectedEpisode.storyText || selectedEpisode.approvedStoryText || "");
    setEpisodeEditorSummary(selectedEpisode.summary || "");
    if (selectedEpisode.status !== "composed" && selectedEpisode.status !== "published") {
      setCombinedEpisodeText("");
    }
  }, [selectedEpisode?.id, selectedEpisode?.updatedAt, selectedEpisode?.storyText, selectedEpisode?.approvedStoryText, selectedEpisode?.summary, selectedEpisode?.status]);

  useEffect(() => {
    if (!selectedSeries) {
      setSeriesEditTitle("");
      setSeriesEditLogline("");
      setSeriesEditDescription("");
      setSeriesEditCanon("");
      setEditingCharacterId(null);
      return;
    }
    setSeriesEditTitle(selectedSeries.title || "");
    setSeriesEditLogline(selectedSeries.logline || "");
    setSeriesEditDescription(selectedSeries.description || "");
    setSeriesEditCanon(selectedSeries.canonicalPrompt || "");
    setEditingCharacterId(null);
  }, [selectedSeries?.id, selectedSeries?.updatedAt]);

  useEffect(() => {
    if (!selectedSeriesId) return;
    setEpisodeNumber(Math.max(1, maxEpisodeNumber + 1));
  }, [maxEpisodeNumber, selectedSeriesId]);

  useEffect(() => {
    if (!showEpisodeForm) return;
    if (characters.length === 0) return;
    setEpisodeCharacterIds((current) => (current.length > 0 ? current : characters.map((character) => character.id)));
  }, [characters, showEpisodeForm]);

  const openSeriesView = (seriesId: string) => {
    setSelectedSeriesId(seriesId);
    setWorkspaceView("series");
  };

  const openEditorForSeries = (seriesId: string, options?: { newEpisode?: boolean; episodeId?: string }) => {
    setSelectedSeriesId(seriesId);
    setWorkspaceView("series");
    setEditorOpen(true);
    setShowSeriesForm(false);
    setShowCharacterForm(false);
    setShowEpisodeForm(Boolean(options?.newEpisode));
    if (options?.episodeId) {
      setSelectedEpisodeId(options.episodeId);
    }
  };

  const openEditorForNewSeries = () => {
    setEditorOpen(true);
    setWorkspaceView("library");
    setSelectedSeriesId(null);
    setSelectedEpisodeId(null);
    setShowSeriesForm(true);
    setShowCharacterForm(false);
    setShowEpisodeForm(false);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setShowSeriesForm(false);
    setShowCharacterForm(false);
    setShowEpisodeForm(false);
  };

  const handleCreateSeries = async () => {
    if (!seriesTitle.trim()) return;
    try {
      setSaving(true);
      const created = await apiCall<StudioSeries>("/story/studio/series", {
        method: "POST",
        body: {
          title: seriesTitle.trim(),
          logline: seriesLogline.trim() || undefined,
          description: seriesDescription.trim() || undefined,
          canonicalPrompt: seriesCanon.trim() || undefined,
          status: "draft",
        },
      });
      const nextSeries = [created, ...series];
      setSeries(nextSeries);
      setSelectedSeriesId(created.id);
      setWorkspaceView("series");
      setSeriesTitle("");
      setSeriesLogline("");
      setSeriesDescription("");
      setSeriesCanon("");
      setShowSeriesForm(false);
      await refreshAllSeriesOverview(nextSeries);
    } catch {
      alert("Serie konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSeriesInfo = async () => {
    if (!selectedSeriesId || !seriesEditTitle.trim()) return;
    try {
      setSavingSeriesInfo(true);
      const updated = await apiCall<StudioSeries>(`/story/studio/series/${selectedSeriesId}`, {
        method: "PUT",
        body: {
          title: seriesEditTitle.trim(),
          logline: seriesEditLogline.trim() || "",
          description: seriesEditDescription.trim() || "",
          canonicalPrompt: seriesEditCanon.trim() || "",
        },
      });

      setSeries((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      await refreshSeriesOverviewItem(updated.id);
    } catch {
      alert("Serieninfos konnten nicht gespeichert werden.");
    } finally {
      setSavingSeriesInfo(false);
    }
  };

  const handleCreateCharacter = async () => {
    if (!selectedSeriesId || !characterName.trim() || !characterPrompt.trim()) return;
    try {
      setSaving(true);
      const created = await apiCall<StudioCharacter>(`/story/studio/series/${selectedSeriesId}/characters`, {
        method: "POST",
        body: {
          name: characterName.trim(),
          role: characterRole.trim() || undefined,
          generationPrompt: characterPrompt.trim(),
          autoGenerateImage: true,
        },
      });
      setCharacters((prev) => [...prev, created]);
      setCharacterName("");
      setCharacterRole("");
      setCharacterPrompt("");
      setShowCharacterForm(false);
      await refreshSeriesOverviewItem(selectedSeriesId);
    } catch {
      alert("Story Charakter konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
    }
  };

  const startCharacterEdit = (character: StudioCharacter) => {
    setEditingCharacterId(character.id);
    setEditingCharacterName(character.name || "");
    setEditingCharacterRole(character.role || "");
    setEditingCharacterDescription(character.description || "");
    setEditingCharacterPrompt(character.generationPrompt || "");
  };

  const cancelCharacterEdit = () => {
    setEditingCharacterId(null);
    setEditingCharacterName("");
    setEditingCharacterRole("");
    setEditingCharacterDescription("");
    setEditingCharacterPrompt("");
  };

  const handleUpdateCharacter = async () => {
    if (!selectedSeriesId || !editingCharacterId || !editingCharacterName.trim() || !editingCharacterPrompt.trim()) {
      return;
    }

    try {
      setUpdatingCharacter(true);
      const updated = await apiCall<StudioCharacter>(
        `/story/studio/series/${selectedSeriesId}/characters/${editingCharacterId}`,
        {
          method: "PUT",
          body: {
            name: editingCharacterName.trim(),
            role: editingCharacterRole.trim() || "",
            description: editingCharacterDescription.trim() || "",
            generationPrompt: editingCharacterPrompt.trim(),
          },
        }
      );

      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      cancelCharacterEdit();
      await refreshSeriesOverviewItem(selectedSeriesId);
    } catch {
      alert("Charakter konnte nicht gespeichert werden.");
    } finally {
      setUpdatingCharacter(false);
    }
  };

  const handleCreateEpisode = async () => {
    if (!selectedSeriesId || !episodeTitle.trim() || episodeNumber <= 0) return;
    try {
      setSaving(true);
      const created = await apiCall<StudioEpisode>(`/story/studio/series/${selectedSeriesId}/episodes`, {
        method: "POST",
        body: {
          episodeNumber,
          title: episodeTitle.trim(),
          selectedCharacterIds:
            episodeCharacterIds.length > 0
              ? episodeCharacterIds
              : characters.map((character) => character.id),
        },
      });
      setEpisodes((prev) => [...prev, created].sort((a, b) => a.episodeNumber - b.episodeNumber));
      setSelectedEpisodeId(created.id);
      setEpisodeTitle("");
      setEpisodeCharacterIds([]);
      setEpisodeNumber((prev) => prev + 1);
      setShowEpisodeForm(false);
      await refreshSeriesOverviewItem(selectedSeriesId);
    } catch {
      alert("Folge konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
    }
  };

  const replaceEpisodeInState = (updated: StudioEpisode) => {
    setEpisodes((prev) =>
      prev
        .map((episode) => (episode.id === updated.id ? updated : episode))
        .sort((a, b) => a.episodeNumber - b.episodeNumber)
    );
  };

  const refreshSelectedEpisode = async () => {
    if (!selectedSeriesId || !selectedEpisodeId) return;
    const refreshed = await apiCall<StudioEpisode>(
      `/story/studio/series/${selectedSeriesId}/episodes/${selectedEpisodeId}`
    );
    replaceEpisodeInState(refreshed);
  };

  const handleGenerateEpisodeText = async () => {
    if (!selectedSeriesId || !selectedEpisodeId) return;
    try {
      setGeneratingText(true);
      const updated = await apiCall<StudioEpisode>(
        `/story/studio/series/${selectedSeriesId}/episodes/${selectedEpisodeId}/generate-text`,
        {
          method: "POST",
          body: {
            userPrompt: generationPrompt.trim() || undefined,
            minWords: 1200,
            maxWords: 1500,
          },
        }
      );
      replaceEpisodeInState(updated);
      setEpisodeEditorText(updated.storyText || "");
      setEpisodeEditorSummary(updated.summary || "");
    } catch {
      alert("Episodentext konnte nicht generiert werden.");
    } finally {
      setGeneratingText(false);
    }
  };

  const handleSaveEpisodeText = async (approve: boolean) => {
    if (!selectedSeriesId || !selectedEpisodeId || !episodeEditorText.trim()) return;
    try {
      setSaving(true);
      setWorkflowError(null);
      const updated = await apiCall<StudioEpisode>(
        `/story/studio/series/${selectedSeriesId}/episodes/${selectedEpisodeId}/text`,
        {
          method: "PUT",
          body: {
            storyText: episodeEditorText.trim(),
            summary: episodeEditorSummary.trim() || undefined,
            approve,
          },
        }
      );
      replaceEpisodeInState(updated);
      setEpisodeEditorText(updated.storyText || "");
      setEpisodeEditorSummary(updated.summary || "");
      if (approve) {
        setCombinedEpisodeText("");
      }
    } catch {
      alert("Text konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const replaceSceneInState = (updated: StudioEpisodeScene) => {
    setScenes((prev) =>
      prev
        .map((scene) => (scene.id === updated.id ? updated : scene))
        .sort((a, b) => a.sceneOrder - b.sceneOrder)
    );
  };

  const updateSceneDraft = (sceneId: string, updates: Partial<StudioEpisodeScene>) => {
    setScenes((prev) =>
      prev.map((scene) => (scene.id === sceneId ? { ...scene, ...updates } : scene))
    );
  };

  const toggleSceneParticipant = (sceneId: string, characterId: string) => {
    setScenes((prev) =>
      prev.map((scene) => {
        if (scene.id !== sceneId) return scene;
        const exists = scene.participantCharacterIds.includes(characterId);
        return {
          ...scene,
          participantCharacterIds: exists
            ? scene.participantCharacterIds.filter((id) => id !== characterId)
            : [...scene.participantCharacterIds, characterId],
        };
      })
    );
  };

  const handleSplitScenes = async () => {
    if (!selectedSeriesId || !selectedEpisodeId) return;
    try {
      setSplittingScenes(true);
      setWorkflowError(null);
      const result = await apiCall<EpisodeWithScenesResponse>(
        `/story/studio/series/${selectedSeriesId}/episodes/${selectedEpisodeId}/split-scenes`,
        {
          method: "POST",
          body: {
            targetSceneCount: 10,
            minSceneCount: 10,
            maxSceneCount: 12,
            userPrompt: splitPrompt.trim() || undefined,
          },
        }
      );
      replaceEpisodeInState(result.episode);
      setScenes(result.scenes || []);
      setCombinedEpisodeText("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Szenen konnten nicht erstellt werden.";
      setWorkflowError(message);
    } finally {
      setSplittingScenes(false);
    }
  };

  const handleSaveScene = async (scene: StudioEpisodeScene) => {
    if (!selectedSeriesId || !selectedEpisodeId) return;
    try {
      setSceneSavingId(scene.id);
      setWorkflowError(null);
      const updated = await apiCall<StudioEpisodeScene>(
        `/story/studio/series/${selectedSeriesId}/episodes/${selectedEpisodeId}/scenes/${scene.id}`,
        {
          method: "PUT",
          body: {
            title: scene.title,
            sceneText: scene.sceneText,
            imagePrompt: scene.imagePrompt || undefined,
            participantCharacterIds: scene.participantCharacterIds,
          },
        }
      );
      replaceSceneInState(updated);
      await refreshSelectedEpisode();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Szene konnte nicht gespeichert werden.";
      setWorkflowError(message);
    } finally {
      setSceneSavingId(null);
    }
  };

  const handleGenerateSceneImage = async (scene: StudioEpisodeScene) => {
    if (!selectedSeriesId || !selectedEpisodeId) return;
    try {
      setSceneGeneratingId(scene.id);
      setWorkflowError(null);
      const result = await apiCall<{ episode: StudioEpisode; scene: StudioEpisodeScene }>(
        `/story/studio/series/${selectedSeriesId}/episodes/${selectedEpisodeId}/scenes/${scene.id}/generate-image`,
        {
          method: "POST",
          body: {
            imagePrompt: scene.imagePrompt?.trim() || undefined,
          },
        }
      );
      replaceEpisodeInState(result.episode);
      replaceSceneInState(result.scene);
      if (result.episode.status !== "composed" && result.episode.status !== "published") {
        setCombinedEpisodeText("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bild konnte nicht generiert werden.";
      setWorkflowError(message);
    } finally {
      setSceneGeneratingId(null);
    }
  };

  const handleGenerateAllSceneImages = async (forceRegenerate = false) => {
    if (!selectedSeriesId || !selectedEpisodeId) return;
    try {
      setBulkGeneratingImages(true);
      setWorkflowError(null);
      const result = await apiCall<EpisodeWithScenesResponse>(
        `/story/studio/series/${selectedSeriesId}/episodes/${selectedEpisodeId}/generate-images`,
        {
          method: "POST",
          body: { forceRegenerate },
        }
      );
      replaceEpisodeInState(result.episode);
      setScenes(result.scenes || []);
      if (result.episode.status !== "composed" && result.episode.status !== "published") {
        setCombinedEpisodeText("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilder konnten nicht generiert werden.";
      setWorkflowError(message);
    } finally {
      setBulkGeneratingImages(false);
    }
  };

  const handleComposeEpisode = async () => {
    if (!selectedSeriesId || !selectedEpisodeId) return;
    try {
      setComposingEpisode(true);
      setWorkflowError(null);
      const result = await apiCall<ComposeEpisodeResponse>(
        `/story/studio/series/${selectedSeriesId}/episodes/${selectedEpisodeId}/compose`,
        { method: "POST" }
      );
      replaceEpisodeInState(result.episode);
      setScenes(result.scenes || []);
      setCombinedEpisodeText(result.combinedText || "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Episode konnte nicht zusammengesetzt werden.";
      setWorkflowError(message);
    } finally {
      setComposingEpisode(false);
    }
  };

  const handlePublishEpisode = async () => {
    if (!selectedSeriesId || !selectedEpisodeId) return;
    try {
      setPublishingEpisode(true);
      setWorkflowError(null);
      const updated = await apiCall<StudioEpisode>(
        `/story/studio/series/${selectedSeriesId}/episodes/${selectedEpisodeId}/publish`,
        { method: "POST" }
      );
      replaceEpisodeInState(updated);
      await refreshSeriesOverviewItem(selectedSeriesId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Episode konnte nicht veroeffentlicht werden.";
      setWorkflowError(message);
    } finally {
      setPublishingEpisode(false);
    }
  };

  const openPublishedEpisodeReader = (episodeId: string) => {
    navigate(`/story-reader/studio-${episodeId}`);
  };

  if (loading) {
    return <div className={cn("rounded-2xl border p-6 text-sm", palette.card, palette.muted)}>Talea Studio wird geladen...</div>;
  }

  const editorWorkspace = (
    <section className="space-y-4">
      <div className={cn("rounded-2xl border p-4 md:p-5", palette.card)}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", palette.muted)}>Talea Studio</p>
            <h2 className={cn("text-3xl md:text-4xl", palette.text)} style={{ fontFamily: headingFont }}>Serien-Workspace</h2>
            <p className={cn("mt-1 text-sm", palette.muted)}>
              Story Charaktere sind strikt an eine Serie gebunden und nicht fuer andere Serien verfuegbar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowSeriesForm((prev) => !prev);
              setShowCharacterForm(false);
              setShowEpisodeForm(false);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f]"
          >
            <Plus className="h-4 w-4" />
            Neue Talea Studio Serie
          </button>
        </div>
      </div>

      {showSeriesForm && (
        <div className={cn("rounded-2xl border p-4", palette.sub)}>
          <h3 className={cn("text-xl", palette.text)} style={{ fontFamily: headingFont }}>Neue Serie</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} placeholder="Serientitel" className={cn("h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)} />
            <input value={seriesLogline} onChange={(e) => setSeriesLogline(e.target.value)} placeholder="Logline (optional)" className={cn("h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)} />
          </div>
          <textarea
            value={seriesDescription}
            onChange={(e) => setSeriesDescription(e.target.value)}
            placeholder="Allgemeine Serien-Infos / Vorgeschichte (optional)"
            rows={3}
            className={cn("mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#a88f80]", palette.input)}
          />
          <textarea
            value={seriesCanon}
            onChange={(e) => setSeriesCanon(e.target.value)}
            placeholder="Serien-Canon / feste Regeln fuer alle Folgen (optional)"
            rows={3}
            className={cn("mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#a88f80]", palette.input)}
          />
          <button type="button" disabled={saving || !seriesTitle.trim()} onClick={handleCreateSeries} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f] disabled:opacity-50">
            <Sparkles className="h-4 w-4" />
            Serie erstellen
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn("rounded-2xl border p-4", palette.card)}>
          <h3 className={cn("text-xl", palette.text)} style={{ fontFamily: headingFont }}>Studio Serien</h3>
          <div className="mt-3 space-y-2">
            {series.map((item, index) => (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => setSelectedSeriesId(item.id)}
                initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
                className={cn("w-full rounded-xl border px-3 py-2.5 text-left", selectedSeriesId === item.id ? "border-[#a88f80] bg-[#f3e8da] dark:bg-[#2a394f]" : palette.sub)}
              >
                <p className="text-sm font-semibold text-[#243246] dark:text-[#e6edf8]">{item.title}</p>
                <p className="text-xs text-[#68788c] dark:text-[#9fb0c7]">{item.status}</p>
              </motion.button>
            ))}
          </div>
        </aside>

        <div className={cn("rounded-2xl border p-4 md:p-5", palette.card)}>
          {!selectedSeries ? (
            <div className={cn("rounded-xl border p-4 text-sm", palette.sub, palette.muted)}>Serie links auswaehlen.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={cn("text-3xl", palette.text)} style={{ fontFamily: headingFont }}>{selectedSeries.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setShowCharacterForm((prev) => !prev); setShowEpisodeForm(false); }} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f]"><Users className="h-4 w-4" /> Story Charakter</button>
                  <button type="button" onClick={() => { setShowEpisodeForm((prev) => !prev); setShowCharacterForm(false); }} className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold", palette.sub, palette.text)}><Plus className="h-4 w-4" /> Neue Folge</button>
                </div>
              </div>

              <div className={cn("rounded-xl border p-4", palette.sub)}>
                <p className={cn("text-xs font-semibold uppercase tracking-wide", palette.muted)}>
                  Serien-Grundlagen (fuer alle Folgen)
                </p>
                <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <input
                    value={seriesEditTitle}
                    onChange={(event) => setSeriesEditTitle(event.target.value)}
                    placeholder="Serientitel"
                    className={cn("h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)}
                  />
                  <input
                    value={seriesEditLogline}
                    onChange={(event) => setSeriesEditLogline(event.target.value)}
                    placeholder="Logline"
                    className={cn("h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)}
                  />
                </div>
                <textarea
                  value={seriesEditDescription}
                  onChange={(event) => setSeriesEditDescription(event.target.value)}
                  placeholder="Vorgeschichte / allgemeine Serieninfos"
                  rows={3}
                  className={cn("mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#a88f80]", palette.input)}
                />
                <textarea
                  value={seriesEditCanon}
                  onChange={(event) => setSeriesEditCanon(event.target.value)}
                  placeholder="Canon / feste Regeln fuer alle Folgen"
                  rows={3}
                  className={cn("mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#a88f80]", palette.input)}
                />
                <button
                  type="button"
                  onClick={handleSaveSeriesInfo}
                  disabled={savingSeriesInfo || !seriesEditTitle.trim()}
                  className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f] disabled:opacity-50"
                >
                  {savingSeriesInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Serieninfos speichern
                </button>
              </div>

              {showCharacterForm && (
                <div className={cn("rounded-xl border p-4", palette.sub)}>
                  <p className={cn("text-xs font-semibold uppercase tracking-wide", palette.muted)}>Serie-exklusiv</p>
                  <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="Name" className={cn("h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)} />
                    <input value={characterRole} onChange={(e) => setCharacterRole(e.target.value)} placeholder="Rolle" className={cn("h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)} />
                    <input value={characterPrompt} onChange={(e) => setCharacterPrompt(e.target.value)} placeholder="Generierungs-Prompt" className={cn("h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)} />
                  </div>
                  <button type="button" disabled={saving || !characterName.trim() || !characterPrompt.trim()} onClick={handleCreateCharacter} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f] disabled:opacity-50"><Wand2 className="h-4 w-4" /> Charakter generieren</button>
                </div>
              )}

              {showEpisodeForm && (
                <div className={cn("rounded-xl border p-4", palette.sub)}>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input type="number" min={1} value={episodeNumber} onChange={(e) => setEpisodeNumber(Number(e.target.value))} placeholder="Folge Nr." className={cn("h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)} />
                    <input value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)} placeholder="Folgentitel" className={cn("h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)} />
                    <div className={cn("rounded-xl border px-3 py-2 text-xs", palette.input)}>
                      <p className={cn("mb-1 font-semibold uppercase tracking-wide", palette.muted)}>Charaktere</p>
                      <div className="max-h-24 space-y-1 overflow-auto">
                        {characters.map((character) => (
                          <label key={character.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={episodeCharacterIds.includes(character.id)}
                              onChange={() => setEpisodeCharacterIds((prev) => prev.includes(character.id) ? prev.filter((id) => id !== character.id) : [...prev, character.id])}
                            />
                            <span>{character.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button type="button" disabled={saving || !episodeTitle.trim()} onClick={handleCreateEpisode} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f] disabled:opacity-50"><BookOpen className="h-4 w-4" /> Folge anlegen</button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className={cn("rounded-xl border p-4", palette.sub)}>
                  <h4 className={cn("text-xl", palette.text)} style={{ fontFamily: headingFont }}>Story Charaktere</h4>
                  {detailLoading ? (
                    <p className={cn("mt-2 text-sm", palette.muted)}>Lade Charaktere...</p>
                  ) : characters.length === 0 ? (
                    <p className={cn("mt-2 text-sm", palette.muted)}>Keine Charaktere vorhanden.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {characters.map((character) => (
                        <div key={character.id} className="rounded-lg border border-[#d8cbbf] bg-white/60 p-2 dark:border-[#415676] dark:bg-[#1f2c42]">
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 overflow-hidden rounded-md bg-[#e6ddd0] dark:bg-[#30445f]">
                              {character.imageUrl ? <img src={character.imageUrl} alt={character.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[#7c7468] dark:text-[#9fb0c7]"><Users className="h-4 w-4" /></div>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#243246] dark:text-[#e6edf8]">{character.name}</p>
                              <p className="truncate text-xs text-[#68788c] dark:text-[#9fb0c7]">{character.role || "ohne Rolle"}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => startCharacterEdit(character)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#cdb8a2] bg-[#f3eadc] px-2.5 text-xs font-semibold text-[#2f3c4f] hover:bg-[#eee2d1] dark:border-[#4e6484] dark:bg-[#2a3950] dark:text-[#dbe7f8]"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Bearbeiten
                            </button>
                          </div>

                          {editingCharacterId === character.id && (
                            <div className={cn("mt-2 space-y-2 rounded-xl border p-2.5", palette.input)}>
                              <input
                                value={editingCharacterName}
                                onChange={(event) => setEditingCharacterName(event.target.value)}
                                placeholder="Name"
                                className={cn("h-9 w-full rounded-lg border px-2.5 text-xs outline-none focus:border-[#a88f80]", palette.input)}
                              />
                              <input
                                value={editingCharacterRole}
                                onChange={(event) => setEditingCharacterRole(event.target.value)}
                                placeholder="Rolle"
                                className={cn("h-9 w-full rounded-lg border px-2.5 text-xs outline-none focus:border-[#a88f80]", palette.input)}
                              />
                              <textarea
                                value={editingCharacterDescription}
                                onChange={(event) => setEditingCharacterDescription(event.target.value)}
                                placeholder="Beschreibung"
                                rows={2}
                                className={cn("w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:border-[#a88f80]", palette.input)}
                              />
                              <textarea
                                value={editingCharacterPrompt}
                                onChange={(event) => setEditingCharacterPrompt(event.target.value)}
                                placeholder="Generierungs-Prompt"
                                rows={2}
                                className={cn("w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:border-[#a88f80]", palette.input)}
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={handleUpdateCharacter}
                                  disabled={updatingCharacter || !editingCharacterName.trim() || !editingCharacterPrompt.trim()}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-2.5 text-xs font-semibold text-[#2f3c4f] disabled:opacity-50"
                                >
                                  {updatingCharacter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                                  Speichern
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelCharacterEdit}
                                  className={cn("inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold", palette.sub, palette.text)}
                                >
                                  Abbrechen
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={cn("rounded-xl border p-4", palette.sub)}>
                  <h4 className={cn("text-xl", palette.text)} style={{ fontFamily: headingFont }}>Folgen</h4>
                  {detailLoading ? (
                    <p className={cn("mt-2 text-sm", palette.muted)}>Lade Folgen...</p>
                  ) : episodes.length === 0 ? (
                    <p className={cn("mt-2 text-sm", palette.muted)}>Noch keine Folge vorhanden.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {episodes.map((episode) => (
                        <div
                          key={episode.id}
                          className={cn(
                            "rounded-lg border p-2.5 text-sm",
                            selectedEpisodeId === episode.id
                              ? "border-[#a88f80] bg-[#f3e8da] dark:bg-[#2a394f]"
                              : "border-[#d8cbbf] bg-white/60 dark:border-[#415676] dark:bg-[#1f2c42]"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedEpisodeId(episode.id)}
                            className="w-full text-left"
                          >
                            <p className="font-semibold text-[#243246] dark:text-[#e6edf8]">
                              Folge {episode.episodeNumber}: {episode.title}
                            </p>
                            <p className="mt-1 text-xs text-[#68788c] dark:text-[#9fb0c7]">
                              {episode.status} - {episode.selectedCharacterIds?.length || 0} Charaktere
                            </p>
                          </button>

                          {episode.status === "published" && (
                            <button
                              type="button"
                              onClick={() => openPublishedEpisodeReader(episode.id)}
                              className="mt-2 inline-flex h-8 items-center gap-1 rounded-lg border border-[#cdb8a2] bg-[#f3eadc] px-2.5 text-xs font-semibold text-[#2f3c4f] hover:bg-[#eee2d1] dark:border-[#4e6484] dark:bg-[#2a3950] dark:text-[#dbe7f8]"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              Lesen wie Story
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedEpisode && (
                <div className={cn("rounded-xl border p-4", palette.sub)}>
                  <div className="flex flex-wrap items-center gap-2">
                    {wizardSteps.map((step) => (
                      <span
                        key={step.key}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                          step.done
                            ? "border-[#4f7f78] bg-[#4f7f78] text-white"
                            : "border-[#cdbda9] text-[#68788c] dark:border-[#4d6382] dark:text-[#9fb0c7]"
                        )}
                      >
                        {step.done ? <Check className="h-3.5 w-3.5" /> : <span className="h-3 w-3 rounded-full border border-current" />}
                        {step.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {workflowError && (
                <div className="rounded-xl border border-[#d1a8a8] bg-[#f8e8e8] px-3 py-2 text-sm text-[#873b3b] dark:border-[#7b4949] dark:bg-[#3d2525] dark:text-[#f1c3c3]">
                  {workflowError}
                </div>
              )}

              <div className={cn("rounded-xl border p-4", palette.sub)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className={cn("text-xl", palette.text)} style={{ fontFamily: headingFont }}>
                    Episodentext Editor
                  </h4>
                  {selectedEpisode && (
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", palette.muted)}>
                      Folge {selectedEpisode.episodeNumber} - {selectedEpisode.status}
                    </p>
                  )}
                </div>

                {!selectedEpisode ? (
                  <p className={cn("mt-2 text-sm", palette.muted)}>
                    Waehle zuerst eine Folge aus, um den Text zu bearbeiten.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                      <input
                        value={generationPrompt}
                        onChange={(e) => setGenerationPrompt(e.target.value)}
                        placeholder="Optionaler Zusatzprompt fuer KI-Generierung (z. B. Stimmung, Twist, Stil)"
                        className={cn("h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)}
                      />
                      <button
                        type="button"
                        onClick={handleGenerateEpisodeText}
                        disabled={generatingText || saving}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f] disabled:opacity-50"
                      >
                        {generatingText ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        KI generieren (GPT-5.2)
                      </button>
                    </div>

                    <p className={cn("text-xs", palette.muted)}>
                      Du kannst hier auch extern generierten Text direkt einfuegen und spaeter akzeptieren.
                    </p>

                    <input
                      value={episodeEditorSummary}
                      onChange={(e) => setEpisodeEditorSummary(e.target.value)}
                      placeholder="Kurz-Zusammenfassung der Folge (optional)"
                      className={cn("h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)}
                    />

                    <textarea
                      value={episodeEditorText}
                      onChange={(e) => setEpisodeEditorText(e.target.value)}
                      placeholder="Episodentext (1200-1500 Woerter). Hier KI-Text anpassen oder externen Text einfuegen."
                      rows={16}
                      className={cn("w-full rounded-xl border px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#a88f80]", palette.input)}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEpisodeText(false)}
                        disabled={saving || generatingText || !episodeEditorText.trim()}
                        className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold", palette.sub, palette.text, "disabled:opacity-50")}
                      >
                        <FileText className="h-4 w-4" />
                        Entwurf speichern
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEpisodeText(true)}
                        disabled={saving || generatingText || !episodeEditorText.trim()}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f] disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        Text akzeptieren
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className={cn("rounded-xl border p-4", palette.sub)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className={cn("text-xl", palette.text)} style={{ fontFamily: headingFont }}>
                    Szenen und Bildprompts
                  </h4>
                  {selectedEpisode && (
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", palette.muted)}>
                      {scenes.length} Szenen
                    </p>
                  )}
                </div>

                {!selectedEpisode ? (
                  <p className={cn("mt-2 text-sm", palette.muted)}>
                    Waehle zuerst eine Folge aus.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                      <input
                        value={splitPrompt}
                        onChange={(event) => setSplitPrompt(event.target.value)}
                        placeholder="Optional: Hinweise fuer Szenen-Aufteilung und Bildstil"
                        className={cn("h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)}
                      />
                      <button
                        type="button"
                        onClick={handleSplitScenes}
                        disabled={splittingScenes || saving || !episodeEditorText.trim()}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f] disabled:opacity-50"
                      >
                        {splittingScenes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                        KI-Szenen erzeugen
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleGenerateAllSceneImages(false)}
                        disabled={bulkGeneratingImages || splittingScenes || scenes.length === 0}
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                          palette.sub,
                          palette.text
                        )}
                      >
                        {bulkGeneratingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        Alle fehlenden Bilder
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateAllSceneImages(true)}
                        disabled={bulkGeneratingImages || splittingScenes || scenes.length === 0}
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                          palette.sub,
                          palette.text
                        )}
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Alle neu generieren
                      </button>
                    </div>

                    {sceneLoading ? (
                      <p className={cn("text-sm", palette.muted)}>Lade Szenen...</p>
                    ) : scenes.length === 0 ? (
                      <p className={cn("text-sm", palette.muted)}>
                        Noch keine Szenen vorhanden. Nach "Text akzeptieren" kannst du hier die automatische Aufteilung starten.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {scenes.map((scene) => (
                          <div key={scene.id} className="rounded-xl border border-[#d8cbbf] bg-white/60 p-3 dark:border-[#415676] dark:bg-[#1f2c42]">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#68788c] dark:text-[#9fb0c7]">
                                    Szene {scene.sceneOrder}
                                  </p>
                                  <p className="text-[11px] text-[#68788c] dark:text-[#9fb0c7]">
                                    {scene.imageUrl ? "Bild vorhanden" : "Noch kein Bild"}
                                  </p>
                                </div>

                                <input
                                  value={scene.title}
                                  onChange={(event) => updateSceneDraft(scene.id, { title: event.target.value })}
                                  placeholder="Szenentitel"
                                  className={cn("h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#a88f80]", palette.input)}
                                />

                                <textarea
                                  value={scene.sceneText}
                                  onChange={(event) => updateSceneDraft(scene.id, { sceneText: event.target.value })}
                                  rows={5}
                                  placeholder="Szeneninhalt"
                                  className={cn("w-full rounded-xl border px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#a88f80]", palette.input)}
                                />

                                <textarea
                                  value={scene.imagePrompt || ""}
                                  onChange={(event) => updateSceneDraft(scene.id, { imagePrompt: event.target.value })}
                                  rows={3}
                                  placeholder="Bildprompt"
                                  className={cn("w-full rounded-xl border px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#a88f80]", palette.input)}
                                />

                                <div className={cn("rounded-xl border px-3 py-2", palette.input)}>
                                  <p className={cn("mb-1 text-[11px] font-semibold uppercase tracking-wide", palette.muted)}>
                                    Teilnehmende Charaktere
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {characters.map((character) => {
                                      const active = scene.participantCharacterIds.includes(character.id);
                                      return (
                                        <button
                                          key={character.id}
                                          type="button"
                                          onClick={() => toggleSceneParticipant(scene.id, character.id)}
                                          className={cn(
                                            "rounded-full border px-2.5 py-1 text-xs font-semibold",
                                            active
                                              ? "border-[#4f7f78] bg-[#4f7f78] text-white"
                                              : "border-[#cbbca9] text-[#6d7d8f] dark:border-[#4d6382] dark:text-[#9fb0c7]"
                                          )}
                                        >
                                          {character.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveScene(scene)}
                                    disabled={sceneSavingId === scene.id || sceneGeneratingId === scene.id || bulkGeneratingImages}
                                    className={cn(
                                      "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                                      palette.sub,
                                      palette.text
                                    )}
                                  >
                                    {sceneSavingId === scene.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                                    Szene speichern
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateSceneImage(scene)}
                                    disabled={sceneGeneratingId === scene.id || sceneSavingId === scene.id || bulkGeneratingImages}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f] disabled:opacity-50"
                                  >
                                    {sceneGeneratingId === scene.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                                    {scene.imageUrl ? "Bild neu generieren" : "Bild generieren"}
                                  </button>
                                </div>
                              </div>

                              <div className="overflow-hidden rounded-xl border border-[#d8cbbf] bg-[#ece2d4] dark:border-[#415676] dark:bg-[#2a3a52]">
                                {scene.imageUrl ? (
                                  <img src={scene.imageUrl} alt={scene.title} className="h-full min-h-[180px] w-full object-cover" />
                                ) : (
                                  <div className="flex h-full min-h-[180px] w-full items-center justify-center text-[#6d7d8f] dark:text-[#9fb0c7]">
                                    <ImagePlus className="h-6 w-6" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={cn("rounded-xl border p-4", palette.sub)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className={cn("text-xl", palette.text)} style={{ fontFamily: headingFont }}>
                    Compose und Publish
                  </h4>
                  {selectedEpisode && (
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", palette.muted)}>
                      Status: {selectedEpisode.status}
                    </p>
                  )}
                </div>

                {!selectedEpisode ? (
                  <p className={cn("mt-2 text-sm", palette.muted)}>
                    Waehle zuerst eine Folge aus.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleComposeEpisode}
                        disabled={composingEpisode || !canCompose}
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                          canCompose
                            ? "border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] text-[#2f3c4f]"
                            : `${palette.sub} ${palette.text}`
                        )}
                      >
                        {composingEpisode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                        Episode zusammensetzen
                      </button>
                      <button
                        type="button"
                        onClick={handlePublishEpisode}
                        disabled={publishingEpisode || !canPublish}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f] disabled:opacity-50"
                      >
                        {publishingEpisode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Veroeffentlichen
                      </button>
                    </div>

                    {selectedEpisode.status === "published" && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#79a58e] bg-[#e6f2ea] px-3 py-2 dark:border-[#4f7f68] dark:bg-[#264335]">
                        <p className="text-sm text-[#2f5b46] dark:text-[#b6d8c5]">
                          Diese Folge ist veroeffentlicht.
                        </p>
                        <button
                          type="button"
                          onClick={() => openPublishedEpisodeReader(selectedEpisode.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#79a58e] bg-white/70 px-2.5 text-xs font-semibold text-[#2f5b46] hover:bg-white dark:border-[#5d8f76] dark:bg-[#1f362a] dark:text-[#b6d8c5]"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          Im Story Reader lesen
                        </button>
                      </div>
                    )}

                    {(combinedEpisodeText || selectedEpisode.status === "published" || selectedEpisode.status === "composed") && scenes.length > 0 && (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-[#d8cbbf] bg-white/60 p-3 text-sm leading-relaxed text-[#2f3c4f] dark:border-[#415676] dark:bg-[#1f2c42] dark:text-[#e6edf8]">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#68788c] dark:text-[#9fb0c7]">
                            Zusammengesetzter Lesetext
                          </p>
                          <p className="mt-2 whitespace-pre-wrap">
                            {combinedEpisodeText ||
                              scenes
                                .map((scene) => `Szene ${scene.sceneOrder}: ${scene.title}\n\n${scene.sceneText}`)
                                .join("\n\n")}
                          </p>
                        </div>

                        <div className="space-y-3">
                          {scenes.map((scene) => (
                            <article key={scene.id} className="rounded-xl border border-[#d8cbbf] bg-white/60 p-3 dark:border-[#415676] dark:bg-[#1f2c42]">
                              <h5 className="text-lg font-semibold text-[#243246] dark:text-[#e6edf8]" style={{ fontFamily: headingFont }}>
                                Szene {scene.sceneOrder}: {scene.title}
                              </h5>
                              {scene.imageUrl && (
                                <img src={scene.imageUrl} alt={scene.title} className="mt-2 max-h-[280px] w-full rounded-lg object-cover" />
                              )}
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#425367] dark:text-[#c0cee3]">
                                {scene.sceneText}
                              </p>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <section className="space-y-4">
      {workspaceView === "library" ? (
        <>
          <div className={cn("rounded-2xl border p-4 md:p-5", palette.card)}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", palette.muted)}>Talea Studio</p>
                <h2 className={cn("text-3xl md:text-4xl", palette.text)} style={{ fontFamily: headingFont }}>
                  Studio Serien
                </h2>
                <p className={cn("mt-1 text-sm", palette.muted)}>
                  Serien werden hier wie Story-Karten angezeigt. Folgen oeffnest du danach auf der Serienseite.
                </p>
              </div>
              <button
                type="button"
                onClick={openEditorForNewSeries}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f]"
              >
                <Plus className="h-4 w-4" />
                Neue Talea Studio Serie
              </button>
            </div>
          </div>

          {series.length === 0 ? (
            <div className={cn("rounded-2xl border p-6 text-sm", palette.card, palette.muted)}>
              Noch keine Studio-Serie vorhanden. Lege deine erste Serie an und starte dann mit den Folgen.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {series.map((item, index) => {
                const overview = seriesOverview[item.id];
                const statusText = overview?.latestEpisodeStatus
                  ? episodeStatusLabel[overview.latestEpisodeStatus]
                  : "Noch keine Folgen";
                return (
                  <motion.article
                    key={item.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.26, delay: index * 0.03 }}
                    className={cn(
                      "group cursor-pointer overflow-hidden rounded-2xl border shadow-[0_12px_30px_rgba(21,32,44,0.08)] transition-transform hover:-translate-y-0.5",
                      palette.card
                    )}
                    onClick={() => openSeriesView(item.id)}
                  >
                    <div
                      className="relative h-44 overflow-hidden"
                      style={{
                        background: overview?.coverImageUrl
                          ? `linear-gradient(180deg, rgba(22,32,52,0.08), rgba(22,32,52,0.75)), url(${overview.coverImageUrl}) center/cover no-repeat`
                          : "linear-gradient(135deg, #f0ddd9 0%, #e2deef 45%, #d8e5dc 100%)",
                      }}
                    >
                      <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/35 bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                        <Layers3 className="h-3.5 w-3.5" />
                        Serie
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                        <h3 className="line-clamp-2 text-2xl leading-tight" style={{ fontFamily: headingFont }}>
                          {item.title}
                        </h3>
                      </div>
                    </div>

                    <div className="space-y-3 p-4">
                      <p className={cn("line-clamp-2 text-sm", palette.muted)}>
                        {item.logline || item.description || "Serie ohne Logline."}
                      </p>
                      <div className={cn("grid grid-cols-3 gap-2 rounded-xl border px-3 py-2 text-xs", palette.sub)}>
                        <div>
                          <p className={palette.muted}>Folgen</p>
                          <p className={cn("font-semibold", palette.text)}>{overview?.episodeCount ?? 0}</p>
                        </div>
                        <div>
                          <p className={palette.muted}>Publiziert</p>
                          <p className={cn("font-semibold", palette.text)}>{overview?.publishedCount ?? 0}</p>
                        </div>
                        <div>
                          <p className={palette.muted}>Charaktere</p>
                          <p className={cn("font-semibold", palette.text)}>{overview?.characterCount ?? 0}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-xs", palette.muted)}>
                          {statusText}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditorForSeries(item.id);
                            }}
                            className={cn(
                              "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold",
                              palette.sub,
                              palette.text
                            )}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Bearbeiten
                          </button>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4f7f78]">
                            Folgen
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}

          {overviewLoading && (
            <p className={cn("text-xs", palette.muted)}>Lade Serien-Uebersicht...</p>
          )}
        </>
      ) : (
        <div className={cn("rounded-2xl border p-4 md:p-5", palette.card)}>
          {!selectedSeries ? (
            <div className={cn("rounded-xl border p-4 text-sm", palette.sub, palette.muted)}>
              Serie wurde nicht gefunden.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setWorkspaceView("library")}
                    className={cn("inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold", palette.sub, palette.text)}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Zur Serienliste
                  </button>
                  <h3 className={cn("text-3xl leading-tight", palette.text)} style={{ fontFamily: headingFont }}>
                    {selectedSeries.title}
                  </h3>
                  <p className={cn("max-w-3xl text-sm", palette.muted)}>
                    {selectedSeries.logline || selectedSeries.description || "Keine Serien-Beschreibung hinterlegt."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditorForSeries(selectedSeries.id, { newEpisode: true })}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8c8ba] bg-[linear-gradient(135deg,#f2d7d3_0%,#e9d8e8_45%,#d8e3d2_100%)] px-4 text-sm font-semibold text-[#2f3c4f]"
                  >
                    <Plus className="h-4 w-4" />
                    Neue Folge erstellen
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditorForSeries(selectedSeries.id)}
                    className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold", palette.sub, palette.text)}
                  >
                    <Edit3 className="h-4 w-4" />
                    Serie bearbeiten
                  </button>
                </div>
              </div>

              <div className={cn("grid grid-cols-1 gap-3 rounded-xl border p-3 md:grid-cols-4", palette.sub)}>
                <div>
                  <p className={cn("text-xs uppercase tracking-wide", palette.muted)}>Folgen</p>
                  <p className={cn("text-xl font-semibold", palette.text)}>{selectedSeriesOverview?.episodeCount ?? episodes.length}</p>
                </div>
                <div>
                  <p className={cn("text-xs uppercase tracking-wide", palette.muted)}>Veroeffentlicht</p>
                  <p className={cn("text-xl font-semibold", palette.text)}>{selectedSeriesOverview?.publishedCount ?? 0}</p>
                </div>
                <div>
                  <p className={cn("text-xs uppercase tracking-wide", palette.muted)}>Story Charaktere</p>
                  <p className={cn("text-xl font-semibold", palette.text)}>{selectedSeriesOverview?.characterCount ?? characters.length}</p>
                </div>
                <div>
                  <p className={cn("text-xs uppercase tracking-wide", palette.muted)}>Aktualisiert</p>
                  <p className={cn("text-xl font-semibold", palette.text)}>{formatDate(selectedSeries.updatedAt)}</p>
                </div>
              </div>

              {detailLoading ? (
                <p className={cn("text-sm", palette.muted)}>Lade Folgen...</p>
              ) : episodes.length === 0 ? (
                <div className={cn("rounded-xl border p-4 text-sm", palette.sub, palette.muted)}>
                  Noch keine Folgen vorhanden. Erstelle die erste Folge fuer diese Serie.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {episodes.map((episode) => (
                    <article key={episode.id} className={cn("rounded-xl border p-4", palette.sub)}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={cn("text-xs font-semibold uppercase tracking-wide", palette.muted)}>
                            Folge {episode.episodeNumber}
                          </p>
                          <h4 className={cn("text-2xl leading-tight", palette.text)} style={{ fontFamily: headingFont }}>
                            {episode.title}
                          </h4>
                        </div>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", palette.input)}>
                          {episodeStatusLabel[episode.status]}
                        </span>
                      </div>

                      <p className={cn("mt-2 line-clamp-3 text-sm", palette.muted)}>
                        {episode.summary || "Noch keine Zusammenfassung fuer diese Folge."}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <p className={cn("text-xs", palette.muted)}>
                          Aktualisiert: {formatDate(episode.updatedAt)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {episode.status === "published" && (
                            <button
                              type="button"
                              onClick={() => openPublishedEpisodeReader(episode.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#79a58e] bg-[#e6f2ea] px-2.5 text-xs font-semibold text-[#2f5b46] hover:bg-[#def0e6] dark:border-[#5d8f76] dark:bg-[#264335] dark:text-[#b6d8c5]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Lesen
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditorForSeries(selectedSeries.id, { episodeId: episode.id })}
                            className={cn("inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold", palette.sub, palette.text)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Im Editor
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-[80] bg-[#0f1a2a]/70 p-2 backdrop-blur-[2px] sm:p-4">
          <div className={cn("mx-auto flex h-full w-full max-w-[1750px] flex-col overflow-hidden rounded-3xl border shadow-[0_30px_60px_rgba(9,16,28,0.4)]", palette.card)}>
            <div className={cn("flex items-center justify-between border-b px-4 py-3", palette.sub)}>
              <div>
                <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", palette.muted)}>Talea Studio Editor</p>
                <p className={cn("text-sm", palette.text)}>
                  Serien, Story Charaktere und Folgen in einem separaten, breiten Bearbeitungsbereich.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg border", palette.sub, palette.text)}
                aria-label="Editor schliessen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 md:p-5">{editorWorkspace}</div>
          </div>
        </div>
      )}
    </section>
  );
};

export default TaleaStudioWorkspace;

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  Check,
  Clapperboard,
  FileText,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";

import { getBackendUrl } from "@/config";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import type { StudioCharacter, StudioEpisode, StudioEpisodeScene, StudioSeries } from "@/types/studio";

const headingFont = '"Cormorant Garamond", "Times New Roman", serif';

type ApiInit = { method?: "GET" | "POST" | "PUT"; body?: unknown };
type EpisodeWithScenesResponse = { episode: StudioEpisode; scenes: StudioEpisodeScene[] };
type ComposeEpisodeResponse = EpisodeWithScenesResponse & { combinedText: string };

const TaleaStudioWorkspace: React.FC = () => {
  const { getToken } = useAuth();
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const isDark = resolvedTheme === "dark";

  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<StudioSeries[]>([]);
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
  const [characterName, setCharacterName] = useState("");
  const [characterRole, setCharacterRole] = useState("");
  const [characterPrompt, setCharacterPrompt] = useState("");
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

  const loadSeries = async () => {
    try {
      setLoading(true);
      const result = await apiCall<{ series: StudioSeries[] }>("/story/studio/series");
      const list = result.series || [];
      setSeries(list);
      setSelectedSeriesId((current) => current ?? list[0]?.id ?? null);
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
    if (selectedSeriesId) void loadDetails(selectedSeriesId);
    else {
      setCharacters([]);
      setEpisodes([]);
      setSelectedEpisodeId(null);
      setScenes([]);
      setCombinedEpisodeText("");
      setWorkflowError(null);
    }
  }, [selectedSeriesId]);

  useEffect(() => {
    if (selectedSeriesId && selectedEpisodeId) {
      void loadScenes(selectedSeriesId, selectedEpisodeId);
      return;
    }
    setScenes([]);
    setCombinedEpisodeText("");
  }, [selectedSeriesId, selectedEpisodeId]);

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

  const handleCreateSeries = async () => {
    if (!seriesTitle.trim()) return;
    try {
      setSaving(true);
      const created = await apiCall<StudioSeries>("/story/studio/series", {
        method: "POST",
        body: { title: seriesTitle.trim(), logline: seriesLogline.trim() || undefined, status: "draft" },
      });
      setSeries((prev) => [created, ...prev]);
      setSelectedSeriesId(created.id);
      setSeriesTitle("");
      setSeriesLogline("");
      setShowSeriesForm(false);
    } catch {
      alert("Serie konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
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
    } catch {
      alert("Story Charakter konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
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
          selectedCharacterIds: episodeCharacterIds,
        },
      });
      setEpisodes((prev) => [...prev, created].sort((a, b) => a.episodeNumber - b.episodeNumber));
      setSelectedEpisodeId(created.id);
      setEpisodeTitle("");
      setEpisodeCharacterIds([]);
      setEpisodeNumber((prev) => prev + 1);
      setShowEpisodeForm(false);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Episode konnte nicht veroeffentlicht werden.";
      setWorkflowError(message);
    } finally {
      setPublishingEpisode(false);
    }
  };

  if (loading) {
    return <div className={cn("rounded-2xl border p-6 text-sm", palette.card, palette.muted)}>Talea Studio wird geladen...</div>;
  }

  return (
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
                        <div key={character.id} className="flex items-center gap-2 rounded-lg border border-[#d8cbbf] bg-white/60 p-2 dark:border-[#415676] dark:bg-[#1f2c42]">
                          <div className="h-10 w-10 overflow-hidden rounded-md bg-[#e6ddd0] dark:bg-[#30445f]">
                            {character.imageUrl ? <img src={character.imageUrl} alt={character.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[#7c7468] dark:text-[#9fb0c7]"><Users className="h-4 w-4" /></div>}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#243246] dark:text-[#e6edf8]">{character.name}</p>
                            <p className="truncate text-xs text-[#68788c] dark:text-[#9fb0c7]">{character.role || "ohne Rolle"}</p>
                          </div>
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
                        <button
                          key={episode.id}
                          type="button"
                          onClick={() => setSelectedEpisodeId(episode.id)}
                          className={cn(
                            "w-full rounded-lg border p-2.5 text-left text-sm",
                            selectedEpisodeId === episode.id
                              ? "border-[#a88f80] bg-[#f3e8da] dark:bg-[#2a394f]"
                              : "border-[#d8cbbf] bg-white/60 dark:border-[#415676] dark:bg-[#1f2c42]"
                          )}
                        >
                          <p className="font-semibold text-[#243246] dark:text-[#e6edf8]">
                            Folge {episode.episodeNumber}: {episode.title}
                          </p>
                          <p className="mt-1 text-xs text-[#68788c] dark:text-[#9fb0c7]">
                            {episode.status} - {episode.selectedCharacterIds?.length || 0} Charaktere
                          </p>
                        </button>
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
                      <p className="rounded-xl border border-[#79a58e] bg-[#e6f2ea] px-3 py-2 text-sm text-[#2f5b46] dark:border-[#4f7f68] dark:bg-[#264335] dark:text-[#b6d8c5]">
                        Diese Folge ist veroeffentlicht.
                      </p>
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
};

export default TaleaStudioWorkspace;

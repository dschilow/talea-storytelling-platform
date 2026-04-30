import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

import { getBackendUrl } from "@/config";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import type {
  StudioCharacter,
  StudioEpisode,
  StudioEpisodeScene,
  StudioSeries,
} from "@/types/studio";

import StudioLibraryView, { type StudioSeriesOverview } from "./studio/StudioLibraryView";
import StudioSeriesDetailView from "./studio/StudioSeriesDetailView";
import StudioEpisodeEditor from "./studio/StudioEpisodeEditor";
import { CreateEpisodeModal, CreateSeriesModal } from "./studio/StudioCreateModals";
import { buildStudioPalette, headingFont } from "./studio/studioPalette";

type ApiInit = { method?: "GET" | "POST" | "PUT"; body?: unknown };
type EpisodeWithScenesResponse = { episode: StudioEpisode; scenes: StudioEpisodeScene[] };
type ComposeEpisodeResponse = EpisodeWithScenesResponse & { combinedText: string };
type WorkspaceView = "library" | "series" | "editor";

const TaleaStudioWorkspace: React.FC = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const palette = useMemo(() => buildStudioPalette(isDark), [isDark]);

  const [view, setView] = useState<WorkspaceView>("library");
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [series, setSeries] = useState<StudioSeries[]>([]);
  const [seriesOverview, setSeriesOverview] = useState<Record<string, StudioSeriesOverview>>({});
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<StudioCharacter[]>([]);
  const [episodes, setEpisodes] = useState<StudioEpisode[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<StudioEpisodeScene[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sceneLoading, setSceneLoading] = useState(false);

  const [showCreateSeriesModal, setShowCreateSeriesModal] = useState(false);
  const [showCreateEpisodeModal, setShowCreateEpisodeModal] = useState(false);
  const [savingSeries, setSavingSeries] = useState(false);
  const [savingEpisode, setSavingEpisode] = useState(false);
  const [savingSeriesInfo, setSavingSeriesInfo] = useState(false);

  const [generationPrompt, setGenerationPrompt] = useState("");
  const [generatingText, setGeneratingText] = useState(false);
  const [episodeEditorText, setEpisodeEditorText] = useState("");
  const [episodeEditorSummary, setEpisodeEditorSummary] = useState("");
  const [savingEpisodeText, setSavingEpisodeText] = useState(false);

  const [splitPrompt, setSplitPrompt] = useState("");
  const [splittingScenes, setSplittingScenes] = useState(false);
  const [bulkGeneratingImages, setBulkGeneratingImages] = useState(false);
  const [sceneSavingId, setSceneSavingId] = useState<string | null>(null);
  const [sceneGeneratingId, setSceneGeneratingId] = useState<string | null>(null);

  const [composingEpisode, setComposingEpisode] = useState(false);
  const [publishingEpisode, setPublishingEpisode] = useState(false);
  const [combinedEpisodeText, setCombinedEpisodeText] = useState("");
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const selectedSeries = useMemo(
    () => series.find((s) => s.id === selectedSeriesId) || null,
    [series, selectedSeriesId]
  );
  const selectedEpisode = useMemo(
    () => episodes.find((e) => e.id === selectedEpisodeId) || null,
    [episodes, selectedEpisodeId]
  );
  const selectedSeriesOverview = selectedSeriesId ? seriesOverview[selectedSeriesId] : undefined;
  const maxEpisodeNumber = useMemo(
    () => episodes.reduce((max, ep) => Math.max(max, ep.episodeNumber), 0),
    [episodes]
  );
  const allSceneImagesReady = useMemo(
    () => scenes.length > 0 && scenes.every((s) => Boolean(s.imageUrl)),
    [scenes]
  );
  const canCompose = allSceneImagesReady && scenes.length > 0;
  const canPublish = selectedEpisode?.status === "composed";

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

  const fetchSeriesOverview = async (seriesId: string): Promise<StudioSeriesOverview> => {
    const [chars, eps] = await Promise.all([
      apiCall<{ characters: StudioCharacter[] }>(`/story/studio/series/${seriesId}/characters`),
      apiCall<{ episodes: StudioEpisode[] }>(`/story/studio/series/${seriesId}/episodes`),
    ]);
    const charList = chars.characters || [];
    const epList = (eps.episodes || []).sort((a, b) => a.episodeNumber - b.episodeNumber);
    const latest = epList[epList.length - 1];
    const publishedCount = epList.filter((e) => e.status === "published").length;
    return {
      episodeCount: epList.length,
      publishedCount,
      characterCount: charList.length,
      latestEpisodeTitle: latest?.title,
      latestEpisodeStatus: latest?.status,
      coverImageUrl: charList.find((c) => Boolean(c.imageUrl))?.imageUrl,
    };
  };

  const refreshAllOverviews = async (seriesList: StudioSeries[]) => {
    if (seriesList.length === 0) {
      setSeriesOverview({});
      return;
    }
    try {
      setOverviewLoading(true);
      const entries = await Promise.all(
        seriesList.map(async (item) => {
          try {
            return [item.id, await fetchSeriesOverview(item.id)] as const;
          } catch {
            return [
              item.id,
              { episodeCount: 0, publishedCount: 0, characterCount: 0 } as StudioSeriesOverview,
            ] as const;
          }
        })
      );
      setSeriesOverview(Object.fromEntries(entries));
    } finally {
      setOverviewLoading(false);
    }
  };

  const refreshOverviewItem = async (seriesId: string) => {
    try {
      const overview = await fetchSeriesOverview(seriesId);
      setSeriesOverview((prev) => ({ ...prev, [seriesId]: overview }));
    } catch {
      // ignore — keep previous data
    }
  };

  const loadSeries = async () => {
    try {
      setLoading(true);
      const result = await apiCall<{ series: StudioSeries[] }>("/story/studio/series");
      const list = result.series || [];
      setSeries(list);
      await refreshAllOverviews(list);
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (seriesId: string) => {
    try {
      setDetailLoading(true);
      const [chars, eps] = await Promise.all([
        apiCall<{ characters: StudioCharacter[] }>(`/story/studio/series/${seriesId}/characters`),
        apiCall<{ episodes: StudioEpisode[] }>(`/story/studio/series/${seriesId}/episodes`),
      ]);
      setCharacters(chars.characters || []);
      const epList = (eps.episodes || []).sort((a, b) => a.episodeNumber - b.episodeNumber);
      setEpisodes(epList);
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
      return;
    }
    if (view === "series" || view === "editor") {
      void loadDetails(selectedSeriesId);
    }
  }, [selectedSeriesId, view]);

  useEffect(() => {
    if (view !== "editor") return;
    if (selectedSeriesId && selectedEpisodeId) {
      void loadScenes(selectedSeriesId, selectedEpisodeId);
    } else {
      setScenes([]);
    }
  }, [view, selectedSeriesId, selectedEpisodeId]);

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
  }, [selectedEpisode?.id, selectedEpisode?.updatedAt, selectedEpisode?.status]);

  const replaceEpisodeInState = (updated: StudioEpisode) => {
    setEpisodes((prev) =>
      prev
        .map((e) => (e.id === updated.id ? updated : e))
        .sort((a, b) => a.episodeNumber - b.episodeNumber)
    );
  };

  const replaceSceneInState = (updated: StudioEpisodeScene) => {
    setScenes((prev) =>
      prev
        .map((s) => (s.id === updated.id ? updated : s))
        .sort((a, b) => a.sceneOrder - b.sceneOrder)
    );
  };

  const updateSceneDraft = (sceneId: string, updates: Partial<StudioEpisodeScene>) => {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, ...updates } : s)));
  };

  const toggleSceneParticipant = (sceneId: string, characterId: string) => {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== sceneId) return s;
        const exists = s.participantCharacterIds.includes(characterId);
        return {
          ...s,
          participantCharacterIds: exists
            ? s.participantCharacterIds.filter((id) => id !== characterId)
            : [...s.participantCharacterIds, characterId],
        };
      })
    );
  };

  const handleCreateSeries = async (data: {
    title: string;
    logline: string;
    description: string;
    canonicalPrompt: string;
  }) => {
    try {
      setSavingSeries(true);
      const created = await apiCall<StudioSeries>("/story/studio/series", {
        method: "POST",
        body: {
          title: data.title,
          logline: data.logline || undefined,
          description: data.description || undefined,
          canonicalPrompt: data.canonicalPrompt || undefined,
          status: "draft",
        },
      });
      const next = [created, ...series];
      setSeries(next);
      setSelectedSeriesId(created.id);
      setShowCreateSeriesModal(false);
      setView("series");
      await refreshAllOverviews(next);
    } catch {
      alert("Serie konnte nicht erstellt werden.");
    } finally {
      setSavingSeries(false);
    }
  };

  const handleSaveSeriesInfo = async (data: {
    title: string;
    logline: string;
    description: string;
    canonicalPrompt: string;
  }) => {
    if (!selectedSeriesId) return;
    try {
      setSavingSeriesInfo(true);
      const updated = await apiCall<StudioSeries>(`/story/studio/series/${selectedSeriesId}`, {
        method: "PUT",
        body: data,
      });
      setSeries((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      await refreshOverviewItem(updated.id);
    } catch {
      alert("Serieninfos konnten nicht gespeichert werden.");
    } finally {
      setSavingSeriesInfo(false);
    }
  };

  const handleCreateCharacter = async (data: { name: string; role: string; generationPrompt: string }) => {
    if (!selectedSeriesId) return;
    try {
      const created = await apiCall<StudioCharacter>(
        `/story/studio/series/${selectedSeriesId}/characters`,
        {
          method: "POST",
          body: {
            name: data.name,
            role: data.role || undefined,
            generationPrompt: data.generationPrompt,
            autoGenerateImage: true,
          },
        }
      );
      setCharacters((prev) => [...prev, created]);
      await refreshOverviewItem(selectedSeriesId);
    } catch {
      alert("Charakter konnte nicht erstellt werden.");
    }
  };

  const handleUpdateCharacter = async (
    characterId: string,
    data: { name: string; role: string; description: string; generationPrompt: string }
  ) => {
    if (!selectedSeriesId) return;
    try {
      const updated = await apiCall<StudioCharacter>(
        `/story/studio/series/${selectedSeriesId}/characters/${characterId}`,
        { method: "PUT", body: data }
      );
      setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      await refreshOverviewItem(selectedSeriesId);
    } catch {
      alert("Charakter konnte nicht gespeichert werden.");
    }
  };

  const handleCreateEpisode = async (data: {
    episodeNumber: number;
    title: string;
    selectedCharacterIds: string[];
  }) => {
    if (!selectedSeriesId) return;
    try {
      setSavingEpisode(true);
      const created = await apiCall<StudioEpisode>(`/story/studio/series/${selectedSeriesId}/episodes`, {
        method: "POST",
        body: data,
      });
      setEpisodes((prev) => [...prev, created].sort((a, b) => a.episodeNumber - b.episodeNumber));
      setSelectedEpisodeId(created.id);
      setShowCreateEpisodeModal(false);
      setView("editor");
      await refreshOverviewItem(selectedSeriesId);
    } catch {
      alert("Folge konnte nicht erstellt werden.");
    } finally {
      setSavingEpisode(false);
    }
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
      setWorkflowError(null);
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
    } catch (e) {
      setWorkflowError(e instanceof Error ? e.message : "Episodentext konnte nicht generiert werden.");
    } finally {
      setGeneratingText(false);
    }
  };

  const handleSaveEpisodeText = async (approve: boolean) => {
    if (!selectedSeriesId || !selectedEpisodeId || !episodeEditorText.trim()) return;
    try {
      setSavingEpisodeText(true);
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
      if (approve) setCombinedEpisodeText("");
    } catch (e) {
      setWorkflowError(e instanceof Error ? e.message : "Text konnte nicht gespeichert werden.");
    } finally {
      setSavingEpisodeText(false);
    }
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
    } catch (e) {
      setWorkflowError(e instanceof Error ? e.message : "Szenen konnten nicht erstellt werden.");
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
    } catch (e) {
      setWorkflowError(e instanceof Error ? e.message : "Szene konnte nicht gespeichert werden.");
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
          body: { imagePrompt: scene.imagePrompt?.trim() || undefined },
        }
      );
      replaceEpisodeInState(result.episode);
      replaceSceneInState(result.scene);
      if (result.episode.status !== "composed" && result.episode.status !== "published") {
        setCombinedEpisodeText("");
      }
    } catch (e) {
      setWorkflowError(e instanceof Error ? e.message : "Bild konnte nicht generiert werden.");
    } finally {
      setSceneGeneratingId(null);
    }
  };

  const handleGenerateAllSceneImages = async (forceRegenerate: boolean) => {
    if (!selectedSeriesId || !selectedEpisodeId) return;
    try {
      setBulkGeneratingImages(true);
      setWorkflowError(null);
      const result = await apiCall<EpisodeWithScenesResponse>(
        `/story/studio/series/${selectedSeriesId}/episodes/${selectedEpisodeId}/generate-images`,
        { method: "POST", body: { forceRegenerate } }
      );
      replaceEpisodeInState(result.episode);
      setScenes(result.scenes || []);
      if (result.episode.status !== "composed" && result.episode.status !== "published") {
        setCombinedEpisodeText("");
      }
    } catch (e) {
      setWorkflowError(e instanceof Error ? e.message : "Bilder konnten nicht generiert werden.");
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
    } catch (e) {
      setWorkflowError(e instanceof Error ? e.message : "Episode konnte nicht zusammengesetzt werden.");
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
      await refreshOverviewItem(selectedSeriesId);
    } catch (e) {
      setWorkflowError(e instanceof Error ? e.message : "Episode konnte nicht veröffentlicht werden.");
    } finally {
      setPublishingEpisode(false);
    }
  };

  const openReader = (episodeId: string) => {
    navigate(`/story-reader/studio-${episodeId}`);
  };

  const openEpisodeEditor = (episodeId: string) => {
    setSelectedEpisodeId(episodeId);
    setView("editor");
  };

  const closeEpisodeEditor = () => {
    setView("series");
  };

  if (loading) {
    return (
      <section className="space-y-4">
        <div className={cn("rounded-3xl border p-10", palette.card)}>
          <p className={cn("text-sm", palette.textMuted)}>Talea Studio wird geladen…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {view === "library" && (
        <StudioLibraryView
          palette={palette}
          series={series}
          overview={seriesOverview}
          loading={overviewLoading}
          onSelectSeries={(id) => {
            setSelectedSeriesId(id);
            setView("series");
          }}
          onCreateSeries={() => setShowCreateSeriesModal(true)}
        />
      )}

      {view === "series" && selectedSeries && (
        <StudioSeriesDetailView
          palette={palette}
          series={selectedSeries}
          overview={selectedSeriesOverview}
          characters={characters}
          episodes={episodes}
          detailLoading={detailLoading}
          savingSeriesInfo={savingSeriesInfo}
          onBack={() => setView("library")}
          onOpenEpisodeEditor={openEpisodeEditor}
          onCreateEpisode={() => setShowCreateEpisodeModal(true)}
          onCreateCharacter={handleCreateCharacter}
          onUpdateCharacter={handleUpdateCharacter}
          onSaveSeriesInfo={handleSaveSeriesInfo}
          onOpenReader={openReader}
        />
      )}

      {view === "series" && !selectedSeries && (
        <div className={cn("rounded-3xl border p-8 text-center", palette.card)}>
          <p className={cn("mb-4", palette.textMuted)}>Serie nicht gefunden.</p>
          <button
            type="button"
            onClick={() => setView("library")}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold",
              palette.primary,
              palette.primaryText,
              palette.primaryBorder
            )}
          >
            Zurück zur Library
          </button>
        </div>
      )}

      {view === "editor" && selectedSeries && selectedEpisode && (
        <StudioEpisodeEditor
          palette={palette}
          series={selectedSeries}
          episode={selectedEpisode}
          episodes={episodes}
          characters={characters}
          scenes={scenes}
          onClose={closeEpisodeEditor}
          onSelectEpisode={setSelectedEpisodeId}
          generationPrompt={generationPrompt}
          setGenerationPrompt={setGenerationPrompt}
          generatingText={generatingText}
          episodeEditorText={episodeEditorText}
          setEpisodeEditorText={setEpisodeEditorText}
          episodeEditorSummary={episodeEditorSummary}
          setEpisodeEditorSummary={setEpisodeEditorSummary}
          saving={savingEpisodeText}
          onGenerateEpisodeText={handleGenerateEpisodeText}
          onSaveEpisodeText={handleSaveEpisodeText}
          splitPrompt={splitPrompt}
          setSplitPrompt={setSplitPrompt}
          splittingScenes={splittingScenes}
          bulkGeneratingImages={bulkGeneratingImages}
          sceneSavingId={sceneSavingId}
          sceneGeneratingId={sceneGeneratingId}
          onSplitScenes={handleSplitScenes}
          onSaveScene={handleSaveScene}
          onGenerateSceneImage={handleGenerateSceneImage}
          onGenerateAllSceneImages={handleGenerateAllSceneImages}
          updateSceneDraft={updateSceneDraft}
          toggleSceneParticipant={toggleSceneParticipant}
          sceneLoading={sceneLoading}
          composingEpisode={composingEpisode}
          publishingEpisode={publishingEpisode}
          combinedEpisodeText={combinedEpisodeText}
          canCompose={canCompose}
          canPublish={canPublish}
          onComposeEpisode={handleComposeEpisode}
          onPublishEpisode={handlePublishEpisode}
          onOpenReader={openReader}
          workflowError={workflowError}
        />
      )}

      <CreateSeriesModal
        palette={palette}
        open={showCreateSeriesModal}
        saving={savingSeries}
        onClose={() => setShowCreateSeriesModal(false)}
        onCreate={handleCreateSeries}
      />

      <CreateEpisodeModal
        palette={palette}
        open={showCreateEpisodeModal}
        saving={savingEpisode}
        defaultEpisodeNumber={Math.max(1, maxEpisodeNumber + 1)}
        characters={characters}
        onClose={() => setShowCreateEpisodeModal(false)}
        onCreate={handleCreateEpisode}
      />
    </section>
  );
};

export default TaleaStudioWorkspace;

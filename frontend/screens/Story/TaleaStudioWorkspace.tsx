import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, Plus, Sparkles, Users, Wand2 } from "lucide-react";

import { getBackendUrl } from "@/config";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import type { StudioCharacter, StudioEpisode, StudioSeries } from "@/types/studio";

const headingFont = '"Cormorant Garamond", "Times New Roman", serif';

type ApiInit = { method?: "GET" | "POST"; body?: unknown };

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

  const selectedSeries = useMemo(
    () => series.find((item) => item.id === selectedSeriesId) || null,
    [series, selectedSeriesId]
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
      setEpisodes(episodesResult.episodes || []);
    } finally {
      setDetailLoading(false);
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
    }
  }, [selectedSeriesId]);

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
                        <div key={episode.id} className="rounded-lg border border-[#d8cbbf] bg-white/60 p-2.5 text-sm dark:border-[#415676] dark:bg-[#1f2c42]">
                          <p className="font-semibold text-[#243246] dark:text-[#e6edf8]">Folge {episode.episodeNumber}: {episode.title}</p>
                          <p className="mt-1 text-xs text-[#68788c] dark:text-[#9fb0c7]">{episode.status} - {episode.selectedCharacterIds?.length || 0} Charaktere</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default TaleaStudioWorkspace;

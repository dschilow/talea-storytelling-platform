import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clapperboard,
  FileText,
  ImagePlus,
  Loader2,
  RefreshCcw,
  Save,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { StudioCharacter, StudioEpisode, StudioEpisodeScene, StudioSeries } from "@/types/studio";

import { episodeStatusLabel, headingFont, type StudioPalette } from "./studioPalette";

interface StudioEpisodeEditorProps {
  palette: StudioPalette;
  series: StudioSeries;
  episode: StudioEpisode;
  episodes: StudioEpisode[];
  characters: StudioCharacter[];
  scenes: StudioEpisodeScene[];

  onClose: () => void;
  onSelectEpisode: (id: string) => void;

  generationPrompt: string;
  setGenerationPrompt: (v: string) => void;
  generatingText: boolean;
  episodeEditorText: string;
  setEpisodeEditorText: (v: string) => void;
  episodeEditorSummary: string;
  setEpisodeEditorSummary: (v: string) => void;
  saving: boolean;
  onGenerateEpisodeText: () => Promise<void>;
  onSaveEpisodeText: (approve: boolean) => Promise<void>;

  splitPrompt: string;
  setSplitPrompt: (v: string) => void;
  splittingScenes: boolean;
  bulkGeneratingImages: boolean;
  sceneSavingId: string | null;
  sceneGeneratingId: string | null;
  onSplitScenes: () => Promise<void>;
  onSaveScene: (scene: StudioEpisodeScene) => Promise<void>;
  onGenerateSceneImage: (scene: StudioEpisodeScene) => Promise<void>;
  onGenerateAllSceneImages: (force: boolean) => Promise<void>;
  updateSceneDraft: (sceneId: string, updates: Partial<StudioEpisodeScene>) => void;
  toggleSceneParticipant: (sceneId: string, characterId: string) => void;
  sceneLoading: boolean;

  composingEpisode: boolean;
  publishingEpisode: boolean;
  combinedEpisodeText: string;
  canCompose: boolean;
  canPublish: boolean;
  onComposeEpisode: () => Promise<void>;
  onPublishEpisode: () => Promise<void>;
  onOpenReader: (id: string) => void;

  workflowError: string | null;
}

type WizardStep = "text" | "scenes" | "images" | "compose" | "publish";

const StudioEpisodeEditor: React.FC<StudioEpisodeEditorProps> = (props) => {
  const {
    palette,
    series,
    episode,
    episodes,
    characters,
    scenes,
    onClose,
    onSelectEpisode,
    generationPrompt,
    setGenerationPrompt,
    generatingText,
    episodeEditorText,
    setEpisodeEditorText,
    episodeEditorSummary,
    setEpisodeEditorSummary,
    saving,
    onGenerateEpisodeText,
    onSaveEpisodeText,
    splitPrompt,
    setSplitPrompt,
    splittingScenes,
    bulkGeneratingImages,
    sceneSavingId,
    sceneGeneratingId,
    onSplitScenes,
    onSaveScene,
    onGenerateSceneImage,
    onGenerateAllSceneImages,
    updateSceneDraft,
    toggleSceneParticipant,
    sceneLoading,
    composingEpisode,
    publishingEpisode,
    combinedEpisodeText,
    canCompose,
    canPublish,
    onComposeEpisode,
    onPublishEpisode,
    onOpenReader,
    workflowError,
  } = props;

  const reduceMotion = useReducedMotion();

  const allSceneImagesReady = useMemo(
    () => scenes.length > 0 && scenes.every((s) => Boolean(s.imageUrl)),
    [scenes]
  );

  const stepStates = useMemo<Array<{ key: WizardStep; label: string; description: string; done: boolean }>>(
    () => [
      {
        key: "text",
        label: "Text",
        description: "Storyentwurf schreiben oder generieren lassen",
        done: Boolean((episode.approvedStoryText || episode.storyText || episodeEditorText).trim()),
      },
      {
        key: "scenes",
        label: "Szenen",
        description: "10–12 Szenen automatisch aufteilen",
        done: scenes.length > 0,
      },
      {
        key: "images",
        label: "Bilder",
        description: "Pro Szene ein Bild generieren",
        done: allSceneImagesReady,
      },
      {
        key: "compose",
        label: "Compose",
        description: "Folge zu einem Lesetext zusammensetzen",
        done: episode.status === "composed" || episode.status === "published",
      },
      {
        key: "publish",
        label: "Publish",
        description: "Folge veröffentlichen — Kinder können lesen",
        done: episode.status === "published",
      },
    ],
    [episode.status, episode.approvedStoryText, episode.storyText, episodeEditorText, scenes.length, allSceneImagesReady]
  );

  const sortedEpisodes = useMemo(
    () => [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber),
    [episodes]
  );

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden" style={{ background: palette.pageBg }}>
      <div className="flex h-full w-full flex-col">
        <header className={cn("flex items-center justify-between border-b px-5 py-3 backdrop-blur", palette.border, palette.cardElevated)}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold", palette.border, palette.text)}
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </button>
            <div>
              <p className={cn("text-[10px] font-bold uppercase tracking-[0.2em]", palette.textDim)}>
                {series.title} · Folge {episode.episodeNumber}
              </p>
              <h2 className={cn("text-xl leading-tight", palette.text)} style={{ fontFamily: headingFont }}>
                {episode.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn("rounded-lg border p-2", palette.border, palette.text)}
            aria-label="Editor schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className={cn("border-b px-5 py-4", palette.border)}>
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between gap-3">
              {stepStates.map((step, idx) => {
                const isLast = idx === stepStates.length - 1;
                return (
                  <React.Fragment key={step.key}>
                    <div className="flex flex-1 flex-col items-center text-center">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition",
                          step.done
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : `${palette.borderStrong} ${palette.cardElevated} ${palette.text}`
                        )}
                      >
                        {step.done ? <Check className="h-4 w-4" /> : idx + 1}
                      </div>
                      <p className={cn("mt-1.5 text-xs font-bold uppercase tracking-wider", step.done ? palette.text : palette.textMuted)}>
                        {step.label}
                      </p>
                      <p className={cn("hidden text-[10px] md:block", palette.textDim)}>{step.description}</p>
                    </div>
                    {!isLast && (
                      <div
                        className={cn(
                          "h-px flex-1 transition",
                          step.done ? "bg-emerald-500/60" : palette.border.replace("border-", "bg-")
                        )}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="mx-auto flex h-full w-full max-w-[1800px] gap-0">
            <aside
              className={cn(
                "hidden w-72 shrink-0 overflow-y-auto border-r p-4 lg:block",
                palette.border
              )}
            >
              <p className={cn("mb-2 text-[10px] font-bold uppercase tracking-[0.2em]", palette.textDim)}>
                Folgen-Navigation
              </p>
              <div className="space-y-1.5">
                {sortedEpisodes.map((ep) => {
                  const active = ep.id === episode.id;
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => onSelectEpisode(ep.id)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-left transition",
                        active
                          ? `${palette.borderStrong} ${palette.cardElevated}`
                          : `${palette.border} hover:${palette.cardElevated.replace("bg-", "bg-")}`
                      )}
                    >
                      <p className={cn("text-[10px] font-bold uppercase tracking-wider", palette.textDim)}>
                        Folge {ep.episodeNumber}
                      </p>
                      <p className={cn("truncate text-sm font-semibold", palette.text)}>{ep.title}</p>
                      <p className={cn("text-[11px]", palette.textMuted)}>{episodeStatusLabel[ep.status] || ep.status}</p>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-5xl space-y-8 px-5 py-8 md:px-8">
                {workflowError && (
                  <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-900/30 dark:text-red-200">
                    {workflowError}
                  </div>
                )}

                <Section
                  palette={palette}
                  step={1}
                  title="Episodentext"
                  subtitle="Generiere mit GPT oder schreibe / füge eigenen Text ein. Ziel: 1200–1500 Wörter."
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                    <input
                      value={generationPrompt}
                      onChange={(e) => setGenerationPrompt(e.target.value)}
                      placeholder="Optionaler Generierungs-Hinweis: Stimmung, Twist, Cliffhanger..."
                      className={cn("h-11 rounded-xl border px-3 text-sm outline-none", palette.input)}
                    />
                    <button
                      type="button"
                      onClick={onGenerateEpisodeText}
                      disabled={generatingText || saving}
                      className={cn(
                        "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-bold disabled:opacity-50",
                        palette.primary,
                        palette.primaryText,
                        palette.primaryBorder
                      )}
                    >
                      {generatingText ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      KI-Text generieren
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <input
                      value={episodeEditorSummary}
                      onChange={(e) => setEpisodeEditorSummary(e.target.value)}
                      placeholder="Kurz-Zusammenfassung (optional, hilft den Folgen aufeinander aufzubauen)"
                      className={cn("h-11 w-full rounded-xl border px-3 text-sm outline-none", palette.input)}
                    />
                    <textarea
                      value={episodeEditorText}
                      onChange={(e) => setEpisodeEditorText(e.target.value)}
                      rows={20}
                      placeholder="Episodentext — KI-Output anpassen oder eigenen Text einfügen."
                      className={cn(
                        "w-full rounded-2xl border px-4 py-3 text-base leading-relaxed outline-none",
                        palette.input
                      )}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSaveEpisodeText(false)}
                      disabled={saving || generatingText || !episodeEditorText.trim()}
                      className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                        palette.border,
                        palette.text
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      Entwurf speichern
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveEpisodeText(true)}
                      disabled={saving || generatingText || !episodeEditorText.trim()}
                      className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-50",
                        palette.primary,
                        palette.primaryText,
                        palette.primaryBorder
                      )}
                    >
                      <Check className="h-4 w-4" />
                      Text akzeptieren
                    </button>
                  </div>
                </Section>

                <Section
                  palette={palette}
                  step={2}
                  title="Szenen & Bildprompts"
                  subtitle="KI teilt den Text in 10–12 Szenen auf. Jede Szene bekommt ihren eigenen Bildprompt."
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                    <input
                      value={splitPrompt}
                      onChange={(e) => setSplitPrompt(e.target.value)}
                      placeholder="Optional: Hinweise für Aufteilung & Bildstil"
                      className={cn("h-11 rounded-xl border px-3 text-sm outline-none", palette.input)}
                    />
                    <button
                      type="button"
                      onClick={onSplitScenes}
                      disabled={splittingScenes || saving || !episodeEditorText.trim()}
                      className={cn(
                        "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-bold disabled:opacity-50",
                        palette.primary,
                        palette.primaryText,
                        palette.primaryBorder
                      )}
                    >
                      {splittingScenes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                      KI-Szenen erzeugen
                    </button>
                  </div>

                  {scenes.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onGenerateAllSceneImages(false)}
                        disabled={bulkGeneratingImages || splittingScenes}
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                          palette.border,
                          palette.text
                        )}
                      >
                        {bulkGeneratingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        Fehlende Bilder generieren
                      </button>
                      <button
                        type="button"
                        onClick={() => onGenerateAllSceneImages(true)}
                        disabled={bulkGeneratingImages || splittingScenes}
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                          palette.border,
                          palette.text
                        )}
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Alle neu generieren
                      </button>
                    </div>
                  )}

                  {sceneLoading ? (
                    <p className={cn("mt-4 text-sm", palette.textMuted)}>Lade Szenen…</p>
                  ) : scenes.length === 0 ? (
                    <div className={cn("mt-4 rounded-2xl border-2 border-dashed p-6 text-center text-sm", palette.border, palette.textMuted)}>
                      Noch keine Szenen. Akzeptiere zuerst den Text, dann starte die Aufteilung.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {scenes.map((scene, idx) => (
                        <SceneEditor
                          key={scene.id}
                          palette={palette}
                          scene={scene}
                          index={idx}
                          characters={characters}
                          isSaving={sceneSavingId === scene.id}
                          isGenerating={sceneGeneratingId === scene.id}
                          bulkBusy={bulkGeneratingImages}
                          onSave={() => onSaveScene(scene)}
                          onGenerateImage={() => onGenerateSceneImage(scene)}
                          updateDraft={(updates) => updateSceneDraft(scene.id, updates)}
                          toggleParticipant={(charId) => toggleSceneParticipant(scene.id, charId)}
                          reduceMotion={Boolean(reduceMotion)}
                        />
                      ))}
                    </div>
                  )}
                </Section>

                <Section
                  palette={palette}
                  step={3}
                  title="Compose & Publish"
                  subtitle="Setze die Folge zusammen und veröffentliche sie für Leser:innen."
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={onComposeEpisode}
                      disabled={composingEpisode || !canCompose}
                      className={cn(
                        "inline-flex h-11 items-center gap-2 rounded-xl border px-5 text-sm font-bold disabled:opacity-50",
                        canCompose ? `${palette.primary} ${palette.primaryText} ${palette.primaryBorder}` : `${palette.border} ${palette.text}`
                      )}
                    >
                      {composingEpisode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Episode zusammensetzen
                    </button>
                    <button
                      type="button"
                      onClick={onPublishEpisode}
                      disabled={publishingEpisode || !canPublish}
                      className={cn(
                        "inline-flex h-11 items-center gap-2 rounded-xl border px-5 text-sm font-bold disabled:opacity-50",
                        canPublish ? `${palette.primary} ${palette.primaryText} ${palette.primaryBorder}` : `${palette.border} ${palette.text}`
                      )}
                    >
                      {publishingEpisode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Veröffentlichen
                    </button>

                    {episode.status === "published" && (
                      <button
                        type="button"
                        onClick={() => onOpenReader(episode.id)}
                        className={cn(
                          "inline-flex h-11 items-center gap-2 rounded-xl border px-5 text-sm font-bold",
                          palette.success,
                          palette.successText
                        )}
                      >
                        <BookOpen className="h-4 w-4" />
                        Im Reader öffnen
                      </button>
                    )}
                  </div>

                  {(combinedEpisodeText || episode.status === "composed" || episode.status === "published") && scenes.length > 0 && (
                    <div className="mt-6 space-y-4">
                      <div className={cn("rounded-2xl border p-4", palette.border, palette.cardElevated)}>
                        <p className={cn("mb-2 text-[10px] font-bold uppercase tracking-[0.2em]", palette.textDim)}>
                          Zusammengesetzter Lesetext
                        </p>
                        <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", palette.text)}>
                          {combinedEpisodeText ||
                            scenes
                              .map((s) => `Szene ${s.sceneOrder}: ${s.title}\n\n${s.sceneText}`)
                              .join("\n\n")}
                        </p>
                      </div>
                      <div className="space-y-4">
                        {scenes.map((scene) => (
                          <article key={scene.id} className={cn("rounded-2xl border p-4", palette.border, palette.card)}>
                            <h5 className={cn("text-xl", palette.text)} style={{ fontFamily: headingFont }}>
                              Szene {scene.sceneOrder}: {scene.title}
                            </h5>
                            {scene.imageUrl && (
                              <img
                                src={scene.imageUrl}
                                alt={scene.title}
                                className="mt-3 max-h-[320px] w-full rounded-xl object-cover"
                              />
                            )}
                            <p className={cn("mt-3 whitespace-pre-wrap text-sm leading-relaxed", palette.textMuted)}>
                              {scene.sceneText}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{
  palette: StudioPalette;
  step: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ palette, step, title, subtitle, children }) => (
  <section className="space-y-4">
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-2 text-sm font-bold",
          palette.borderStrong,
          palette.cardElevated,
          palette.text
        )}
        style={{ fontFamily: headingFont }}
      >
        {step}
      </div>
      <div>
        <h3 className={cn("text-2xl leading-tight", palette.text)} style={{ fontFamily: headingFont }}>
          {title}
        </h3>
        <p className={cn("text-sm", palette.textMuted)}>{subtitle}</p>
      </div>
    </div>
    <div className={cn("rounded-2xl border p-5", palette.card)}>{children}</div>
  </section>
);

const SceneEditor: React.FC<{
  palette: StudioPalette;
  scene: StudioEpisodeScene;
  index: number;
  characters: StudioCharacter[];
  isSaving: boolean;
  isGenerating: boolean;
  bulkBusy: boolean;
  onSave: () => void;
  onGenerateImage: () => void;
  updateDraft: (updates: Partial<StudioEpisodeScene>) => void;
  toggleParticipant: (characterId: string) => void;
  reduceMotion: boolean;
}> = ({
  palette,
  scene,
  index,
  characters,
  isSaving,
  isGenerating,
  bulkBusy,
  onSave,
  onGenerateImage,
  updateDraft,
  toggleParticipant,
  reduceMotion,
}) => {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className={cn("rounded-2xl border p-4", palette.border, palette.cardElevated)}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                palette.borderStrong,
                palette.text
              )}
            >
              Szene {scene.sceneOrder}
            </span>
            <span className={cn("text-[11px]", palette.textDim)}>
              {scene.imageUrl ? "✓ Bild bereit" : "Bild fehlt"}
            </span>
          </div>

          <input
            value={scene.title}
            onChange={(e) => updateDraft({ title: e.target.value })}
            placeholder="Szenentitel"
            className={cn("h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none", palette.input)}
          />
          <textarea
            value={scene.sceneText}
            onChange={(e) => updateDraft({ sceneText: e.target.value })}
            rows={5}
            placeholder="Szeneninhalt"
            className={cn("w-full rounded-xl border px-3 py-2 text-sm leading-relaxed outline-none", palette.input)}
          />
          <textarea
            value={scene.imagePrompt || ""}
            onChange={(e) => updateDraft({ imagePrompt: e.target.value })}
            rows={3}
            placeholder="Bildprompt (Englisch empfohlen)"
            className={cn("w-full rounded-xl border px-3 py-2 text-sm leading-relaxed outline-none font-mono", palette.input)}
          />

          <div className={cn("rounded-xl border p-3", palette.border)}>
            <p className={cn("mb-2 text-[10px] font-bold uppercase tracking-wider", palette.textDim)}>
              Teilnehmende Charaktere
            </p>
            <div className="flex flex-wrap gap-2">
              {characters.map((c) => {
                const active = scene.participantCharacterIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleParticipant(c.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                      active
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : `${palette.border} ${palette.textMuted}`
                    )}
                  >
                    {active && <Check className="h-3 w-3" />}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || isGenerating || bulkBusy}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                palette.border,
                palette.text
              )}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Szene speichern
            </button>
            <button
              type="button"
              onClick={onGenerateImage}
              disabled={isSaving || isGenerating || bulkBusy}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-50",
                palette.primary,
                palette.primaryText,
                palette.primaryBorder
              )}
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {scene.imageUrl ? "Neu generieren" : "Bild generieren"}
            </button>
          </div>
        </div>

        <div className={cn("overflow-hidden rounded-2xl border", palette.border)}>
          {scene.imageUrl ? (
            <img src={scene.imageUrl} alt={scene.title} className="h-full min-h-[200px] w-full object-cover" />
          ) : (
            <div className={cn("flex h-full min-h-[200px] w-full items-center justify-center", palette.cardElevated)}>
              <ImagePlus className={cn("h-8 w-8", palette.textDim)} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StudioEpisodeEditor;

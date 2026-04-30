import React, { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Edit3,
  Eye,
  Loader2,
  Plus,
  Save,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { StudioCharacter, StudioEpisode, StudioSeries } from "@/types/studio";

import { episodeStatusLabel, episodeStatusTone, formatStudioDate, headingFont, type StudioPalette } from "./studioPalette";
import type { StudioSeriesOverview } from "./StudioLibraryView";

interface StudioSeriesDetailViewProps {
  palette: StudioPalette;
  series: StudioSeries;
  overview?: StudioSeriesOverview;
  characters: StudioCharacter[];
  episodes: StudioEpisode[];
  detailLoading: boolean;
  savingSeriesInfo: boolean;
  onBack: () => void;
  onOpenEpisodeEditor: (episodeId: string) => void;
  onCreateEpisode: () => void;
  onCreateCharacter: (data: { name: string; role: string; generationPrompt: string }) => Promise<void>;
  onUpdateCharacter: (
    characterId: string,
    data: { name: string; role: string; description: string; generationPrompt: string }
  ) => Promise<void>;
  onSaveSeriesInfo: (data: {
    title: string;
    logline: string;
    description: string;
    canonicalPrompt: string;
  }) => Promise<void>;
  onOpenReader: (episodeId: string) => void;
}

const StudioSeriesDetailView: React.FC<StudioSeriesDetailViewProps> = ({
  palette,
  series,
  overview,
  characters,
  episodes,
  detailLoading,
  savingSeriesInfo,
  onBack,
  onOpenEpisodeEditor,
  onCreateEpisode,
  onCreateCharacter,
  onUpdateCharacter,
  onSaveSeriesInfo,
  onOpenReader,
}) => {
  const reduceMotion = useReducedMotion();

  const [showCharacterForm, setShowCharacterForm] = useState(false);
  const [showSeriesEdit, setShowSeriesEdit] = useState(false);

  const [newCharName, setNewCharName] = useState("");
  const [newCharRole, setNewCharRole] = useState("");
  const [newCharPrompt, setNewCharPrompt] = useState("");
  const [creatingCharacter, setCreatingCharacter] = useState(false);

  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editCharName, setEditCharName] = useState("");
  const [editCharRole, setEditCharRole] = useState("");
  const [editCharDesc, setEditCharDesc] = useState("");
  const [editCharPrompt, setEditCharPrompt] = useState("");
  const [savingCharacter, setSavingCharacter] = useState(false);

  const [editTitle, setEditTitle] = useState(series.title);
  const [editLogline, setEditLogline] = useState(series.logline || "");
  const [editDescription, setEditDescription] = useState(series.description || "");
  const [editCanon, setEditCanon] = useState(series.canonicalPrompt || "");

  const sortedEpisodes = useMemo(
    () => [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber),
    [episodes]
  );

  const heroCover = overview?.coverImageUrl || characters.find((c) => c.imageUrl)?.imageUrl;

  const handleSubmitCharacter = async () => {
    if (!newCharName.trim() || !newCharPrompt.trim()) return;
    try {
      setCreatingCharacter(true);
      await onCreateCharacter({
        name: newCharName.trim(),
        role: newCharRole.trim(),
        generationPrompt: newCharPrompt.trim(),
      });
      setNewCharName("");
      setNewCharRole("");
      setNewCharPrompt("");
      setShowCharacterForm(false);
    } finally {
      setCreatingCharacter(false);
    }
  };

  const startEditCharacter = (c: StudioCharacter) => {
    setEditingCharacterId(c.id);
    setEditCharName(c.name);
    setEditCharRole(c.role || "");
    setEditCharDesc(c.description || "");
    setEditCharPrompt(c.generationPrompt || "");
  };

  const cancelEditCharacter = () => {
    setEditingCharacterId(null);
  };

  const submitEditCharacter = async () => {
    if (!editingCharacterId || !editCharName.trim() || !editCharPrompt.trim()) return;
    try {
      setSavingCharacter(true);
      await onUpdateCharacter(editingCharacterId, {
        name: editCharName.trim(),
        role: editCharRole.trim(),
        description: editCharDesc.trim(),
        generationPrompt: editCharPrompt.trim(),
      });
      setEditingCharacterId(null);
    } finally {
      setSavingCharacter(false);
    }
  };

  const submitSeriesEdit = async () => {
    if (!editTitle.trim()) return;
    await onSaveSeriesInfo({
      title: editTitle.trim(),
      logline: editLogline.trim(),
      description: editDescription.trim(),
      canonicalPrompt: editCanon.trim(),
    });
    setShowSeriesEdit(false);
  };

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl">
        <div
          className="absolute inset-0"
          style={{
            background: heroCover
              ? `${palette.heroOverlay}, url(${heroCover}) center/cover no-repeat`
              : "radial-gradient(circle at 30% 20%, rgba(167,139,214,0.4) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgba(108,174,157,0.35) 0%, transparent 60%), linear-gradient(135deg, #1a1530 0%, #0d1f2c 100%)",
          }}
        />
        <div className="relative px-6 py-8 md:px-10 md:py-12">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur transition hover:bg-black/45"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zur Library
          </button>

          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/85 backdrop-blur">
                <Sparkles className="h-3 w-3" />
                Talea Studio Serie
              </span>
              <h1
                className="text-5xl leading-[1.05] text-white md:text-6xl"
                style={{ fontFamily: headingFont }}
              >
                {series.title}
              </h1>
              {series.logline && (
                <p className="text-lg italic text-white/85">{series.logline}</p>
              )}
              {series.description && (
                <p className="max-w-2xl text-sm text-white/70">{series.description}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 self-start md:self-end">
              <button
                type="button"
                onClick={() => setShowSeriesEdit((v) => !v)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
              >
                <Edit3 className="h-4 w-4" />
                Serie bearbeiten
              </button>
              <button
                type="button"
                onClick={onCreateEpisode}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#1a1530] shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition hover:bg-white/95"
              >
                <Plus className="h-4 w-4" />
                Neue Folge
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <HeroStat label="Folgen" value={overview?.episodeCount ?? episodes.length} />
            <HeroStat
              label="Veröffentlicht"
              value={overview?.publishedCount ?? 0}
              accent="success"
            />
            <HeroStat label="Charaktere" value={overview?.characterCount ?? characters.length} />
            <HeroStat label="Aktualisiert" valueText={formatStudioDate(series.updatedAt)} />
          </div>
        </div>
      </header>

      {showSeriesEdit && (
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-2xl border p-5", palette.cardElevated)}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className={cn("text-xl", palette.text)} style={{ fontFamily: headingFont }}>
              Serien-Bibel bearbeiten
            </h3>
            <button
              type="button"
              onClick={() => setShowSeriesEdit(false)}
              className={cn("rounded-lg border p-1.5", palette.border, palette.text)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <LabeledInput
              palette={palette}
              label="Titel"
              value={editTitle}
              onChange={setEditTitle}
              placeholder="Serientitel"
            />
            <LabeledInput
              palette={palette}
              label="Logline"
              value={editLogline}
              onChange={setEditLogline}
              placeholder="Eine knackige Zeile, die alles sagt"
            />
          </div>
          <LabeledTextarea
            palette={palette}
            label="Welt & Vorgeschichte"
            value={editDescription}
            onChange={setEditDescription}
            rows={3}
            placeholder="Was ist diese Serie? Welt, Tonalität, was Leser:innen erwartet."
            className="mt-3"
          />
          <LabeledTextarea
            palette={palette}
            label="Canon — feste Regeln für alle Folgen"
            value={editCanon}
            onChange={setEditCanon}
            rows={3}
            placeholder="Magie-Regeln, Zeitachse, Themen, Verbote — alles, was nie verletzt werden darf."
            className="mt-3"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowSeriesEdit(false)}
              className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold", palette.border, palette.text)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={submitSeriesEdit}
              disabled={savingSeriesInfo || !editTitle.trim()}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                palette.primary,
                palette.primaryText,
                palette.primaryBorder
              )}
            >
              {savingSeriesInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Speichern
            </button>
          </div>
        </motion.section>
      )}

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className={cn("text-3xl", palette.text)} style={{ fontFamily: headingFont }}>
              Cast
            </h2>
            <p className={cn("text-sm", palette.textMuted)}>
              Wiederkehrende Charaktere — strikt an diese Serie gebunden.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCharacterForm((v) => !v)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold",
              palette.primary,
              palette.primaryText,
              palette.primaryBorder
            )}
          >
            <UserPlus className="h-4 w-4" />
            Charakter hinzufügen
          </button>
        </div>

        {showCharacterForm && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("rounded-2xl border p-5", palette.cardElevated)}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <LabeledInput palette={palette} label="Name" value={newCharName} onChange={setNewCharName} placeholder="z.B. Kira" />
              <LabeledInput palette={palette} label="Rolle" value={newCharRole} onChange={setNewCharRole} placeholder="z.B. Heldin / Mentor / Antagonist" />
            </div>
            <LabeledTextarea
              palette={palette}
              label="Generierungs-Prompt"
              value={newCharPrompt}
              onChange={setNewCharPrompt}
              rows={3}
              placeholder="Beschreibe den Charakter visuell und vom Wesen — wird zur Bildgenerierung und für jede Folge verwendet."
              className="mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCharacterForm(false)}
                className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold", palette.border, palette.text)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSubmitCharacter}
                disabled={creatingCharacter || !newCharName.trim() || !newCharPrompt.trim()}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                  palette.primary,
                  palette.primaryText,
                  palette.primaryBorder
                )}
              >
                {creatingCharacter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Charakter generieren
              </button>
            </div>
          </motion.div>
        )}

        {detailLoading ? (
          <p className={cn("text-sm", palette.textMuted)}>Lade Charaktere…</p>
        ) : characters.length === 0 ? (
          <div className={cn("rounded-2xl border-2 border-dashed p-8 text-center", palette.border, palette.textMuted)}>
            <Users className={cn("mx-auto h-8 w-8", palette.textDim)} />
            <p className="mt-2 text-sm">Noch keine Charaktere. Lege das Ensemble dieser Serie an.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {characters.map((c, idx) => (
              <motion.div
                key={c.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.03 }}
                className={cn(
                  "group overflow-hidden rounded-2xl border transition hover:-translate-y-0.5",
                  palette.card,
                  palette.cardHover
                )}
              >
                <div
                  className="relative aspect-[3/4] overflow-hidden"
                  style={{
                    background: c.imageUrl
                      ? `url(${c.imageUrl}) center/cover no-repeat`
                      : "linear-gradient(135deg,#3a2d5c 0%,#1f3a4a 100%)",
                  }}
                >
                  {!c.imageUrl && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Users className="h-10 w-10 text-white/30" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3">
                    <p className="text-base font-bold leading-tight text-white" style={{ fontFamily: headingFont }}>
                      {c.name}
                    </p>
                    {c.role && <p className="text-[11px] text-white/70">{c.role}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startEditCharacter(c)}
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 border-t px-3 py-2 text-xs font-semibold",
                    palette.border,
                    palette.textMuted,
                    "hover:" + palette.text.replace("text-", "")
                  )}
                >
                  <Edit3 className="h-3 w-3" />
                  Bearbeiten
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {editingCharacterId && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("rounded-2xl border p-5", palette.cardElevated)}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className={cn("text-lg", palette.text)} style={{ fontFamily: headingFont }}>
                Charakter bearbeiten
              </h4>
              <button
                type="button"
                onClick={cancelEditCharacter}
                className={cn("rounded-lg border p-1.5", palette.border, palette.text)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <LabeledInput palette={palette} label="Name" value={editCharName} onChange={setEditCharName} />
              <LabeledInput palette={palette} label="Rolle" value={editCharRole} onChange={setEditCharRole} />
            </div>
            <LabeledTextarea
              palette={palette}
              label="Beschreibung"
              value={editCharDesc}
              onChange={setEditCharDesc}
              rows={2}
              className="mt-3"
            />
            <LabeledTextarea
              palette={palette}
              label="Generierungs-Prompt"
              value={editCharPrompt}
              onChange={setEditCharPrompt}
              rows={3}
              className="mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelEditCharacter}
                className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold", palette.border, palette.text)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={submitEditCharacter}
                disabled={savingCharacter || !editCharName.trim() || !editCharPrompt.trim()}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50",
                  palette.primary,
                  palette.primaryText,
                  palette.primaryBorder
                )}
              >
                {savingCharacter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Speichern
              </button>
            </div>
          </motion.div>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className={cn("text-3xl", palette.text)} style={{ fontFamily: headingFont }}>
              Folgen
            </h2>
            <p className={cn("text-sm", palette.textMuted)}>
              Jede Folge baut auf der vorherigen auf. Klicke „Im Editor", um an Text, Szenen und Bildern zu arbeiten.
            </p>
          </div>
        </div>

        {detailLoading ? (
          <p className={cn("text-sm", palette.textMuted)}>Lade Folgen…</p>
        ) : sortedEpisodes.length === 0 ? (
          <div className={cn("rounded-2xl border-2 border-dashed p-8 text-center", palette.border)}>
            <BookOpen className={cn("mx-auto h-8 w-8", palette.textDim)} />
            <p className={cn("mt-2 text-sm", palette.textMuted)}>
              Noch keine Folgen. Erstelle die erste Folge — sie wird zur Eröffnung deiner Serie.
            </p>
            <button
              type="button"
              onClick={onCreateEpisode}
              className={cn(
                "mt-4 inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold",
                palette.primary,
                palette.primaryText,
                palette.primaryBorder
              )}
            >
              <Plus className="h-4 w-4" />
              Erste Folge erstellen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {sortedEpisodes.map((ep, idx) => (
              <EpisodeTimelineCard
                key={ep.id}
                palette={palette}
                episode={ep}
                index={idx}
                isLast={idx === sortedEpisodes.length - 1}
                onOpen={() => onOpenEpisodeEditor(ep.id)}
                onRead={ep.status === "published" ? () => onOpenReader(ep.id) : undefined}
                reduceMotion={Boolean(reduceMotion)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const HeroStat: React.FC<{
  label: string;
  value?: number;
  valueText?: string;
  accent?: "success";
}> = ({ label, value, valueText, accent }) => {
  const valueClass = accent === "success" ? "text-emerald-300" : "text-white";
  return (
    <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-2.5 backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">{label}</p>
      <p className={cn("text-2xl font-bold", valueClass)} style={{ fontFamily: headingFont }}>
        {valueText ?? value}
      </p>
    </div>
  );
};

const EpisodeTimelineCard: React.FC<{
  palette: StudioPalette;
  episode: StudioEpisode;
  index: number;
  isLast: boolean;
  onOpen: () => void;
  onRead?: () => void;
  reduceMotion: boolean;
}> = ({ palette, episode, index, onOpen, onRead, reduceMotion }) => {
  const tone = episodeStatusTone[episode.status] || "neutral";
  const statusBadgeClass =
    tone === "published"
      ? "bg-emerald-500/15 text-emerald-700 border-emerald-400 dark:text-emerald-300 dark:border-emerald-500/40"
      : tone === "ready"
      ? "bg-amber-400/15 text-amber-800 border-amber-400 dark:text-amber-200 dark:border-amber-500/40"
      : tone === "progress"
      ? "bg-violet-400/15 text-violet-800 border-violet-400 dark:text-violet-200 dark:border-violet-500/40"
      : `${palette.badge} ${palette.badgeText}`;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-5 transition hover:-translate-y-0.5",
        palette.card,
        palette.cardHover
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 text-xl font-bold",
            palette.borderStrong,
            palette.cardElevated,
            palette.text
          )}
          style={{ fontFamily: headingFont }}
        >
          {episode.episodeNumber}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("text-[10px] font-bold uppercase tracking-[0.18em]", palette.textDim)}>
                Folge {episode.episodeNumber}
              </p>
              <h3
                className={cn("text-2xl leading-tight", palette.text)}
                style={{ fontFamily: headingFont }}
              >
                {episode.title}
              </h3>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                statusBadgeClass
              )}
            >
              {tone === "published" && <Check className="h-3 w-3" />}
              {episodeStatusLabel[episode.status] || episode.status}
            </span>
          </div>

          <p className={cn("mt-2 line-clamp-2 text-sm", palette.textMuted)}>
            {episode.summary || "Noch keine Zusammenfassung."}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className={cn("text-[11px]", palette.textDim)}>
              {episode.selectedCharacterIds?.length || 0} Charaktere · Aktualisiert {formatStudioDate(episode.updatedAt)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {onRead && (
                <button
                  type="button"
                  onClick={onRead}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold",
                    palette.success,
                    palette.successText
                  )}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Lesen
                </button>
              )}
              <button
                type="button"
                onClick={onOpen}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold",
                  palette.primary,
                  palette.primaryText,
                  palette.primaryBorder
                )}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Im Editor
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

const LabeledInput: React.FC<{
  palette: StudioPalette;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ palette, label, value, onChange, placeholder, className }) => (
  <label className={cn("block", className)}>
    <span className={cn("mb-1 block text-[10px] font-bold uppercase tracking-[0.16em]", palette.textDim)}>{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn("h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-current/20", palette.input)}
    />
  </label>
);

const LabeledTextarea: React.FC<{
  palette: StudioPalette;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}> = ({ palette, label, value, onChange, rows = 3, placeholder, className }) => (
  <label className={cn("block", className)}>
    <span className={cn("mb-1 block text-[10px] font-bold uppercase tracking-[0.16em]", palette.textDim)}>{label}</span>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-xl border px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-current/20",
        palette.input
      )}
    />
  </label>
);

export default StudioSeriesDetailView;

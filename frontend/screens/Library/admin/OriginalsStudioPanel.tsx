import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BookOpen, Brush, CalendarClock, ChevronDown, FileText, Headphones, Loader2, PenLine, Plus, Rocket, Undo2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useBackend } from "@/hooks/useBackend";
import { cn } from "@/lib/utils";
import { taleaDisplayFont, taleaInputClass, taleaInsetSurfaceClass, taleaSurfaceClass } from "@/components/talea/TaleaPastelPrimitives";
import { CharacterManager } from "./CharacterManager";
import { EpisodeAudioPanel } from "./EpisodeAudioPanel";
import { VoiceCastManager } from "./VoiceCastManager";
import {
  episodeLabel,
  episodeReaderPath,
  errorMessage,
  formatRelease,
  STATE_LABELS,
  STATE_TONES,
  type LibraryAdminEpisode,
  type LibraryAdminSeriesResponse,
  type LibraryEpisodeResponse,
} from "../libraryShared";

const POLL_MS = 5000;

const STEP_LABELS: Record<string, string> = {
  queued: "Startet …",
  blueprint: "Plant die Folge (Beat-Sheet)",
  write: "Schreibt die Folge",
  score: "Lektorat prüft und bewertet",
  finalize: "Kanon-Fakten, Sammelkarte und Bildregie",
  pictures: "Malt Cover und Kapitelbilder",
};

function stepLabel(step?: string): string {
  if (!step) return "Arbeitet …";
  if (step.startsWith("revision")) return `Überarbeitet nach dem Lektorat (Runde ${step.split("-")[1]})`;
  return STEP_LABELS[step] ?? step;
}

const DIMENSION_LABELS: Record<string, string> = {
  figurenkonsistenz: "Figuren",
  plotKohaerenz: "Plot",
  sprachqualitaet: "Sprache",
  emotionaleTiefe: "Gefühl",
  altersangemessenheit: "Alter",
  ende: "Ende",
  kanonTreue: "Kanon",
  weitererzaehlFaktor: "Schulhof",
};

/**
 * Production of a series (admins only): the plan, the editor's ideas, writing
 * in the background, review with scores, picture redraws, release.
 */
const OriginalsStudioPanel: React.FC<{ slug: string; onChanged: () => void }> = ({ slug, onChanged }) => {
  const backend = useBackend();
  const [data, setData] = useState<LibraryAdminSeriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEpisode, setNewEpisode] = useState<{ title: string; idea: string } | null>(null);
  const wasGenerating = useRef(new Set<string>());
  const wasRecording = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const next = await backend.story.libraryAdminSeries({ slug });
      // A finished job changes the reader's side too (new cover, new state).
      const running = new Set(next.episodes.filter((episode) => episode.state === "generating").map((episode) => episode.id));
      const finished = [...wasGenerating.current].filter((id) => !running.has(id));
      wasGenerating.current = running;
      const recording = new Set(next.episodes.filter((episode) => episode.audio.status === "generating").map((episode) => episode.id));
      const recorded = [...wasRecording.current].filter((id) => !recording.has(id));
      wasRecording.current = recording;
      for (const id of recorded) {
        const episode = next.episodes.find((entry) => entry.id === id);
        if (episode?.audio.status === "ready") toast.success(`Hörspiel „${episode.title}“ ist fertig${episode.audio.released ? " und freigegeben" : " — bitte anhören und freigeben"}.`);
        if (episode?.audio.status === "failed") toast.error(`Hörspiel „${episode?.title}“: ${episode?.audio.error || "fehlgeschlagen"}`);
      }
      setData(next);
      setError(null);
      if (finished.length) {
        onChanged();
        for (const id of finished) {
          const episode = next.episodes.find((entry) => entry.id === id);
          if (episode?.state === "in_review") toast.success(`„${episode.title}“ ist geschrieben und wartet auf die Prüfung.`);
          if (episode?.state === "failed") toast.error(`„${episode.title}“: ${episode.generation.error || "fehlgeschlagen"}`);
        }
      }
    } catch (loadError) {
      setError(errorMessage(loadError, "Das Studio konnte nicht geladen werden."));
    }
  }, [backend, slug, onChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  const generating = data?.episodes.some((episode) => episode.state === "generating" || episode.audio.status === "generating");
  useEffect(() => {
    if (!generating) return;
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [generating, load]);

  const createEpisode = async () => {
    if (!newEpisode?.title.trim()) return;
    try {
      await backend.story.libraryAdminCreateEpisode({ slug, title: newEpisode.title.trim(), idea: newEpisode.idea.trim() || undefined });
      setNewEpisode(null);
      toast.success("Neue Folge angelegt.");
      await load();
    } catch (createError) {
      toast.error(errorMessage(createError, "Die Folge konnte nicht angelegt werden."));
    }
  };

  if (error) return <p className="text-[15px] text-rose-600">{error}</p>;
  if (!data) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" /></div>;

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-[1.2rem] font-bold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>Folgen-Produktion</h3>
            <p className="text-[14px] text-[var(--talea-text-secondary)]">
              Schreiben: {data.models.writer} · Planen und Bildregie: {data.models.support} · Lektorat: {data.models.critic} · Bilder: {data.models.image}
            </p>
          </div>
          <button type="button" onClick={() => setNewEpisode({ title: "", idea: "" })} className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--talea-surface-inset)] px-4 text-[14px] font-semibold text-[var(--primary)]">
            <Plus className="h-4 w-4" /> Neue Folge
          </button>
        </div>

        {newEpisode ? (
          <div className={cn(taleaInsetSurfaceClass, "mt-4 flex flex-col gap-3 p-4")}>
            <input autoFocus placeholder="Titel der Folge" value={newEpisode.title} onChange={(event) => setNewEpisode({ ...newEpisode, title: event.target.value })} className={taleaInputClass} />
            <textarea
              rows={3}
              placeholder="Idee: Was soll passieren? (z. B. Mats flunkert, er könne mit Tieren sprechen …)"
              value={newEpisode.idea}
              onChange={(event) => setNewEpisode({ ...newEpisode, idea: event.target.value })}
              className={cn(taleaInputClass, "h-auto py-2.5")}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setNewEpisode(null)} className="h-10 rounded-full px-4 text-[14px] font-semibold text-[var(--talea-text-secondary)]">Abbrechen</button>
              <button type="button" onClick={() => void createEpisode()} disabled={!newEpisode.title.trim()} className="h-10 rounded-full bg-[var(--primary)] px-4 text-[14px] font-semibold text-white disabled:opacity-50">Anlegen</button>
            </div>
          </div>
        ) : null}

        <ol className="mt-4 flex flex-col gap-3">
          {data.episodes.map((episode) => (
            <EpisodeProduction key={episode.id} episode={episode} onChanged={() => { void load(); onChanged(); }} />
          ))}
        </ol>
      </section>

      <CharacterManager slug={slug} characters={data.characters} onChanged={() => { void load(); onChanged(); }} />

      <VoiceCastManager slug={slug} />

      <details className={cn(taleaInsetSurfaceClass, "p-5")}>
        <summary className="cursor-pointer text-[15px] font-semibold text-[var(--talea-text-primary)]">Serien-Bibel v{data.bibleVersion} (Kanon, Formel, Regeln)</summary>
        <div className="mt-4 grid gap-5 text-[14px] leading-relaxed text-[var(--talea-text-primary)] md:grid-cols-2">
          <BibleList title="Welt" items={[data.bible.setting, data.bible.tone]} />
          <BibleList title="Welt-Regeln" items={data.bible.rules} />
          <BibleList title="Episoden-Formel" items={data.bible.episodeFormula} ordered />
          <BibleList title="Kanon-Invarianten" items={data.bible.canonInvariants} />
          <BibleList title="Running Gags" items={data.bible.runningGags} />
          <BibleList title="Staffeln" items={data.bible.seasons.map((season) => `Staffel ${season.season}: ${season.title} — ${season.mystery}`)} />
          <BibleList title="Verbotene Themen" items={[data.bible.forbiddenTopics.join(", ")]} />
          <BibleList title="Bildstil" items={[data.bible.imageStyleEn]} />
        </div>
      </details>
    </div>
  );
};

const BibleList: React.FC<{ title: string; items: string[]; ordered?: boolean }> = ({ title, items, ordered }) => {
  const List = ordered ? "ol" : "ul";
  return (
    <div>
      <h4 className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--talea-text-tertiary)]">{title}</h4>
      <List className={cn("flex flex-col gap-1 pl-5", ordered ? "list-decimal" : "list-disc")}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </List>
    </div>
  );
};

const EpisodeProduction: React.FC<{ episode: LibraryAdminEpisode; onChanged: () => void }> = ({ episode, onChanged }) => {
  const backend = useBackend();
  const navigate = useNavigate();
  const [open, setOpen] = useState(episode.state === "in_review" || episode.state === "generating" || episode.state === "failed");
  const [idea, setIdea] = useState(episode.idea || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // At release the editor decides about the audio drama too.
  const [withAudio, setWithAudio] = useState(true);
  const [releaseAudio, setReleaseAudio] = useState(true);

  useEffect(() => setIdea(episode.idea || ""), [episode.idea]);

  const run = async (key: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await action();
      if (success) toast.success(success);
      onChanged();
    } catch (actionError) {
      toast.error(errorMessage(actionError, "Das hat nicht geklappt."));
    } finally {
      setBusy(null);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const canWrite = episode.state !== "generating" && episode.state !== "published";
  const scores = episode.scores;

  return (
    <li className={cn(taleaSurfaceClass, "p-0")}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left sm:p-4">
        <span className="relative aspect-[3/2] w-24 shrink-0 overflow-hidden rounded-[10px] bg-[var(--talea-surface-inset)] sm:w-32">
          {episode.coverImageUrl ? <img src={episode.coverImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
          {episode.state === "generating" ? <span className="absolute inset-0 flex items-center justify-center bg-black/35"><Loader2 className="h-5 w-5 animate-spin text-white" /></span> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--talea-text-tertiary)]">
            {episodeLabel(episode)}
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] normal-case tracking-normal", STATE_TONES[episode.state])}>
              {episode.state === "scheduled" && episode.publishAt ? `Erscheint ${formatRelease(episode.publishAt)}` : STATE_LABELS[episode.state]}
            </span>
            {episode.generation.costUSD ? <span className="normal-case tracking-normal">${episode.generation.costUSD.toFixed(3)}</span> : null}
            {episode.audio.status !== "none" ? (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] normal-case tracking-normal", episode.audio.released ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-[var(--talea-surface-inset)] text-[var(--talea-text-secondary)]")}>
                {episode.audio.status === "generating" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Headphones className="h-3 w-3" />}
                {episode.audio.status === "generating" ? "Hörspiel entsteht" : episode.audio.status === "failed" ? "Hörspiel fehlgeschlagen" : episode.audio.released ? "Hörspiel live" : "Hörspiel bereit"}
              </span>
            ) : null}
          </span>
          <span className="truncate text-[16px] font-semibold text-[var(--talea-text-primary)]">{episode.title}</span>
          {episode.state === "generating" ? <span className="text-[13px] text-amber-700 dark:text-amber-300">{stepLabel(episode.generation.step)}</span> : null}
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-[var(--talea-text-tertiary)] transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="flex flex-col gap-4 border-t border-[var(--talea-border-light)] p-4">
          <div className="grid gap-3 text-[14px] text-[var(--talea-text-primary)] md:grid-cols-2">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--talea-text-tertiary)]">Geplant</p>
              <p className="mt-1 leading-relaxed">{episode.logline || "Noch keine Logline."}</p>
              {Object.entries(episode.plan.fields).length ? (
                <ul className="mt-2 flex flex-col gap-0.5 text-[13px] text-[var(--talea-text-secondary)]">
                  {Object.entries(episode.plan.fields).map(([key, value]) => <li key={key}><strong>{key}:</strong> {value}</li>)}
                </ul>
              ) : null}
              {episode.plan.clue ? <p className="mt-2 text-[13px] text-[var(--talea-text-secondary)]"><strong>Staffel-Hinweis:</strong> {episode.plan.clue}</p> : null}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--talea-text-tertiary)]">Eigene Idee für diese Folge</span>
              <textarea
                rows={4}
                value={idea}
                disabled={!canWrite}
                placeholder="Optional: Was soll in dieser Folge passieren? Die Idee hat Vorrang vor der Logline, der Kanon gilt trotzdem."
                onChange={(event) => setIdea(event.target.value)}
                onBlur={() => idea !== (episode.idea || "") && void run("idea", () => backend.story.libraryAdminUpdateEpisode({ id: episode.id, idea }))}
                className={cn(taleaInputClass, "h-auto py-2.5")}
              />
            </label>
          </div>

          {episode.state === "failed" && episode.generation.error ? (
            <p className="rounded-xl bg-rose-50 p-3 text-[14px] text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{episode.generation.error}</p>
          ) : null}

          {episode.state === "generating" ? (
            <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-[14px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <Loader2 className="h-4 w-4 animate-spin" />
              {stepLabel(episode.generation.step)} · seit {episode.generation.startedAt ? new Date(episode.generation.startedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "eben"} Uhr. Dauert etwa 3–5 Minuten.
            </div>
          ) : null}

          {scores ? (
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--talea-text-tertiary)]">
                Lektorat {scores.passed ? "· bestanden" : "· unter 9 — bitte selbst prüfen"}{episode.generation.writes ? ` · ${episode.generation.writes} Fassung(en)` : ""}
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
                {Object.entries(scores.dimensions).map(([key, value]) => (
                  <div key={key} className="flex flex-col items-center gap-1 rounded-xl bg-[var(--talea-surface-inset)] p-2">
                    <span className={cn("text-[18px] font-bold", value >= 9 ? "text-emerald-600" : value >= 7 ? "text-amber-600" : "text-rose-600")}>{value}</span>
                    <span className="text-[11px] text-[var(--talea-text-secondary)]">{DIMENSION_LABELS[key] ?? key}</span>
                  </div>
                ))}
              </div>
              {scores.mustFix.length ? (
                <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-[13px] text-[var(--talea-text-secondary)]">
                  {scores.mustFix.map((note) => <li key={note}>{note}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}

          {episode.hasContent ? <PictureStrip episode={episode} busy={busy} onRedraw={(slot) => run(`pic-${slot}`, () => backend.story.libraryAdminRedrawPicture({ id: episode.id, slot, assetOrigin: origin }), "Bild neu gemalt.")} /> : null}

          {episode.generation.issues?.length ? (
            <p className="text-[13px] text-amber-700 dark:text-amber-300">Bilder fehlen: {episode.generation.issues.join(" · ")}</p>
          ) : null}

          {episode.hasContent ? <EpisodeAudioPanel episode={episode} onChanged={onChanged} /> : null}

          {episode.state === "in_review" ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[var(--talea-text-secondary)]">
              <span className="font-semibold text-[var(--talea-text-primary)]">Beim Freigeben:</span>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={withAudio} onChange={(event) => setWithAudio(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                {episode.audio.status === "ready" && !episode.audio.outdated ? "Hörspiel mit veröffentlichen" : "Hörspiel dazu erzeugen"}
              </label>
              {withAudio && !(episode.audio.status === "ready" && !episode.audio.outdated) ? (
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={releaseAudio} onChange={(event) => setReleaseAudio(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                  Hörspiel automatisch freigeben, sobald es fertig ist
                </label>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {canWrite ? (
              <ActionButton
                icon={<Wand2 className="h-4 w-4" />}
                busy={busy === "generate"}
                primary={!episode.hasContent}
                onClick={() => {
                  if (episode.hasContent && !window.confirm("Die Folge wird komplett neu geschrieben, der bisherige Text und die Bilder werden ersetzt. Weiter?")) return;
                  void run("generate", () => backend.story.libraryAdminGenerateEpisode({ id: episode.id, idea, assetOrigin: origin }), "Die Folge wird geschrieben. Das dauert ein paar Minuten.");
                }}
              >
                {episode.hasContent ? "Neu schreiben" : "Folge schreiben"}
              </ActionButton>
            ) : null}
            {episode.hasContent ? (
              <ActionButton icon={<BookOpen className="h-4 w-4" />} onClick={() => navigate(episodeReaderPath(episode.id))}>Lesen</ActionButton>
            ) : null}
            {episode.hasContent && episode.state !== "generating" ? (
              <ActionButton icon={<PenLine className="h-4 w-4" />} onClick={() => setEditing(true)}>Text bearbeiten</ActionButton>
            ) : null}
            {episode.state === "in_review" ? (
              <>
                <ActionButton icon={<CalendarClock className="h-4 w-4" />} primary busy={busy === "approve"} onClick={() => void run("approve", () => backend.story.libraryAdminApproveEpisode({ id: episode.id, withAudio, releaseAudio: withAudio && (releaseAudio || (episode.audio.status === "ready" && !episode.audio.outdated)) }), withAudio ? "Freigegeben für den nächsten Release-Termin — mit Hörspiel." : "Freigegeben für den nächsten Release-Termin.")}>
                  Freigeben (nächster Freitag)
                </ActionButton>
                <ActionButton icon={<Rocket className="h-4 w-4" />} busy={busy === "now"} onClick={() => void run("now", () => backend.story.libraryAdminApproveEpisode({ id: episode.id, now: true, withAudio, releaseAudio: withAudio && (releaseAudio || (episode.audio.status === "ready" && !episode.audio.outdated)) }), withAudio ? (episode.audio.status === "ready" && !episode.audio.outdated ? "Sofort veröffentlicht — mit Hörspiel." : "Sofort veröffentlicht — das Hörspiel folgt in ein paar Minuten.") : "Sofort veröffentlicht.")}>
                  Sofort veröffentlichen
                </ActionButton>
              </>
            ) : null}
            {episode.state === "scheduled" || episode.state === "published" ? (
              <ActionButton icon={<Undo2 className="h-4 w-4" />} busy={busy === "unpublish"} onClick={() => window.confirm("Folge zurückziehen? Kinder sehen sie dann nicht mehr.") && void run("unpublish", () => backend.story.libraryAdminUnpublishEpisode({ id: episode.id }), "Zurückgezogen.")}>
                Zurückziehen
              </ActionButton>
            ) : null}
          </div>
        </div>
      ) : null}

      {editing ? <TextEditor episodeId={episode.id} onClose={(saved) => { setEditing(false); if (saved) onChanged(); }} /> : null}
    </li>
  );
};

const PictureStrip: React.FC<{ episode: LibraryAdminEpisode; busy: string | null; onRedraw: (slot: string) => void }> = ({ episode, busy, onRedraw }) => {
  const backend = useBackend();
  const [pictures, setPictures] = useState<Array<{ slot: string; label: string; url?: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    backend.story.libraryEpisode({ id: episode.id }).then((full: LibraryEpisodeResponse) => {
      if (cancelled) return;
      setPictures([
        { slot: "cover", label: "Cover", url: full.coverImageUrl },
        ...full.chapters.map((chapter, index) => ({ slot: String(index + 1), label: `Kapitel ${index + 1}`, url: chapter.imageUrl })),
      ]);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [backend, episode.id, episode.coverImageUrl, busy]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {pictures.map((picture) => (
        <figure key={picture.slot} className="flex flex-col gap-1.5">
          <div className="relative aspect-[3/2] overflow-hidden rounded-[10px] bg-[var(--talea-surface-inset)]">
            {picture.url ? <img src={picture.url} alt={picture.label} loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[12px] text-[var(--talea-text-tertiary)]">fehlt</span>}
            {busy === `pic-${picture.slot}` ? <span className="absolute inset-0 flex items-center justify-center bg-white/60"><Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" /></span> : null}
          </div>
          <figcaption className="flex items-center justify-between gap-2 text-[12px] text-[var(--talea-text-secondary)]">
            {picture.label}
            <button type="button" onClick={() => onRedraw(picture.slot)} disabled={busy !== null} className="inline-flex items-center gap-1 font-semibold text-[var(--primary)] disabled:opacity-40">
              <Brush className="h-3.5 w-3.5" /> Neu malen
            </button>
          </figcaption>
        </figure>
      ))}
    </div>
  );
};

const ActionButton: React.FC<{ icon: React.ReactNode; onClick: () => void; busy?: boolean; primary?: boolean; children: React.ReactNode }> = ({ icon, onClick, busy, primary, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy}
    className={cn(
      "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold disabled:opacity-50",
      primary ? "bg-[var(--primary)] text-white" : "bg-[var(--talea-surface-inset)] text-[var(--primary)]",
    )}
  >
    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
    {children}
  </button>
);

/** Manual revision after the review: chapter texts, summary and teaser. */
const TextEditor: React.FC<{ episodeId: string; onClose: (saved: boolean) => void }> = ({ episodeId, onClose }) => {
  const backend = useBackend();
  const [episode, setEpisode] = useState<LibraryEpisodeResponse | null>(null);
  const [draft, setDraft] = useState<{ title: string; summary: string; teaser: string; chapters: Array<{ title: string; text: string }> } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    backend.story.libraryEpisode({ id: episodeId }).then((full: LibraryEpisodeResponse) => {
      setEpisode(full);
      setDraft({ title: full.title, summary: full.summary, teaser: full.teaser, chapters: full.chapters.map((chapter) => ({ title: chapter.title, text: chapter.text })) });
    }).catch((loadError) => toast.error(errorMessage(loadError, "Text konnte nicht geladen werden.")));
  }, [backend, episodeId]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await backend.story.libraryAdminUpdateEpisodeText({ id: episodeId, ...draft });
      toast.success("Text gespeichert.");
      onClose(true);
    } catch (saveError) {
      toast.error(errorMessage(saveError, "Speichern hat nicht geklappt."));
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose(false)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[2000] bg-black/55" />
        <DialogPrimitive.Content className="fixed inset-2 z-[2001] flex flex-col overflow-hidden rounded-[22px] bg-[var(--talea-surface-primary)] shadow-2xl focus:outline-none sm:inset-6">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--talea-border-light)] px-5 py-3">
            <DialogPrimitive.Title className="flex items-center gap-2 text-[1.1rem] font-bold text-[var(--talea-text-primary)]">
              <FileText className="h-5 w-5 text-[var(--primary)]" /> {episode?.title || "Text"} bearbeiten
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Kapiteltexte, Kurzbeschreibung und Teaser der Folge.</DialogPrimitive.Description>
            <div className="flex gap-2">
              <DialogPrimitive.Close className="h-10 rounded-full px-4 text-[14px] font-semibold text-[var(--talea-text-secondary)]">Abbrechen</DialogPrimitive.Close>
              <button type="button" onClick={() => void save()} disabled={!draft || saving} className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--primary)] px-4 text-[14px] font-semibold text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Speichern
              </button>
            </div>
          </div>
          {draft ? (
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={taleaInputClass} aria-label="Titel" />
                <textarea rows={2} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className={cn(taleaInputClass, "h-auto py-2.5")} aria-label="Kurzbeschreibung" />
                {draft.chapters.map((chapter, index) => (
                  <div key={index} className="flex flex-col gap-2">
                    <input
                      value={chapter.title}
                      onChange={(event) => setDraft({ ...draft, chapters: draft.chapters.map((entry, entryIndex) => (entryIndex === index ? { ...entry, title: event.target.value } : entry)) })}
                      className={cn(taleaInputClass, "font-semibold")}
                      aria-label={`Titel Kapitel ${index + 1}`}
                    />
                    <textarea
                      rows={18}
                      value={chapter.text}
                      onChange={(event) => setDraft({ ...draft, chapters: draft.chapters.map((entry, entryIndex) => (entryIndex === index ? { ...entry, text: event.target.value } : entry)) })}
                      className={cn(taleaInputClass, "h-auto py-3 font-[family-name:var(--talea-font-ui)] leading-relaxed")}
                      aria-label={`Text Kapitel ${index + 1}`}
                    />
                  </div>
                ))}
                <input value={draft.teaser} onChange={(event) => setDraft({ ...draft, teaser: event.target.value })} className={taleaInputClass} aria-label="Teaser" />
                <p className="text-[12px] text-[var(--talea-text-tertiary)]">Absätze durch eine Leerzeile trennen. Die Bilder bleiben nach ihrem Absatz stehen.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" /></div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default OriginalsStudioPanel;

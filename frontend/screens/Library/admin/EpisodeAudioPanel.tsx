import React, { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Eye, EyeOff, FileAudio, Headphones, Loader2, Mic, Music2, RefreshCw, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useBackend } from "@/hooks/useBackend";
import { cn } from "@/lib/utils";
import { taleaInsetSurfaceClass } from "@/components/talea/TaleaPastelPrimitives";
import { errorMessage, formatClock, type LibraryAdminEpisode, type LibraryAudioScriptResponse } from "../libraryShared";

const STATUS_LABELS = { none: "Kein Hörspiel", generating: "Entsteht", ready: "Fertig", failed: "Fehlgeschlagen" } as const;
const STATUS_TONES = {
  none: "bg-[var(--talea-surface-inset)] text-[var(--talea-text-secondary)]",
  generating: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  ready: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
} as const;

/**
 * The episode as an audio drama (admins): Captain Comedy narrates, every figure
 * has its own voice, the series' music, ambience and sounds come from the
 * screenplay. Record, listen, release, record again.
 */
export const EpisodeAudioPanel: React.FC<{ episode: LibraryAdminEpisode; onChanged: () => void }> = ({ episode, onChanged }) => {
  const backend = useBackend();
  const audio = episode.audio;
  const [release, setRelease] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const textBusy = episode.state === "generating";

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

  const record = (keepScript: boolean) =>
    run(
      keepScript ? "re-record" : "record",
      () => backend.story.libraryAdminGenerateAudio({ id: episode.id, release, keepScript }),
      "Das Hörspiel entsteht. Das dauert etwa 6–10 Minuten.",
    );

  const status = audio.status;
  return (
    <section className={cn(taleaInsetSurfaceClass, "flex flex-col gap-3 p-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <Headphones className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
        <h4 className="text-[15px] font-bold text-[var(--talea-text-primary)]">Hörspiel</h4>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONES[status])}>{STATUS_LABELS[status]}</span>
        {audio.url ? (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", audio.released ? "bg-emerald-600 text-white" : "bg-[var(--talea-surface-primary)] text-[var(--talea-text-secondary)]")}>
            {audio.released ? "Für Kinder freigegeben" : "Nicht freigegeben"}
          </span>
        ) : null}
      </div>

      {status === "none" ? (
        <p className="text-[14px] leading-relaxed text-[var(--talea-text-secondary)]">
          Captain Comedy erzählt, jede Figur spricht mit ihrer eigenen Stimme (ElevenLabs v4 mit Emotions-Tags). Dazu kommen die Musik der Reihe, Orts-Atmosphäre und Geräusche nach einem eigenen Hörspiel-Drehbuch.
        </p>
      ) : null}

      {status === "generating" ? (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-[14px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span>
            {audio.stepLabel || "Arbeitet …"} · seit {audio.startedAt ? new Date(audio.startedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "eben"} Uhr. Dauert etwa 6–10 Minuten.
            {audio.autoRelease ? " Wird danach automatisch freigegeben." : " Danach erst anhören, dann freigeben."}
          </span>
        </div>
      ) : null}

      {status === "failed" && audio.error ? <p className="rounded-xl bg-rose-50 p-3 text-[14px] text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{audio.error}</p> : null}

      {audio.outdated ? (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Der Text wurde nach der Aufnahme geändert. Das Hörspiel erzählt noch die alte Fassung — bitte neu erzeugen.
        </p>
      ) : null}

      {audio.url ? (
        <div className="flex flex-col gap-2">
          <audio controls preload="none" src={audio.url} className="w-full" aria-label={`Hörspiel: ${episode.title}`} />
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--talea-text-secondary)]">
            {audio.durationSeconds ? <span>{formatClock(audio.durationSeconds)} Min.</span> : null}
            {audio.voiceCharacters ? <span className="inline-flex items-center gap-1"><Mic className="h-3 w-3" aria-hidden="true" />{audio.voiceCharacters.toLocaleString("de-DE")} Zeichen</span> : null}
            {audio.sounds ? <span className="inline-flex items-center gap-1"><Volume2 className="h-3 w-3" aria-hidden="true" />{audio.sounds} Geräusche</span> : null}
            {audio.music ? <span className="inline-flex items-center gap-1"><Music2 className="h-3 w-3" aria-hidden="true" />Musik {audio.music}</span> : null}
            {audio.llmCostUSD ? <span>Drehbuch ${audio.llmCostUSD.toFixed(3)}</span> : null}
            {audio.takes ? <span>{audio.takes} Takes{audio.retakes ? `, ${audio.retakes} nach Hörprobe neu aufgenommen` : ""}</span> : null}
            {audio.renderSeconds ? <span>{Math.round(audio.renderSeconds / 60)} Min. Produktion</span> : null}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {status !== "generating" ? (
          <label className="mr-1 inline-flex items-center gap-2 text-[13px] text-[var(--talea-text-secondary)]">
            <input type="checkbox" checked={release} onChange={(event) => setRelease(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            {status === "ready" ? "Neue Aufnahme sofort freigeben" : "Danach sofort freigeben"}
          </label>
        ) : null}
        {status === "none" || status === "failed" ? (
          <PanelButton primary icon={<FileAudio className="h-4 w-4" />} busy={busy === "record"} disabled={!episode.hasContent || textBusy} onClick={() => void record(status === "failed")}>
            {status === "failed" ? "Nochmal versuchen" : "Hörspiel erzeugen"}
          </PanelButton>
        ) : null}
        {status === "ready" ? (
          <>
            <PanelButton
              primary={!audio.released}
              icon={audio.released ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              busy={busy === "release"}
              onClick={() => void run("release", () => backend.story.libraryAdminReleaseAudio({ id: episode.id, released: !audio.released }), audio.released ? "Hörspiel zurückgezogen." : "Hörspiel freigegeben.")}
            >
              {audio.released ? "Hörspiel zurückziehen" : "Hörspiel freigeben"}
            </PanelButton>
            <PanelButton icon={<RefreshCw className="h-4 w-4" />} busy={busy === "re-record"} disabled={textBusy || audio.outdated} onClick={() => window.confirm("Mit demselben Drehbuch neu vertonen (z. B. nach einem Stimmenwechsel)? Das alte Hörspiel bleibt bis dahin online.") && void record(true)}>
              Neu vertonen
            </PanelButton>
            <PanelButton icon={<FileAudio className="h-4 w-4" />} busy={busy === "record"} disabled={textBusy} onClick={() => window.confirm("Neues Drehbuch schreiben und komplett neu vertonen?") && void record(false)}>
              Neues Drehbuch
            </PanelButton>
          </>
        ) : null}
        {status === "ready" || (status === "failed" && audio.url) ? (
          <PanelButton icon={<Eye className="h-4 w-4" />} onClick={() => setScriptOpen(true)}>Drehbuch ansehen</PanelButton>
        ) : null}
      </div>

      {scriptOpen ? <ScriptDialog episodeId={episode.id} onClose={() => setScriptOpen(false)} /> : null}
    </section>
  );
};

const PanelButton: React.FC<{ icon: React.ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean; primary?: boolean; children: React.ReactNode }> = ({ icon, onClick, busy, disabled, primary, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy || disabled}
    className={cn(
      "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold disabled:opacity-50",
      primary ? "bg-[var(--primary)] text-white" : "bg-[var(--talea-surface-primary)] text-[var(--primary)]",
    )}
  >
    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
    {children}
  </button>
);

const SPEAKER_TONES = [
  "text-sky-700 dark:text-sky-300",
  "text-emerald-700 dark:text-emerald-300",
  "text-rose-700 dark:text-rose-300",
  "text-violet-700 dark:text-violet-300",
  "text-amber-700 dark:text-amber-300",
  "text-teal-700 dark:text-teal-300",
  "text-fuchsia-700 dark:text-fuchsia-300",
  "text-orange-700 dark:text-orange-300",
];

/** The screenplay as the director wrote it: scenes, who speaks how, which sound lands where. */
const ScriptDialog: React.FC<{ episodeId: string; onClose: () => void }> = ({ episodeId, onClose }) => {
  const backend = useBackend();
  const [script, setScript] = useState<LibraryAudioScriptResponse | null>(null);
  // The studio re-renders while it polls; the screenplay is fetched once per opening.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    backend.story.libraryAdminAudioScript({ id: episodeId }).then(setScript).catch((loadError) => {
      toast.error(errorMessage(loadError, "Drehbuch konnte nicht geladen werden."));
      close.current();
    });
  }, [backend, episodeId]);

  const speakers = useMemo(() => new Map((script?.speakers || []).map((speaker, index) => [speaker.key, { ...speaker, tone: speaker.isNarrator ? "text-[var(--talea-text-secondary)]" : SPEAKER_TONES[index % SPEAKER_TONES.length] }])), [script]);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[2000] bg-black/55" />
        <DialogPrimitive.Content className="fixed inset-2 z-[2001] flex flex-col overflow-hidden rounded-[22px] bg-[var(--talea-surface-primary)] shadow-2xl focus:outline-none sm:inset-6">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--talea-border-light)] px-5 py-3">
            <DialogPrimitive.Title className="flex items-center gap-2 text-[1.1rem] font-bold text-[var(--talea-text-primary)]">
              <Headphones className="h-5 w-5 text-[var(--primary)]" /> Drehbuch: {script?.title || "…"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Das Hörspiel-Drehbuch mit Sprechern, Regie-Tags, Szenen und Geräuschen.</DialogPrimitive.Description>
            <DialogPrimitive.Close className="h-10 rounded-full px-4 text-[14px] font-semibold text-[var(--talea-text-secondary)]">Schließen</DialogPrimitive.Close>
          </div>
          {script ? (
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="mx-auto flex max-w-3xl flex-col gap-5">
                <ul className="flex flex-wrap gap-2">
                  {script.speakers.map((speaker) => (
                    <li key={speaker.key} className="rounded-full bg-[var(--talea-surface-inset)] px-3 py-1 text-[12px]">
                      <strong className={speakers.get(speaker.key)?.tone}>{speaker.isNarrator ? "Erzähler" : speaker.name}</strong> · {speaker.voiceName || "?"} · <em>{speaker.persona}</em>
                    </li>
                  ))}
                </ul>
                {script.notes.length ? (
                  <ul className="flex list-disc flex-col gap-1 rounded-xl bg-amber-50 p-3 pl-7 text-[13px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    {script.notes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                ) : null}
                {script.parts.map((part, partIndex) => (
                  <section key={partIndex} className="flex flex-col gap-2">
                    <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--talea-text-tertiary)]">{part.title}</h3>
                    {part.lines.map((line, lineIndex) => {
                      const scene = part.scenes.find((entry) => entry.startLine === lineIndex);
                      const speaker = speakers.get(line.speaker);
                      return (
                        <React.Fragment key={lineIndex}>
                          {scene ? (
                            <p className="mt-2 rounded-lg bg-[var(--talea-surface-inset)] px-3 py-2 text-[12px] text-[var(--talea-text-secondary)]">
                              <strong>Szene:</strong> {scene.place}
                              {scene.ambience ? <> · Atmo: <em>{scene.ambience}</em></> : null}
                              {scene.music ? <> · Musik: <strong>{scene.music}</strong></> : null}
                            </p>
                          ) : null}
                          <p className="text-[14px] leading-relaxed text-[var(--talea-text-primary)]">
                            <strong className={speaker?.tone}>{speaker?.isNarrator ? "Erzähler" : speaker?.name || line.speaker}:</strong> {line.text}
                            {line.sounds.map((sound, soundIndex) => (
                              <span key={soundIndex} className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--talea-surface-inset)] px-2 py-0.5 text-[11px] text-[var(--talea-text-secondary)]">
                                <Volume2 className="h-3 w-3" aria-hidden="true" /> {sound.sound}{sound.at ? ` @${sound.at}` : ""}
                              </span>
                            ))}
                          </p>
                        </React.Fragment>
                      );
                    })}
                  </section>
                ))}
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

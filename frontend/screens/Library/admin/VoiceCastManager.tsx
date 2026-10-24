import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { useBackend } from "@/hooks/useBackend";
import { cn } from "@/lib/utils";
import { taleaDisplayFont, taleaInputClass, taleaSurfaceClass } from "@/components/talea/TaleaPastelPrimitives";
import { errorMessage, type LibraryVoiceCastResponse, type LibraryVoiceOption, type LibraryVoiceRole } from "../libraryShared";

const SOURCE_LABELS: Record<string, string> = { admin: "Von dir gewählt", series: "Standard der Reihe", auto: "Automatisch gewählt" };

/** One cast per voice catalog: Gemini Lite and Flash share the same 30 voices. */
const FAMILIES = [
  { id: "elevenlabs", engine: "elevenlabs", label: "ElevenLabs", note: "Stimmen aus dem ElevenLabs-Konto, Hörprobe von ElevenLabs." },
  { id: "gemini", engine: "gemini-lite", label: "Gemini", note: "30 Gemini-Stimmen; Alter und Wesen kommen aus der Regie. Die Hörprobe spricht einen Satz der Figur (≈ 0,06 ct)." },
] as const;

/**
 * Who speaks with which voice in the audio dramas of a series, per engine. A
 * figure keeps its voice in every episode; a change applies from the next
 * recording on („Neu vertonen" keeps the screenplay). The acting note is shared
 * by all engines: ElevenLabs gets it as the base audio tag, Gemini as direction.
 */
export const VoiceCastManager: React.FC<{ slug: string }> = ({ slug }) => {
  const backend = useBackend();
  const [family, setFamily] = useState<(typeof FAMILIES)[number]["id"]>("elevenlabs");
  const [data, setData] = useState<LibraryVoiceCastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const engine = FAMILIES.find((entry) => entry.id === family)!.engine;

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    backend.story
      .libraryAdminVoiceCast({ slug, engine })
      .then((response) => alive && setData(response))
      .catch((loadError) => alive && setError(errorMessage(loadError, "Stimmen konnten nicht geladen werden.")));
    return () => {
      alive = false;
      player.current?.pause();
    };
  }, [backend, slug, engine]);

  // German voices first on ElevenLabs: the dramas are German, other voices speak with an accent.
  const voices = useMemo(
    () => [...(data?.voices || [])].sort((a, b) => Number(b.traits.includes("Deutsch")) - Number(a.traits.includes("Deutsch")) || a.name.localeCompare(b.name)),
    [data],
  );
  const byId = useMemo(() => new Map(voices.map((voice) => [voice.voiceId, voice])), [voices]);

  const save = async (role: LibraryVoiceRole, change: { voiceId?: string; persona?: string; reset?: boolean }) => {
    setSaving(role.speakerId);
    try {
      setData(await backend.story.libraryAdminUpdateVoice({ slug, speakerId: role.speakerId, engine, ...change }));
      toast.success(change.reset ? `${role.name}: wieder automatische bzw. Standard-Stimme.` : `${role.name} gespeichert. Gilt ab der nächsten Aufnahme.`);
    } catch (saveError) {
      toast.error(errorMessage(saveError, "Speichern hat nicht geklappt."));
    } finally {
      setSaving(null);
    }
  };

  const play = (key: string, url: string) => {
    player.current?.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlaying(null);
    player.current = audio;
    setPlaying(key);
    void audio.play().catch(() => setPlaying(null));
  };

  const preview = async (role: LibraryVoiceRole, voice: LibraryVoiceOption | undefined) => {
    if (!voice) return;
    const key = `${role.speakerId}:${voice.voiceId}`;
    if (playing === key) {
      player.current?.pause();
      setPlaying(null);
      return;
    }
    if (!data?.generatedPreviews) {
      if (voice.previewUrl) play(key, voice.previewUrl);
      return;
    }
    setLoadingPreview(key);
    try {
      const result = await backend.story.libraryAdminVoicePreview({ slug, speakerId: role.speakerId, engine, voiceId: voice.voiceId });
      play(key, result.audio);
    } catch (previewError) {
      toast.error(errorMessage(previewError, "Hörprobe hat nicht geklappt."));
    } finally {
      setLoadingPreview(null);
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[1.2rem] font-bold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>Stimmen im Hörspiel</h3>
          <p className="text-[14px] text-[var(--talea-text-secondary)]">
            Jede Figur behält ihre Stimme in allen Folgen, je Engine eine eigene. Eine Änderung gilt ab der nächsten Aufnahme („Neu vertonen“ behält das Drehbuch). Der Grundton gilt für alle Engines (Englisch, z. B. „grumpy, gruff“).
          </p>
        </div>
        <div className="flex rounded-full bg-[var(--talea-surface-inset)] p-1" role="tablist" aria-label="Stimmen-Engine">
          {FAMILIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={family === entry.id}
              onClick={() => setFamily(entry.id)}
              className={cn("h-9 rounded-full px-4 text-[13px] font-semibold", family === entry.id ? "bg-[var(--talea-surface-primary)] text-[var(--primary)] shadow-sm" : "text-[var(--talea-text-secondary)]")}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-[var(--talea-text-tertiary)]">{FAMILIES.find((entry) => entry.id === family)!.note}</p>
      {error ? <p className="mt-3 text-[14px] text-rose-600">{error}</p> : null}
      {!data && !error ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" /></div> : null}
      {data ? (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {data.roles.map((role) => {
            const voice = role.voiceId ? byId.get(role.voiceId) : undefined;
            const key = voice ? `${role.speakerId}:${voice.voiceId}` : "";
            const canPreview = Boolean(voice && (data.generatedPreviews || voice.previewUrl));
            return (
              <li key={role.speakerId} className={cn(taleaSurfaceClass, "flex flex-col gap-2.5 p-4")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold text-[var(--talea-text-primary)]">{role.name}</p>
                    <p className="text-[12px] text-[var(--talea-text-tertiary)]">{[role.role, SOURCE_LABELS[role.source] ?? role.source].filter(Boolean).join(" · ")}</p>
                  </div>
                  {saving === role.speakerId ? <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" /> : null}
                </div>
                {role.silent ? (
                  <p className="flex items-center gap-2 text-[13px] text-[var(--talea-text-secondary)]">
                    <VolumeX className="h-4 w-4" aria-hidden="true" /> Spricht nicht — nur Geräusche ({role.persona}). Wähle eine Stimme, wenn die Figur sprechen soll.
                  </p>
                ) : null}
                {role.replaced ? <p className="text-[12px] text-amber-700 dark:text-amber-300">Die eingestellte Stimme gibt es im ElevenLabs-Konto nicht mehr; vertreten durch eine automatische Wahl.</p> : null}
                <div className="flex items-center gap-2">
                  <select
                    value={role.voiceId || ""}
                    disabled={saving !== null}
                    onChange={(event) => event.target.value && void save(role, { voiceId: event.target.value })}
                    className={cn(taleaInputClass, "min-w-0 flex-1")}
                    aria-label={`Stimme für ${role.name}`}
                  >
                    {!role.voiceId ? <option value="">— keine Stimme —</option> : null}
                    {voices.map((option) => (
                      <option key={option.voiceId} value={option.voiceId}>
                        {option.name}{option.traits ? ` (${option.traits})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void preview(role, voice)}
                    disabled={!canPreview || loadingPreview !== null}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--talea-surface-inset)] text-[var(--primary)] disabled:opacity-40"
                    aria-label={playing === key ? "Hörprobe stoppen" : `Hörprobe: ${voice?.name ?? "keine"}`}
                  >
                    {loadingPreview === key ? <Loader2 className="h-4 w-4 animate-spin" /> : playing === key ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </div>
                {voice?.description ? <p className="line-clamp-2 text-[12px] text-[var(--talea-text-tertiary)]">{voice.description}</p> : null}
                <div className="flex items-center gap-2">
                  <input
                    key={`${role.speakerId}-${role.persona}`}
                    defaultValue={role.persona}
                    disabled={saving !== null}
                    onBlur={(event) => event.target.value.trim() !== role.persona && void save(role, { persona: event.target.value })}
                    className={cn(taleaInputClass, "min-w-0 flex-1 text-[14px]")}
                    aria-label={`Grundton für ${role.name}`}
                    placeholder="Grundton, z. B. grumpy, gruff"
                  />
                  {role.source === "admin" ? (
                    <button type="button" onClick={() => void save(role, { reset: true })} disabled={saving !== null} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-[var(--talea-text-secondary)]" title={family === "gemini" ? "Zurück zur automatischen Wahl" : "Zurück zur Standard-Stimme der Reihe"}>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {family === "gemini" ? "Automatisch" : "Standard"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
};

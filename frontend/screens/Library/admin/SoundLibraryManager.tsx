import React, { useMemo, useRef, useState } from "react";
import { Ban, Loader2, Pause, Pencil, Play, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useBackend } from "@/hooks/useBackend";
import { cn } from "@/lib/utils";
import { taleaInputClass, taleaInsetSurfaceClass, taleaSurfaceClass } from "@/components/talea/TaleaPastelPrimitives";
import { errorMessage, type LibrarySoundsResponse, type LibrarySoundView } from "../libraryShared";

const FILTERS = [
  { id: "all", label: "Alle" },
  { id: "sfx", label: "Effekte" },
  { id: "ambience", label: "Atmosphären" },
  { id: "blocked", label: "Gesperrt" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const PAGE = 60;

const lengthLabel = (sound: LibrarySoundView) => (sound.kind === "ambience" ? "Atmosphäre · Schleife" : `Effekt · ${sound.seconds.toLocaleString("de-DE")} s`);

/**
 * The sound library every story shares (admins). Every generated spot effect
 * and ambience bed lands here with a name, a description and keywords; before a
 * recording, Luna looks for a sound that sounds the same for each sound of the
 * screenplay, and only what is missing is generated. A bad sound is blocked so
 * it is never chosen again; a corrected description helps the next match.
 */
export const SoundLibraryManager: React.FC = () => {
  const backend = useBackend();
  const [data, setData] = useState<LibrarySoundsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await backend.story.libraryAdminSounds());
    } catch (loadError) {
      setError(errorMessage(loadError, "Die Geräusche-Bibliothek konnte nicht geladen werden."));
    } finally {
      setLoading(false);
    }
  };

  const sounds = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (data?.sounds || []).filter((sound) => {
      if (filter === "blocked" ? !sound.blocked : filter !== "all" && sound.kind !== filter) return false;
      const text = `${sound.label} ${sound.description} ${sound.tags.join(" ")} ${sound.prompt} ${sound.origin ?? ""}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [data, filter, query]);

  const replace = (sound: LibrarySoundView) => setData((current) => (current ? { ...current, sounds: current.sounds.map((entry) => (entry.id === sound.id ? sound : entry)) } : current));

  const save = async (sound: LibrarySoundView, change: { label?: string; description?: string; tags?: string[]; blocked?: boolean }, message: string) => {
    setSaving(sound.id);
    try {
      replace(await backend.story.libraryAdminUpdateSound({ id: sound.id, ...change }));
      setEditing(null);
      toast.success(message);
    } catch (saveError) {
      toast.error(errorMessage(saveError, "Speichern hat nicht geklappt."));
    } finally {
      setSaving(null);
    }
  };

  const play = async (sound: LibrarySoundView) => {
    if (playing === sound.id) {
      player.current?.pause();
      setPlaying(null);
      return;
    }
    player.current?.pause();
    setLoadingAudio(sound.id);
    try {
      const { url } = await backend.story.libraryAdminSoundAudio({ id: sound.id });
      const audio = new Audio(url);
      audio.onended = () => setPlaying(null);
      player.current = audio;
      setPlaying(sound.id);
      await audio.play();
    } catch (playError) {
      setPlaying(null);
      toast.error(errorMessage(playError, "Abspielen hat nicht geklappt."));
    } finally {
      setLoadingAudio(null);
    }
  };

  return (
    <details
      className={cn(taleaInsetSurfaceClass, "p-5")}
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open && !data && !loading) void load();
        if (!(event.currentTarget as HTMLDetailsElement).open) player.current?.pause();
      }}
    >
      <summary className="cursor-pointer text-[15px] font-semibold text-[var(--talea-text-primary)]">
        Geräusche-Bibliothek (alle Geschichten)
        {data ? <span className="font-normal text-[var(--talea-text-secondary)]"> · {data.counts.sfx} Effekte, {data.counts.ambience} Atmosphären{data.reuses ? `, ${data.reuses}× wiederverwendet` : ""}</span> : null}
      </summary>
      <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-[var(--talea-text-secondary)]">
        Jedes erzeugte Geräusch landet hier mit Namen, Beschreibung und Stichwörtern. Vor jeder Aufnahme sucht Luna für jedes Geräusch des Drehbuchs eines, das in der Szene gleich klingt; nur was fehlt, wird neu erzeugt. Ein schlechtes Geräusch sperrst du hier: Es wird nie wieder genommen, und Folgen, die es benutzt haben, bekommen bei der nächsten Aufnahme ein anderes.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--talea-text-tertiary)]" aria-hidden="true" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setShown(PAGE); }} placeholder="Suchen, z. B. Tür, Hund, Regen" className={cn(taleaInputClass, "w-full pl-9 text-[14px]")} aria-label="Geräusche durchsuchen" />
        </label>
        <div className="flex flex-wrap rounded-full bg-[var(--talea-surface-primary)] p-1" role="tablist" aria-label="Art">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={filter === entry.id}
              onClick={() => { setFilter(entry.id); setShown(PAGE); }}
              className={cn("h-9 rounded-full px-3 text-[13px] font-semibold", filter === entry.id ? "bg-[var(--talea-surface-inset)] text-[var(--primary)]" : "text-[var(--talea-text-secondary)]")}
            >
              {entry.label}{entry.id === "blocked" && data?.counts.blocked ? ` (${data.counts.blocked})` : ""}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-3 text-[14px] text-rose-600">{error}</p> : null}
      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" /></div> : null}
      {data && !sounds.length ? (
        <p className="mt-4 text-[14px] text-[var(--talea-text-secondary)]">
          {data.sounds.length ? "Kein Geräusch passt zur Suche." : "Noch leer: Die erste Hörspiel-Aufnahme füllt die Bibliothek."}
        </p>
      ) : null}

      {sounds.length ? (
        <ul className="mt-4 flex flex-col gap-2">
          {sounds.slice(0, shown).map((sound) => (
            <li key={sound.id} className={cn(taleaSurfaceClass, "flex flex-col gap-2 p-3", sound.blocked && "opacity-60")}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => void play(sound)}
                  disabled={loadingAudio !== null && loadingAudio !== sound.id}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--talea-surface-inset)] text-[var(--primary)] disabled:opacity-40"
                  aria-label={playing === sound.id ? "Anhören stoppen" : `Anhören: ${sound.label}`}
                >
                  {loadingAudio === sound.id ? <Loader2 className="h-4 w-4 animate-spin" /> : playing === sound.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-[var(--talea-text-primary)]">{sound.label}{sound.blocked ? <span className="ml-2 text-[12px] font-semibold text-rose-600">gesperrt</span> : null}</p>
                  <p className="text-[12px] text-[var(--talea-text-tertiary)]">
                    {[lengthLabel(sound), `${sound.uses}× benutzt`, sound.origin ? `zuerst in ${sound.origin}` : ""].filter(Boolean).join(" · ")}
                  </p>
                  {editing !== sound.id ? (
                    <>
                      <p className="mt-1 text-[13px] leading-relaxed text-[var(--talea-text-secondary)]">{sound.description}</p>
                      {sound.tags.length ? (
                        <ul className="mt-1.5 flex flex-wrap gap-1">
                          {sound.tags.map((tag) => <li key={tag} className="rounded-full bg-[var(--talea-surface-inset)] px-2 py-0.5 text-[11px] text-[var(--talea-text-secondary)]">{tag}</li>)}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <SoundEditor sound={sound} busy={saving === sound.id} onCancel={() => setEditing(null)} onSave={(change) => void save(sound, change, "Beschreibung gespeichert. Gilt ab der nächsten Aufnahme.")} />
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                  {saving === sound.id && editing !== sound.id ? <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" /> : null}
                  {editing !== sound.id ? (
                    <button type="button" onClick={() => setEditing(sound.id)} disabled={saving !== null} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-[var(--primary)]">
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Bearbeiten
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void save(sound, { blocked: !sound.blocked }, sound.blocked ? `„${sound.label}“ wird wieder verwendet.` : `„${sound.label}“ ist gesperrt und wird nicht mehr gewählt.`)}
                    disabled={saving !== null}
                    className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold", sound.blocked ? "text-[var(--primary)]" : "text-rose-600")}
                  >
                    {sound.blocked ? <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Ban className="h-3.5 w-3.5" aria-hidden="true" />}
                    {sound.blocked ? "Wieder verwenden" : "Sperren"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {sounds.length > shown ? (
        <button type="button" onClick={() => setShown((count) => count + PAGE)} className="mt-3 h-10 rounded-full bg-[var(--talea-surface-primary)] px-4 text-[14px] font-semibold text-[var(--primary)]">
          Weitere {Math.min(PAGE, sounds.length - shown)} von {sounds.length - shown} zeigen
        </button>
      ) : null}
    </details>
  );
};

/** Name, description and keywords — what later screenplays are matched against. */
const SoundEditor: React.FC<{ sound: LibrarySoundView; busy: boolean; onCancel: () => void; onSave: (change: { label: string; description: string; tags: string[] }) => void }> = ({ sound, busy, onCancel, onSave }) => {
  const [label, setLabel] = useState(sound.label);
  const [description, setDescription] = useState(sound.description);
  const [tags, setTags] = useState(sound.tags.join(", "));
  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ label, description, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean) });
      }}
    >
      <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} className={cn(taleaInputClass, "text-[14px]")} aria-label="Name (deutsch)" placeholder="Name, z. B. Holztür fällt leise ins Schloss" />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={320} rows={3} className={cn(taleaInputClass, "text-[14px] leading-relaxed")} aria-label="Beschreibung (englisch)" placeholder="What you hear: source, action, material, room, intensity, character" />
      <input value={tags} onChange={(event) => setTags(event.target.value)} className={cn(taleaInputClass, "text-[14px]")} aria-label="Stichwörter (englisch, mit Komma)" placeholder="door, wooden, close, shut, latch" />
      <p className="text-[12px] text-[var(--talea-text-tertiary)]">Beschreibung und Stichwörter auf Englisch: Danach sucht die Bibliothek, wenn ein Drehbuch ein Geräusch wünscht.</p>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--primary)] px-4 text-[13px] font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Speichern
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="h-9 rounded-full px-3 text-[13px] font-semibold text-[var(--talea-text-secondary)]">Abbrechen</button>
      </div>
    </form>
  );
};

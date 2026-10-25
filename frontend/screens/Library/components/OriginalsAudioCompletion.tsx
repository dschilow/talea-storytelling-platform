import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Headphones, Loader2, X } from "lucide-react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useBackend } from "@/hooks/useBackend";
import { TaleaActionButton, taleaDisplayFont } from "@/components/talea/TaleaPastelPrimitives";
import { errorMessage, type LibraryEpisodeResponse } from "../libraryShared";
import { EpisodeContinuation } from "./EpisodeContinuation";

/** Lives beside the global player, so finishing still works after leaving the reader. */
export const OriginalsAudioCompletion: React.FC = () => {
  const { originalsCompletion, dismissOriginalsCompletion, retryOriginalsCompletion } = useAudioPlayer();
  const backend = useBackend();
  const [episode, setEpisode] = useState<LibraryEpisodeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const source = originalsCompletion?.track.originals;

  useEffect(() => {
    setEpisode(null);
    setError(null);
    if (!source) return;
    let cancelled = false;
    backend.story.libraryEpisode({ id: source.episodeId, profileId: source.profileId })
      .then((result) => { if (!cancelled) setEpisode(result); })
      .catch((loadError) => { if (!cancelled) setError(errorMessage(loadError, "Der nächste Vorschlag konnte nicht geladen werden.")); });
    return () => { cancelled = true; };
  }, [backend, source?.episodeId, source?.profileId, attempt]);

  return (
    <Dialog.Root open={Boolean(originalsCompletion)} onOpenChange={(open) => { if (!open) dismissOriginalsCompletion(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2100] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[2101] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-[2rem] bg-[var(--talea-surface-primary)] p-5 text-[var(--talea-text-primary)] shadow-2xl focus:outline-none sm:p-7">
          <Dialog.Close aria-label="Vorschlag schließen" className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--talea-text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"><X className="h-5 w-5" /></Dialog.Close>
          <div className="pr-8">
            <p className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--primary)]"><Headphones className="h-4 w-4" aria-hidden="true" /> Ende des Hörspiels</p>
            <Dialog.Title className="text-[26px] font-bold leading-tight" style={{ fontFamily: taleaDisplayFont }}>Zu Ende gehört!</Dialog.Title>
            <Dialog.Description className="mt-2 text-[15px] leading-relaxed text-[var(--talea-text-secondary)]">{originalsCompletion?.track.title}</Dialog.Description>
          </div>
          {originalsCompletion?.status === "saving" ? <p role="status" className="text-[13px] text-[var(--talea-text-secondary)]">Dein Hörfortschritt wird gespeichert …</p> : null}
          {originalsCompletion?.status === "saved" && originalsCompletion.collectible ? <p className="text-[14px] leading-relaxed text-[var(--talea-text-secondary)]">Deine Karte „{originalsCompletion.collectible.title}“ liegt jetzt in deiner Sammlung.</p> : null}
          {originalsCompletion?.status === "error" ? (
            <div role="alert" className="space-y-2 text-[14px] text-[var(--talea-text-secondary)]"><p>Dein Hörfortschritt konnte noch nicht gespeichert werden.</p><TaleaActionButton variant="secondary" onClick={retryOriginalsCompletion}>Speichern erneut versuchen</TaleaActionButton></div>
          ) : null}
          {episode ? <EpisodeContinuation episode={episode} mode="listen" profileId={source?.profileId} onContinue={dismissOriginalsCompletion} /> : error ? (
            <div role="alert" className="space-y-2 text-[14px] text-[var(--talea-text-secondary)]"><p>{error}</p><TaleaActionButton variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Vorschlag erneut laden</TaleaActionButton></div>
          ) : <p role="status" className="flex items-center gap-2 text-[14px] text-[var(--talea-text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Deine nächste Geschichte wird ausgesucht …</p>}
          <Dialog.Close className="min-h-11 rounded-2xl px-4 py-2.5 text-[15px] font-semibold text-[var(--talea-text-secondary)] hover:bg-[var(--talea-surface-inset)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]">Für heute fertig</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Headphones, Loader2, Shuffle } from "lucide-react";
import { useBackend } from "@/hooks/useBackend";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { TaleaActionButton, taleaDisplayFont } from "@/components/talea/TaleaPastelPrimitives";
import { episodeLabel, episodeReaderPath, errorMessage, originalsHomePath, type LibraryEpisodeResponse } from "../libraryShared";
import { originalsAudioTrack } from "../originalsAudioTrack";

/** The same continuation after reading and listening; starting it is always a choice. */
export const EpisodeContinuation: React.FC<{
  episode: LibraryEpisodeResponse;
  mode?: "read" | "listen";
  profileId?: string;
  onContinue?: () => void;
}> = ({ episode, mode = "read", profileId, onContinue }) => {
  const backend = useBackend();
  const navigate = useNavigate();
  const { playTrack } = useAudioPlayer();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proposal = mode === "listen" ? episode.audioRecommendation ?? episode.recommendation : episode.recommendation;
  const listen = mode === "listen" && Boolean(proposal?.hasAudio);

  const read = () => {
    onContinue?.();
    navigate(proposal ? episodeReaderPath(proposal.id) : originalsHomePath);
  };
  const play = async () => {
    if (!proposal || pending) return;
    setPending(true);
    setError(null);
    try {
      // Resolve a fresh URL and re-check availability when the child chooses it.
      const next = await backend.story.libraryEpisode({ id: proposal.id, profileId });
      if (!next.audio?.released) throw new Error("Dieses Hörspiel ist gerade nicht verfügbar. Du kannst die Folge lesen.");
      playTrack(originalsAudioTrack(next, profileId));
      onContinue?.();
      navigate(episodeReaderPath(next.id));
    } catch (playError) {
      setError(errorMessage(playError, "Das Hörspiel konnte nicht gestartet werden. Bitte nochmal versuchen."));
    } finally {
      setPending(false);
    }
  };

  if (!proposal) {
    return <TaleaActionButton variant="secondary" icon={<BookOpen className="h-4 w-4" aria-hidden="true" />} onClick={read}>Weitere Originals entdecken</TaleaActionButton>;
  }

  return (
    <section aria-label="Deine nächste Geschichte" className="w-full max-w-md rounded-3xl bg-[var(--talea-surface-inset)] p-4 text-left text-[var(--talea-text-primary)]">
      <p className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--primary)]">
        {proposal.kind === "random" ? <Shuffle className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        {proposal.kind === "next" ? "Die nächste Folge wartet" : "Eine andere Geschichte für dich"}
      </p>
      <div className="flex items-start gap-3">
        {proposal.coverImageUrl ? <img src={proposal.coverImageUrl} alt="" className="aspect-[3/2] w-24 shrink-0 rounded-xl object-cover sm:w-28" loading="lazy" /> : null}
        <div className="min-w-0">
          <p className="text-[12px] leading-relaxed text-[var(--talea-text-secondary)]">{proposal.seriesTitle} · {episodeLabel(proposal)}</p>
          <h3 className="mt-1 text-[18px] font-bold leading-snug" style={{ fontFamily: taleaDisplayFont }}>{proposal.title}</h3>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <TaleaActionButton className="flex-1" disabled={pending} aria-busy={pending} onClick={() => listen ? void play() : read()} icon={pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : listen ? <Headphones className="h-4 w-4" aria-hidden="true" /> : <BookOpen className="h-4 w-4" aria-hidden="true" />}>
          {pending ? "Hörspiel wird geladen …" : listen ? "Weiterhören" : "Jetzt lesen"}
        </TaleaActionButton>
        {listen ? <TaleaActionButton variant="secondary" onClick={read}>Lieber lesen</TaleaActionButton> : null}
      </div>
      {error ? <p role="alert" className="mt-3 text-[13px] leading-relaxed text-[var(--talea-text-secondary)]">{error}</p> : null}
    </section>
  );
};

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Footprints, Gem, Sparkles, Star, X } from 'lucide-react';

import { useBackend } from '../../../hooks/useBackend';
import { cn } from '@/lib/utils';

export interface BroughtArtifactSelection {
  artifactId: string;
  avatarId: string;
  avatarName: string;
  name: string;
  emoji?: string;
  imageUrl?: string;
  level: number;
  journeys: number;
  journeysUntilNextLevel?: number;
  nextLevel?: number;
}

interface BringableArtifactView extends BroughtArtifactSelection {
  description: string;
  category: string;
  rarity: string;
  storyRole?: string;
}

interface Props {
  selectedAvatars: string[];
  broughtArtifact: BroughtArtifactSelection | null;
  onSelect: (selection: BroughtArtifactSelection | null) => void;
}

/**
 * Wizard section: take ONE artifact from a participating avatar's
 * Schatzkammer along into the new story. Journeys feed the artifact's level
 * track — the story rewards a Fundstück instead of a new artifact.
 */
export default function ArtifactCompanionPicker({ selectedAvatars, broughtArtifact, onSelect }: Props) {
  const backend = useBackend();
  const [artifacts, setArtifacts] = useState<BringableArtifactView[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (selectedAvatars.length === 0) {
      setArtifacts([]);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const result = await backend.story.bringableArtifacts({ avatarIds: selectedAvatars });
        if (!active) return;
        setArtifacts((result?.artifacts || []) as BringableArtifactView[]);
      } catch (err) {
        console.warn('[ArtifactCompanionPicker] Loading bringable artifacts failed:', err);
        if (active) setArtifacts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [backend, selectedAvatars.join(',')]);

  // Deselect when the owning avatar leaves the party.
  useEffect(() => {
    if (broughtArtifact && !selectedAvatars.includes(broughtArtifact.avatarId)) {
      onSelect(null);
    }
  }, [selectedAvatars, broughtArtifact, onSelect]);

  if (!loading && (artifacts?.length ?? 0) === 0) {
    return null; // No treasures yet — the section stays invisible instead of empty.
  }

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
          <Gem className="h-4 w-4 text-amber-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Einen Schatz mitnehmen?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ein Artefakt aus der Schatzkammer reist mit und sammelt eine Reise für seinen Stufenaufstieg.
            Dafür gibt es am Ende ein Fundstück statt eines neuen Artefakts.
          </p>
        </div>
        {broughtArtifact && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Ohne Schatz
          </button>
        )}
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-muted-foreground">Schatzkammer wird durchsucht …</p>
      ) : (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label="Artefakt zum Mitnehmen wählen">
          {(artifacts || []).map((artifact) => {
            const isSelected =
              broughtArtifact?.artifactId === artifact.artifactId &&
              broughtArtifact?.avatarId === artifact.avatarId;
            return (
              <button
                key={`${artifact.avatarId}:${artifact.artifactId}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() =>
                  onSelect(
                    isSelected
                      ? null
                      : {
                          artifactId: artifact.artifactId,
                          avatarId: artifact.avatarId,
                          avatarName: artifact.avatarName,
                          name: artifact.name,
                          emoji: artifact.emoji,
                          imageUrl: artifact.imageUrl,
                          level: artifact.level,
                          journeys: artifact.journeys,
                          journeysUntilNextLevel: artifact.journeysUntilNextLevel,
                          nextLevel: artifact.nextLevel,
                        }
                  )
                }
                className={cn(
                  'relative flex w-32 shrink-0 flex-col items-center rounded-2xl border p-3 text-center transition-all',
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 shadow-md ring-2 ring-amber-500/30'
                    : 'border-border bg-card hover:border-amber-400/50'
                )}
              >
                {artifact.imageUrl ? (
                  <img src={artifact.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center text-3xl">{artifact.emoji || '🎁'}</span>
                )}
                <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-tight text-foreground">{artifact.name}</p>
                <p className="text-[10px] text-muted-foreground">von {artifact.avatarName}</p>
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  {[...Array(Math.max(1, Math.min(5, artifact.level)))].map((_, i) => (
                    <Star key={i} className="h-2.5 w-2.5 fill-current text-amber-400" />
                  ))}
                  · <Footprints className="h-2.5 w-2.5" /> {artifact.journeys}
                </span>
                <AnimatePresence>
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -right-1.5 -top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white shadow"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {broughtArtifact && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            {broughtArtifact.name} reist mit!
            {broughtArtifact.journeysUntilNextLevel
              ? ` Noch ${broughtArtifact.journeysUntilNextLevel} ${broughtArtifact.journeysUntilNextLevel === 1 ? 'Reise' : 'Reisen'} bis Stufe ${broughtArtifact.nextLevel}.`
              : ''}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

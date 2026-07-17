import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Footprints, Gem, Sparkles, Star, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import ArtifactCelebrationModal, { UnlockedArtifact } from './ArtifactCelebrationModal';

// Mirror of MarkStoryReadResponse.treasureRewards (backend/story/markRead.ts).
export interface TreasureRewardsPayload {
  shardsForChoice: number;
  perAvatar: Array<{
    avatarId: string;
    avatarName: string;
    shardsEarned: number;
    shardBalance: number;
    choiceReady: boolean;
    journey?: {
      artifactId: string;
      artifactName: string;
      emoji?: string;
      imageUrl?: string;
      journeys: number;
      level: number;
      leveledUp: boolean;
      journeysUntilNextLevel?: number;
      nextLevel?: number;
    };
    completedSets: Array<{
      setId: string;
      setName: string;
      setEmoji?: string;
      crown: {
        id: string;
        name: string;
        description: string;
        category: string;
        rarity: string;
        emoji?: string;
        imageUrl?: string;
      };
    }>;
  }>;
}

type Scene =
  | { kind: 'journey'; avatarName: string; journey: NonNullable<TreasureRewardsPayload['perAvatar'][number]['journey']> }
  | { kind: 'crown'; avatarName: string; setName: string; crown: TreasureRewardsPayload['perAvatar'][number]['completedSets'][number]['crown'] };

interface TreasureRewardsOverlayProps {
  /** markRead treasureRewards payload; null/undefined renders nothing. */
  rewards: TreasureRewardsPayload | null | undefined;
  /** Gate: only start presenting once the (optional) artifact celebration closed. */
  active: boolean;
  onAllDone?: () => void;
}

/**
 * Presents the Schatzkammer outcome of a finished story in order:
 * journey/level-up cards → set-crown celebrations → a small Fundstück toast.
 */
const TreasureRewardsOverlay: React.FC<TreasureRewardsOverlayProps> = ({ rewards, active, onAllDone }) => {
  const navigate = useNavigate();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);

  const scenes = useMemo<Scene[]>(() => {
    if (!rewards) return [];
    const list: Scene[] = [];
    for (const entry of rewards.perAvatar) {
      if (entry.journey) {
        list.push({ kind: 'journey', avatarName: entry.avatarName, journey: entry.journey });
      }
    }
    for (const entry of rewards.perAvatar) {
      for (const set of entry.completedSets || []) {
        list.push({ kind: 'crown', avatarName: entry.avatarName, setName: set.setName, crown: set.crown });
      }
    }
    return list;
  }, [rewards]);

  const shardEntries = useMemo(
    () => (rewards?.perAvatar || []).filter((entry) => entry.shardsEarned > 0),
    [rewards]
  );
  const choiceReadyEntry = useMemo(
    () => (rewards?.perAvatar || []).find((entry) => entry.choiceReady),
    [rewards]
  );

  const scenesDone = sceneIndex >= scenes.length;

  // Shard toast appears once the modal scenes are through.
  useEffect(() => {
    if (!active || !rewards) return;
    if (scenesDone && shardEntries.length > 0 && !toastDismissed) {
      setToastVisible(true);
      const handle = window.setTimeout(() => {
        setToastVisible(false);
        setToastDismissed(true);
      }, 9000);
      return () => window.clearTimeout(handle);
    }
  }, [active, rewards, scenesDone, shardEntries.length, toastDismissed]);

  useEffect(() => {
    if (active && rewards && scenesDone && (shardEntries.length === 0 || toastDismissed)) {
      onAllDone?.();
    }
  }, [active, rewards, scenesDone, shardEntries.length, toastDismissed, onAllDone]);

  if (!rewards || !active) return null;

  const scene = scenes[sceneIndex];

  return (
    <>
      {/* Journey / level-up card */}
      <AnimatePresence>
        {scene?.kind === 'journey' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            onClick={() => setSceneIndex((i) => i + 1)}
          >
            <motion.div
              initial={{ scale: 0.4, y: 80, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1, transition: { type: 'spring', damping: 18, stiffness: 180 } }}
              exit={{ scale: 0.4, y: -80, opacity: 0 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSceneIndex((i) => i + 1)}
                className="absolute right-4 top-4 rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Weiter"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center justify-center gap-2">
                <Footprints className="h-5 w-5 text-amber-400" />
                <h2 className="text-xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                  {scene.journey.leveledUp ? 'Stufenaufstieg!' : 'Reise abgeschlossen!'}
                </h2>
              </div>
              <p className="mt-1 text-sm text-white/60">
                {scene.journey.artifactName} war mit {scene.avatarName} unterwegs.
              </p>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.35, type: 'spring', damping: 12 }}
                className="mx-auto mt-5 h-32 w-32 rounded-2xl border border-white/20 bg-white/10 p-2"
              >
                {scene.journey.imageUrl ? (
                  <img src={scene.journey.imageUrl} alt="" className="h-full w-full rounded-xl object-contain" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-6xl">{scene.journey.emoji || '🎒'}</span>
                )}
              </motion.div>

              <div className="mt-4 flex items-center justify-center gap-1">
                {[...Array(Math.max(1, Math.min(5, scene.journey.level)))].map((_, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.5 + i * 0.12 }}
                  >
                    <Star className="h-6 w-6 fill-current text-amber-400 drop-shadow" />
                  </motion.span>
                ))}
              </div>
              <p className="mt-1 text-sm font-semibold text-white">
                {scene.journey.leveledUp
                  ? `Jetzt Stufe ${scene.journey.level}!`
                  : `Stufe ${scene.journey.level} · ${scene.journey.journeys}. Reise`}
              </p>
              {scene.journey.journeysUntilNextLevel ? (
                <p className="mt-1 text-xs text-white/60">
                  Noch {scene.journey.journeysUntilNextLevel}{' '}
                  {scene.journey.journeysUntilNextLevel === 1 ? 'Reise' : 'Reisen'} bis Stufe {scene.journey.nextLevel}.
                </p>
              ) : (
                <p className="mt-1 text-xs text-white/60">Höchste Stufe erreicht — ein Reise-Veteran!</p>
              )}

              <button
                type="button"
                onClick={() => setSceneIndex((i) => i + 1)}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Weiter <Sparkles className="ml-1 inline h-4 w-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Set crown celebration */}
      {scene?.kind === 'crown' && (
        <ArtifactCelebrationModal
          artifact={
            {
              id: scene.crown.id,
              name: scene.crown.name,
              description: scene.crown.description,
              category: scene.crown.category,
              rarity: (scene.crown.rarity as UnlockedArtifact['rarity']) || 'legendary',
              emoji: scene.crown.emoji,
              imageUrl: scene.crown.imageUrl,
            } satisfies UnlockedArtifact
          }
          isVisible
          onClose={() => setSceneIndex((i) => i + 1)}
          setName={scene.setName}
        />
      )}

      {/* Fundstück toast (non-blocking) */}
      <AnimatePresence>
        {toastVisible && shardEntries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            className="fixed bottom-5 left-1/2 z-[95] w-[92%] max-w-md -translate-x-1/2"
            role="status"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-amber-300/40 bg-gradient-to-r from-[#2a2117] to-[#3a2d1c] p-4 shadow-2xl">
              <motion.span
                animate={{ rotate: [0, -12, 12, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.2 }}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/20"
              >
                <Gem className="h-6 w-6 text-amber-300" />
              </motion.span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-100">
                  +{shardEntries.reduce((sum, entry) => sum + entry.shardsEarned, 0)} Fundstück
                  {shardEntries.reduce((sum, entry) => sum + entry.shardsEarned, 0) > 1 ? 'e' : ''}!
                </p>
                {shardEntries.map((entry) => (
                  <div key={entry.avatarId} className="mt-0.5 flex items-center gap-1.5">
                    <span className="truncate text-xs text-amber-200/80">{entry.avatarName}</span>
                    <span className="flex items-center gap-0.5">
                      {[...Array(rewards.shardsForChoice)].map((_, i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: i < Math.min(rewards.shardsForChoice, entry.shardBalance) ? '#f0c36a' : '#5a4a30' }}
                        />
                      ))}
                    </span>
                    <span className="text-[10px] text-amber-200/60">
                      {Math.min(rewards.shardsForChoice, entry.shardBalance)}/{rewards.shardsForChoice}
                    </span>
                  </div>
                ))}
              </div>
              {choiceReadyEntry ? (
                <button
                  type="button"
                  onClick={() => navigate(`/avatar/${choiceReadyEntry.avatarId}?tab=treasure`)}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-xs font-bold text-white shadow"
                >
                  <Crown className="mr-1 inline h-3.5 w-3.5" />
                  Schatz wählen!
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setToastVisible(false);
                    setToastDismissed(true);
                  }}
                  className="shrink-0 rounded-full p-1.5 text-amber-200/60 hover:bg-white/10 hover:text-amber-100"
                  aria-label="Schließen"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TreasureRewardsOverlay;

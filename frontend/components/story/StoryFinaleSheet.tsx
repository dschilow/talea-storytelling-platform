import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, Crown, Footprints, Gem, Sparkles, Star, X } from 'lucide-react';

import type { UnlockedArtifact } from '../gamification/ArtifactCelebrationModal';
import type { TreasureRewardsPayload } from '../gamification/TreasureRewardsOverlay';

/**
 * ONE calm completion experience for a finished story.
 *
 * Before this component the reader fired up to eight competing surfaces at
 * once (two toasts, a growth modal, an artifact modal, a legacy artifact
 * toast, a level-up modal, the treasure overlay and a stack of agent cards).
 * A child cannot parse that. Here everything the completion produced becomes a
 * short sequence of single-idea cards inside one sheet — at most five, each
 * advanced by one big button.
 *
 * Re-reads are silent: the backend reports `alreadyCompleted` and the sheet
 * simply does not open, because nothing was earned a second time.
 */

// ---------------------------------------------------------------------------
// Payload (mirror of MarkStoryReadResponse — see backend/story/markRead.ts)
// ---------------------------------------------------------------------------

export interface StoryCompletionResult {
  updatedAvatars?: number;
  alreadyCompleted?: boolean;
  personalityChanges?: Array<{
    avatarName?: string;
    changes?: Array<{ trait: string; change: number; description?: string }>;
  }>;
  unlockedArtifact?: UnlockedArtifact | null;
  treasureRewards?: TreasureRewardsPayload | null;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

interface GrowthTrait {
  icon: string;
  label: string;
  change: number;
  reason?: string;
}

type FinaleStep =
  | { kind: 'growth'; avatarName: string; traits: GrowthTrait[] }
  | { kind: 'artifact'; artifact: UnlockedArtifact }
  | { kind: 'crown'; avatarName: string; setName: string; crown: UnlockedArtifact }
  | { kind: 'journey'; avatarName: string; journey: NonNullable<TreasureRewardsPayload['perAvatar'][number]['journey']> }
  | { kind: 'shards'; avatarName: string; balance: number; needed: number; earned: number }
  | { kind: 'outro'; treasureAvatarId?: string };

/** Max reward cards before the outro — beyond this it stops being a moment. */
const MAX_REWARD_STEPS = 4;

/**
 * Turns a trait description into something a child can read.
 * The heuristic fallback in markRead writes "+3 Mut durch Geschichte \"X\"",
 * which only restates the number we already show as a badge — strip that part
 * and keep whatever real reason follows. AI-written reasons pass through.
 */
const humanizeReason = (raw?: string): string | undefined => {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  const withoutPoints = text.replace(/^[+-]?\d+\s+\S+\s+/, '').trim();
  const candidate = withoutPoints.length >= 12 ? withoutPoints : text;
  if (candidate.length < 12) return undefined;
  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
};

async function buildGrowthSteps(result: StoryCompletionResult): Promise<FinaleStep[]> {
  const { getTraitLabel, getTraitIcon, getSubcategoryLabel, getSubcategoryIcon } = await import(
    '../../constants/traits'
  );

  const steps: FinaleStep[] = [];
  for (const avatarChange of result.personalityChanges || []) {
    const changes = (avatarChange.changes || []).filter(
      (change) => change && typeof change.change === 'number' && change.change !== 0
    );
    if (changes.length === 0) continue;

    // Biggest gains first — a child should see the headline growth, not the
    // alphabetically first one.
    const traits: GrowthTrait[] = [...changes]
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 3)
      .map((change) => {
        const isSubcategory = change.trait.includes('.');
        const subcategory = isSubcategory ? change.trait.split('.')[1] : '';
        return {
          icon: isSubcategory ? getSubcategoryIcon(subcategory) : getTraitIcon(change.trait),
          label: isSubcategory ? getSubcategoryLabel(subcategory, 'de') : getTraitLabel(change.trait, 'de'),
          change: change.change,
          reason: humanizeReason(change.description),
        };
      });

    steps.push({ kind: 'growth', avatarName: avatarChange.avatarName || 'Dein Held', traits });
  }
  return steps;
}

function buildTreasureSteps(result: StoryCompletionResult): FinaleStep[] {
  const steps: FinaleStep[] = [];
  const rewards = result.treasureRewards;

  if (result.unlockedArtifact) {
    steps.push({ kind: 'artifact', artifact: result.unlockedArtifact });
  }

  for (const entry of rewards?.perAvatar || []) {
    if (entry.journey) {
      steps.push({ kind: 'journey', avatarName: entry.avatarName, journey: entry.journey });
    }
  }

  for (const entry of rewards?.perAvatar || []) {
    for (const set of entry.completedSets || []) {
      steps.push({
        kind: 'crown',
        avatarName: entry.avatarName,
        setName: set.setName,
        crown: {
          id: set.crown.id,
          name: set.crown.name,
          description: set.crown.description,
          category: set.crown.category,
          rarity: (set.crown.rarity as UnlockedArtifact['rarity']) || 'legendary',
          emoji: set.crown.emoji,
          imageUrl: set.crown.imageUrl,
        },
      });
    }
  }

  // Fundstücke are the quiet reward — one summary card, never one per avatar.
  const shardEntry = (rewards?.perAvatar || []).find((entry) => entry.shardsEarned > 0);
  if (shardEntry && rewards) {
    steps.push({
      kind: 'shards',
      avatarName: shardEntry.avatarName,
      balance: shardEntry.shardBalance,
      needed: rewards.shardsForChoice,
      earned: shardEntry.shardsEarned,
    });
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

interface StoryFinaleSheetProps {
  /** markRead response; null keeps the sheet closed. */
  result: StoryCompletionResult | null;
  storyTitle: string;
  isDark: boolean;
  onClose: () => void;
  /** Opens the avatar's treasury tab. */
  onOpenTreasury: (avatarId?: string) => void;
  /** Starts a new adventure. */
  onNextStory: () => void;
}

const StoryFinaleSheet: React.FC<StoryFinaleSheetProps> = ({
  result,
  storyTitle,
  isDark,
  onClose,
  onOpenTreasury,
  onNextStory,
}) => {
  const [steps, setSteps] = useState<FinaleStep[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // A re-read earns nothing, so it gets no celebration at all.
    if (!result || result.alreadyCompleted) {
      setSteps(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const growth = await buildGrowthSteps(result);
      const treasure = buildTreasureSteps(result);
      if (cancelled) return;

      const rewardSteps = [...growth, ...treasure].slice(0, MAX_REWARD_STEPS);
      const treasureAvatarId =
        (result.treasureRewards?.perAvatar || []).find((entry) => entry.choiceReady)?.avatarId ||
        (result.treasureRewards?.perAvatar || [])[0]?.avatarId;

      setIndex(0);
      setSteps([...rewardSteps, { kind: 'outro', treasureAvatarId }]);
    })();
    return () => {
      cancelled = true;
    };
  }, [result]);

  const step = steps?.[index];
  const isLast = Boolean(steps) && index >= (steps?.length ?? 0) - 1;

  const advance = useCallback(() => {
    setIndex((current) => current + 1);
  }, []);

  const close = useCallback(() => {
    setSteps(null);
    onClose();
  }, [onClose]);

  const palette = useMemo(
    () =>
      isDark
        ? {
            backdrop: 'rgba(8, 10, 16, 0.86)',
            card: 'linear-gradient(165deg, #1c2331 0%, #141a25 100%)',
            border: 'rgba(255,255,255,0.10)',
            title: '#f3ece2',
            body: '#b9c2cf',
            sub: '#7d8797',
            chip: 'rgba(255,255,255,0.06)',
          }
        : {
            backdrop: 'rgba(38, 30, 22, 0.62)',
            card: 'linear-gradient(165deg, #fffdf9 0%, #fdf3e6 100%)',
            border: 'rgba(196,120,50,0.16)',
            title: '#2c2418',
            body: '#5c4e3e',
            sub: '#8c7e6e',
            chip: 'rgba(196,120,50,0.08)',
          },
    [isDark]
  );

  if (!steps || !step) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="finale-sheet"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-end justify-center p-3 sm:items-center sm:p-6"
        style={{ background: palette.backdrop, backdropFilter: 'blur(6px)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Belohnungen für die fertige Geschichte"
      >
        <motion.div
          initial={{ y: 60, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1, transition: { type: 'spring', damping: 22, stiffness: 220 } }}
          exit={{ y: 40, opacity: 0 }}
          className="relative w-full max-w-md overflow-hidden rounded-[28px] border shadow-2xl"
          style={{ background: palette.card, borderColor: palette.border }}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-10 rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: palette.sub }}
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header — stays constant so the child keeps their bearings */}
          <div className="px-6 pt-7 text-center">
            <motion.span
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12, delay: 0.1 }}
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
              style={{ background: palette.chip }}
              aria-hidden
            >
              🎉
            </motion.span>
            <h2 className="mt-3 text-2xl font-bold" style={{ color: palette.title }}>
              Geschafft!
            </h2>
            <p className="mt-1 line-clamp-2 text-sm" style={{ color: palette.sub }}>
              Du hast „{storyTitle}" zu Ende gelesen.
            </p>
          </div>

          {/* Step content */}
          <div className="px-6 pb-2 pt-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
              >
                <StepContent step={step} palette={palette} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer: progress + one single action */}
          <div className="px-6 pb-6 pt-3">
            {steps.length > 1 && (
              <div className="mb-4 flex items-center justify-center gap-1.5" aria-hidden>
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === index ? 20 : 6,
                      background: i <= index ? '#e0a03c' : (isDark ? '#39414f' : '#e6dbc9'),
                    }}
                  />
                ))}
              </div>
            )}

            {step.kind === 'outro' ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onOpenTreasury(step.treasureAvatarId)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-base font-bold text-white shadow-lg transition-transform active:scale-[0.98]"
                >
                  <Gem className="h-5 w-5" />
                  Schatzkammer ansehen
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onNextStory}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold transition-transform active:scale-[0.98]"
                    style={{ borderColor: palette.border, background: palette.chip, color: palette.title }}
                  >
                    <BookOpen className="h-4 w-4" />
                    Neue Geschichte
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold transition-transform active:scale-[0.98]"
                    style={{ borderColor: palette.border, color: palette.body }}
                  >
                    <Check className="h-4 w-4" />
                    Fertig
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={advance}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-base font-bold text-white shadow-lg transition-transform active:scale-[0.98]"
              >
                Weiter
                <Sparkles className="h-4 w-4" />
              </button>
            )}

            {!isLast && (
              <button
                type="button"
                onClick={close}
                className="mt-2 w-full py-1.5 text-xs font-semibold underline-offset-2 hover:underline"
                style={{ color: palette.sub }}
              >
                Überspringen
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------------
// Step cards — one idea each, always with a sentence that says WHY it matters
// ---------------------------------------------------------------------------

interface StepPalette {
  title: string;
  body: string;
  sub: string;
  chip: string;
  border: string;
}

const StepContent: React.FC<{ step: FinaleStep; palette: StepPalette }> = ({ step, palette }) => {
  switch (step.kind) {
    case 'growth':
      return (
        <div>
          <p className="text-center text-sm font-bold uppercase tracking-[0.14em]" style={{ color: '#c98a2e' }}>
            Das hat {step.avatarName} gelernt
          </p>
          <ul className="mt-4 space-y-2">
            {step.traits.map((trait, i) => (
              <motion.li
                key={`${trait.label}-${i}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.12 }}
                className="flex items-start gap-3 rounded-2xl border p-3"
                style={{ borderColor: palette.border, background: palette.chip }}
              >
                <span className="text-2xl leading-none" aria-hidden>{trait.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold" style={{ color: palette.title }}>
                      {trait.label}
                    </span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {trait.change > 0 ? `+${trait.change}` : trait.change}
                    </span>
                  </div>
                  {trait.reason && (
                    <p className="mt-0.5 text-xs leading-snug" style={{ color: palette.sub }}>
                      {trait.reason}
                    </p>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      );

    case 'artifact':
      return (
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: '#c98a2e' }}>
            Du hast einen Schatz gefunden
          </p>
          <motion.div
            initial={{ scale: 0.4, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 13, delay: 0.15 }}
            className="mx-auto mt-4 flex h-32 w-32 items-center justify-center rounded-3xl border p-2"
            style={{ borderColor: palette.border, background: palette.chip }}
          >
            {step.artifact.imageUrl ? (
              <img src={step.artifact.imageUrl} alt="" className="h-full w-full rounded-2xl object-contain" />
            ) : (
              <span className="text-6xl" aria-hidden>{step.artifact.emoji || '💎'}</span>
            )}
          </motion.div>
          <h3 className="mt-4 text-xl font-bold" style={{ color: palette.title }}>
            {step.artifact.name}
          </h3>
          <p className="mt-1 text-sm leading-snug" style={{ color: palette.body }}>
            {step.artifact.description}
          </p>
          <p className="mt-3 rounded-2xl border p-3 text-xs leading-snug" style={{ borderColor: palette.border, color: palette.sub }}>
            Er wartet ab jetzt in deiner Schatzkammer. Nimm ihn beim nächsten Abenteuer mit — dann
            sammelt er Reisen und wird stärker.
          </p>
        </div>
      );

    case 'journey':
      return (
        <div className="text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.14em]" style={{ color: '#c98a2e' }}>
            <Footprints className="h-4 w-4" />
            {step.journey.leveledUp ? 'Dein Schatz ist aufgestiegen' : 'Dein Schatz war dabei'}
          </p>
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 13, delay: 0.15 }}
            className="mx-auto mt-4 flex h-28 w-28 items-center justify-center rounded-3xl border p-2"
            style={{ borderColor: palette.border, background: palette.chip }}
          >
            {step.journey.imageUrl ? (
              <img src={step.journey.imageUrl} alt="" className="h-full w-full rounded-2xl object-contain" />
            ) : (
              <span className="text-5xl" aria-hidden>{step.journey.emoji || '🎒'}</span>
            )}
          </motion.div>
          <h3 className="mt-3 text-lg font-bold" style={{ color: palette.title }}>
            {step.journey.artifactName}
          </h3>
          <div className="mt-2 flex items-center justify-center gap-1">
            {[...Array(Math.max(1, Math.min(5, step.journey.level)))].map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.35 + i * 0.1 }}
              >
                <Star className="h-6 w-6 fill-current text-amber-400" />
              </motion.span>
            ))}
          </div>
          <p className="mt-2 text-sm font-semibold" style={{ color: palette.title }}>
            {step.journey.leveledUp
              ? `Jetzt Stufe ${step.journey.level}!`
              : `${step.journey.journeys}. Reise mit ${step.avatarName}`}
          </p>
          <p className="mt-1 text-xs" style={{ color: palette.sub }}>
            {step.journey.journeysUntilNextLevel
              ? `Noch ${step.journey.journeysUntilNextLevel} ${
                  step.journey.journeysUntilNextLevel === 1 ? 'Reise' : 'Reisen'
                } bis Stufe ${step.journey.nextLevel}.`
              : 'Höchste Stufe erreicht — ein echter Reise-Veteran!'}
          </p>
        </div>
      );

    case 'crown':
      return (
        <div className="text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.14em]" style={{ color: '#c98a2e' }}>
            <Crown className="h-4 w-4" />
            Set vollendet
          </p>
          <motion.div
            initial={{ scale: 0.4, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 12, delay: 0.15 }}
            className="mx-auto mt-4 flex h-32 w-32 items-center justify-center rounded-3xl border-2 p-2"
            style={{ borderColor: '#d9b45c', background: 'rgba(217,180,92,0.14)' }}
          >
            {step.crown.imageUrl ? (
              <img src={step.crown.imageUrl} alt="" className="h-full w-full rounded-2xl object-contain" />
            ) : (
              <span className="text-6xl" aria-hidden>{step.crown.emoji || '👑'}</span>
            )}
          </motion.div>
          <h3 className="mt-4 text-xl font-bold" style={{ color: palette.title }}>
            {step.crown.name}
          </h3>
          <p className="mt-1 text-sm leading-snug" style={{ color: palette.body }}>
            {step.avatarName} hat alle Schätze aus „{step.setName}" gesammelt — dafür gibt es diesen
            Kronen-Schatz.
          </p>
        </div>
      );

    case 'shards': {
      const missing = Math.max(0, step.needed - step.balance);
      return (
        <div className="text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.14em]" style={{ color: '#c98a2e' }}>
            <Gem className="h-4 w-4" />
            {step.earned === 1 ? 'Ein Fundstück' : `${step.earned} Fundstücke`}
          </p>
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, delay: 0.12 }}
            className="mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-3xl text-5xl"
            style={{ background: palette.chip }}
            aria-hidden
          >
            💎
          </motion.span>
          <div
            className="mt-4 flex items-center justify-center gap-2"
            aria-label={`${Math.min(step.needed, step.balance)} von ${step.needed} Fundstücken`}
          >
            {[...Array(step.needed)].map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.25 + i * 0.1 }}
                className="h-4 w-4 rounded-full"
                style={{ background: i < Math.min(step.needed, step.balance) ? '#e0a03c' : 'rgba(140,126,110,0.28)' }}
              />
            ))}
          </div>
          <p className="mt-3 text-sm leading-snug" style={{ color: palette.body }}>
            {missing === 0
              ? `${step.avatarName} hat genug gesammelt — du darfst dir jetzt einen Schatz aussuchen!`
              : `Fundstücke sind Splitter von Schätzen. Sammle ${missing} ${
                  missing === 1 ? 'weiteres' : 'weitere'
                }, dann darfst du dir in der Schatzkammer einen Schatz aussuchen.`}
          </p>
        </div>
      );
    }

    case 'outro':
      return (
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: '#c98a2e' }}>
            Und jetzt?
          </p>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: palette.body }}>
            Alles ist gespeichert. Deine Helden nehmen mit, was sie erlebt haben — in die nächste
            Geschichte.
          </p>
        </div>
      );

    default:
      return null;
  }
};

/**
 * Small inline note for a story the child has finished before. It replaces the
 * old "0 Avatare entwickelt" toast: honest, friendly, and free of any reward
 * promise.
 */
export const StoryAlreadyReadNote: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <motion.p
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
    style={{
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(196,120,50,0.2)',
      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(196,120,50,0.07)',
      color: isDark ? '#b9c2cf' : '#5c4e3e',
    }}
  >
    <span aria-hidden>🔁</span>
    Diese Geschichte kennst du schon — schön, dass du sie nochmal gelesen hast!
  </motion.p>
);

export default StoryFinaleSheet;

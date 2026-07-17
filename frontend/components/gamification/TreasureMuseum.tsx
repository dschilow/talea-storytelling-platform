import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Crown,
  Footprints,
  Gem,
  Lock,
  LoaderCircle,
  MapPin,
  ScrollText,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useTheme } from '../../contexts/ThemeContext';
import { useBackend } from '../../hooks/useBackend';
import ArtifactCelebrationModal, { UnlockedArtifact } from './ArtifactCelebrationModal';

// ---------------------------------------------------------------------------
// Types (mirror backend/story/artifact-treasury-api.ts)
// ---------------------------------------------------------------------------

interface TreasuryArtifactView {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  emoji?: string;
  imageUrl?: string;
  storyRole?: string;
  owned: boolean;
  isCrown: boolean;
  level: number;
  journeys: number;
  journeysUntilNextLevel?: number;
  nextLevel?: number;
}

interface TreasurySetView {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  accentColor?: string;
  ownedCount: number;
  totalCount: number;
  crownArtifactId?: string;
  crownOwned: boolean;
  completed: boolean;
  artifacts: TreasuryArtifactView[];
}

interface ShardOfferArtifactView {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  emoji?: string;
  imageUrl?: string;
  storyRole?: string;
  setName?: string;
}

interface ShardOfferView {
  offerId: string;
  artifacts: ShardOfferArtifactView[];
  cost: number;
}

interface TreasuryOverview {
  avatarId: string;
  avatarName: string;
  shards: number;
  shardsForChoice: number;
  choiceReady: boolean;
  totalOwned: number;
  totalArtifacts: number;
  sets: TreasurySetView[];
  unsortedArtifacts: TreasuryArtifactView[];
  pendingOffer?: ShardOfferView;
}

interface JournalEntry {
  id: string;
  event: string;
  note?: string;
  storyId?: string;
  storyTitle?: string;
  createdAt: string;
}

interface TreasureMuseumProps {
  avatarId: string;
  avatarName: string;
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

const RARITY_LABELS: Record<string, string> = {
  common: 'Häufig',
  uncommon: 'Besonders',
  rare: 'Selten',
  legendary: 'Legendär',
};

const RARITY_COLORS: Record<string, string> = {
  common: '#8a97a5',
  uncommon: '#5f9d7c',
  rare: '#7d6cb2',
  legendary: '#c99236',
};

const EVENT_META: Record<string, { label: string; icon: React.FC<{ className?: string; style?: React.CSSProperties }> }> = {
  found: { label: 'Gefunden', icon: MapPin },
  journey: { label: 'Reise', icon: Footprints },
  levelup: { label: 'Stufenaufstieg', icon: Star },
  set_crown: { label: 'Set-Krönung', icon: Crown },
  shard_choice: { label: 'Aus Fundstücken gewählt', icon: Gem },
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
};

const LevelStars: React.FC<{ level: number }> = ({ level }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`Stufe ${level}`}>
    {[...Array(Math.max(1, Math.min(5, level)))].map((_, i) => (
      <Star key={i} className="h-3 w-3 fill-current text-amber-400" />
    ))}
  </span>
);

// ---------------------------------------------------------------------------
// Museum
// ---------------------------------------------------------------------------

const TreasureMuseum: React.FC<TreasureMuseumProps> = ({ avatarId, avatarName }) => {
  const backend = useBackend();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [overview, setOverview] = useState<TreasuryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TreasuryArtifactView | null>(null);
  const [journal, setJournal] = useState<JournalEntry[] | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [offer, setOffer] = useState<ShardOfferView | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<UnlockedArtifact | null>(null);
  const [celebrationSetName, setCelebrationSetName] = useState<string | null>(null);

  const panel = {
    borderColor: isDark ? '#344b61' : '#ded2c3',
    background: isDark ? 'rgba(24,36,51,0.9)' : 'rgba(255,252,247,0.94)',
  };
  const textMain = isDark ? '#edf4ff' : '#203449';
  const textMuted = isDark ? '#9fb2c8' : '#687d93';

  const loadOverview = useCallback(async () => {
    try {
      setError(null);
      const data = await backend.story.treasuryOverview({ avatarId });
      setOverview(data as TreasuryOverview);
      if ((data as TreasuryOverview).pendingOffer) {
        setOffer((data as TreasuryOverview).pendingOffer!);
      }
    } catch (err) {
      console.error('[TreasureMuseum] Failed to load treasury overview:', err);
      setError('Die Schatzkammer konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [backend, avatarId]);

  useEffect(() => {
    setLoading(true);
    void loadOverview();
  }, [loadOverview]);

  const openDetail = useCallback(
    async (artifact: TreasuryArtifactView) => {
      if (!artifact.owned) return;
      setSelected(artifact);
      setJournal(null);
      setJournalLoading(true);
      try {
        const result = await backend.story.artifactJournal({ avatarId, artifactId: artifact.id });
        setJournal((result?.entries || []) as JournalEntry[]);
      } catch (err) {
        console.warn('[TreasureMuseum] Journal load failed:', err);
        setJournal([]);
      } finally {
        setJournalLoading(false);
      }
    },
    [backend, avatarId]
  );

  const openChoice = useCallback(async () => {
    setChoiceOpen(true);
    setPickedId(null);
    if (offer) return;
    setOfferLoading(true);
    try {
      const created = await backend.story.createShardOffer({ avatarId });
      setOffer(created as ShardOfferView);
    } catch (err) {
      console.error('[TreasureMuseum] Offer creation failed:', err);
      setChoiceOpen(false);
    } finally {
      setOfferLoading(false);
    }
  }, [backend, avatarId, offer]);

  const redeem = useCallback(async () => {
    if (!offer || !pickedId) return;
    setRedeeming(true);
    try {
      const result = await backend.story.redeemShardOffer({
        avatarId,
        offerId: offer.offerId,
        artifactId: pickedId,
      });
      setChoiceOpen(false);
      setOffer(null);
      setPickedId(null);
      const artifact = result?.artifact as ShardOfferArtifactView | undefined;
      if (artifact) {
        setCelebrationSetName(null);
        setCelebration({
          id: artifact.id,
          name: artifact.name,
          description: artifact.description,
          category: artifact.category,
          rarity: (artifact.rarity as UnlockedArtifact['rarity']) || 'rare',
          emoji: artifact.emoji,
          imageUrl: artifact.imageUrl,
        });
      }
      const completed = (result?.completedSets || []) as Array<{ setName: string; crown: ShardOfferArtifactView }>;
      if (completed.length > 0) {
        // Crown celebration follows after the picked artifact is dismissed.
        window.setTimeout(() => {
          setCelebrationSetName(completed[0].setName);
          setCelebration({
            id: completed[0].crown.id,
            name: completed[0].crown.name,
            description: completed[0].crown.description,
            category: completed[0].crown.category,
            rarity: 'legendary',
            emoji: completed[0].crown.emoji,
            imageUrl: completed[0].crown.imageUrl,
          });
        }, 400);
      }
      await loadOverview();
    } catch (err) {
      console.error('[TreasureMuseum] Redeem failed:', err);
    } finally {
      setRedeeming(false);
    }
  }, [backend, avatarId, offer, pickedId, loadOverview]);

  const shardDots = useMemo(() => {
    const total = overview?.shardsForChoice || 5;
    const filled = Math.min(total, overview?.shards || 0);
    return { total, filled };
  }, [overview]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[28px] border px-5 py-16" style={panel}>
        <LoaderCircle className="h-6 w-6 animate-spin" style={{ color: textMuted }} />
        <span className="ml-3 text-sm" style={{ color: textMuted }}>Schatzkammer wird geöffnet …</span>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="rounded-[28px] border px-5 py-10 text-center" style={panel}>
        <p className="text-sm" style={{ color: textMuted }}>{error || 'Keine Daten.'}</p>
        <button
          type="button"
          onClick={() => { setLoading(true); void loadOverview(); }}
          className="mt-4 rounded-full bg-[#9b7138] px-5 py-2 text-sm font-semibold text-white"
        >
          Nochmal versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: shard balance + museum stats */}
      <section className="rounded-[28px] border p-4 sm:p-5" style={panel}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: isDark ? '#d0b690' : '#9b7138' }}>
              Museum der Abenteuer
            </p>
            <h2 className="mt-1 text-2xl font-semibold" style={{ color: textMain }}>
              Schatzkammer von {avatarName}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: textMuted }}>
              {overview.totalOwned} von {overview.totalArtifacts} Schätzen gesammelt. Vollende ein Set,
              um seinen legendären Kronen-Schatz zu verdienen — und nimm Artefakte in neue Geschichten mit,
              damit sie Reisen sammeln und aufsteigen.
            </p>
          </div>

          {/* Fundstücke capsule */}
          <div
            className="flex items-center gap-3 rounded-2xl border px-4 py-3"
            style={{
              borderColor: isDark ? '#5b513f' : '#ddccb0',
              background: isDark ? 'rgba(96,76,43,0.2)' : '#f8f0e3',
            }}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20">
              <Gem className="h-5 w-5" style={{ color: isDark ? '#e0c79f' : '#9b7138' }} />
            </span>
            <div>
              <p className="text-sm font-bold" style={{ color: isDark ? '#e0c79f' : '#85612f' }}>
                {overview.shards} {overview.shards === 1 ? 'Fundstück' : 'Fundstücke'}
              </p>
              <div className="mt-1 flex items-center gap-1" aria-label={`${shardDots.filled} von ${shardDots.total} Fundstücken`}>
                {[...Array(shardDots.total)].map((_, i) => (
                  <span
                    key={i}
                    className="h-2.5 w-2.5 rounded-full transition-colors"
                    style={{
                      background: i < shardDots.filled ? (isDark ? '#e0c79f' : '#b98a4b') : (isDark ? '#3a4a5d' : '#e8ddcc'),
                    }}
                  />
                ))}
              </div>
            </div>
            {overview.choiceReady && (
              <motion.button
                type="button"
                initial={{ scale: 0.9 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                onClick={() => void openChoice()}
                className="ml-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-md"
              >
                Schatz wählen!
              </motion.button>
            )}
          </div>
        </div>
      </section>

      {/* Set shelves */}
      {overview.sets.map((set) => {
        const accent = set.accentColor || '#9b7138';
        const crown = set.artifacts.find((a) => a.isCrown);
        const progressPct = set.totalCount > 0 ? Math.round((set.ownedCount / set.totalCount) * 100) : 0;
        return (
          <section key={set.id} className="rounded-[28px] border p-4 sm:p-5" style={panel}>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-2xl"
                style={{ background: `${accent}22` }}
                aria-hidden
              >
                {set.emoji || '✨'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold" style={{ color: textMain }}>{set.name}</h3>
                  {set.completed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-bold" style={{ color: isDark ? '#e8c66f' : '#8c6a1d' }}>
                      <Crown className="h-3 w-3" /> Vollendet
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: textMuted }}>{set.description}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: textMain }}>{set.ownedCount}/{set.totalCount}</p>
                <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full" style={{ background: isDark ? '#2c3e52' : '#ece2d3' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: accent }} />
                </div>
              </div>
            </div>

            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6" aria-label={`Schätze im Set ${set.name}`}>
              {set.artifacts.map((artifact) => {
                const rarityColor = RARITY_COLORS[artifact.rarity] || RARITY_COLORS.common;
                const isLockedCrown = artifact.isCrown && !artifact.owned;
                return (
                  <li key={artifact.id}>
                    <button
                      type="button"
                      onClick={() => void openDetail(artifact)}
                      disabled={!artifact.owned}
                      className={`group relative flex h-full w-full flex-col items-center rounded-2xl border p-2.5 text-center transition-transform ${artifact.owned ? 'hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'}`}
                      style={{
                        borderColor: artifact.isCrown
                          ? (isDark ? '#8c6a1d' : '#d9b45c')
                          : artifact.owned
                            ? `${rarityColor}66`
                            : (isDark ? '#2c3e52' : '#e4dacb'),
                        background: artifact.isCrown
                          ? (isDark ? 'rgba(140,106,29,0.12)' : 'rgba(217,180,92,0.12)')
                          : artifact.owned
                            ? (isDark ? 'rgba(36,52,71,0.85)' : '#fffdf9')
                            : (isDark ? 'rgba(20,30,43,0.6)' : 'rgba(240,234,224,0.7)'),
                        borderStyle: isLockedCrown ? 'dashed' : 'solid',
                      }}
                      aria-label={artifact.owned ? `${artifact.name} öffnen` : `${artifact.name} — noch nicht gefunden`}
                    >
                      {/* Tile visual */}
                      <div className="relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
                        {artifact.owned && artifact.imageUrl ? (
                          <img
                            src={artifact.imageUrl}
                            alt=""
                            className="h-full w-full rounded-xl object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <span
                            className="text-3xl sm:text-4xl"
                            style={artifact.owned ? undefined : { filter: 'grayscale(1)', opacity: 0.35 }}
                            aria-hidden
                          >
                            {artifact.emoji || '❔'}
                          </span>
                        )}
                        {!artifact.owned && (
                          <span
                            className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border"
                            style={{ background: isDark ? '#1a2736' : '#f4ecdf', borderColor: isDark ? '#3a4a5d' : '#ddd0bc' }}
                          >
                            {artifact.isCrown
                              ? <Crown className="h-3.5 w-3.5" style={{ color: isDark ? '#c9a648' : '#b08b2e' }} />
                              : <Lock className="h-3 w-3" style={{ color: textMuted }} />}
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-tight" style={{ color: artifact.owned ? textMain : textMuted }}>
                        {artifact.name}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium" style={{ color: artifact.owned ? rarityColor : textMuted }}>
                        {artifact.isCrown ? 'Kronen-Schatz' : RARITY_LABELS[artifact.rarity] || artifact.rarity}
                      </p>
                      {artifact.owned && artifact.level > 1 && (
                        <span className="mt-0.5"><LevelStars level={artifact.level} /></span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {crown && !crown.owned && (
              <p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: textMuted }}>
                <Crown className="h-3.5 w-3.5" style={{ color: isDark ? '#c9a648' : '#b08b2e' }} />
                Noch {set.totalCount - set.ownedCount} {set.totalCount - set.ownedCount === 1 ? 'Schatz' : 'Schätze'} bis „{crown.name}"!
              </p>
            )}
          </section>
        );
      })}

      {/* Unsorted (legacy) artifacts */}
      {overview.unsortedArtifacts.length > 0 && (
        <section className="rounded-[28px] border p-4 sm:p-5" style={panel}>
          <h3 className="text-lg font-semibold" style={{ color: textMain }}>Weitere Fundstücke</h3>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {overview.unsortedArtifacts.map((artifact) => (
              <li key={artifact.id}>
                <button
                  type="button"
                  onClick={() => void openDetail(artifact)}
                  className="flex h-full w-full flex-col items-center rounded-2xl border p-2.5 text-center hover:-translate-y-0.5 transition-transform"
                  style={{ borderColor: isDark ? '#344b61' : '#e4dacb', background: isDark ? 'rgba(36,52,71,0.85)' : '#fffdf9' }}
                >
                  {artifact.imageUrl
                    ? <img src={artifact.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" loading="lazy" />
                    : <span className="text-3xl">{artifact.emoji || '❔'}</span>}
                  <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold" style={{ color: textMain }}>{artifact.name}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Detail modal with travel journal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border p-5 sm:rounded-3xl"
              style={panel}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label={`Details zu ${selected.name}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selected.imageUrl
                    ? <img src={selected.imageUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                    : <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl" style={{ background: isDark ? '#2c3e52' : '#f4ecdf' }}>{selected.emoji || '❔'}</span>}
                  <div>
                    <h3 className="text-xl font-semibold" style={{ color: textMain }}>{selected.name}</h3>
                    <p className="text-xs font-medium" style={{ color: RARITY_COLORS[selected.rarity] || RARITY_COLORS.common }}>
                      {selected.isCrown ? 'Kronen-Schatz · ' : ''}{RARITY_LABELS[selected.rarity] || selected.rarity}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <LevelStars level={selected.level} />
                      <span className="text-[11px]" style={{ color: textMuted }}>Stufe {selected.level}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-full p-2 hover:bg-black/10"
                  aria-label="Schließen"
                >
                  <X className="h-5 w-5" style={{ color: textMuted }} />
                </button>
              </div>

              <p className="mt-3 text-sm leading-relaxed" style={{ color: textMuted }}>{selected.description}</p>

              {selected.storyRole && (
                <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: isDark ? '#3a4a5d' : '#e4dacb', background: isDark ? 'rgba(96,76,43,0.12)' : 'rgba(217,180,92,0.08)' }}>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: isDark ? '#d0b690' : '#9b7138' }}>
                    <Sparkles className="mr-1 inline h-3.5 w-3.5" />So wirkt es in Geschichten
                  </p>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: textMain }}>{selected.storyRole}</p>
                </div>
              )}

              {/* Level track */}
              <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: isDark ? '#3a4a5d' : '#e4dacb' }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: textMuted }}>
                  <Footprints className="mr-1 inline h-3.5 w-3.5" />
                  {selected.journeys} {selected.journeys === 1 ? 'Reise' : 'Reisen'} unternommen
                </p>
                <p className="mt-1 text-sm" style={{ color: textMain }}>
                  {selected.journeysUntilNextLevel
                    ? <>Noch <strong>{selected.journeysUntilNextLevel}</strong> {selected.journeysUntilNextLevel === 1 ? 'Reise' : 'Reisen'} bis Stufe {selected.nextLevel}. Nimm es im Story-Zauberer einfach mit!</>
                    : 'Höchste Stufe erreicht — ein wahrer Reise-Veteran!'}
                </p>
              </div>

              {/* Travel journal */}
              <div className="mt-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: textMain }}>
                  <ScrollText className="h-4 w-4" /> Reisetagebuch
                </p>
                {journalLoading ? (
                  <p className="mt-2 text-xs" style={{ color: textMuted }}>Wird geladen …</p>
                ) : journal && journal.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {journal.map((entry) => {
                      const meta = EVENT_META[entry.event] || EVENT_META.found;
                      const Icon = meta.icon;
                      return (
                        <li key={entry.id} className="flex items-start gap-2.5 rounded-xl border p-2.5" style={{ borderColor: isDark ? '#2c3e52' : '#efe6d8' }}>
                          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: isDark ? '#2c3e52' : '#f4ecdf' }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: isDark ? '#d0b690' : '#9b7138' }} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold" style={{ color: textMain }}>
                              {meta.label}
                              {entry.storyTitle ? <span style={{ color: textMuted }}> · „{entry.storyTitle}"</span> : null}
                            </p>
                            {entry.note && <p className="text-xs" style={{ color: textMuted }}>{entry.note}</p>}
                            <p className="mt-0.5 text-[10px]" style={{ color: textMuted }}>{formatDate(entry.createdAt)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs" style={{ color: textMuted }}>
                    Noch keine Einträge — nimm diesen Schatz in eine Geschichte mit!
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate(`/story?bringArtifact=${encodeURIComponent(selected.id)}&bringAvatar=${encodeURIComponent(avatarId)}`)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-sm font-bold text-white shadow-md transition-transform hover:-translate-y-0.5"
              >
                <BookOpen className="h-4 w-4" />
                In eine neue Geschichte mitnehmen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shard choice modal (5 Fundstücke → pick 1 of 3) */}
      <AnimatePresence>
        {choiceOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            onClick={() => !redeeming && setChoiceOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 40 }}
              className="w-full max-w-2xl rounded-3xl border p-5 sm:p-6"
              style={panel}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Wähle deinen Schatz"
            >
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: isDark ? '#d0b690' : '#9b7138' }}>
                  {overview.shardsForChoice} Fundstücke gesammelt
                </p>
                <h3 className="mt-1 text-2xl font-semibold" style={{ color: textMain }}>Wähle deinen Schatz!</h3>
                <p className="mt-1 text-sm" style={{ color: textMuted }}>
                  Einer dieser drei Schätze zieht in deine Schatzkammer ein. Wähle weise!
                </p>
              </div>

              {offerLoading || !offer ? (
                <div className="flex items-center justify-center py-12">
                  <LoaderCircle className="h-6 w-6 animate-spin" style={{ color: textMuted }} />
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {offer.artifacts.map((artifact) => {
                    const isPicked = pickedId === artifact.id;
                    const rarityColor = RARITY_COLORS[artifact.rarity] || RARITY_COLORS.common;
                    return (
                      <motion.button
                        key={artifact.id}
                        type="button"
                        whileHover={{ y: -4 }}
                        onClick={() => setPickedId(artifact.id)}
                        className="flex flex-col items-center rounded-2xl border-2 p-4 text-center transition-colors"
                        style={{
                          borderColor: isPicked ? rarityColor : (isDark ? '#344b61' : '#e4dacb'),
                          background: isPicked
                            ? (isDark ? `${rarityColor}22` : `${rarityColor}14`)
                            : (isDark ? 'rgba(36,52,71,0.85)' : '#fffdf9'),
                        }}
                        aria-pressed={isPicked}
                      >
                        {artifact.imageUrl
                          ? <img src={artifact.imageUrl} alt="" className="h-24 w-24 rounded-2xl object-cover" />
                          : <span className="flex h-24 w-24 items-center justify-center text-5xl">{artifact.emoji || '🎁'}</span>}
                        <p className="mt-2 text-sm font-bold" style={{ color: textMain }}>{artifact.name}</p>
                        <p className="text-[11px] font-medium" style={{ color: rarityColor }}>
                          {RARITY_LABELS[artifact.rarity] || artifact.rarity}
                          {artifact.setName ? ` · ${artifact.setName}` : ''}
                        </p>
                        <p className="mt-1 line-clamp-3 text-xs leading-snug" style={{ color: textMuted }}>{artifact.description}</p>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={redeeming}
                  onClick={() => setChoiceOpen(false)}
                  className="flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold"
                  style={{ borderColor: isDark ? '#344b61' : '#ded2c3', color: textMuted }}
                >
                  Später entscheiden
                </button>
                <button
                  type="button"
                  disabled={!pickedId || redeeming}
                  onClick={() => void redeem()}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {redeeming ? 'Wird geholt …' : `Diesen Schatz nehmen (${offer?.cost ?? 5} Fundstücke)`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Celebration (picked artifact / set crown) */}
      <ArtifactCelebrationModal
        artifact={celebration}
        isVisible={Boolean(celebration)}
        onClose={() => { setCelebration(null); setCelebrationSetName(null); }}
        setName={celebrationSetName || undefined}
      />
    </div>
  );
};

export default TreasureMuseum;

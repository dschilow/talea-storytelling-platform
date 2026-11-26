import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  Crown,
  Heart,
  Lightbulb,
  LockKeyhole,
  MessageCircle,
  Mountain,
  Puzzle,
  Search,
  Shield,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

import { useTheme } from '../../contexts/ThemeContext';
import { formatTraitLabel } from '../../constants/traits';
import type { AvatarMemory, AvatarProgression } from '../../types/avatar';
import ConceptHelp from "./ConceptHelp";

export interface GrowthTrait {
  id: string;
  label: string;
  value: number;
  subcategories: Array<{ name: string; value: number }>;
}

interface AvatarGrowthDashboardProps {
  avatarName: string;
  traits: GrowthTrait[];
  progression?: AvatarProgression | null;
  /** The diary entries; each one says which trait grew and why. */
  memories?: AvatarMemory[];
}

/** One "why did this trait grow" line, taken from a diary entry. */
type GrowthReason = {
  key: string;
  label: string;
  change: number;
  text: string;
  source: string;
  createdAt: number;
};

const REASONS_PER_TRAIT = 3;

type TraitCard = {
  id: string;
  label: string;
  value: number;
  progress: number;
  rankName: string;
  nextRankAt: number | null;
};

const TRAIT_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; soft: string; hint: string }
> = {
  knowledge: {
    icon: Brain,
    color: '#527b70',
    soft: '#e3f0eb',
    hint: 'W\u00e4chst mit Dokus, Wissen und neuen Themen.',
  },
  creativity: {
    icon: Lightbulb,
    color: '#a45f7a',
    soft: '#f6e6ed',
    hint: 'W\u00e4chst durch Ideen und kreative Entscheidungen.',
  },
  vocabulary: {
    icon: MessageCircle,
    color: '#6576a7',
    soft: '#e9ecf7',
    hint: 'W\u00e4chst beim Lesen, Zuh\u00f6ren und Sprechen.',
  },
  courage: {
    icon: Shield,
    color: '#b4674f',
    soft: '#f7e7e1',
    hint: 'W\u00e4chst bei mutigen Entscheidungen.',
  },
  curiosity: {
    icon: Search,
    color: '#8a6ca8',
    soft: '#efe8f6',
    hint: 'W\u00e4chst beim Fragen und Entdecken.',
  },
  teamwork: {
    icon: Users,
    color: '#4f789d',
    soft: '#e4edf4',
    hint: 'W\u00e4chst, wenn Figuren gemeinsam L\u00f6sungen finden.',
  },
  empathy: {
    icon: Heart,
    color: '#ad6170',
    soft: '#f8e5e8',
    hint: 'W\u00e4chst durch Mitgef\u00fchl und Perspektivwechsel.',
  },
  persistence: {
    icon: Mountain,
    color: '#8a7149',
    soft: '#f2ecdf',
    hint: 'W\u00e4chst beim Dranbleiben und Wiederholen.',
  },
  logic: {
    icon: Puzzle,
    color: '#4e7d78',
    soft: '#e2efed',
    hint: 'W\u00e4chst durch R\u00e4tsel, Pl\u00e4ne und Probleml\u00f6sen.',
  },
};

const LABELS: Record<string, string> = {
  knowledge: 'Wissen',
  creativity: 'Kreativit\u00e4t',
  Kreativitaet: 'Kreativit\u00e4t',
  vocabulary: 'Wortschatz',
  courage: 'Mut',
  curiosity: 'Neugier',
  teamwork: 'Teamgeist',
  empathy: 'Empathie',
  persistence: 'Ausdauer',
  logic: 'Logik',
  Geschichte: 'Geschichte',
  Biologie: 'Biologie',
  Astronomie: 'Astronomie',
  Chemie: 'Chemie',
};

const RANK_NAMES: Record<string, string> = {
  Anfaenger: 'Anf\u00e4nger',
  Geselle: 'Entdecker',
  Meister: 'K\u00f6nner',
  Legende: 'Legende',
  Veteran: 'Profi',
  Ikone: 'Champion',
  Mythos: 'Meisterhaft',
  Transzendent: 'Sagenhaft',
};

const TEXT_REPLACEMENTS: Array<[string, string]> = [
  ['Gedaechtnis', 'Ged\u00e4chtnis'],
  ['Staerke', 'St\u00e4rke'],
  ['fuer', 'f\u00fcr'],
  ['handlungsfaehig', 'handlungsf\u00e4hig'],
  ['Herzensbruecke', 'Herzensbr\u00fccke'],
  ['Loesungswege', 'L\u00f6sungswege'],
  ['Loest', 'L\u00f6st'],
  ['Verstaendnis', 'Verst\u00e4ndnis'],
  ['Raetselloeser', 'R\u00e4tsell\u00f6ser'],
  ['Verknuepft', 'Verkn\u00fcpft'],
  ['fruehere', 'fr\u00fchere'],
  ['anstossen', 'ansto\u00dfen'],
  ['Fuehrt', 'F\u00fchrt'],
  ['Kapitaen', 'Kapit\u00e4n'],
  ['Kreativitaet', 'Kreativit\u00e4t'],
  ['Schluesselmomente', 'Schl\u00fcsselmomente'],
  ['Lektuere', 'Lekt\u00fcre'],
];

const germanize = (value: string) => {
  const directMatch = RANK_NAMES[value] || LABELS[value];
  if (directMatch) return directMatch;

  return TEXT_REPLACEMENTS.reduce(
    (text, [source, replacement]) => text.replaceAll(source, replacement),
    value
  );
};

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/**
 * The reason without the "+3 Mut" the badge already shows: stored fallback
 * reasons read "+3 Mut durch die Geschichte \u201e\u2026\u201c".
 */
const reasonText = (description: string | undefined, source: string): string => {
  const text = germanize((description || '').trim());
  if (!text) return `aus \u201e${source}\u201c`;
  // "+3 Mut durch \u2026" \u2192 "durch \u2026", read after the badge: "+3 Mut durch \u2026".
  const afterAmount = text.match(/^[+\u2212-]\s*\d+\s+.*?\s(durch\s[\s\S]*)$/);
  if (afterAmount) return afterAmount[1];
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Newest first, grouped by base trait ("knowledge.history" counts for Wissen). */
const reasonsByTrait = (memories: AvatarMemory[]): Map<string, GrowthReason[]> => {
  const grouped = new Map<string, GrowthReason[]>();
  for (const memory of memories) {
    const createdAt = Date.parse(memory.createdAt || memory.timestamp || '') || 0;
    (memory.personalityChanges || []).forEach((change, index) => {
      if (!change?.trait || !Number.isFinite(change.change) || change.change === 0) return;
      const baseId = change.trait.split('.')[0];
      const list = grouped.get(baseId) || [];
      list.push({
        key: `${memory.id}-${change.trait}-${index}`,
        label: formatTraitLabel(change.trait),
        change: change.change,
        text: reasonText(change.description, memory.storyTitle),
        source: memory.storyTitle,
        createdAt,
      });
      grouped.set(baseId, list);
    });
  }
  for (const list of grouped.values()) list.sort((a, b) => b.createdAt - a.createdAt);
  return grouped;
};

const fallbackRank = (value: number) => {
  if (value >= 81) return 'Legende';
  if (value >= 61) return 'K\u00f6nner';
  if (value >= 41) return 'Entdecker';
  if (value >= 21) return 'Lehrling';
  return 'Anf\u00e4nger';
};

const toCards = (traits: GrowthTrait[], progression?: AvatarProgression | null): TraitCard[] => {
  if (progression?.traitMastery?.length) {
    return progression.traitMastery.map((entry) => ({
      id: entry.trait,
      label: germanize(entry.label),
      value: Math.round(entry.value),
      progress: clamp(entry.progressToNext),
      rankName: germanize(entry.rank.name),
      nextRankAt: entry.nextRankAt,
    }));
  }

  return traits.map((trait) => ({
    id: trait.id,
    label: LABELS[trait.id] || germanize(trait.label),
    value: Math.round(trait.value),
    progress: clamp(trait.value),
    rankName: fallbackRank(trait.value),
    nextRankAt: null,
  }));
};

const goalUnit = (id: string, amount: number) => {
  const singular = amount === 1;
  if (id.includes('story')) return singular ? 'Geschichte' : 'Geschichten';
  if (id.includes('doku')) return singular ? 'Doku' : 'Dokus';
  if (id.includes('memory')) return singular ? 'Erinnerung' : 'Erinnerungen';
  if (id.includes('knowledge')) return singular ? 'Wissensgebiet' : 'Wissensgebiete';
  return singular ? 'Schritt' : 'Schritte';
};

const AvatarGrowthDashboard: React.FC<AvatarGrowthDashboardProps> = ({
  avatarName,
  traits,
  progression,
  memories = [],
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const reduceMotion = useReducedMotion();
  const cards = useMemo(() => toCards(traits, progression), [traits, progression]);
  const reasons = useMemo(() => reasonsByTrait(memories), [memories]);
  const subcategoriesById = useMemo(
    () => new Map(traits.map((trait) => [trait.id, trait.subcategories.filter((entry) => entry.value > 0)])),
    [traits]
  );
  const strongest = useMemo(
    () => [...cards].filter((card) => card.value > 0).sort((a, b) => b.value - a.value).slice(0, 3),
    [cards]
  );
  const activeGoals = progression?.quests?.filter((quest) => quest.status === 'active') || [];
  const completedGoals = progression?.quests?.filter((quest) => quest.status === 'completed') || [];
  const nextGoal = [...activeGoals].sort(
    (a, b) => b.progress / Math.max(1, b.target) - a.progress / Math.max(1, a.target)
  )[0];
  const unlockedTalents = progression?.perks?.filter((perk) => perk.unlocked) || [];
  const nextTalents = progression?.perks
    ?.filter((perk) => !perk.unlocked)
    .sort(
      (a, b) =>
        (a.requiredValue - a.currentValue) - (b.requiredValue - b.currentValue)
    )
    .slice(0, 2) || [];

  const panel = {
    borderColor: 'var(--talea-border-soft)',
    background: 'var(--talea-surface-primary)',
  };

  return (
    <div className="space-y-4">
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="overflow-hidden rounded-[28px] border"
        style={panel}
      >
        <div
          className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center"
          style={{
            background: 'linear-gradient(135deg, var(--talea-accent-terracotta-soft), var(--talea-surface-primary) 78%)',
          }}
        >
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.16em]"
              style={{ color: 'var(--primary)' }}
            >
              {strongest.length > 0 ? 'Entwicklung von ' + avatarName : 'Die Reise von ' + avatarName + ' beginnt'}
            </p>
            <h2
              className="mt-2 text-2xl font-semibold leading-tight"
              style={{ color: 'var(--talea-text-primary)' }}
            >
              {strongest.length > 0
                ? `${avatarName} w\u00e4chst mit jedem Abenteuer`
                : `${avatarName} ist bereit f\u00fcr das erste Abenteuer`}
            </h2>
            <p
              className="mt-2 max-w-2xl text-sm leading-relaxed"
              style={{ color: 'var(--talea-text-tertiary)' }}
            >
              Geschichten und Dokus st&auml;rken passende F&auml;higkeiten. Die Punkte werden nach
              abgeschlossenen Inhalten automatisch aktualisiert.
            </p>
          </div>

          <div
            className="flex min-w-32 items-center gap-3 rounded-2xl border px-4 py-3 md:flex-col md:text-center"
            style={{
              borderColor: 'var(--talea-border-accent)',
              background: 'color-mix(in srgb, var(--talea-surface-primary) 80%, transparent)',
            }}
            aria-label={`Reisestufe ${progression?.overallLevel || 1}`}
          >
            <Crown className="h-5 w-5" style={{ color: 'var(--talea-accent-gold)' }} />
            <div>
              <p className="text-2xl font-semibold" style={{ color: 'var(--talea-text-primary)' }}>
                {progression?.overallLevel || 1}
              </p>
              <div className="flex items-center justify-center gap-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.13em]" style={{ color: 'var(--talea-text-tertiary)' }}>
                  Reisestufe
                </p>
                <ConceptHelp title="Was ist die Reisestufe?">
                  Sie fasst alle Abenteuer, Erinnerungen und St&auml;rken zusammen. Sie ist keine Schulnote.
                </ConceptHelp>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="rounded-[24px] border p-4 sm:p-5" style={panel}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--primary)' }}>So funktioniert es</p>
            <h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--talea-text-primary)' }}>So w&auml;chst dein Avatar</h3>
          </div>
          <ConceptHelp title="Was bedeuten die Punkte?">
            Punkte zeigen, was der Avatar in abgeschlossenen Geschichten und Dokus oft erlebt hat. Sie bewerten niemals das Kind.
          </ConceptHelp>
        </div>
        <ol className="mt-4 grid gap-2 md:grid-cols-3">
          {[
            { step: '1', title: 'Abenteuer abschlie&szlig;en', text: 'Eine Geschichte oder Doku wird wirklich bis zum Ende erlebt.' },
            { step: '2', title: 'Passende St&auml;rke w&auml;chst', text: 'Mutige, kluge oder einf&uuml;hlsame Momente geben passende Punkte.' },
            { step: '3', title: 'Neues entdecken', text: 'Mit genug Punkten steigen Stufen und Talente werden sichtbar.' },
          ].map((item) => (
            <li key={item.step} className="flex gap-3 rounded-2xl border p-3.5" style={{ borderColor: 'var(--talea-border-light)', background: 'var(--talea-surface-primary)' }}>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-white">{item.step}</span>
              <div>
                <p className="font-semibold" style={{ color: 'var(--talea-text-secondary)' }} dangerouslySetInnerHTML={{ __html: item.title }} />
                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--talea-text-tertiary)' }} dangerouslySetInnerHTML={{ __html: item.text }} />
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs" style={{ color: 'var(--talea-text-tertiary)' }}>Wichtig: Das sind Story-St&auml;rken des Avatars &ndash; keine Bewertung des Kindes.</p>
      </section>

      {nextGoal ? (
        <section className="rounded-[24px] border p-4 sm:p-5" style={panel}>
          <div className="flex items-start gap-3">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: 'var(--talea-border-accent)', color: 'var(--primary)' }}
            >
              <Target className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--talea-text-tertiary)' }}>
                N&auml;chster kleiner Schritt
              </p>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--talea-text-primary)' }}>
                  {germanize(nextGoal.title)}
                </h3>
                <span className="text-sm font-semibold" style={{ color: 'var(--talea-text-tertiary)' }}>
                  {nextGoal.progress} von {nextGoal.target}
                </span>
              </div>
              <p className="mt-1 text-sm" style={{ color: 'var(--talea-text-tertiary)' }}>
                Noch {Math.max(0, nextGoal.target - nextGoal.progress)} {goalUnit(nextGoal.id, nextGoal.target - nextGoal.progress)} &ndash; dann ist dieses Ziel geschafft.
              </p>
              <ProgressBar
                value={(nextGoal.progress / Math.max(1, nextGoal.target)) * 100}
                color="var(--primary)"
                isDark={isDark}
                label={`${nextGoal.title}: ${nextGoal.progress} von ${nextGoal.target}`}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border p-4 sm:p-5" style={panel}>
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5" style={{ color: 'var(--talea-accent-gold)' }} />
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--talea-text-primary)' }}>
              {strongest.length > 0 ? 'Das kann dein Avatar schon besonders gut' : 'Hier werden die ersten St&auml;rken sichtbar'}
            </h3>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--talea-text-tertiary)' }}>
              Nicht jeder Avatar w&auml;chst gleich &ndash; das macht jede Reise einzigartig.
            </p>
          </div>
        </div>

        {strongest.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {strongest.map((card, index) => (
              <StrengthCard key={card.id} card={card} place={index + 1} isDark={isDark} latest={reasons.get(card.id)?.[0]} />
            ))}
          </div>
        ) : (
          <div
            className="mt-4 rounded-2xl border border-dashed px-4 py-5 text-center"
            style={{ borderColor: 'var(--talea-border-soft)', color: 'var(--talea-text-tertiary)' }}
          >
            Nach der ersten abgeschlossenen Geschichte oder Doku erscheinen hier die st&auml;rksten F&auml;higkeiten.
          </div>
        )}
      </section>

      <details className="group rounded-[24px] border" style={panel}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:px-5">
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--talea-text-primary)' }}>Alle neun St&auml;rken</h3>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--talea-text-tertiary)' }}>
              Punkte, Unterbereiche und wof&uuml;r es zuletzt Punkte gab
            </p>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180" style={{ color: 'var(--talea-text-tertiary)' }} />
        </summary>
        <div className="grid gap-2 border-t p-3 sm:grid-cols-2 lg:grid-cols-3" style={{ borderColor: 'var(--talea-border-light)' }}>
          {cards.map((card) => (
            <TraitRow
              key={card.id}
              card={card}
              isDark={isDark}
              subcategories={subcategoriesById.get(card.id) || []}
              reasons={(reasons.get(card.id) || []).slice(0, REASONS_PER_TRAIT)}
            />
          ))}
        </div>
      </details>

      {(unlockedTalents.length > 0 || nextTalents.length > 0) && (
        <section className="rounded-[24px] border p-4 sm:p-5" style={panel}>
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5" style={{ color: 'var(--talea-accent-gold)' }} />
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--talea-text-primary)' }}>Entdeckte Talente</h3>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--talea-text-tertiary)' }}>
                Talente beschreiben, was dein Avatar in neuen Geschichten einbringen kann.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {unlockedTalents.map((talent) => (
              <article
                key={talent.id}
                className="flex items-start gap-3 rounded-2xl border px-3.5 py-3"
                style={{
                  borderColor: 'var(--talea-border-accent)',
                  background: 'var(--talea-accent-terracotta-soft)',
                }}
              >
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                  <Check className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--primary)' }}>{germanize(talent.title)}</p>
                  <p className="mt-0.5 text-sm leading-relaxed" style={{ color: 'var(--primary)' }}>{germanize(talent.description)}</p>
                </div>
              </article>
            ))}
            {nextTalents.map((talent) => {
              const missing = Math.max(0, talent.requiredValue - talent.currentValue);
              return (
                <article
                  key={talent.id}
                  className="flex items-start gap-3 rounded-2xl border px-3.5 py-3"
                  style={{ borderColor: 'var(--talea-border-light)', background: 'var(--talea-surface-inset)' }}
                >
                  <LockKeyhole className="mt-1 h-4 w-4 shrink-0" style={{ color: 'var(--talea-text-tertiary)' }} />
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--talea-text-secondary)' }}>{germanize(talent.title)}</p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--talea-text-tertiary)' }}>Noch {missing} Punkte in {germanize(talent.trait)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {(activeGoals.length > 1 || completedGoals.length > 0) && (
        <section className="overflow-hidden rounded-[24px] border p-4 sm:p-5" style={panel}>
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5" style={{ color: 'var(--talea-text-tertiary)' }} />
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--talea-text-primary)' }}>Weitere Reiseziele</h3>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--talea-text-tertiary)' }}>Diese Ziele laufen automatisch mit.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {[...completedGoals, ...activeGoals.filter((goal) => goal.id !== nextGoal?.id)].map((goal) => (
              <div
                key={goal.id}
                className="flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3"
                style={{
                  borderColor: goal.status === 'completed' ? 'var(--talea-border-accent)' : 'var(--talea-border-light)',
                  background: goal.status === 'completed' ? 'var(--talea-accent-terracotta-soft)' : 'transparent',
                }}
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold" style={{ borderColor: 'var(--talea-border-soft)', color: 'var(--talea-text-tertiary)' }}>
                  {goal.status === 'completed' ? <Check className="h-4 w-4" /> : `${goal.progress}/${goal.target}`}
                </span>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="break-words font-semibold" style={{ color: 'var(--talea-text-secondary)' }}>{germanize(goal.title)}</p>
                  <p className="line-clamp-2 break-words text-xs leading-relaxed" style={{ color: 'var(--talea-text-tertiary)' }}>{goal.status === 'completed' ? 'Geschafft!' : germanize(goal.description)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {progression?.topKnowledgeDomains?.length ? (
        <section className="rounded-[24px] border p-4 sm:p-5" style={panel}>
          <h3 className="font-semibold" style={{ color: 'var(--talea-text-primary)' }}>Lieblingsthemen</h3>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--talea-text-tertiary)' }}>
            In diesen Wissensgebieten hat {avatarName} schon besonders viel gesammelt.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {progression.topKnowledgeDomains.map((domain) => (
              <span
                key={domain.name}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: 'var(--talea-border-accent)', background: 'var(--talea-accent-terracotta-soft)', color: 'var(--primary)' }}
              >
                {germanize(domain.name)}
                <span className="text-xs opacity-75">{Math.round(domain.value)}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

const ProgressBar: React.FC<{ value: number; color: string; isDark: boolean; label: string }> = ({
  value,
  color,
  isDark,
  label,
}) => (
  <div
    className="mt-3 h-2 overflow-hidden rounded-full"
    style={{ background: 'var(--talea-border-light)' }}
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={clamp(value)}
    aria-label={label}
  >
    <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${clamp(value)}%`, background: color }} />
  </div>
);

const StrengthCard: React.FC<{ card: TraitCard; place: number; isDark: boolean; latest?: GrowthReason }> = ({ card, place, isDark, latest }) => {
  const meta = TRAIT_META[card.id] || TRAIT_META.knowledge;
  const Icon = meta.icon;
  return (
    <article className="rounded-2xl border p-3.5" style={{ borderColor: 'var(--talea-border-light)', background: 'var(--talea-surface-primary)' }}>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: isDark ? `${meta.color}33` : meta.soft, color: isDark ? `color-mix(in srgb, ${meta.color} 55%, #fff7ec)` : meta.color }}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold" style={{ color: 'var(--talea-text-tertiary)' }}>#{place}</span>
          <ConceptHelp title={`Was bedeutet ${card.label}?`}>{meta.hint} Die Punkte stammen nur aus abgeschlossenen Inhalten.</ConceptHelp>
        </div>
      </div>
      <h4 className="mt-3 font-semibold" style={{ color: 'var(--talea-text-secondary)' }}>{card.label}</h4>
      <p className="mt-0.5 text-sm" style={{ color: 'var(--talea-text-tertiary)' }}>{card.rankName} &middot; {card.value} Punkte</p>
      {latest ? (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--talea-text-tertiary)' }}>
          Zuletzt {latest.change > 0 ? '+' : ''}{latest.change} {latest.label}
          {/^(durch|aus)\s/.test(latest.text) ? ' ' : ': '}
          {latest.text}
        </p>
      ) : null}
    </article>
  );
};

const TraitRow: React.FC<{
  card: TraitCard;
  isDark: boolean;
  subcategories: Array<{ name: string; value: number }>;
  reasons: GrowthReason[];
}> = ({ card, isDark, subcategories, reasons }) => {
  const meta = TRAIT_META[card.id] || TRAIT_META.knowledge;
  const Icon = meta.icon;
  return (
    <article className="rounded-2xl border p-3.5" style={{ borderColor: 'var(--talea-border-light)', background: 'var(--talea-surface-primary)' }}>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: isDark ? `${meta.color}32` : meta.soft, color: isDark ? `color-mix(in srgb, ${meta.color} 55%, #fff7ec)` : meta.color }}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-semibold" style={{ color: 'var(--talea-text-secondary)' }}>{card.label}</h4>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold" style={{ color: 'var(--talea-text-tertiary)' }}>{card.value}</span>
              <ConceptHelp title={`Was bedeutet ${card.label}?`}>{meta.hint} Punkte sind keine Schulnoten.</ConceptHelp>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--talea-text-tertiary)' }}>
            {card.value === 0 ? 'Noch unentdeckt' : card.rankName}
          </p>
        </div>
      </div>
      <ProgressBar value={card.progress} color={meta.color} isDark={isDark} label={`${card.label}: ${card.progress} Prozent bis zur n\u00e4chsten Stufe`} />
      {subcategories.length > 0 ? (
        <ul className="mt-3 space-y-1 border-l-2 pl-3" style={{ borderColor: 'var(--talea-border-light)' }} aria-label={`Unterbereiche von ${card.label}`}>
          {subcategories.map((entry) => (
            <li key={entry.name} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate" style={{ color: 'var(--talea-text-secondary)' }}>
                {formatTraitLabel(`${card.id}.${entry.name}`)}
              </span>
              <span className="shrink-0 font-semibold" style={{ color: 'var(--talea-text-tertiary)' }}>{Math.round(entry.value)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {reasons.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--talea-text-tertiary)' }}>
            Wof&uuml;r es Punkte gab
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {reasons.map((reason) => (
              <li key={reason.key} className="text-xs leading-relaxed" style={{ color: 'var(--talea-text-tertiary)' }}>
                <span className="font-semibold" style={{ color: reason.change > 0 ? 'var(--primary)' : 'var(--talea-accent-rose)' }}>
                  {reason.change > 0 ? '+' : ''}{reason.change} {reason.label}
                </span>{' '}
                {reason.text}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--talea-text-tertiary)' }}>
          {card.value === 0 ? 'Startet mit der ersten passenden Geschichte oder Doku.' : meta.hint}
        </p>
      )}
    </article>
  );
};

export default AvatarGrowthDashboard;

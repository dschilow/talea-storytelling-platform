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
import type { AvatarProgression } from '../../types/avatar';

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
}

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
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const reduceMotion = useReducedMotion();
  const cards = useMemo(() => toCards(traits, progression), [traits, progression]);
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
    borderColor: isDark ? '#344b61' : '#ded2c3',
    background: isDark ? 'rgba(24,36,51,0.9)' : 'rgba(255,252,247,0.94)',
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
            background: isDark
              ? 'linear-gradient(135deg, rgba(78,112,105,0.22), rgba(82,91,132,0.14))'
              : 'linear-gradient(135deg, #edf6f1, #f6f0ea)',
          }}
        >
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.16em]"
              style={{ color: isDark ? '#9bc4b9' : '#527b70' }}
            >
              {strongest.length > 0 ? 'Deine Entwicklung' : 'Deine Reise beginnt'}
            </p>
            <h2
              className="mt-2 text-2xl font-semibold leading-tight"
              style={{ color: isDark ? '#edf4ff' : '#203449' }}
            >
              {strongest.length > 0
                ? `${avatarName} w\u00e4chst mit jedem Abenteuer`
                : `${avatarName} ist bereit f\u00fcr das erste Abenteuer`}
            </h2>
            <p
              className="mt-2 max-w-2xl text-sm leading-relaxed"
              style={{ color: isDark ? '#b3c4d8' : '#5c7188' }}
            >
              Geschichten und Dokus st&auml;rken passende F&auml;higkeiten. Die Punkte werden nach
              abgeschlossenen Inhalten automatisch aktualisiert.
            </p>
          </div>

          <div
            className="flex min-w-32 items-center gap-3 rounded-2xl border px-4 py-3 md:flex-col md:text-center"
            style={{
              borderColor: isDark ? '#456075' : '#cfddd5',
              background: isDark ? 'rgba(20,31,45,0.62)' : 'rgba(255,255,255,0.72)',
            }}
            aria-label={`Reisestufe ${progression?.overallLevel || 1}`}
          >
            <Crown className="h-5 w-5" style={{ color: isDark ? '#e8c788' : '#9b7138' }} />
            <div>
              <p className="text-2xl font-semibold" style={{ color: isDark ? '#f2f6fc' : '#203449' }}>
                {progression?.overallLevel || 1}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em]" style={{ color: isDark ? '#9eb1c7' : '#6b7d90' }}>
                Reisestufe
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {nextGoal ? (
        <section className="rounded-[24px] border p-4 sm:p-5" style={panel}>
          <div className="flex items-start gap-3">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: isDark ? 'rgba(91,126,113,0.28)' : '#e3f0eb', color: isDark ? '#a9d1c4' : '#527b70' }}
            >
              <Target className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: isDark ? '#98acc3' : '#6a7e93' }}>
                N&auml;chster kleiner Schritt
              </p>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>
                  {germanize(nextGoal.title)}
                </h3>
                <span className="text-sm font-semibold" style={{ color: isDark ? '#b8c8da' : '#526a82' }}>
                  {nextGoal.progress} von {nextGoal.target}
                </span>
              </div>
              <p className="mt-1 text-sm" style={{ color: isDark ? '#aabdd1' : '#61768d' }}>
                Noch {Math.max(0, nextGoal.target - nextGoal.progress)} {goalUnit(nextGoal.id, nextGoal.target - nextGoal.progress)} &ndash; dann ist dieses Ziel geschafft.
              </p>
              <ProgressBar
                value={(nextGoal.progress / Math.max(1, nextGoal.target)) * 100}
                color="#527b70"
                isDark={isDark}
                label={`${nextGoal.title}: ${nextGoal.progress} von ${nextGoal.target}`}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border p-4 sm:p-5" style={panel}>
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5" style={{ color: isDark ? '#e1bd82' : '#9b7138' }} />
          <div>
            <h3 className="text-lg font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>
              {strongest.length > 0 ? 'Das kann dein Avatar schon besonders gut' : 'Hier werden die ersten St&auml;rken sichtbar'}
            </h3>
            <p className="mt-0.5 text-sm" style={{ color: isDark ? '#9fb2c8' : '#687d93' }}>
              Nicht jeder Avatar w&auml;chst gleich &ndash; das macht jede Reise einzigartig.
            </p>
          </div>
        </div>

        {strongest.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {strongest.map((card, index) => (
              <StrengthCard key={card.id} card={card} place={index + 1} isDark={isDark} />
            ))}
          </div>
        ) : (
          <div
            className="mt-4 rounded-2xl border border-dashed px-4 py-5 text-center"
            style={{ borderColor: isDark ? '#42566b' : '#d8ccbd', color: isDark ? '#aabbd0' : '#65798e' }}
          >
            Nach der ersten abgeschlossenen Geschichte oder Doku erscheinen hier die st&auml;rksten F&auml;higkeiten.
          </div>
        )}
      </section>

      <details className="group rounded-[24px] border" style={panel}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527b70] sm:px-5">
          <div>
            <h3 className="font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>Alle neun St&auml;rken</h3>
            <p className="mt-0.5 text-sm" style={{ color: isDark ? '#9fb2c8' : '#687d93' }}>
              Punkte, Stufe und der Weg bis zum n&auml;chsten Schritt
            </p>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180" style={{ color: isDark ? '#a9bbcf' : '#60758c' }} />
        </summary>
        <div className="grid gap-2 border-t p-3 sm:grid-cols-2 lg:grid-cols-3" style={{ borderColor: isDark ? '#344b61' : '#e3d8ca' }}>
          {cards.map((card) => (
            <TraitRow key={card.id} card={card} isDark={isDark} />
          ))}
        </div>
      </details>

      {(unlockedTalents.length > 0 || nextTalents.length > 0) && (
        <section className="rounded-[24px] border p-4 sm:p-5" style={panel}>
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5" style={{ color: isDark ? '#e1bd82' : '#9b7138' }} />
            <div>
              <h3 className="font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>Entdeckte Talente</h3>
              <p className="mt-0.5 text-sm" style={{ color: isDark ? '#9fb2c8' : '#687d93' }}>
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
                  borderColor: isDark ? '#476656' : '#b9d5c6',
                  background: isDark ? 'rgba(48,78,63,0.25)' : '#edf7f1',
                }}
              >
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#527b70] text-white">
                  <Check className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold" style={{ color: isDark ? '#eaf4ef' : '#24473b' }}>{germanize(talent.title)}</p>
                  <p className="mt-0.5 text-sm leading-relaxed" style={{ color: isDark ? '#b1c8bd' : '#567166' }}>{germanize(talent.description)}</p>
                </div>
              </article>
            ))}
            {nextTalents.map((talent) => {
              const missing = Math.max(0, talent.requiredValue - talent.currentValue);
              return (
                <article
                  key={talent.id}
                  className="flex items-start gap-3 rounded-2xl border px-3.5 py-3"
                  style={{ borderColor: isDark ? '#3a4f65' : '#dfd4c6', background: isDark ? 'rgba(25,38,53,0.68)' : '#fbf8f3' }}
                >
                  <LockKeyhole className="mt-1 h-4 w-4 shrink-0" style={{ color: isDark ? '#8196ad' : '#8693a0' }} />
                  <div>
                    <p className="font-semibold" style={{ color: isDark ? '#c7d4e3' : '#40556b' }}>{germanize(talent.title)}</p>
                    <p className="mt-0.5 text-xs" style={{ color: isDark ? '#8fa3ba' : '#718399' }}>Noch {missing} Punkte in {germanize(talent.trait)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {(activeGoals.length > 1 || completedGoals.length > 0) && (
        <section className="rounded-[24px] border p-4 sm:p-5" style={panel}>
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5" style={{ color: isDark ? '#a9bdd5' : '#5d7897' }} />
            <div>
              <h3 className="font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>Weitere Reiseziele</h3>
              <p className="mt-0.5 text-sm" style={{ color: isDark ? '#9fb2c8' : '#687d93' }}>Diese Ziele laufen automatisch mit.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {[...completedGoals, ...activeGoals.filter((goal) => goal.id !== nextGoal?.id)].map((goal) => (
              <div
                key={goal.id}
                className="flex items-center gap-3 rounded-2xl border px-3.5 py-3"
                style={{
                  borderColor: goal.status === 'completed' ? (isDark ? '#476656' : '#b9d5c6') : (isDark ? '#3a4f65' : '#dfd4c6'),
                  background: goal.status === 'completed' ? (isDark ? 'rgba(48,78,63,0.22)' : '#edf7f1') : 'transparent',
                }}
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold" style={{ borderColor: isDark ? '#496079' : '#d2c5b6', color: isDark ? '#c4d2e1' : '#50667d' }}>
                  {goal.status === 'completed' ? <Check className="h-4 w-4" /> : `${goal.progress}/${goal.target}`}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold" style={{ color: isDark ? '#e5edf7' : '#263a4f' }}>{germanize(goal.title)}</p>
                  <p className="truncate text-xs" style={{ color: isDark ? '#95a9c0' : '#718399' }}>{goal.status === 'completed' ? 'Geschafft!' : germanize(goal.description)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {progression?.topKnowledgeDomains?.length ? (
        <section className="rounded-[24px] border p-4 sm:p-5" style={panel}>
          <h3 className="font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>Lieblingsthemen</h3>
          <p className="mt-0.5 text-sm" style={{ color: isDark ? '#9fb2c8' : '#687d93' }}>
            In diesen Wissensgebieten hat {avatarName} schon besonders viel gesammelt.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {progression.topKnowledgeDomains.map((domain) => (
              <span
                key={domain.name}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: isDark ? '#456259' : '#c8ddd3', background: isDark ? 'rgba(52,83,71,0.24)' : '#edf6f1', color: isDark ? '#b8d2c8' : '#42675a' }}
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
    style={{ background: isDark ? '#293b4e' : '#e6ded4' }}
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={clamp(value)}
    aria-label={label}
  >
    <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${clamp(value)}%`, background: color }} />
  </div>
);

const StrengthCard: React.FC<{ card: TraitCard; place: number; isDark: boolean }> = ({ card, place, isDark }) => {
  const meta = TRAIT_META[card.id] || TRAIT_META.knowledge;
  const Icon = meta.icon;
  return (
    <article className="rounded-2xl border p-3.5" style={{ borderColor: isDark ? '#3a5066' : '#e0d5c8', background: isDark ? 'rgba(27,41,57,0.72)' : '#fffdfa' }}>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: isDark ? `${meta.color}33` : meta.soft, color: isDark ? '#dce8f4' : meta.color }}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs font-bold" style={{ color: isDark ? '#849ab2' : '#8996a3' }}>#{place}</span>
      </div>
      <h4 className="mt-3 font-semibold" style={{ color: isDark ? '#e9f0f8' : '#263a4f' }}>{card.label}</h4>
      <p className="mt-0.5 text-sm" style={{ color: isDark ? '#9fb2c8' : '#687d93' }}>{card.rankName} &middot; {card.value} Punkte</p>
    </article>
  );
};

const TraitRow: React.FC<{ card: TraitCard; isDark: boolean }> = ({ card, isDark }) => {
  const meta = TRAIT_META[card.id] || TRAIT_META.knowledge;
  const Icon = meta.icon;
  return (
    <article className="rounded-2xl border p-3.5" style={{ borderColor: isDark ? '#384e64' : '#e2d8cc', background: isDark ? 'rgba(26,39,55,0.7)' : '#fffdfa' }}>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: isDark ? `${meta.color}32` : meta.soft, color: isDark ? '#d7e4ef' : meta.color }}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-semibold" style={{ color: isDark ? '#e7eef7' : '#2b3e52' }}>{card.label}</h4>
            <span className="text-sm font-semibold" style={{ color: isDark ? '#b2c2d3' : '#536980' }}>{card.value}</span>
          </div>
          <p className="text-xs" style={{ color: isDark ? '#91a6bd' : '#718399' }}>
            {card.value === 0 ? 'Noch unentdeckt' : card.rankName}
          </p>
        </div>
      </div>
      <ProgressBar value={card.progress} color={meta.color} isDark={isDark} label={`${card.label}: ${card.progress} Prozent bis zur n\u00e4chsten Stufe`} />
      <p className="mt-2 text-xs leading-relaxed" style={{ color: isDark ? '#8fa3ba' : '#728399' }}>
        {card.value === 0 ? 'Startet mit der ersten passenden Geschichte oder Doku.' : meta.hint}
      </p>
    </article>
  );
};

export default AvatarGrowthDashboard;

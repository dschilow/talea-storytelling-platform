import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Brain,
  Compass,
  Ear,
  Feather,
  Gem,
  Handshake,
  Heart,
  Lightbulb,
  Mountain,
  Palette,
  Rocket,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Type as TypeIcon,
  Wand2,
} from 'lucide-react';

import { cn } from '@/lib/utils';

export type ChapterId =
  | 'welcome'
  | 'avatar'
  | 'story'
  | 'reading'
  | 'doku'
  | 'treasure'
  | 'parents'
  | 'start';

export interface ChapterMeta {
  id: ChapterId;
  /** Roman numeral shown as the oversized watermark. Empty for cover/finale. */
  numeral: string;
  eyebrow: string;
  title: string;
  lede: string;
}

export const CHAPTERS: ChapterMeta[] = [
  {
    id: 'welcome',
    numeral: '',
    eyebrow: 'Willkommen',
    title: 'Hier beginnt eure Geschichte.',
    lede: 'In zwei Minuten zeigen wir dir alles, was Talea kann. Du kannst jederzeit abbrechen und später weitermachen.',
  },
  {
    id: 'avatar',
    numeral: 'I',
    eyebrow: 'Avatare',
    title: 'Helden, die wirklich wachsen.',
    lede: 'Jeder Avatar startet bei null. Was er in Geschichten erlebt, verändert ihn — dauerhaft.',
  },
  {
    id: 'story',
    numeral: 'II',
    eyebrow: 'Geschichten',
    title: 'Jede Geschichte gibt es nur einmal.',
    lede: 'Du bestimmst Welt, Stimmung und Länge. Die KI schreibt daraus etwas, das es vorher nicht gab.',
  },
  {
    id: 'reading',
    numeral: 'III',
    eyebrow: 'Lesen & Hören',
    title: 'Drei Arten, eine Geschichte zu erleben.',
    lede: 'Vorlesen lassen, selbst lesen oder wie einen Film ansehen — jederzeit umschaltbar.',
  },
  {
    id: 'doku',
    numeral: 'IV',
    eyebrow: 'Wissen',
    title: 'Neugier, die belohnt wird.',
    lede: 'Wissens-Dokus zu allem, was dein Kind interessiert — mit Quiz direkt an der Erklärung.',
  },
  {
    id: 'treasure',
    numeral: 'V',
    eyebrow: 'Schatzkammer',
    title: 'Was bleibt, wenn die Geschichte endet.',
    lede: 'Fundstücke aus Abenteuern wandern in die Schatzkammer — und dürfen wieder mitreisen.',
  },
  {
    id: 'parents',
    numeral: 'VI',
    eyebrow: 'Für Eltern',
    title: 'Die Regeln machst du.',
    lede: 'Tabu-Themen, Lernziele und Limits — mit PIN geschützt und direkt in der KI verankert.',
  },
  {
    id: 'start',
    numeral: '',
    eyebrow: 'Bereit',
    title: 'Jetzt fehlt nur noch dein Held.',
    lede: 'Leg deinen ersten Avatar an — danach ist die erste Geschichte nur noch ein paar Klicks entfernt.',
  },
];

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const stagger = (reduce: boolean, index: number) =>
  reduce
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0.01 } }
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, delay: 0.12 + index * 0.07, ease: [0.22, 1, 0.36, 1] as const },
      };

const Panel: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({
  children,
  className,
  delay = 0,
}) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      {...stagger(Boolean(reduce), delay)}
      className={cn(
        'rounded-[1.5rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] p-4',
        className
      )}
    >
      {children}
    </motion.div>
  );
};

type IconComponent = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

const Bullet: React.FC<{ icon: IconComponent; title: string; body: string; delay: number }> = ({
  icon: Icon,
  title,
  body,
  delay,
}) => {
  const reduce = useReducedMotion();
  return (
    <motion.li {...stagger(Boolean(reduce), delay)} className="flex gap-3">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/12">
        <Icon className="h-4.5 w-4.5 text-[var(--primary)]" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--talea-text-primary)]">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-[var(--talea-text-secondary)]">{body}</span>
      </span>
    </motion.li>
  );
};

/* ------------------------------------------------------------------ */
/* I — Avatars: the personality system, made tangible                  */
/* ------------------------------------------------------------------ */

const TRAITS = [
  { id: 'knowledge', label: 'Wissen', icon: Brain, sub: 'Weltraum' },
  { id: 'creativity', label: 'Kreativität', icon: Palette, sub: null },
  { id: 'courage', label: 'Mut', icon: Mountain, sub: null },
  { id: 'curiosity', label: 'Neugier', icon: Compass, sub: null },
  { id: 'empathy', label: 'Empathie', icon: Heart, sub: null },
  { id: 'teamwork', label: 'Teamgeist', icon: Handshake, sub: null },
] as const;

/**
 * Lets the reader tap a trait and watch it grow — including a subcategory
 * appearing under "Wissen", which is exactly how the real engine works.
 */
export const AvatarChapterDemo: React.FC = () => {
  const [values, setValues] = useState<Record<string, number>>({});
  const [touched, setTouched] = useState(false);
  const reduce = useReducedMotion();

  const bump = (id: string) => {
    setTouched(true);
    setValues((prev) => ({ ...prev, [id]: Math.min(100, (prev[id] ?? 0) + (id === 'knowledge' ? 12 : 18)) }));
  };

  return (
    <Panel delay={2} className="!p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--talea-text-tertiary)]">
        Probier es aus — tippe eine Eigenschaft an
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TRAITS.map((trait) => {
          const value = values[trait.id] ?? 0;
          const Icon = trait.icon;
          return (
            <button
              key={trait.id}
              type="button"
              onClick={() => bump(trait.id)}
              className="group rounded-xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-2.5 text-left transition-colors hover:border-[var(--primary)]/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/18"
            >
              <span className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden />
                <span className="truncate text-xs font-semibold text-[var(--talea-text-primary)]">
                  {trait.label}
                </span>
                <span className="ml-auto text-[11px] font-bold tabular-nums text-[var(--primary)]">{value}</span>
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[var(--talea-surface-inset)]">
                <motion.span
                  className="block h-full rounded-full bg-[var(--primary)]"
                  animate={{ width: `${value}%` }}
                  transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 220, damping: 26 }}
                />
              </span>

              {/* Subcategories only appear once the AI awards them — mirrored here. */}
              {trait.sub && value > 0 && (
                <motion.span
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-1.5 flex items-center gap-1 overflow-hidden text-[10px] text-[var(--talea-text-tertiary)]"
                >
                  <span className="text-[var(--primary)]">└</span> {trait.sub} +{Math.round(value / 2)}
                </motion.span>
              )}
            </button>
          );
        })}
      </div>

      <motion.p
        animate={{ opacity: touched ? 1 : 0.62 }}
        className="mt-3 text-xs leading-relaxed text-[var(--talea-text-secondary)]"
      >
        {touched
          ? 'Genau so wächst dein Avatar — nur dass die Punkte aus dem kommen, was er in der Geschichte tatsächlich erlebt hat. Zu jeder Änderung gibt es eine Begründung.'
          : 'Neun Grundeigenschaften starten bei 0. Spezialgebiete wie „Wissen · Weltraum" entstehen erst, wenn eine Geschichte sie verdient hat.'}
      </motion.p>
    </Panel>
  );
};

/* ------------------------------------------------------------------ */
/* II — Story: pick a world, see the pitch change                      */
/* ------------------------------------------------------------------ */

const WORLDS = [
  { id: 'fairy', label: 'Märchen', icon: Sparkles, line: '„Es war einmal ein Wald, in dem jeder Baum ein Geheimnis kannte …"' },
  { id: 'adventure', label: 'Abenteuer', icon: Mountain, line: '„Die Karte endete an einer Klippe. Genau dort begann alles."' },
  { id: 'magic', label: 'Magie', icon: Wand2, line: '„Der Zauberstab wählte sie aus — und niemand wusste, warum."' },
  { id: 'scifi', label: 'Sci-Fi', icon: Rocket, line: '„Auf dem fremden Planeten war der Himmel grün und der Boden sang."' },
] as const;

const MOODS = ['Lustig', 'Spannend', 'Herzerwärmend'] as const;

export const StoryChapterDemo: React.FC = () => {
  const [world, setWorld] = useState<string>('adventure');
  const [moods, setMoods] = useState<string[]>(['Spannend']);
  const reduce = useReducedMotion();
  const active = WORLDS.find((entry) => entry.id === world) ?? WORLDS[1];

  return (
    <Panel delay={2} className="!p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--talea-text-tertiary)]">
        Wähle eine Welt und eine Stimmung
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WORLDS.map((entry) => {
          const Icon = entry.icon;
          const selected = world === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setWorld(entry.id)}
              aria-pressed={selected}
              className={cn(
                'rounded-xl border p-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/18',
                selected
                  ? 'border-[var(--primary)] bg-[var(--primary)]/12'
                  : 'border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] hover:border-[var(--talea-border-strong)]'
              )}
            >
              <Icon
                className={cn('mx-auto mb-1 h-4 w-4', selected ? 'text-[var(--primary)]' : 'text-[var(--talea-text-tertiary)]')}
                aria-hidden
              />
              <span className="block text-xs font-semibold text-[var(--talea-text-primary)]">{entry.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {MOODS.map((mood) => {
          const selected = moods.includes(mood);
          return (
            <button
              key={mood}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                setMoods((prev) => (prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]))
              }
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/18',
                selected
                  ? 'border-[var(--primary)] bg-[var(--primary)]/12 text-[var(--talea-text-primary)]'
                  : 'border-[var(--talea-border-light)] text-[var(--talea-text-secondary)] hover:border-[var(--talea-border-strong)]'
              )}
            >
              {mood}
            </button>
          );
        })}
      </div>

      <motion.blockquote
        key={active.id + moods.join()}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="mt-3 rounded-xl border-l-2 border-[var(--primary)] bg-[var(--talea-surface-primary)] px-3.5 py-3"
      >
        <p className="text-[15px] italic leading-relaxed text-[var(--talea-text-primary)]" style={{ fontFamily: '"Fraunces", serif' }}>
          {active.line}
        </p>
        <p className="mt-1.5 text-[11px] text-[var(--talea-text-tertiary)]">
          {moods.length > 0 ? `Stimmung: ${moods.join(' · ')}` : 'Wähle mindestens eine Stimmung'}
        </p>
      </motion.blockquote>
    </Panel>
  );
};

/* ------------------------------------------------------------------ */
/* III — Reading modes                                                 */
/* ------------------------------------------------------------------ */

const MODES = [
  { id: 'cinematic', label: 'Kino', body: 'Szene für Szene mit generierten Bildern — wie ein Film zum Mitlesen.' },
  { id: 'classic', label: 'Klassisch', body: 'Ruhige Buchansicht, Kapitel für Kapitel. Ideal zum Selberlesen.' },
  { id: 'scroll', label: 'Scroll', body: 'Ein durchgehender Fluss — gut für schnelle Leser und unterwegs.' },
] as const;

export const ReadingChapterDemo: React.FC = () => {
  const [mode, setMode] = useState<string>('cinematic');
  const reduce = useReducedMotion();
  const active = MODES.find((entry) => entry.id === mode) ?? MODES[0];

  return (
    <Panel delay={2} className="!p-4">
      <div className="flex gap-1.5 rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-1">
        {MODES.map((entry) => {
          const selected = mode === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setMode(entry.id)}
              aria-pressed={selected}
              className="relative flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/18"
            >
              {selected && (
                <motion.span
                  layoutId="tour-reading-pill"
                  transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-[var(--primary)]"
                />
              )}
              <span className={cn('relative', selected ? 'text-white' : 'text-[var(--talea-text-secondary)]')}>
                {entry.label}
              </span>
            </button>
          );
        })}
      </div>

      <motion.p
        key={active.id}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-3 text-sm leading-relaxed text-[var(--talea-text-secondary)]"
      >
        {active.body}
      </motion.p>

      <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[var(--primary)]/10 px-3 py-2.5">
        <Ear className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
        <p className="text-xs leading-relaxed text-[var(--talea-text-secondary)]">
          <strong className="font-semibold text-[var(--talea-text-primary)]">Audio geht immer dazu.</strong>{' '}
          Jede Geschichte und jede Doku lässt sich vorlesen — praktisch im Auto und zur Schlafenszeit.
        </p>
      </div>
    </Panel>
  );
};

/* ------------------------------------------------------------------ */
/* Static chapters                                                     */
/* ------------------------------------------------------------------ */

export const DokuChapterBody: React.FC = () => (
  <ul className="space-y-3.5">
    <Bullet
      icon={Lightbulb}
      delay={2}
      title="Themenwelten statt leerem Suchfeld"
      body="Natur, Weltraum, Technik, Geschichte und mehr — mit Vorschlägen, die zum Alter und Lernstand passen."
    />
    <Bullet
      icon={ScrollText}
      delay={3}
      title="Struktur mit Lernzielen"
      body="Jede Doku ist in Kapitel gegliedert, mit Mitmach-Ideen für zwischendurch."
    />
    <Bullet
      icon={Sparkles}
      delay={4}
      title="Quiz direkt an der Erklärung"
      body="Gefragt wird da, wo die Antwort gerade erklärt wurde — nicht als Test am Ende."
    />
  </ul>
);

export const TreasureChapterBody: React.FC = () => (
  <ul className="space-y-3.5">
    <Bullet
      icon={Gem}
      delay={2}
      title="Fundstücke aus echten Abenteuern"
      body="Was dein Avatar in einer Geschichte findet, gehört ihm danach wirklich."
    />
    <Bullet
      icon={Feather}
      delay={3}
      title="Mitnehmen und aufwerten"
      body="Nimm ein Fundstück in die nächste Geschichte mit — mit jeder Reise steigt seine Stufe."
    />
    <Bullet
      icon={BookOpen}
      delay={4}
      title="Tagebuch und Erinnerungen"
      body="Jeder Avatar führt ein Tagebuch. Erlebtes taucht später in neuen Geschichten wieder auf."
    />
  </ul>
);

export const ParentsChapterBody: React.FC = () => (
  <ul className="space-y-3.5">
    <Bullet
      icon={ShieldCheck}
      delay={2}
      title="Eltern-Dashboard mit PIN"
      body="Tabu-Themen, Lernziele und Tageslimits an einem Ort — für Kinder nicht erreichbar."
    />
    <Bullet
      icon={TypeIcon}
      delay={3}
      title="Vorher, nicht nachher"
      body="Deine Regeln stehen im Prompt, bevor die Geschichte entsteht. Es wird nicht nachträglich gefiltert."
    />
    <Bullet
      icon={Heart}
      delay={4}
      title="Ein Profil pro Kind"
      body="Alter, Avatare und Fortschritt bleiben getrennt — auch bei mehreren Kindern."
    />
  </ul>
);

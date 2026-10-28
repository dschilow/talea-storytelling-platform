import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

import { TaleaSelectedBadge } from '@/components/talea/TaleaPastelPrimitives';
import { cn } from '@/lib/utils';
import {
  DEFAULT_OPENROUTER_STORY_MODEL,
  STORYBOOK_OPENROUTER_STORY_MODEL,
  type OpenRouterStoryModel,
} from '@/types/story';
import { joinNames } from '../library/storyShelves';
import type { CharacterSeriesChoice } from './StepCharacterSeries';
import { StoryWizardIcon, type StoryWizardIconName } from './StoryWizardIcon';
import { ChoiceTile, TONE, WizardStepHeading, idleTileClass, selectedTileClass } from './wizardChoices';

/** "Eigene Geschichte" (Talea-Folge) or "Figurenabenteuer" (Figurenserie): the two kinds families choose between. */
export type StoryKind = 'story' | 'series';

/** Which pipeline writes an "Eigene Geschichte". Customers always get Talea-Folge; admins can test the others. */
export interface StoryLaneState {
  developerMode: boolean;
  storybookMode: boolean;
  bookWorkshopMode: boolean;
  wonderStoryMode: boolean;
  episodeMode: boolean;
  chapterBookMode: boolean;
  openRouterModel: OpenRouterStoryModel;
}

interface Props {
  kind: StoryKind;
  onKindChange: (kind: StoryKind) => void;
  /** The figures of the Figurenserie, with this profile's progress. */
  series: CharacterSeriesChoice[];
  isAdmin: boolean;
  lanes: StoryLaneState;
  onLaneChange: (updates: Partial<StoryLaneState>) => void;
}

const figureName = (entry: CharacterSeriesChoice) => entry.characterName || entry.title;
/** Inside a sentence an article is lower case ("… und die Nebelfee"); the first name starts the sentence. */
const inSentence = (name: string, index: number) => (index > 0 ? name.replace(/^(Der|Die|Das) /, (article) => article.toLowerCase()) : name);

export default function StepStoryKind({ kind, onKindChange, series, isAdmin, lanes, onLaneChange }: Props) {
  const started = series.filter((entry) => entry.episodeCount > 0);
  const seriesFact = started.length
    ? `${joinNames(started.map(figureName).map(inSentence), 2)} ${started.length === 1 ? 'wartet' : 'warten'} auf eure nächste Folge`
    : series.length
      ? `${series.length} Figuren warten auf euch`
      : 'Figuren mit eigener Welt';

  return (
    <div className="space-y-7">
      <WizardStepHeading title="Was möchtet ihr erleben?" subtitle="Eine Geschichte nur für euch oder eine Serie mit einer Talea-Figur." />

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Art der Geschichte">
        <KindCard
          selected={kind === 'story'}
          onSelect={() => onKindChange('story')}
          title="Eigene Geschichte"
          text="Ein neues Abenteuer, frei erfunden für eure Avatare. Ihr wählt Welt, Länge und Gefühl."
          fact="Eure Avatare sind die Helden"
          background="var(--talea-gradient-warm)"
          art={<StoryArt />}
        />
        <KindCard
          selected={kind === 'series'}
          onSelect={() => onKindChange('series')}
          title="Figurenabenteuer"
          text="Trefft eine Talea-Figur und erlebt mit ihr eine Serie. Jede Folge erzählt eure Geschichte weiter."
          fact={seriesFact}
          background="var(--talea-gradient-ocean)"
          art={<SeriesArt series={series} />}
        />
      </div>

      {isAdmin && kind === 'story' ? <AdminLanes lanes={lanes} onLaneChange={onLaneChange} /> : null}
    </div>
  );
}

const KindCard: React.FC<{
  selected: boolean;
  onSelect: () => void;
  title: string;
  text: string;
  fact: string;
  background: string;
  art: React.ReactNode;
}> = ({ selected, onSelect, title, text, fact, background, art }) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]',
        selected ? selectedTileClass : idleTileClass,
      )}
    >
      <span className="relative flex h-32 items-center justify-center sm:h-36" style={{ background }} aria-hidden="true">
        {art}
      </span>
      <span className="flex flex-1 flex-col gap-1 px-4 pb-4 pt-3.5">
        <span className="text-[1.25rem] font-bold leading-tight text-[var(--talea-text-primary)]" style={{ fontFamily: 'var(--talea-font-display)' }}>
          {title}
        </span>
        <span className="text-[14px] leading-snug text-[var(--talea-text-secondary)]">{text}</span>
        <span className="mt-auto pt-2 text-[13px] font-semibold text-[var(--primary)]">{fact}</span>
      </span>
      <AnimatePresence>{selected && <TaleaSelectedBadge label={title} className="right-3 top-3 h-7 w-7" />}</AnimatePresence>
    </motion.button>
  );
};

/** An open book in the middle, three of the worlds around it: any world, made up for you. */
const StoryArt: React.FC = () => {
  const worlds: Array<{ icon: StoryWizardIconName; tone: string; place: string }> = [
    { icon: 'castle', tone: TONE.rose, place: 'left-[18%] top-4' },
    { icon: 'rocket', tone: TONE.sky, place: 'right-[18%] top-5' },
    { icon: 'fox', tone: TONE.mint, place: 'bottom-4 right-[24%]' },
  ];
  return (
    <>
      {worlds.map((world) => (
        <span
          key={world.icon}
          className={cn('absolute flex h-10 w-10 items-center justify-center rounded-full shadow-[0_6px_14px_rgba(62,40,31,0.10)]', world.place)}
          style={{ background: `color-mix(in srgb, ${world.tone} 16%, var(--talea-surface-primary))`, color: world.tone }}
        >
          <StoryWizardIcon name={world.icon} className="h-7 w-7" tint={0.25} />
        </span>
      ))}
      <span
        className="flex h-20 w-20 items-center justify-center rounded-[1.4rem] shadow-[0_10px_24px_rgba(62,40,31,0.14)]"
        style={{ background: `color-mix(in srgb, ${TONE.terracotta} 16%, var(--talea-surface-primary))`, color: TONE.terracotta }}
      >
        <StoryWizardIcon name="openBook" className="h-14 w-14" tint={0.3} />
      </span>
    </>
  );
};

/** The figures themselves, side by side: the series are about them. */
const SeriesArt: React.FC<{ series: CharacterSeriesChoice[] }> = ({ series }) => {
  const portraits = series.filter((entry) => entry.imageUrl).slice(0, 4);
  if (!portraits.length) {
    return (
      <span className="flex h-20 w-20 items-center justify-center rounded-[1.4rem]" style={{ background: `color-mix(in srgb, ${TONE.mint} 16%, var(--talea-surface-primary))`, color: TONE.mint }}>
        <StoryWizardIcon name="books3" className="h-14 w-14" tint={0.3} />
      </span>
    );
  }
  return (
    <span className="flex -space-x-4">
      {portraits.map((entry, index) => (
        <span
          key={entry.id}
          className="h-[4.5rem] w-[4.5rem] overflow-hidden rounded-full bg-white shadow-[0_8px_18px_rgba(40,20,10,0.16)] ring-[3px] ring-[var(--talea-surface-primary)] sm:h-20 sm:w-20"
          style={{ transform: `translateY(${index % 2 ? 6 : -4}px)` }}
        >
          <img src={entry.imageUrl || undefined} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </span>
      ))}
    </span>
  );
};

type AdminLane = 'episode' | 'wonder' | 'standard' | 'storybook' | 'chapterbook' | 'workshop' | 'developer';

const LANES: Array<{ id: AdminLane; title: string; badge: string; icon: StoryWizardIconName; tone: string; description: string; note?: string }> = [
  {
    id: 'episode',
    title: 'Talea-Folge',
    badge: 'Für alle Kunden',
    icon: 'openBook',
    tone: TONE.sky,
    description:
      'Gebaut wie die Talea Originals: pro Geschichte eine eigene kleine Reihenbibel mit einem Wunder und seiner Regel, Figuren mit eigener Stimme, Running Gags, einem Mutmoment und einem Ende, das alles einlöst. Zwei bis vier volle Kapitel.',
    note: 'GPT-6.1 Sol plant und schreibt in einem Aufruf (Flex-Tarif), etwa 3 ¢ Text; zwei Bilder pro Kapitel und ein Cover. Das schreibt jede „Eigene Geschichte“ der Kunden.',
  },
  {
    id: 'wonder',
    title: 'Wunder & Witz',
    badge: 'Test',
    icon: 'laugh',
    tone: TONE.gold,
    description: 'Situationskomik mit eigenwilligen Figuren und einem warmen Ende; eigene Beispielideen, ausgearbeitete Kapitel und Lektorat.',
  },
  {
    id: 'standard',
    title: 'Geschichte (alt)',
    badge: 'Test',
    icon: 'books2',
    tone: TONE.terracotta,
    description: 'Die bisherige Pipeline: Avatare mit Persönlichkeit und Erinnerungen, Charakter-Pool, Story-DNA, Stilpaket, Bilder pro Kapitel. Schreibt mit Kimi K2.6; Tavi nutzt sie weiter, solange TALEA_CUSTOMER_STORY_ENGINE nicht gesetzt ist.',
  },
  {
    id: 'storybook',
    title: 'Bilderbuch',
    badge: 'Test',
    icon: 'picture',
    tone: TONE.rose,
    description: 'Nach den Bauplänen der besten Bilderbücher: drei Ideen, die stärkste wird Seite für Seite geplant, geschrieben, von einer unabhängigen Lektorin bewertet (0–10) und überarbeitet.',
  },
  {
    id: 'chapterbook',
    title: 'Kapitelbuch',
    badge: 'Test',
    icon: 'books3',
    tone: TONE.sky,
    description: 'Ein Buch für mehrere Abende: 8 bis 15 Kapitel mit 1–3 Bildern pro Kapitel, geprüftem Bandplan und Fortsetzung. Geschätzt 25–35 ¢ pro Band.',
  },
  {
    id: 'workshop',
    title: 'Buchwerkstatt',
    badge: 'Test',
    icon: 'pencil',
    tone: TONE.mint,
    description: 'Eigenständige Pipeline: plant die Handlung, schreibt die Geschichte und prüft sie auf Verständlichkeit und Widersprüche.',
  },
  {
    id: 'developer',
    title: 'Developer',
    badge: 'Test',
    icon: 'flask',
    tone: TONE.gold,
    description: 'Kostenoptimierte Text-Pipeline: Blueprint, Dramaturgie-Check, finale Geschichte und harte Validierung, mit dem Standard-Schreibmodell. Keine Bilder, Avatare werden nicht verändert.',
  },
];

function activeLaneOf(lanes: StoryLaneState): AdminLane {
  if (lanes.episodeMode) return 'episode';
  if (lanes.wonderStoryMode) return 'wonder';
  if (lanes.chapterBookMode) return 'chapterbook';
  if (lanes.bookWorkshopMode) return 'workshop';
  if (lanes.developerMode) return 'developer';
  if (lanes.storybookMode) return 'storybook';
  return 'standard';
}

/** Admin-only: the test pipelines behind "Eigene Geschichte", folded away so the page reads like the customer's. */
const AdminLanes: React.FC<{ lanes: StoryLaneState; onLaneChange: (updates: Partial<StoryLaneState>) => void }> = ({ lanes, onLaneChange }) => {
  const reduceMotion = useReducedMotion();
  const activeLane = activeLaneOf(lanes);
  const active = LANES.find((lane) => lane.id === activeLane) ?? LANES[0];
  // The Bilderbuch, the Kapitelbuch and Wunder & Witz are built and measured on Sol; the others write with the default.
  const select = (lane: AdminLane) => {
    const solLane = lane === 'storybook' || lane === 'chapterbook' || lane === 'wonder' || lane === 'episode';
    onLaneChange({
      developerMode: lane === 'developer',
      storybookMode: lane === 'storybook',
      bookWorkshopMode: lane === 'workshop',
      chapterBookMode: lane === 'chapterbook',
      wonderStoryMode: lane === 'wonder',
      episodeMode: lane === 'episode',
      openRouterModel: solLane ? STORYBOOK_OPENROUTER_STORY_MODEL : DEFAULT_OPENROUTER_STORY_MODEL,
    });
  };

  return (
    <details className="group rounded-[1.25rem] border border-amber-400/40 bg-amber-400/10 p-3.5 sm:p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-[var(--talea-text-primary)]">Admin: Pipeline für „Eigene Geschichte“</span>
          <span className="block truncate text-[13px] text-[var(--talea-text-secondary)]">{active.title}{activeLane === 'episode' ? ' – wie bei allen Kunden' : ' – nur zum Testen'}</span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-[var(--talea-text-secondary)] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {LANES.map((lane) => (
            <ChoiceTile
              key={lane.id}
              compact
              icon={lane.icon}
              tone={lane.tone}
              title={lane.title}
              description={lane.badge}
              selected={activeLane === lane.id}
              onClick={() => select(lane.id)}
            />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.16 }}
            className="rounded-[1rem] bg-[var(--talea-surface-primary)] px-3.5 py-3"
          >
            <p className="text-[13px] leading-relaxed text-[var(--talea-text-secondary)]">{active.description}</p>
            {active.note ? <p className="mt-1.5 text-[12px] italic text-[var(--talea-text-tertiary)]">{active.note}</p> : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </details>
  );
};

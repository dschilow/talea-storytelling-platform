import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import {
  DEFAULT_OPENROUTER_STORY_MODEL,
  STORYBOOK_OPENROUTER_STORY_MODEL,
  type AIModel,
  type AIProvider,
  type OpenRouterStoryModel,
} from '@/types/story';
import type { StoryWizardIconName } from './StoryWizardIcon';
import EngineModelPicker from './EngineModelPicker';
import { ChoiceTile, TONE, WizardStepHeading } from './wizardChoices';

export interface EngineModeState {
  developerMode: boolean;
  storybookMode: boolean;
  bookWorkshopMode: boolean;
  wonderStoryMode: boolean;
  episodeMode: boolean;
  characterSeries?: string | null;
  chapterBookMode: boolean;
  aiModel: AIModel;
  aiProvider: AIProvider;
  openRouterModel: OpenRouterStoryModel;
}

interface Props {
  state: EngineModeState;
  updateState: (updates: Partial<EngineModeState>) => void;
}

type GenerationLane = 'standard' | 'episode' | 'character-series' | 'wonder' | 'storybook' | 'chapterbook' | 'workshop' | 'developer';

const LANES: Array<{
  id: GenerationLane;
  title: string;
  badge: string;
  icon: StoryWizardIconName;
  tone: string;
  description: string;
  note?: string;
}> = [
  {
    id: 'episode',
    title: 'Talea-Folge',
    badge: 'Neu · Test',
    icon: 'openBook',
    tone: TONE.sky,
    description:
      'Gebaut wie die Talea Originals (Bruno, Monster-Müllabfuhr): pro Geschichte eine eigene kleine Reihenbibel – ein Wunder mit einer Regel, das eine echte Kindersituation wörtlich nimmt, Figuren mit eigener Stimme, Running Gags, ein Mutmoment mit Herz und ein Ende, das alles Angelegte einlöst. Drei volle Kapitel statt fünf kurzer Seiten.',
    note: 'GPT-6.1 Sol plant und schreibt in einem Aufruf (Flex-Tarif), mit Originals-Kapiteln als Stilvorlage. Etwa 3 ¢ Text pro Geschichte, ein Bild pro Kapitel.',
  },
  {
    id: 'character-series',
    title: 'Figurenserie',
    badge: 'Überarbeitet · Test',
    icon: 'books3',
    tone: TONE.mint,
    description:
      'Erlebe mit deinen Avataren die Vorgeschichte einer Talea-Figur und kehre in weiteren Folgen in ihre Welt zurück. Wähle eine Figur selbst oder lass dich passend zur gewählten Welt überraschen.',
    note: 'Beim ersten Besuch lernt ihr die Figur und ihre Welt kennen. Danach geht euer gemeinsames Abenteuer weiter – mit einem Bild pro Kapitel und einem Cover.',
  },
  {
    id: 'wonder',
    title: 'Wunder & Witz',
    badge: 'Neu · Test',
    icon: 'laugh',
    tone: TONE.gold,
    description:
      'Ein Frühstück, das plötzlich eigene Pläne hat. Ein Drache mit Lampenfieber. Geschichten mit Situationskomik, eigenwilligen Figuren und einem warmen Ende – deine Avatare entscheiden, wie das Abenteuer ausgeht.',
    note: 'Mit eigenen Beispielideen, ausgearbeiteten Kapiteln und Lektorat. Alter, Länge und deine Wünsche bestimmen den Ton.',
  },
  {
    id: 'standard',
    title: 'Geschichte',
    badge: 'Normal',
    icon: 'openBook',
    tone: TONE.terracotta,
    description:
      'Volle Pipeline: Avatare mit Persönlichkeit & Erinnerungen, Charakter-Pool, Story-DNA, Stilpaket, Bilder pro Kapitel, Personality-Updates nach dem Lesen.',
  },
  {
    id: 'storybook',
    title: 'Bilderbuch',
    badge: 'Neu',
    icon: 'picture',
    tone: TONE.rose,
    description:
      'Gebaut nach den Bauplänen der besten Bilderbücher: drei Ideen, die stärkste wird Seite für Seite geplant, geschrieben, von einer unabhängigen Lektorin gegen echte Kinderbücher bewertet (0–10) und überarbeitet. Figuren aus dem Charakter-Pool per Casting, Artefakt je nach Einstellung, actionreiche Bilder mit Bildprüfung.',
    note: 'Startet mit GPT-6 Luna als Autor-Modell; die Lektorin ist immer ein Modell einer anderen Familie.',
  },
  {
    id: 'chapterbook',
    title: 'Kapitelbuch',
    badge: 'Neu · Test',
    icon: 'books3',
    tone: TONE.sky,
    description:
      'Ein richtiges Buch für mehrere Abende: 8 bis 15 Kapitel mit 1–3 Bildern pro Kapitel. Erst Idee und passende Figuren, dann ein geprüfter Bandplan mit großer Frage, Wendung, Running Gag und Finale. Die ersten Kapitel sind nach wenigen Minuten lesbar, der Rest entsteht im Hintergrund. Am Ende: nächster Band oder ganz neue Geschichte.',
    note: 'GPT-6 Luna plant, GPT-6.1 Sol schreibt, Gemini prüft, Luna patcht und führt das Logbuch. Geschätzt 25–35 ¢ pro Band.',
  },
  {
    id: 'workshop',
    title: 'Buchwerkstatt',
    badge: 'Test',
    icon: 'pencil',
    tone: TONE.mint,
    description:
      'Neue, eigenständige Pipeline: plant die Handlung, schreibt die Geschichte und prüft sie auf Verständlichkeit und Widersprüche. Mit deinen Avataren, passenden Nebenfiguren, Artefakten und Illustrationen.',
    note: 'Zum Testen und Vergleichen.',
  },
  {
    id: 'developer',
    title: 'Developer',
    badge: 'Test',
    icon: 'flask',
    tone: TONE.gold,
    description:
      'Kostenoptimierte Text-Pipeline: Blueprint, Dramaturgie-Check, finale Geschichte und harte Validierung. Planung und Prüfung laufen über ein günstiges Support-Modell; nur die finale Story-Prosa nutzt das ausgewählte KI-Modell. Keine Bilder. Avatare werden nicht verändert.',
    note: 'Der Validator bewertet nur und schreibt die finale Geschichte nicht um.',
  },
];

/** Admin-only: which pipeline writes the story, and with which model. */
export default function StepEngineMode({ state, updateState }: Props) {
  const reduceMotion = useReducedMotion();
  const activeLane: GenerationLane = state.characterSeries ? 'character-series' : state.episodeMode ? 'episode' : state.wonderStoryMode ? 'wonder' : state.chapterBookMode
    ? 'chapterbook'
    : state.bookWorkshopMode
      ? 'workshop'
      : state.developerMode
        ? 'developer'
        : state.storybookMode
          ? 'storybook'
          : 'standard';
  const active = LANES.find((lane) => lane.id === activeLane) ?? LANES[0];

  // The Bilderbuch and the Kapitelbuch are built and measured on their own writer;
  // the model picker below still lets an admin choose any other one afterwards.
  const select = (lane: GenerationLane) => {
    const modelUpdate: Partial<EngineModeState> =
      lane === 'storybook' || lane === 'chapterbook' || lane === 'wonder' || lane === 'episode' || lane === 'character-series'
        ? { aiProvider: 'openrouter', openRouterModel: STORYBOOK_OPENROUTER_STORY_MODEL }
        : state.openRouterModel === STORYBOOK_OPENROUTER_STORY_MODEL
          ? { openRouterModel: DEFAULT_OPENROUTER_STORY_MODEL }
          : {};
    updateState({
      developerMode: lane === 'developer',
      storybookMode: lane === 'storybook',
      bookWorkshopMode: lane === 'workshop',
      chapterBookMode: lane === 'chapterbook',
      wonderStoryMode: lane === 'wonder',
      episodeMode: lane === 'episode',
      characterSeries: lane === 'character-series' ? 'auto' : null,
      ...modelUpdate,
    });
  };

  return (
    <div className="space-y-7">
      <WizardStepHeading title="Was soll entstehen?" subtitle="Nur für Admins sichtbar. Avatare und Wünsche folgen danach." />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
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
          className="rounded-[1.25rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] px-4 py-3.5"
        >
          <p className="text-[15px] font-semibold text-[var(--talea-text-primary)]">{active.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--talea-text-secondary)]">{active.description}</p>
          {active.note ? <p className="mt-1.5 text-[12px] italic text-[var(--talea-text-tertiary)]">{active.note}</p> : null}
        </motion.div>
      </AnimatePresence>

      <EngineModelPicker state={state} updateState={updateState} />
    </div>
  );
}

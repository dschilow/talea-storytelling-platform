// Modern Doku Wizard - Checker Tobi Style
// Step-by-step wizard for creating educational dokus
// Inspired by ModernStoryWizard design

import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, CheckCircle, FlaskConical, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useBackend } from '../../hooks/useBackend';
import { useTranslation } from 'react-i18next';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DokuWizardState {
  // Step 1: Topic
  topic: string;

  // Step 2: Age & Depth
  ageGroup: '3-5' | '6-8' | '9-12' | '13+';
  depth: 'basic' | 'standard' | 'deep';

  // Step 3: Perspective & Tone
  perspective: 'science' | 'history' | 'technology' | 'nature' | 'culture';
  tone: 'fun' | 'neutral' | 'curious';

  // Step 4: Content Settings
  length: 'short' | 'medium' | 'long';
  includeInteractive: boolean;
  quizQuestions: number;
  handsOnActivities: number;
}

// ─── Step Components ──────────────────────────────────────────────────────────

function Step1Topic({ state, updateState }: { state: DokuWizardState; updateState: (u: Partial<DokuWizardState>) => void }) {
  const { t } = useTranslation();

  const topicSuggestions = [
    { emoji: '🦕', label: 'Dinosaurier', topic: 'Dinosaurier' },
    { emoji: '🌋', label: 'Vulkane', topic: 'Vulkane' },
    { emoji: '🚀', label: 'Weltraum', topic: 'Das Sonnensystem' },
    { emoji: '🦁', label: 'Tiere Afrikas', topic: 'Tiere in Afrika' },
    { emoji: '⚡', label: 'Elektrizität', topic: 'Wie funktioniert Strom?' },
    { emoji: '🏰', label: 'Ritter & Burgen', topic: 'Das Leben im Mittelalter' },
    { emoji: '🌊', label: 'Ozeane', topic: 'Die Geheimnisse der Ozeane' },
    { emoji: '🧬', label: 'Menschlicher Körper', topic: 'Wie funktioniert unser Körper?' },
    { emoji: '🌱', label: 'Pflanzen', topic: 'Wie wachsen Pflanzen?' },
    { emoji: '🐝', label: 'Bienen', topic: 'Warum sind Bienen so wichtig?' },
    { emoji: '🌍', label: 'Klimawandel', topic: 'Klimawandel einfach erklärt' },
    { emoji: '🔬', label: 'Chemie', topic: 'Chemie im Alltag' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Was möchtest du entdecken?
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Gib ein Thema ein oder wähle eine Idee aus
        </p>
      </div>

      {/* Topic Input */}
      <div className="relative">
        <input
          type="text"
          value={state.topic}
          onChange={(e) => updateState({ topic: e.target.value })}
          placeholder="z.B. Dinosaurier, Vulkane, Weltraum..."
          className="w-full px-6 py-4 text-lg rounded-xl border-2 border-gray-200 dark:border-gray-600
                     bg-white dark:bg-gray-800 text-gray-800 dark:text-white
                     focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-800
                     placeholder:text-gray-400 transition-all outline-none"
          autoFocus
        />
        {state.topic && (
          <button
            onClick={() => updateState({ topic: '' })}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        )}
      </div>

      {/* Topic Suggestions */}
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Ideen zum Entdecken:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {topicSuggestions.map((s) => (
            <button
              key={s.label}
              onClick={() => updateState({ topic: s.topic })}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-left transition-all
                ${state.topic === s.topic
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 shadow-md'
                  : 'border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-600 bg-white dark:bg-gray-800'
                }
              `}
            >
              <span className="text-xl">{s.emoji}</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step2AgeAndDepth({ state, updateState }: { state: DokuWizardState; updateState: (u: Partial<DokuWizardState>) => void }) {
  const ageGroups = [
    { value: '3-5' as const, emoji: '🧒', label: '3-5 Jahre', desc: 'Ganz einfach, mit Bildern' },
    { value: '6-8' as const, emoji: '👧', label: '6-8 Jahre', desc: 'Spielerisch und spannend' },
    { value: '9-12' as const, emoji: '🧑', label: '9-12 Jahre', desc: 'Tiefere Zusammenhänge' },
    { value: '13+' as const, emoji: '🧑‍🎓', label: '13+ Jahre', desc: 'Komplexe Themen' },
  ];

  const depths = [
    { value: 'basic' as const, emoji: '🌱', label: 'Grundlagen', desc: 'Einfacher Einstieg ins Thema' },
    { value: 'standard' as const, emoji: '🌿', label: 'Standard', desc: 'Ausgewogene Tiefe mit Details' },
    { value: 'deep' as const, emoji: '🌳', label: 'Tief', desc: 'Experten-Wissen, viele Details' },
  ];

  return (
    <div className="space-y-8">
      {/* Age Group */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-center">
          Für wen ist die Doku?
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-4">Wähle die passende Altersgruppe</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ageGroups.map((ag) => (
            <button
              key={ag.value}
              onClick={() => updateState({ ageGroup: ag.value })}
              className={`
                flex flex-col items-center gap-2 px-4 py-5 rounded-xl border-2 transition-all
                ${state.ageGroup === ag.value
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 shadow-md scale-[1.02]'
                  : 'border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-600 bg-white dark:bg-gray-800'
                }
              `}
            >
              <span className="text-3xl">{ag.emoji}</span>
              <span className="font-bold text-gray-800 dark:text-white">{ag.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center">{ag.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Depth */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3">Wie tief soll es gehen?</h3>
        <div className="grid grid-cols-3 gap-3">
          {depths.map((d) => (
            <button
              key={d.value}
              onClick={() => updateState({ depth: d.value })}
              className={`
                flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all
                ${state.depth === d.value
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 shadow-md'
                  : 'border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-600 bg-white dark:bg-gray-800'
                }
              `}
            >
              <span className="text-2xl">{d.emoji}</span>
              <span className="font-bold text-sm text-gray-800 dark:text-white">{d.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center">{d.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step3PerspectiveAndTone({ state, updateState }: { state: DokuWizardState; updateState: (u: Partial<DokuWizardState>) => void }) {
  const perspectives = [
    { value: 'science' as const, emoji: '🔬', label: 'Naturwissenschaft', desc: 'Wie funktioniert es?' },
    { value: 'history' as const, emoji: '📜', label: 'Geschichte', desc: 'Wie war es früher?' },
    { value: 'technology' as const, emoji: '⚙️', label: 'Technik', desc: 'Wie wird es gebaut?' },
    { value: 'nature' as const, emoji: '🌿', label: 'Natur', desc: 'Was lebt und wächst?' },
    { value: 'culture' as const, emoji: '🎭', label: 'Kultur', desc: 'Was bedeutet es für Menschen?' },
  ];

  const tones = [
    { value: 'fun' as const, emoji: '😄', label: 'Lustig', desc: 'Mit Witz und Humor' },
    { value: 'curious' as const, emoji: '🤔', label: 'Neugierig', desc: 'Checker Tobi Style' },
    { value: 'neutral' as const, emoji: '📖', label: 'Sachlich', desc: 'Klar und informativ' },
  ];

  return (
    <div className="space-y-8">
      {/* Perspective */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-center">
          Welcher Blickwinkel?
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-4">Aus welcher Perspektive soll erzählt werden?</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {perspectives.map((p) => (
            <button
              key={p.value}
              onClick={() => updateState({ perspective: p.value })}
              className={`
                flex flex-col items-center gap-2 px-3 py-4 rounded-xl border-2 transition-all
                ${state.perspective === p.value
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 shadow-md scale-[1.02]'
                  : 'border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-600 bg-white dark:bg-gray-800'
                }
              `}
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="font-bold text-sm text-gray-800 dark:text-white">{p.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tone */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3">Wie soll es klingen?</h3>
        <div className="grid grid-cols-3 gap-3">
          {tones.map((t) => (
            <button
              key={t.value}
              onClick={() => updateState({ tone: t.value })}
              className={`
                flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all
                ${state.tone === t.value
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 shadow-md'
                  : 'border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-600 bg-white dark:bg-gray-800'
                }
              `}
            >
              <span className="text-2xl">{t.emoji}</span>
              <span className="font-bold text-sm text-gray-800 dark:text-white">{t.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step4ContentSettings({ state, updateState }: { state: DokuWizardState; updateState: (u: Partial<DokuWizardState>) => void }) {
  const lengths = [
    { value: 'short' as const, emoji: '📄', label: 'Kurz', desc: '3 Abschnitte', detail: 'Schneller Überblick' },
    { value: 'medium' as const, emoji: '📑', label: 'Mittel', desc: '5 Abschnitte', detail: 'Ausgewogen' },
    { value: 'long' as const, emoji: '📚', label: 'Lang', desc: '7 Abschnitte', detail: 'Ausführliches Wissen' },
  ];

  return (
    <div className="space-y-8">
      {/* Length */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-center">
          Wie umfangreich?
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-4">Wähle die Länge deiner Wissensdoku</p>
        <div className="grid grid-cols-3 gap-4">
          {lengths.map((l) => (
            <button
              key={l.value}
              onClick={() => updateState({ length: l.value })}
              className={`
                flex flex-col items-center gap-2 px-4 py-5 rounded-xl border-2 transition-all
                ${state.length === l.value
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 shadow-md scale-[1.02]'
                  : 'border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-600 bg-white dark:bg-gray-800'
                }
              `}
            >
              <span className="text-3xl">{l.emoji}</span>
              <span className="font-bold text-gray-800 dark:text-white">{l.label}</span>
              <span className="text-sm text-teal-600 dark:text-teal-400">{l.desc}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{l.detail}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Toggle */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Interaktive Elemente</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Quiz-Fragen und Mitmach-Aktivitäten</p>
          </div>
          <button
            onClick={() => updateState({ includeInteractive: !state.includeInteractive })}
            className={`
              relative w-14 h-7 rounded-full transition-colors
              ${state.includeInteractive ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <span className={`
              absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform
              ${state.includeInteractive ? 'translate-x-7' : 'translate-x-0.5'}
            `} />
          </button>
        </div>

        {state.includeInteractive && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-2">
                Quiz-Fragen (0-10)
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateState({ quizQuestions: Math.max(0, state.quizQuestions - 1) })}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                             font-bold text-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  -
                </button>
                <span className="text-2xl font-bold text-teal-600 dark:text-teal-400 w-8 text-center">
                  {state.quizQuestions}
                </span>
                <button
                  onClick={() => updateState({ quizQuestions: Math.min(10, state.quizQuestions + 1) })}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                             font-bold text-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-2">
                Mitmach-Aktivitäten (0-5)
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateState({ handsOnActivities: Math.max(0, state.handsOnActivities - 1) })}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                             font-bold text-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  -
                </button>
                <span className="text-2xl font-bold text-teal-600 dark:text-teal-400 w-8 text-center">
                  {state.handsOnActivities}
                </span>
                <button
                  onClick={() => updateState({ handsOnActivities: Math.min(5, state.handsOnActivities + 1) })}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                             font-bold text-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step5Summary({ state, onGenerate }: { state: DokuWizardState; onGenerate: () => void }) {
  const perspectiveLabels: Record<string, string> = {
    science: 'Naturwissenschaft',
    history: 'Geschichte',
    technology: 'Technik',
    nature: 'Natur',
    culture: 'Kultur',
  };

  const toneLabels: Record<string, string> = {
    fun: 'Lustig',
    neutral: 'Sachlich',
    curious: 'Neugierig',
  };

  const depthLabels: Record<string, string> = {
    basic: 'Grundlagen',
    standard: 'Standard',
    deep: 'Tief',
  };

  const lengthLabels: Record<string, string> = {
    short: 'Kurz (3 Abschnitte)',
    medium: 'Mittel (5 Abschnitte)',
    long: 'Lang (7 Abschnitte)',
  };

  const items = [
    { icon: '🎯', label: 'Thema', value: state.topic },
    { icon: '👤', label: 'Altersgruppe', value: state.ageGroup + ' Jahre' },
    { icon: '📊', label: 'Tiefe', value: depthLabels[state.depth] },
    { icon: '🔬', label: 'Perspektive', value: perspectiveLabels[state.perspective] },
    { icon: '🎨', label: 'Tonalität', value: toneLabels[state.tone] },
    { icon: '📏', label: 'Länge', value: lengthLabels[state.length] },
    { icon: '🧩', label: 'Interaktiv', value: state.includeInteractive ? `${state.quizQuestions} Quiz + ${state.handsOnActivities} Aktivitäten` : 'Ohne' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Deine Wissensdoku
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Überprüfe deine Einstellungen
        </p>
      </div>

      <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20
                      rounded-2xl p-6 border border-teal-200 dark:border-teal-800">
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3 py-2 border-b border-teal-100 dark:border-teal-800 last:border-0">
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-28">{item.label}</span>
              <span className="text-sm font-bold text-gray-800 dark:text-white flex-1">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center pt-2">
        <button
          onClick={onGenerate}
          className="
            inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-xl
            bg-gradient-to-r from-teal-500 to-cyan-600 text-white
            hover:from-teal-600 hover:to-cyan-700 active:scale-95
            shadow-2xl transform transition-all duration-200
          "
        >
          <Sparkles size={24} />
          Doku erstellen
        </button>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

const STEPS = ['Thema', 'Alter & Tiefe', 'Perspektive', 'Inhalt', 'Zusammenfassung'];

export default function ModernDokuWizard() {
  const navigate = useNavigate();
  const backend = useBackend();
  const { userId } = useAuth();
  const { user } = useUser();
  const { i18n } = useTranslation();

  const [activeStep, setActiveStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<'text' | 'cover' | 'sections' | 'personality' | 'complete'>('text');
  const [userLanguage, setUserLanguage] = useState<string>('de');

  useEffect(() => {
    if (i18n.language) {
      setUserLanguage(i18n.language);
    }
  }, [i18n.language]);

  // Load user preferred language
  useEffect(() => {
    const loadLang = async () => {
      try {
        const profile = await backend.user.me();
        if (profile.preferredLanguage) setUserLanguage(profile.preferredLanguage);
      } catch { /* fallback to i18n */ }
    };
    if (backend && user) loadLang();
  }, [backend, user]);

  const [state, setState] = useState<DokuWizardState>({
    topic: '',
    ageGroup: '6-8',
    depth: 'standard',
    perspective: 'science',
    tone: 'curious',
    length: 'medium',
    includeInteractive: true,
    quizQuestions: 3,
    handsOnActivities: 1,
  });

  const updateState = (updates: Partial<DokuWizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep(prev => prev - 1);
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0: return state.topic.trim().length >= 3;
      case 1: return true; // Always have defaults
      case 2: return true;
      case 3: return true;
      case 4: return true; // Summary
      default: return false;
    }
  };

  const handleGenerate = async () => {
    if (!userId) return;
    if (!state.topic.trim()) return;

    try {
      setGenerating(true);
      setGenerationPhase('text');

      const config = {
        topic: state.topic.trim(),
        ageGroup: state.ageGroup,
        depth: state.depth,
        perspective: state.perspective,
        tone: state.tone,
        length: state.length,
        includeInteractive: state.includeInteractive,
        quizQuestions: state.includeInteractive ? state.quizQuestions : 0,
        handsOnActivities: state.includeInteractive ? state.handsOnActivities : 0,
        language: userLanguage as 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl',
      };

      // Start a timer to cycle through phases for UX
      const phaseTimer = setInterval(() => {
        setGenerationPhase(prev => {
          if (prev === 'text') return 'cover';
          if (prev === 'cover') return 'sections';
          if (prev === 'sections') return 'personality';
          return prev;
        });
      }, 4000);

      const created = await backend.doku.generateDoku({ userId, config });

      clearInterval(phaseTimer);
      setGenerationPhase('complete');
      await new Promise(r => setTimeout(r, 800));

      navigate(`/doku-reader/${created.id}`);
    } catch (error) {
      console.error('[DokuWizard] Error generating doku:', error);
      let message = 'Doku konnte nicht erstellt werden. Bitte versuche es erneut.';
      if (error instanceof Error && error.message.includes('Abo-Limit erreicht')) {
        message = 'Abo-Limit erreicht. Bitte im Profil dein Abo upgraden.';
      }
      alert(message);
    } finally {
      setGenerating(false);
      setGenerationPhase('text');
    }
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0: return <Step1Topic state={state} updateState={updateState} />;
      case 1: return <Step2AgeAndDepth state={state} updateState={updateState} />;
      case 2: return <Step3PerspectiveAndTone state={state} updateState={updateState} />;
      case 3: return <Step4ContentSettings state={state} updateState={updateState} />;
      case 4: return <Step5Summary state={state} onGenerate={handleGenerate} />;
      default: return null;
    }
  };

  // Generation Progress
  if (generating) {
    const phaseConfig = {
      text: { icon: '📝', title: 'Wissen wird zusammengestellt...', desc: 'KI recherchiert und schreibt deine Doku' },
      cover: { icon: '🎨', title: 'Cover-Bild wird gemalt...', desc: 'Axel Scheffler Stil, kindgerecht' },
      sections: { icon: '🖼️', title: 'Kapitel-Bilder werden gemalt...', desc: 'Jeder Abschnitt bekommt eine Illustration' },
      personality: { icon: '🧠', title: 'Wissen wird verteilt...', desc: 'Deine Avatare lernen neue Dinge' },
      complete: { icon: '✅', title: 'Fertig!', desc: 'Deine Wissensdoku ist bereit' },
    };

    const current = phaseConfig[generationPhase];
    const phases = ['text', 'cover', 'sections', 'personality', 'complete'] as const;
    const currentIdx = phases.indexOf(generationPhase);

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4 animate-bounce">{current.icon}</div>
            <h1 className="text-3xl font-bold text-teal-600 dark:text-teal-400 mb-2">{current.title}</h1>
            <p className="text-gray-500 dark:text-gray-400">{current.desc}</p>
          </div>

          {/* Progress Steps */}
          <div className="space-y-3">
            {phases.map((phase, idx) => {
              const conf = phaseConfig[phase];
              const isDone = idx < currentIdx;
              const isCurrent = idx === currentIdx;

              return (
                <div key={phase} className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                  ${isDone ? 'bg-green-50 dark:bg-green-900/20' : ''}
                  ${isCurrent ? 'bg-teal-50 dark:bg-teal-900/20 ring-2 ring-teal-300 dark:ring-teal-700' : ''}
                  ${!isDone && !isCurrent ? 'opacity-40' : ''}
                `}>
                  <span className="text-xl">{conf.icon}</span>
                  <span className={`flex-1 text-sm font-medium ${isDone ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {conf.title}
                  </span>
                  {isDone && <CheckCircle size={18} className="text-green-500" />}
                  {isCurrent && <Loader2 size={18} className="text-teal-500 animate-spin" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <FlaskConical className="w-8 h-8 text-teal-600" />
            <h1 className="text-3xl font-bold text-teal-600 dark:text-teal-400">
              Neue Wissensdoku
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            Schritt {activeStep + 1} von {STEPS.length}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((label, index) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all
                  ${index < activeStep ? 'bg-green-500 text-white' : ''}
                  ${index === activeStep ? 'bg-teal-600 text-white ring-4 ring-teal-200 dark:ring-teal-800' : ''}
                  ${index > activeStep ? 'bg-gray-200 dark:bg-gray-700 text-gray-500' : ''}
                `}>
                  {index < activeStep ? <CheckCircle size={20} /> : index + 1}
                </div>
                <span className={`text-xs mt-2 text-center hidden sm:block ${index === activeStep ? 'font-bold text-teal-600 dark:text-teal-400' : 'text-gray-500'}`}>
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-1 flex-1 mx-2 rounded ${index < activeStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px] mb-8">
          {renderStep()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={activeStep === 0 ? () => navigate('/doku') : handleBack}
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
                       bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                       hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95"
          >
            <ArrowLeft size={20} />
            {activeStep === 0 ? 'Zurück' : 'Zurück'}
          </button>

          {activeStep < STEPS.length - 1 && (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
                ${!canProceed()
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-95 shadow-lg'
                }
              `}
            >
              Weiter
              <ArrowRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

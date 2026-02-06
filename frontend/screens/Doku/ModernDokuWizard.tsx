// Talea Doku Wizard - Immersive, Professional, Child-Friendly
// Redesigned with Talea design system: glass-morphism, gradient accents, framer-motion

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Sparkles, CheckCircle, FlaskConical,
  Loader2, Check, X, Wand2, GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useBackend } from '../../hooks/useBackend';
import { useTranslation } from 'react-i18next';

// =====================================================
// TYPES
// =====================================================
interface DokuWizardState {
  topic: string;
  ageGroup: '3-5' | '6-8' | '9-12' | '13+';
  depth: 'basic' | 'standard' | 'deep';
  perspective: 'science' | 'history' | 'technology' | 'nature' | 'culture';
  tone: 'fun' | 'neutral' | 'curious';
  length: 'short' | 'medium' | 'long';
  includeInteractive: boolean;
  quizQuestions: number;
  handsOnActivities: number;
}

// =====================================================
// ANIMATED BACKGROUND
// =====================================================
const DokuWizardBackground: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <motion.div
      className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20"
      style={{ background: 'radial-gradient(circle, rgba(255,155,92,0.4) 0%, rgba(255,107,157,0.2) 50%, transparent 70%)' }}
      animate={{ scale: [1, 1.15, 1], x: [0, 20, 0] }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full opacity-20"
      style={{ background: 'radial-gradient(circle, rgba(169,137,242,0.3) 0%, transparent 70%)' }}
      animate={{ scale: [1, 1.2, 1], y: [0, -20, 0] }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
    />
    {['🔬', '🌍', '📚', '⭐', '🧪', '🌱'].map((emoji, i) => (
      <motion.div
        key={i}
        className="absolute text-2xl select-none opacity-10"
        style={{ left: `${10 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
        animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0], opacity: [0.05, 0.12, 0.05] }}
        transition={{ duration: 8 + i * 2, delay: i * 0.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        {emoji}
      </motion.div>
    ))}
  </div>
);

// =====================================================
// SELECTION CARD - Reusable animated selection
// =====================================================
const SelectionCard: React.FC<{
  selected: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  desc?: string;
  detail?: string;
  compact?: boolean;
}> = ({ selected, onClick, emoji, label, desc, detail, compact }) => (
  <motion.button
    whileHover={{ scale: 1.03, y: -2 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className={`flex flex-col items-center gap-2 ${compact ? 'p-3' : 'p-4'} rounded-2xl border-2 transition-all text-center ${
      selected
        ? 'border-[#FF9B5C] bg-[#FF9B5C]/10 shadow-lg shadow-[#FF9B5C]/10'
        : 'border-white/[0.08] bg-white/[0.06] backdrop-blur-lg hover:border-[#FF9B5C]/40 hover:shadow-md hover:bg-white/[0.10]'
    }`}
  >
    <span className={compact ? 'text-xl' : 'text-2xl'}>{emoji}</span>
    <span className="font-bold text-sm text-foreground">{label}</span>
    {desc && <span className="text-xs text-muted-foreground">{desc}</span>}
    {detail && <span className="text-[10px] text-muted-foreground/60">{detail}</span>}
    {selected && (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF9B5C] rounded-full flex items-center justify-center shadow-sm"
      >
        <Check className="w-3 h-3 text-white" />
      </motion.div>
    )}
  </motion.button>
);

// =====================================================
// STEP 1 - TOPIC
// =====================================================
function Step1Topic({ state, updateState }: { state: DokuWizardState; updateState: (u: Partial<DokuWizardState>) => void }) {
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
        <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
          Was möchtest du entdecken?
        </h2>
        <p className="text-sm text-muted-foreground">
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
          className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-white/[0.08] bg-white/[0.06] backdrop-blur-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#FF9B5C]/40 focus:border-[#FF9B5C]/40 transition-all shadow-sm"
          style={{ fontFamily: '"Nunito", sans-serif' }}
          autoFocus
        />
        {state.topic && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={() => updateState({ topic: '' })}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      {/* Topic Suggestions */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">Ideen zum Entdecken</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {topicSuggestions.map((s) => (
            <motion.button
              key={s.label}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => updateState({ topic: s.topic })}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border-2 text-left transition-all ${
                state.topic === s.topic
                  ? 'border-[#FF9B5C] bg-[#FF9B5C]/10 shadow-lg shadow-[#FF9B5C]/10'
                  : 'border-white/[0.08] bg-white/[0.06] backdrop-blur-lg hover:border-[#FF9B5C]/40 hover:shadow-md hover:bg-white/[0.10]'
              }`}
            >
              <span className="text-xl flex-shrink-0">{s.emoji}</span>
              <span className="text-sm font-semibold text-foreground">{s.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// STEP 2 - AGE & DEPTH
// =====================================================
function Step2AgeAndDepth({ state, updateState }: { state: DokuWizardState; updateState: (u: Partial<DokuWizardState>) => void }) {
  const ageGroups = [
    { value: '3-5' as const, emoji: '🧒', label: '3-5 Jahre', desc: 'Ganz einfach' },
    { value: '6-8' as const, emoji: '👧', label: '6-8 Jahre', desc: 'Spielerisch' },
    { value: '9-12' as const, emoji: '🧑', label: '9-12 Jahre', desc: 'Tiefere Zusammenhänge' },
    { value: '13+' as const, emoji: '🧑‍🎓', label: '13+ Jahre', desc: 'Komplexe Themen' },
  ];

  const depths = [
    { value: 'basic' as const, emoji: '🌱', label: 'Grundlagen', desc: 'Einfacher Einstieg' },
    { value: 'standard' as const, emoji: '🌿', label: 'Standard', desc: 'Ausgewogene Tiefe' },
    { value: 'deep' as const, emoji: '🌳', label: 'Tief', desc: 'Experten-Wissen' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
          Für wen ist die Doku?
        </h2>
        <p className="text-sm text-muted-foreground">Wähle die passende Altersgruppe</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ageGroups.map((ag) => (
          <SelectionCard
            key={ag.value}
            selected={state.ageGroup === ag.value}
            onClick={() => updateState({ ageGroup: ag.value })}
            emoji={ag.emoji}
            label={ag.label}
            desc={ag.desc}
          />
        ))}
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-3" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
          Wie tief soll es gehen?
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {depths.map((d) => (
            <SelectionCard
              key={d.value}
              selected={state.depth === d.value}
              onClick={() => updateState({ depth: d.value })}
              emoji={d.emoji}
              label={d.label}
              desc={d.desc}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// STEP 3 - PERSPECTIVE & TONE
// =====================================================
function Step3PerspectiveAndTone({ state, updateState }: { state: DokuWizardState; updateState: (u: Partial<DokuWizardState>) => void }) {
  const perspectives = [
    { value: 'science' as const, emoji: '🔬', label: 'Naturwissenschaft', desc: 'Wie funktioniert es?' },
    { value: 'history' as const, emoji: '📜', label: 'Geschichte', desc: 'Wie war es früher?' },
    { value: 'technology' as const, emoji: '⚙️', label: 'Technik', desc: 'Wie wird es gebaut?' },
    { value: 'nature' as const, emoji: '🌿', label: 'Natur', desc: 'Was lebt und wächst?' },
    { value: 'culture' as const, emoji: '🎭', label: 'Kultur', desc: 'Was bedeutet es?' },
  ];

  const tones = [
    { value: 'fun' as const, emoji: '😄', label: 'Lustig', desc: 'Mit Witz und Humor' },
    { value: 'curious' as const, emoji: '🤔', label: 'Neugierig', desc: 'Checker Tobi Style' },
    { value: 'neutral' as const, emoji: '📖', label: 'Sachlich', desc: 'Klar und informativ' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
          Welcher Blickwinkel?
        </h2>
        <p className="text-sm text-muted-foreground">Aus welcher Perspektive soll erzählt werden?</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {perspectives.map((p) => (
          <SelectionCard
            key={p.value}
            selected={state.perspective === p.value}
            onClick={() => updateState({ perspective: p.value })}
            emoji={p.emoji}
            label={p.label}
            desc={p.desc}
            compact
          />
        ))}
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-3" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
          Wie soll es klingen?
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {tones.map((t) => (
            <SelectionCard
              key={t.value}
              selected={state.tone === t.value}
              onClick={() => updateState({ tone: t.value })}
              emoji={t.emoji}
              label={t.label}
              desc={t.desc}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// STEP 4 - CONTENT SETTINGS
// =====================================================
function Step4ContentSettings({ state, updateState }: { state: DokuWizardState; updateState: (u: Partial<DokuWizardState>) => void }) {
  const lengths = [
    { value: 'short' as const, emoji: '📄', label: 'Kurz', desc: '3 Abschnitte', detail: 'Schneller Überblick' },
    { value: 'medium' as const, emoji: '📑', label: 'Mittel', desc: '5 Abschnitte', detail: 'Ausgewogen' },
    { value: 'long' as const, emoji: '📚', label: 'Lang', desc: '7 Abschnitte', detail: 'Ausführliches Wissen' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
          Wie umfangreich?
        </h2>
        <p className="text-sm text-muted-foreground">Wähle die Länge deiner Wissensdoku</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {lengths.map((l) => (
          <SelectionCard
            key={l.value}
            selected={state.length === l.value}
            onClick={() => updateState({ length: l.value })}
            emoji={l.emoji}
            label={l.label}
            desc={l.desc}
            detail={l.detail}
          />
        ))}
      </div>

      {/* Interactive Toggle */}
      <div className="rounded-2xl bg-white/[0.06] backdrop-blur-lg border border-white/[0.08] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              🧩 Interaktive Elemente
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Quiz-Fragen und Mitmach-Aktivitäten</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => updateState({ includeInteractive: !state.includeInteractive })}
            className={`relative w-14 h-7 rounded-full transition-colors shadow-inner ${
              state.includeInteractive ? 'bg-[#FF9B5C]' : 'bg-muted'
            }`}
          >
            <motion.span
              animate={{ x: state.includeInteractive ? 28 : 2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
            />
          </motion.button>
        </div>

        <AnimatePresence>
          {state.includeInteractive && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.08]">
                {/* Quiz Questions */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Quiz-Fragen
                  </label>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateState({ quizQuestions: Math.max(0, state.quizQuestions - 1) })}
                      className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.08] font-bold text-lg text-foreground hover:bg-white/[0.15] transition-colors shadow-sm"
                    >
                      -
                    </motion.button>
                    <span className="text-2xl font-bold text-[#FF9B5C] w-8 text-center">
                      {state.quizQuestions}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateState({ quizQuestions: Math.min(10, state.quizQuestions + 1) })}
                      className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.08] font-bold text-lg text-foreground hover:bg-white/[0.15] transition-colors shadow-sm"
                    >
                      +
                    </motion.button>
                  </div>
                </div>

                {/* Hands-on Activities */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Mitmach-Aktivitäten
                  </label>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateState({ handsOnActivities: Math.max(0, state.handsOnActivities - 1) })}
                      className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.08] font-bold text-lg text-foreground hover:bg-white/[0.15] transition-colors shadow-sm"
                    >
                      -
                    </motion.button>
                    <span className="text-2xl font-bold text-[#FF9B5C] w-8 text-center">
                      {state.handsOnActivities}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateState({ handsOnActivities: Math.min(5, state.handsOnActivities + 1) })}
                      className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.08] font-bold text-lg text-foreground hover:bg-white/[0.15] transition-colors shadow-sm"
                    >
                      +
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// =====================================================
// STEP 5 - SUMMARY
// =====================================================
function Step5Summary({ state, onGenerate }: { state: DokuWizardState; onGenerate: () => void }) {
  const labels: Record<string, Record<string, string>> = {
    perspective: { science: 'Naturwissenschaft', history: 'Geschichte', technology: 'Technik', nature: 'Natur', culture: 'Kultur' },
    tone: { fun: 'Lustig', neutral: 'Sachlich', curious: 'Neugierig' },
    depth: { basic: 'Grundlagen', standard: 'Standard', deep: 'Tief' },
    length: { short: 'Kurz (3)', medium: 'Mittel (5)', long: 'Lang (7)' },
  };

  const items = [
    { icon: '🎯', label: 'Thema', value: state.topic },
    { icon: '👤', label: 'Altersgruppe', value: state.ageGroup + ' Jahre' },
    { icon: '📊', label: 'Tiefe', value: labels.depth[state.depth] },
    { icon: '🔬', label: 'Perspektive', value: labels.perspective[state.perspective] },
    { icon: '🎨', label: 'Tonalität', value: labels.tone[state.tone] },
    { icon: '📏', label: 'Abschnitte', value: labels.length[state.length] },
    { icon: '🧩', label: 'Interaktiv', value: state.includeInteractive ? `${state.quizQuestions} Quiz + ${state.handsOnActivities} Aktivitäten` : 'Ohne' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
          Deine Wissensdoku
        </h2>
        <p className="text-sm text-muted-foreground">Überprüfe deine Einstellungen</p>
      </div>

      <div className="rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] shadow-lg p-6">
        <div className="space-y-3">
          {items.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 py-2.5 border-b border-white/[0.06] last:border-0"
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <span className="text-sm font-medium text-muted-foreground w-28 flex-shrink-0">{item.label}</span>
              <span className="text-sm font-bold text-foreground flex-1">{item.value}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.03, y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={onGenerate}
        className="w-full flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-bold text-lg text-white shadow-xl shadow-[#FF9B5C]/25 hover:shadow-2xl hover:shadow-[#FF9B5C]/35 transition-shadow"
        style={{ background: 'linear-gradient(135deg, #FF9B5C 0%, #FF6B9D 100%)' }}
      >
        <Sparkles className="w-6 h-6" />
        Doku erstellen
      </motion.button>
    </div>
  );
}

// =====================================================
// STEP INDICATOR
// =====================================================
const STEPS = ['Thema', 'Alter & Tiefe', 'Perspektive', 'Inhalt', 'Zusammenfassung'];

const StepIndicator: React.FC<{ activeStep: number }> = ({ activeStep }) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {STEPS.map((label, i) => (
      <React.Fragment key={i}>
        <motion.div className="relative group" whileHover={{ scale: 1.1 }}>
          <motion.div
            animate={{
              width: i === activeStep ? 40 : 32,
              height: 32,
            }}
            className={`rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < activeStep
                ? 'bg-emerald-500 text-white'
                : i === activeStep
                ? 'bg-gradient-to-br from-[#FF9B5C] to-[#FF6B9D] text-white shadow-lg shadow-[#FF9B5C]/25'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i < activeStep ? <Check className="w-4 h-4" /> : i + 1}
          </motion.div>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            {label}
          </div>
        </motion.div>
        {i < STEPS.length - 1 && (
          <div className={`w-6 h-0.5 rounded-full transition-colors ${i < activeStep ? 'bg-emerald-500' : 'bg-muted'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// =====================================================
// GENERATION PROGRESS
// =====================================================
const GenerationProgress: React.FC<{ phase: string }> = ({ phase }) => {
  const phases = [
    { key: 'text', icon: '📝', title: 'Wissen wird zusammengestellt...', desc: 'KI recherchiert und schreibt deine Doku' },
    { key: 'cover', icon: '🎨', title: 'Cover-Bild wird gemalt...', desc: 'Kindgerechte Illustration' },
    { key: 'sections', icon: '🖼️', title: 'Kapitel-Bilder entstehen...', desc: 'Jeder Abschnitt bekommt ein Bild' },
    { key: 'personality', icon: '🧠', title: 'Wissen wird verteilt...', desc: 'Deine Avatare lernen dazu' },
    { key: 'complete', icon: '✅', title: 'Fertig!', desc: 'Deine Wissensdoku ist bereit' },
  ];

  const currentIdx = phases.findIndex(p => p.key === phase);
  const current = phases[currentIdx] || phases[0];

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center"
      >
        {/* Central icon */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #FF9B5C 0%, #FF6B9D 100%)' }}
        >
          <FlaskConical className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
          {current.title}
        </h2>
        <p className="text-sm text-muted-foreground mb-10">{current.desc}</p>

        {/* Progress steps */}
        <div className="space-y-3 text-left">
          {phases.map((p, idx) => {
            const isActive = idx === currentIdx;
            const isComplete = idx < currentIdx;

            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 ${
                  isActive
                    ? 'bg-white/[0.08] backdrop-blur-lg border border-[#FF9B5C]/30 shadow-lg shadow-[#FF9B5C]/10'
                    : isComplete
                    ? 'bg-white/[0.04]'
                    : 'opacity-40'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isComplete
                    ? 'bg-emerald-500 text-white'
                    : isActive
                    ? 'bg-gradient-to-br from-[#FF9B5C] to-[#FF6B9D] text-white'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {isComplete ? (
                    <Check className="w-5 h-5" />
                  ) : isActive ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                      <Loader2 className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <span className="text-base">{p.icon}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? 'text-foreground' : isComplete ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                    {p.title}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-8 w-full h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #FF9B5C, #FF6B9D)' }}
            animate={{ width: `${((currentIdx + 1) / phases.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
};

// =====================================================
// MAIN WIZARD
// =====================================================
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
    if (i18n.language) setUserLanguage(i18n.language);
  }, [i18n.language]);

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
      case 1: return true;
      case 2: return true;
      case 3: return true;
      case 4: return true;
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

  // Generation screen
  if (generating) {
    return (
      <div className="min-h-screen relative pb-28">
        <DokuWizardBackground />
        <div className="relative z-10 pt-6">
          <GenerationProgress phase={generationPhase} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative pb-28">
      <DokuWizardBackground />

      <div className="relative z-10 pt-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-4"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF9B5C] to-[#FF6B9D] flex items-center justify-center shadow-lg shadow-[#FF9B5C]/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              Neue Wissensdoku
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Schritt {activeStep + 1} von {STEPS.length}
          </p>
        </motion.div>

        {/* Step indicator */}
        <StepIndicator activeStep={activeStep} />

        {/* Step content with glass container */}
        <motion.div className="rounded-3xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] shadow-xl p-6 md:p-8 min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-between items-center mt-6"
        >
          <motion.button
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={activeStep === 0 ? () => navigate('/doku') : handleBack}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-foreground bg-white/[0.06] backdrop-blur-lg border border-white/[0.08] hover:bg-white/[0.12] shadow-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </motion.button>

          {activeStep < STEPS.length - 1 && (
            <motion.button
              whileHover={{ x: 2, scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
                !canProceed()
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'text-white shadow-lg shadow-[#FF9B5C]/25 hover:shadow-xl hover:shadow-[#FF9B5C]/35'
              }`}
              style={canProceed() ? { background: 'linear-gradient(135deg, #FF9B5C 0%, #FF6B9D 100%)' } : undefined}
            >
              Weiter
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

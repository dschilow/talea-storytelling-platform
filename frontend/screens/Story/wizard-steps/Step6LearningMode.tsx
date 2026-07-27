import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Globe2,
  Landmark,
  MessageCircle,
  Microscope,
  Plus,
  Puzzle,
  Sigma,
  Sprout,
  TreeDeciduous,
  Trees,
  Users,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

export interface LearningModeValue {
  enabled: boolean;
  subjects: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  learningObjectives: string[];
  assessmentType: 'quiz' | 'interactive' | 'discussion';
}

export const DEFAULT_LEARNING_MODE: LearningModeValue = {
  enabled: false,
  subjects: [],
  difficulty: 'beginner',
  learningObjectives: [],
  assessmentType: 'interactive',
};

interface Props {
  state: { learningMode: LearningModeValue };
  updateState: (updates: any) => void;
}

const SUBJECTS = [
  { id: 'math', icon: Sigma, tone: '#8e7daf' },
  { id: 'science', icon: Microscope, tone: '#7ba89c' },
  { id: 'language', icon: MessageCircle, tone: '#c5828c' },
  { id: 'history', icon: Landmark, tone: '#be8f55' },
  { id: 'geography', icon: Globe2, tone: '#6f8cab' },
  { id: 'social', icon: Users, tone: '#d0885e' },
] as const;

const DIFFICULTIES = [
  { id: 'beginner', icon: Sprout },
  { id: 'intermediate', icon: TreeDeciduous },
  { id: 'advanced', icon: Trees },
] as const;

const ASSESSMENTS = [
  { id: 'interactive', icon: Puzzle },
  { id: 'quiz', icon: Check },
  { id: 'discussion', icon: MessageCircle },
] as const;

const MAX_OBJECTIVES = 3;

export default function Step6LearningMode({ state, updateState }: Props) {
  const { t } = useTranslation();
  const [draftObjective, setDraftObjective] = useState('');
  const learningMode = state.learningMode ?? DEFAULT_LEARNING_MODE;

  const patch = (updates: Partial<LearningModeValue>) =>
    updateState({ learningMode: { ...learningMode, ...updates } });

  const toggleSubject = (id: string) => {
    patch({
      subjects: learningMode.subjects.includes(id)
        ? learningMode.subjects.filter((subject) => subject !== id)
        : [...learningMode.subjects, id],
    });
  };

  const addObjective = () => {
    const value = draftObjective.trim();
    if (!value || learningMode.learningObjectives.length >= MAX_OBJECTIVES) return;
    patch({ learningObjectives: [...learningMode.learningObjectives, value] });
    setDraftObjective('');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="mb-1 text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          {t('wizard.titles.learning')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('wizard.subtitles.learning')}</p>
      </motion.div>

      <button
        type="button"
        onClick={() => patch({ enabled: !learningMode.enabled })}
        aria-pressed={learningMode.enabled}
        className={cn(
          'flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-colors',
          learningMode.enabled ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'
        )}
        style={{ borderColor: learningMode.enabled ? 'var(--primary)' : 'var(--color-border)' }}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">
            {t('wizard.learning.toggleTitle')}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {t('wizard.learning.toggleDescription')}
          </span>
        </span>
        <span
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
            learningMode.enabled ? 'bg-[var(--primary)]' : 'bg-[var(--talea-surface-inset)]'
          )}
        >
          <motion.span
            layout
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            className={cn(
              'inline-block h-5 w-5 rounded-full bg-white shadow-sm',
              learningMode.enabled ? 'ml-6' : 'ml-1'
            )}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {learningMode.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24 }}
            className="space-y-6 overflow-hidden"
          >
            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground/85">
                {t('wizard.learning.subjectsTitle')}
              </h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {SUBJECTS.map((subject) => {
                  const selected = learningMode.subjects.includes(subject.id);
                  const Icon = subject.icon;
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => toggleSubject(subject.id)}
                      aria-pressed={selected}
                      className={cn(
                        'relative rounded-2xl border p-3 text-left transition-colors',
                        selected ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'
                      )}
                      style={{ borderColor: selected ? `${subject.tone}66` : 'var(--color-border)' }}
                    >
                      <span
                        className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ background: `${subject.tone}1f` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: subject.tone }} />
                      </span>
                      <p className="text-sm font-semibold text-foreground">
                        {t(`wizard.learning.subjects.${subject.id}`)}
                      </p>
                      {selected && (
                        <Check className="absolute right-2 top-2 h-4 w-4" style={{ color: subject.tone }} />
                      )}
                    </button>
                  );
                })}
              </div>
              {learningMode.subjects.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{t('wizard.learning.subjectsHint')}</p>
              )}
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground/85">
                {t('wizard.learning.difficultyTitle')}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {DIFFICULTIES.map((option) => {
                  const selected = learningMode.difficulty === option.id;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => patch({ difficulty: option.id })}
                      aria-pressed={selected}
                      className={cn(
                        'rounded-2xl border p-3 text-center transition-colors',
                        selected ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'
                      )}
                      style={{ borderColor: selected ? 'var(--primary)' : 'var(--color-border)' }}
                    >
                      <Icon className="mx-auto mb-2 h-5 w-5 text-[var(--primary)]" />
                      <p className="text-sm font-semibold text-foreground">
                        {t(`wizard.learning.difficulties.${option.id}.title`)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(`wizard.learning.difficulties.${option.id}.description`)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground/85">
                {t('wizard.learning.assessmentTitle')}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {ASSESSMENTS.map((option) => {
                  const selected = learningMode.assessmentType === option.id;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => patch({ assessmentType: option.id })}
                      aria-pressed={selected}
                      className={cn(
                        'rounded-2xl border p-3 text-center transition-colors',
                        selected ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'
                      )}
                      style={{ borderColor: selected ? 'var(--primary)' : 'var(--color-border)' }}
                    >
                      <Icon className="mx-auto mb-2 h-5 w-5 text-[var(--primary)]" />
                      <p className="text-sm font-semibold text-foreground">
                        {t(`wizard.learning.assessments.${option.id}.title`)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(`wizard.learning.assessments.${option.id}.description`)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-1 text-sm font-semibold text-foreground/85">
                {t('wizard.learning.objectivesTitle')}
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">{t('wizard.learning.objectivesHint')}</p>

              {learningMode.learningObjectives.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {learningMode.learningObjectives.map((objective, index) => (
                    <li
                      key={`${objective}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm text-foreground">{objective}</span>
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            learningObjectives: learningMode.learningObjectives.filter((_, i) => i !== index),
                          })
                        }
                        aria-label={t('wizard.learning.removeObjective')}
                        className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {learningMode.learningObjectives.length < MAX_OBJECTIVES && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draftObjective}
                    onChange={(event) => setDraftObjective(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addObjective();
                      }
                    }}
                    maxLength={80}
                    placeholder={t('wizard.learning.objectivePlaceholder')}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-card/70 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-[var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={addObjective}
                    disabled={!draftObjective.trim()}
                    aria-label={t('wizard.learning.addObjective')}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl border border-border bg-card/70 px-3 transition-colors hover:bg-accent/45 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Plus className="h-4 w-4 text-foreground" />
                  </button>
                </div>
              )}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

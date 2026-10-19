import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { StoryWizardIcon } from './StoryWizardIcon';
import { ChoiceTile, SUBJECT_CHOICES, TONE, idleTileClass, selectedTileClass } from './wizardChoices';

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

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
const ASSESSMENTS = ['interactive', 'quiz', 'discussion'] as const;
const MAX_OBJECTIVES = 3;

interface Props {
  value: LearningModeValue;
  onChange: (value: LearningModeValue) => void;
}

/** iOS-style switch drawn inside a row button, so the whole row toggles. */
export function WizardSwitch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors',
        on ? 'bg-[var(--primary)]' : 'bg-[var(--talea-progress-track)]'
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 460, damping: 32 }}
        className={cn('inline-block h-[27px] w-[27px] rounded-full bg-white shadow-sm', on ? 'ml-[22px]' : 'ml-[2px]')}
      />
    </span>
  );
}

/**
 * The child decides "learn something?" and picks a subject by picture. How deep
 * and in which form stay with the parents, folded away behind one row.
 */
export default function LearningModeSection({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [draftObjective, setDraftObjective] = useState('');
  const [showDetails, setShowDetails] = useState(
    () => value.learningObjectives.length > 0 || value.difficulty !== 'beginner' || value.assessmentType !== 'interactive'
  );

  const patch = (updates: Partial<LearningModeValue>) => onChange({ ...value, ...updates });

  const toggleSubject = (id: string) =>
    patch({
      subjects: value.subjects.includes(id) ? value.subjects.filter((subject) => subject !== id) : [...value.subjects, id],
    });

  const addObjective = () => {
    const objective = draftObjective.trim();
    if (!objective || value.learningObjectives.length >= MAX_OBJECTIVES) return;
    patch({ learningObjectives: [...value.learningObjectives, objective] });
    setDraftObjective('');
  };

  const segment = (selected: boolean) =>
    cn(
      'rounded-2xl border px-2 py-2.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]',
      selected ? selectedTileClass : idleTileClass
    );

  return (
    <section className="overflow-hidden rounded-[1.375rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)]">
      <button
        type="button"
        onClick={() => patch({ enabled: !value.enabled })}
        aria-pressed={value.enabled}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]"
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.95rem]"
          style={{ background: `color-mix(in srgb, ${TONE.gold} 14%, transparent)`, color: TONE.gold }}
        >
          <StoryWizardIcon name="backpack" className="h-9 w-9" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold text-[var(--talea-text-primary)]">{t('wizard.extras.learnTitle')}</span>
          <span className="mt-0.5 block text-[13px] text-[var(--talea-text-secondary)]">{t('wizard.extras.learnDescription')}</span>
        </span>
        <WizardSwitch on={value.enabled} />
      </button>

      <AnimatePresence initial={false}>
        {value.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-[var(--talea-border-light)] px-3 pb-4 pt-4 sm:px-4">
              <div>
                <p className="mb-2.5 px-1 text-[14px] font-semibold text-[var(--talea-text-primary)]">{t('wizard.learning.subjectsTitle')}</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {SUBJECT_CHOICES.map((choice) => (
                    <ChoiceTile
                      key={choice.id}
                      compact
                      icon={choice.icon}
                      tone={choice.tone}
                      title={t(`wizard.learning.subjects.${choice.id}`)}
                      selected={value.subjects.includes(choice.id)}
                      onClick={() => toggleSubject(choice.id)}
                    />
                  ))}
                </div>
                {value.subjects.length === 0 && (
                  <p className="mt-2 px-1 text-[13px] text-[var(--talea-text-secondary)]">{t('wizard.learning.subjectsHint')}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowDetails((open) => !open)}
                aria-expanded={showDetails}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1.5 text-left text-[14px] font-semibold text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                {t('wizard.extras.parentSettings')}
                <ChevronDown className={cn('h-4 w-4 transition-transform', showDetails && 'rotate-180')} aria-hidden />
              </button>

              <AnimatePresence initial={false}>
                {showDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div>
                      <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--talea-text-secondary)]">{t('wizard.learning.difficultyTitle')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {DIFFICULTIES.map((id) => (
                          <button key={id} type="button" aria-pressed={value.difficulty === id} onClick={() => patch({ difficulty: id })} className={segment(value.difficulty === id)}>
                            <span className="block text-[14px] font-semibold text-[var(--talea-text-primary)]">{t(`wizard.learning.difficulties.${id}.title`)}</span>
                            <span className="mt-0.5 block text-[12px] text-[var(--talea-text-secondary)]">{t(`wizard.learning.difficulties.${id}.description`)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 px-1 text-[13px] font-semibold text-[var(--talea-text-secondary)]">{t('wizard.learning.assessmentTitle')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {ASSESSMENTS.map((id) => (
                          <button key={id} type="button" aria-pressed={value.assessmentType === id} onClick={() => patch({ assessmentType: id })} className={segment(value.assessmentType === id)}>
                            <span className="block text-[14px] font-semibold text-[var(--talea-text-primary)]">{t(`wizard.learning.assessments.${id}.title`)}</span>
                            <span className="mt-0.5 block text-[12px] text-[var(--talea-text-secondary)]">{t(`wizard.learning.assessments.${id}.description`)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="px-1 text-[13px] font-semibold text-[var(--talea-text-secondary)]">{t('wizard.learning.objectivesTitle')}</p>
                      <p className="mb-2 px-1 text-[12px] text-[var(--talea-text-tertiary)]">{t('wizard.learning.objectivesHint')}</p>
                      {value.learningObjectives.length > 0 && (
                        <ul className="mb-2 space-y-2">
                          {value.learningObjectives.map((objective, index) => (
                            <li
                              key={`${objective}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)]/50 px-3 py-2"
                            >
                              <span className="min-w-0 truncate text-sm text-[var(--talea-text-primary)]">{objective}</span>
                              <button
                                type="button"
                                onClick={() => patch({ learningObjectives: value.learningObjectives.filter((_, i) => i !== index) })}
                                aria-label={t('wizard.learning.removeObjective')}
                                className="shrink-0 rounded-lg p-1 text-[var(--talea-text-secondary)] hover:text-[var(--talea-text-primary)]"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {value.learningObjectives.length < MAX_OBJECTIVES && (
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
                            className="min-w-0 flex-1 rounded-xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] px-3 py-2 text-sm text-[var(--talea-text-primary)] outline-none transition-colors placeholder:text-[var(--talea-text-tertiary)] focus:border-[var(--primary)]"
                          />
                          <button
                            type="button"
                            onClick={addObjective}
                            disabled={!draftObjective.trim()}
                            aria-label={t('wizard.learning.addObjective')}
                            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--talea-border-light)] px-3 transition-colors hover:bg-[var(--talea-surface-inset)] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Plus className="h-4 w-4 text-[var(--talea-text-primary)]" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

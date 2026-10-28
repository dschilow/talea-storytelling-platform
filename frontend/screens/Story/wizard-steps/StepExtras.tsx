import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import ArtifactCompanionPicker, { type BroughtArtifactSelection } from './ArtifactCompanionPicker';
import LearningModeSection, { type LearningModeValue } from './LearningModeSection';
import { ChoiceTile, TONE, WISH_CHOICES, WizardSectionTitle, WizardStepHeading, type WizardWish } from './wizardChoices';

interface Props {
  state: Record<WizardWish, boolean> & {
    selectedAvatars: string[];
    customWish: string;
    broughtArtifact: BroughtArtifactSelection | null;
    learningMode: LearningModeValue;
  };
  updateState: (updates: any) => void;
  /** Wishes that do not apply (a Figurenserie: its figure leads, and its cast is planned). */
  hiddenWishes?: WizardWish[];
}

/**
 * Everything optional on one page, so the main path stays four quick choices:
 * picture wishes, a treasure to take along, learning, and an own wish in words.
 */
export default function StepExtras({ state, updateState, hiddenWishes = [] }: Props) {
  const { t } = useTranslation();
  const wishes = WISH_CHOICES.filter((choice) => !hiddenWishes.includes(choice.id));

  return (
    <div className="space-y-7">
      <WizardStepHeading title={t('wizard.titles.extras')} subtitle={t('wizard.subtitles.extras')} />

      <div className={cn('grid gap-2.5 sm:gap-3', wishes.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
        {wishes.map((choice) => (
          <ChoiceTile
            key={choice.id}
            compact
            icon={choice.icon}
            tone={choice.tone}
            title={t(`wizard.wishes.${choice.id}.title`)}
            description={t(`wizard.wishes.${choice.id}.description`)}
            selected={state[choice.id]}
            onClick={() => updateState({ [choice.id]: !state[choice.id] })}
          />
        ))}
      </div>

      <ArtifactCompanionPicker
        selectedAvatars={state.selectedAvatars}
        broughtArtifact={state.broughtArtifact}
        onSelect={(selection) => updateState({ broughtArtifact: selection })}
      />

      <LearningModeSection value={state.learningMode} onChange={(learningMode) => updateState({ learningMode })} />

      <section aria-labelledby="wizard-own-wish-title">
        <WizardSectionTitle id="wizard-own-wish-title" icon="pencil" tone={TONE.mint} title={t('wizard.extras.ownWishTitle')} />
        <textarea
          value={state.customWish}
          onChange={(event) => updateState({ customWish: event.target.value })}
          placeholder={t('wizard.common.customWishPlaceholder')}
          aria-labelledby="wizard-own-wish-title"
          maxLength={200}
          rows={3}
          className="w-full resize-none rounded-[1.25rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] px-4 py-3 text-[15px] text-[var(--talea-text-primary)] outline-none transition-colors placeholder:text-[var(--talea-text-tertiary)] focus:border-[var(--primary)]"
        />
        {state.customWish.length > 150 && (
          <p className="mt-1 text-right text-xs text-[var(--talea-text-tertiary)]">
            {state.customWish.length}/200 {t('wizard.common.chars')}
          </p>
        )}
      </section>
    </div>
  );
}

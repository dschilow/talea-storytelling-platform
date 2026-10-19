import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  ChoiceTile,
  FEELING_CHOICES,
  LENGTH_CHOICES,
  TONE,
  WizardSectionTitle,
  WizardStepHeading,
  type WizardFeeling,
  type WizardLength,
} from './wizardChoices';

const MAX_FEELINGS = 3;

interface Props {
  state: { length: WizardLength | null; feelings: WizardFeeling[] };
  updateState: (updates: any) => void;
  /** Chapter books choose their size in their own step. */
  hideLength?: boolean;
}

/**
 * Length and mood on one page: two quick picture choices that both describe
 * the story itself. The age is not asked here; it comes from the child profile
 * and can be changed on the last page.
 */
export default function StepStoryShape({ state, updateState, hideLength = false }: Props) {
  const { t } = useTranslation();

  const toggleFeeling = (id: WizardFeeling) => {
    if (state.feelings.includes(id)) {
      updateState({ feelings: state.feelings.filter((item) => item !== id) });
      return;
    }
    if (state.feelings.length >= MAX_FEELINGS) return;
    updateState({ feelings: [...state.feelings, id] });
  };

  return (
    <div className="space-y-7">
      <WizardStepHeading title={t('wizard.titles.shape')} />

      {!hideLength && (
        <section aria-labelledby="wizard-length-title">
          <WizardSectionTitle id="wizard-length-title" icon="books2" tone={TONE.sky} title={t('wizard.shape.lengthTitle')} />
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {LENGTH_CHOICES.map((choice) => (
              <ChoiceTile
                key={choice.id}
                compact
                icon={choice.icon}
                tone={choice.tone}
                title={t(`wizard.lengths.${choice.id}.title`)}
                description={t(`wizard.lengths.${choice.id}.chapters`)}
                selected={state.length === choice.id}
                onClick={() => updateState({ length: choice.id })}
              />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="wizard-feeling-title">
        <WizardSectionTitle
          id="wizard-feeling-title"
          icon="heartFace"
          tone={TONE.rose}
          title={t('wizard.shape.feelingTitle')}
          hint={t('wizard.shape.feelingHint')}
        />
        {/* Wrapping flex keeps the last row of a 3-column phone grid centred. */}
        <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
          {FEELING_CHOICES.map((choice) => {
            const selected = state.feelings.includes(choice.id);
            return (
              <ChoiceTile
                key={choice.id}
                compact
                icon={choice.icon}
                tone={choice.tone}
                title={t(`wizard.feelings.${choice.id}.title`)}
                selected={selected}
                disabled={!selected && state.feelings.length >= MAX_FEELINGS}
                onClick={() => toggleFeeling(choice.id)}
                className="w-[calc((100%-1.25rem)/3)] sm:w-[calc((100%-3rem)/5)]"
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

import React from 'react';
import { useTranslation } from 'react-i18next';

import { CATEGORY_CHOICES, ChoiceTile, WizardStepHeading, categoryKey, type WizardCategory } from './wizardChoices';

interface Props {
  state: { mainCategory: WizardCategory | null };
  updateState: (updates: any) => void;
}

/** Six worlds, all visible at once on a phone: picture, one word, one short line. */
export default function Step2CategorySelection({ state, updateState }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <WizardStepHeading title={t('wizard.titles.category')} subtitle={t('wizard.subtitles.category')} />

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {CATEGORY_CHOICES.map((choice) => (
          <ChoiceTile
            key={choice.id}
            icon={choice.icon}
            tone={choice.tone}
            title={t(`wizard.categories.${categoryKey(choice.id)}.title`)}
            description={t(`wizard.categories.${categoryKey(choice.id)}.description`)}
            selected={state.mainCategory === choice.id}
            onClick={() => updateState({ mainCategory: choice.id })}
          />
        ))}
      </div>
    </div>
  );
}

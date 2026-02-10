import React from "react";
import { useTranslation } from 'react-i18next';
import Card from "../../../components/common/Card";

export type EmotionalFlavorKey =
  | "warmherzigkeit"
  | "lachfreude"
  | "prickeln"
  | "geborgenheit"
  | "uebermut"
  | "staunen"
  | "zusammenhalt";

export interface EmotionalFlavorOption {
  key: EmotionalFlavorKey;
  label: string;
  description: string;
  effect: string;
}

export const EMOTIONAL_FLAVOR_KEYS: EmotionalFlavorKey[] = [
  "warmherzigkeit",
  "lachfreude",
  "prickeln",
  "geborgenheit",
  "uebermut",
  "staunen",
  "zusammenhalt",
];

// Exporting empty/dummy arrays for compatibility if needed by other files, 
// but ideally they should use keys or be refactored too.
export const EMOTIONAL_FLAVOR_OPTIONS: EmotionalFlavorOption[] = [] as any;

export type StoryTempoKey = "cozy" | "balanced" | "fast";

export interface StoryTempoOption {
  key: StoryTempoKey;
  label: string;
  description: string;
}

export const STORY_TEMPO_KEYS: StoryTempoKey[] = ["cozy", "balanced", "fast"];
export const STORY_TEMPO_OPTIONS: StoryTempoOption[] = [] as any;

export type SpecialIngredientKey =
  | "surprise"
  | "mystery"
  | "transformation"
  | "magic"
  | "trial"
  | "aha";

export interface SpecialIngredientOption {
  key: SpecialIngredientKey;
  label: string;
  description: string;
}

export const SPECIAL_INGREDIENT_KEYS: SpecialIngredientKey[] = [
  "surprise",
  "mystery",
  "transformation",
  "magic",
  "trial",
  "aha",
];
export const SPECIAL_INGREDIENT_OPTIONS: SpecialIngredientOption[] = [] as any;


const MAX_FLAVORS = 2;
const MAX_INGREDIENTS = 2;

interface Props {
  emotionalFlavors: EmotionalFlavorKey[];
  storyTempo?: StoryTempoKey;
  specialIngredients: SpecialIngredientKey[];
  customPrompt: string;
  onChange: (update: Partial<Props>) => void;
}

const StoryFlavorStep: React.FC<Props> = ({
  emotionalFlavors,
  storyTempo,
  specialIngredients,
  customPrompt,
  onChange,
}) => {
  const { t } = useTranslation();

  const emotionalFlavorOptions = EMOTIONAL_FLAVOR_KEYS.map(key => ({
    key,
    label: t(`story.wizard.flavor.options.${key}.label`),
    description: t(`story.wizard.flavor.options.${key}.description`),
    effect: t(`story.wizard.flavor.options.${key}.effect`),
  }));

  const storyTempoOptions = STORY_TEMPO_KEYS.map(key => ({
    key,
    label: t(`story.wizard.tempo.options.${key}.label`),
    description: t(`story.wizard.tempo.options.${key}.description`),
  }));

  const specialIngredientOptions = SPECIAL_INGREDIENT_KEYS.map(key => ({
    key,
    label: t(`story.wizard.ingredients.options.${key}.label`),
    description: t(`story.wizard.ingredients.options.${key}.description`),
  }));

  const toggleFlavor = (key: EmotionalFlavorKey) => {
    const isSelected = emotionalFlavors.includes(key);
    if (!isSelected && emotionalFlavors.length >= MAX_FLAVORS) {
      return;
    }
    const next = isSelected
      ? emotionalFlavors.filter((value) => value !== key)
      : [...emotionalFlavors, key];
    onChange({ emotionalFlavors: next });
  };

  const toggleIngredient = (key: SpecialIngredientKey) => {
    const isSelected = specialIngredients.includes(key);
    if (!isSelected && specialIngredients.length >= MAX_INGREDIENTS) {
      return;
    }
    const next = isSelected
      ? specialIngredients.filter((value) => value !== key)
      : [...specialIngredients, key];
    onChange({ specialIngredients: next });
  };

  return (
    <Card variant="elevated">
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{t('story.wizard.flavor.title')}</h3>
          <p className="text-gray-600 text-sm mb-3">{t('story.wizard.flavor.subtitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {emotionalFlavorOptions.map((option) => {
              const isSelected = emotionalFlavors.includes(option.key);
              return (
                <label
                  key={option.key}
                  className={`border rounded-lg p-3 cursor-pointer transition ${isSelected
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 hover:border-amber-400 hover:bg-amber-50/40"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleFlavor(option.key)}
                    className="mr-2"
                  />
                  <div className="inline-block align-top">
                    <div className="text-sm font-semibold text-gray-800">{option.label}</div>
                    <div className="text-xs text-gray-600">{option.description}</div>
                    <div className="text-xs text-gray-500 mt-1">{option.effect}</div>
                  </div>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">{t('story.wizard.flavor.max', { count: MAX_FLAVORS })}</p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800">{t('story.wizard.tempo.title')}</h3>
          <p className="text-gray-600 text-sm mb-3">{t('story.wizard.tempo.subtitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {storyTempoOptions.map((option) => {
              const isSelected = storyTempo === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onChange({ storyTempo: option.key })}
                  className={`border rounded-lg p-3 text-left transition ${isSelected
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 hover:border-amber-400 hover:bg-amber-50/40"
                    }`}
                >
                  <div className="font-semibold text-sm text-gray-800">{option.label}</div>
                  <div className="text-xs text-gray-600">{option.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800">{t('story.wizard.ingredients.title')}</h3>
          <p className="text-gray-600 text-sm mb-3">{t('story.wizard.ingredients.subtitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {specialIngredientOptions.map((option) => {
              const isSelected = specialIngredients.includes(option.key);
              return (
                <label
                  key={option.key}
                  className={`border rounded-lg p-3 cursor-pointer transition ${isSelected
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 hover:border-amber-400 hover:bg-amber-50/40"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleIngredient(option.key)}
                    className="mr-2"
                  />
                  <div className="inline-block align-top">
                    <div className="text-sm font-semibold text-gray-800">{option.label}</div>
                    <div className="text-xs text-gray-600">{option.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">{t('story.wizard.ingredients.max', { count: MAX_INGREDIENTS })}</p>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">{t('story.wizard.customPrompt.label')}</label>
          <textarea
            className="w-full border rounded-lg p-3 min-h-[120px]"
            placeholder={t('story.wizard.customPrompt.placeholder')}
            value={customPrompt}
            onChange={(event) => onChange({ customPrompt: event.target.value })}
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('story.wizard.customPrompt.hint')}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default StoryFlavorStep;


import React from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { STORY_IMAGE_STYLE_OPTIONS, type StoryImageStyleId } from '@/lib/story-image-styles';
import { StoryWizardIcon } from './StoryWizardIcon';
import { idleTileClass, selectedTileClass } from './wizardChoices';

export default function StoryImageStylePicker({ value, onChange }: {
  value: StoryImageStyleId;
  onChange: (style: StoryImageStyleId) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset aria-describedby="wizard-image-style-hint">
      <legend className="mb-1 text-lg font-bold text-[var(--talea-text-primary)]">
        {t('wizard.imageStyles.title')}
      </legend>
      <p id="wizard-image-style-hint" className="mb-4 text-sm text-[var(--talea-text-secondary)]">
        {t('wizard.imageStyles.hint')}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STORY_IMAGE_STYLE_OPTIONS.map(option => {
          const selected = value === option.id;
          return (
            <label key={option.id} className="relative block cursor-pointer">
              <input
                type="radio"
                name="story-image-style"
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                className="peer sr-only"
              />
              <span className={cn(
                'flex h-full min-h-28 overflow-hidden rounded-[1.25rem] border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-[var(--primary)] sm:flex-col',
                selected ? selectedTileClass : idleTileClass,
              )}>
                <span className="relative flex w-32 shrink-0 items-center justify-center overflow-hidden bg-[var(--talea-surface-inset)] sm:aspect-[1216/832] sm:w-full">
                  <StoryWizardIcon name="openBook" className="absolute h-10 w-10 text-[var(--talea-text-secondary)]" />
                  <img
                    src={option.image}
                    alt=""
                    width={1216}
                    height={832}
                    loading="lazy"
                    decoding="async"
                    className="relative h-full w-full object-cover"
                    onError={event => { event.currentTarget.style.visibility = 'hidden'; }}
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center p-3.5">
                  <span className="pr-5 text-sm font-bold leading-snug text-[var(--talea-text-primary)]">
                    {t(`wizard.imageStyles.${option.id}.title`)}
                  </span>
                  <span className="mt-1 text-xs leading-relaxed text-[var(--talea-text-secondary)]">
                    {t(`wizard.imageStyles.${option.id}.description`)}
                  </span>
                </span>
              </span>
              {selected && (
                <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

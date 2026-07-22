import React, { useMemo } from 'react';
import { MessageCircleHeart, Quote, Sparkles, Tag } from 'lucide-react';

import { NARRATIVE_TRAIT_OPTIONS, type AvatarFormData } from '../../types/avatarForm';

interface NarrativeProfileFieldsProps {
  formData: AvatarFormData;
  updateFormData: (updates: Partial<AvatarFormData>) => void;
  compact?: boolean;
}

const MAX_TRAITS = 4;

export function NarrativeProfileFields({
  formData,
  updateFormData,
  compact = false,
}: NarrativeProfileFieldsProps) {
  const selectedTraits = useMemo(
    () => new Set(formData.characterTraits),
    [formData.characterTraits],
  );

  const toggleTrait = (trait: string) => {
    const next = new Set(selectedTraits);
    if (next.has(trait)) {
      next.delete(trait);
    } else if (next.size < MAX_TRAITS) {
      next.add(trait);
    }
    updateFormData({ characterTraits: [...next] });
  };

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      <div className="rounded-2xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/[0.06] p-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2DD4BF]/15 text-[#168d84] dark:text-[#67e8df]">
            <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">So wird die Figur in Geschichten lebendig</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Diese Angaben beschreiben Charakter und Stimme. Sie ver\u00e4ndern nicht das Avatar-Bild.
            </p>
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-foreground/85">Kern der Pers\u00f6nlichkeit</legend>
        <p className="mt-1 text-xs text-muted-foreground">W\u00e4hle den Zug, der diese Figur am st\u00e4rksten pr\u00e4gt.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Kern der Pers\u00f6nlichkeit">
          {NARRATIVE_TRAIT_OPTIONS.map((option) => {
            const selected = formData.dominantPersonality === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => updateFormData({ dominantPersonality: selected ? '' : option.id })}
                className="min-h-11 rounded-xl border px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2DD4BF]/25"
                style={{
                  borderColor: selected ? '#2DD4BF' : 'var(--border)',
                  background: selected ? 'rgba(45,212,191,0.13)' : 'var(--card)',
                  color: selected ? '#137a73' : 'var(--foreground)',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="flex items-center gap-1.5 text-sm font-semibold text-foreground/85">
          <Tag className="h-3.5 w-3.5 text-[#168d84]" aria-hidden="true" />
          Weitere Facetten
        </legend>
        <p className="mt-1 text-xs text-muted-foreground">Bis zu {MAX_TRAITS} Eigenschaften, die im Zusammenspiel sichtbar werden.</p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Weitere Charaktereigenschaften">
          {NARRATIVE_TRAIT_OPTIONS.map((option) => {
            const selected = selectedTraits.has(option.id);
            const disabled = !selected && selectedTraits.size >= MAX_TRAITS;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => toggleTrait(option.id)}
                className="min-h-10 rounded-full border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2DD4BF]/25"
                style={{
                  borderColor: selected ? '#2DD4BF' : 'var(--border)',
                  background: selected ? 'rgba(45,212,191,0.13)' : 'var(--card)',
                  color: selected ? '#137a73' : 'var(--muted-foreground)',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground/85">
            <MessageCircleHeart className="h-3.5 w-3.5 text-[#168d84]" aria-hidden="true" />
            Besonderheit
          </span>
          <span className="block text-xs text-muted-foreground">Eine kleine Eigenart, die man wiedererkennt.</span>
          <textarea
            value={formData.quirk}
            onChange={(event) => updateFormData({ quirk: event.target.value })}
            maxLength={180}
            rows={compact ? 3 : 4}
            placeholder="z. B. sortiert vor einer Antwort drei Dinge nebeneinander."
            className="w-full resize-none rounded-xl border border-border bg-card/70 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/65 focus:border-[#2DD4BF]/50 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground/85">
            <Quote className="h-3.5 w-3.5 text-[#168d84]" aria-hidden="true" />
            Lieblingssatz <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <span className="block text-xs text-muted-foreground">Ein Satz, der h\u00f6chstens einmal pro Geschichte auftaucht.</span>
          <input
            value={formData.catchphrase}
            onChange={(event) => updateFormData({ catchphrase: event.target.value })}
            maxLength={120}
            placeholder="z. B. Ich habe da eine Idee!"
            className="w-full rounded-xl border border-border bg-card/70 px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/65 focus:border-[#2DD4BF]/50 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
          />
        </label>
      </div>

      <details className="rounded-2xl border border-border bg-card/45 px-3.5 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]/30">
          Kleine Vorgeschichte <span className="font-normal text-muted-foreground">(optional)</span>
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Nur ein Detail, das in einer Geschichte wichtig werden k\u00f6nnte.</p>
        <textarea
          value={formData.backstory}
          onChange={(event) => updateFormData({ backstory: event.target.value })}
          maxLength={520}
          rows={3}
          placeholder="z. B. H\u00fctet eine Schachtel mit Fundst\u00fccken aus jedem Abenteuer."
          className="mt-3 w-full resize-none rounded-xl border border-border bg-card/70 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/65 focus:border-[#2DD4BF]/50 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
        />
      </details>
    </div>
  );
}

import React from 'react';
import { UserRound } from 'lucide-react';
import { CharacterTypeSelector } from '../../../components/avatar-form/CharacterTypeSelector';
import { GenderSelector } from '../../../components/avatar-form/GenderSelector';
import type { AvatarFormData } from '../../../types/avatarForm';
import { useTheme } from '../../../contexts/ThemeContext';

interface Step1BasicsProps {
  formData: AvatarFormData;
  updateFormData: (updates: Partial<AvatarFormData>) => void;
  childMode?: boolean;
}

export default function Step1Basics({ formData, updateFormData, childMode = false }: Step1BasicsProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-1 text-2xl font-extrabold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          {childMode ? 'So erscheint das Kind in Geschichten' : 'Wer soll dein Avatar sein?'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {childMode
            ? 'Du gestaltest jetzt den festen Kind-Avatar dieses Kinderprofils.'
            : 'Lege Identität und Rolle fest. Das Aussehen folgt in den nächsten Schritten.'}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="avatar-name" className="text-sm font-semibold text-foreground/80">
          {childMode ? 'Name des Kind-Avatars' : 'Name des Avatars'}
        </label>
        <input
          id="avatar-name"
          type="text"
          value={formData.name}
          readOnly={childMode}
          onChange={(event) => updateFormData({ name: event.target.value })}
          placeholder="Wie soll dein Avatar heißen?"
          className="w-full rounded-xl border border-border bg-card/70 px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground/70 transition-all focus:border-[#2DD4BF]/50 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30 read-only:cursor-not-allowed read-only:bg-muted/55"
        />
        {childMode ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Der Name kommt aus dem Kinderprofil. So bleiben Profil und Kind-Avatar eindeutig verbunden.
          </p>
        ) : null}
      </div>

      {childMode ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-100">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Rolle: Das Kind selbst</p>
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                Ein Kind-Avatar ist immer ein Mensch und gehört exklusiv zu diesem Kinderprofil.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground/80">Was für eine Figur ist es?</label>
          <CharacterTypeSelector
            value={formData.characterType}
            onChange={(characterType) => {
              const updates: Partial<AvatarFormData> = { characterType };
              if (characterType !== 'other') updates.customCharacterType = undefined;
              updateFormData(updates);
            }}
            customValue={formData.customCharacterType}
            onCustomChange={(value) => updateFormData({ customCharacterType: value })}
            darkMode={isDark}
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground/80">Geschlecht</label>
        <GenderSelector
          value={formData.gender}
          onChange={(gender) => updateFormData({ gender })}
          darkMode={isDark}
        />
      </div>
    </div>
  );
}

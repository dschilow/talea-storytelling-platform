import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, PanInfo } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Eye, Wand2 } from 'lucide-react';

import { useTheme } from '../../contexts/ThemeContext';
import {
  AvatarFormData,
  DEFAULT_AVATAR_FORM_DATA,
  CharacterTypeId,
  formDataToDescription,
  getAvatarVisualPromptSignature,
  isAnimalCharacter,
  isHumanCharacter,
} from '../../types/avatarForm';
import { AgeHeightSliders } from './AgeHeightSliders';
import { BodyBuildSelector } from './BodyBuildSelector';
import { CharacterTypeSelector } from './CharacterTypeSelector';
import {
  EyeColorSelector,
  HairColorSelector,
  HairStyleSelector,
  SkinFurColorSelector,
} from './ColorSelector';
import { GenderSelector } from './GenderSelector';
import { ImageUploadCamera } from './ImageUploadCamera';
import { NarrativeProfileFields } from './NarrativeProfileFields';
import { SpecialFeaturesSelector } from './SpecialFeaturesSelector';

interface AvatarFormProps {
  initialData?: Partial<AvatarFormData>;
  onChange?: (data: AvatarFormData) => void;
  onPreview?: (data: AvatarFormData, referenceImageUrl?: string) => void;
  previewUrl?: string;
  isGeneratingPreview?: boolean;
  mode?: 'create' | 'edit';
  compact?: boolean;
  childMode?: boolean;
  lockedName?: string;
  lockedAge?: number;
  onPreviewInvalidated?: () => void;
}

/** One wizard step = one screen the user clicks/swipes through. */
type StepId = 'identity' | 'character' | 'body' | 'appearance' | 'features' | 'reference' | 'notes' | 'preview';

interface StepDef {
  id: StepId;
  title: string;
  subtitle?: string;
  /** Hidden entirely in child mode (identity is locked to human). */
  hiddenInChildMode?: boolean;
}

function enforceChildIdentity(
  data: AvatarFormData,
  childMode: boolean,
  lockedName?: string,
  lockedAge?: number
): AvatarFormData {
  if (!childMode) return data;

  return {
    ...data,
    name: lockedName ?? data.name,
    age: Number.isFinite(lockedAge) ? Number(lockedAge) : data.age,
    characterType: 'human',
    customCharacterType: undefined,
  };
}

export const AvatarForm: React.FC<AvatarFormProps> = ({
  initialData,
  onChange,
  onPreview,
  previewUrl,
  isGeneratingPreview = false,
  compact = false,
  childMode = false,
  lockedName,
  lockedAge,
  onPreviewInvalidated,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [formData, setFormData] = useState<AvatarFormData>(() =>
    enforceChildIdentity(
      { ...DEFAULT_AVATAR_FORM_DATA, ...initialData },
      childMode,
      lockedName,
      lockedAge
    )
  );
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | undefined>();
  const [showDescription, setShowDescription] = useState(false);

  /* ── Wizard steps ─────────────────────────────────────────────
     One screen per step, navigated via Weiter/Zurück or swipe. */
  const allSteps = useMemo<StepDef[]>(
    () => [
      { id: 'identity', title: 'Charaktertyp', subtitle: 'Was für ein Wesen soll dein Avatar sein?', hiddenInChildMode: true },
      { id: 'character', title: 'Charakter & Stimme', subtitle: 'Wie tickt dein Avatar? (optional)' },
      { id: 'body', title: 'Alter & Körper', subtitle: 'Größe, Alter und Statur' },
      { id: 'appearance', title: 'Aussehen', subtitle: 'Haare, Augen und Farben' },
      { id: 'features', title: 'Besondere Merkmale', subtitle: 'Accessoires & Details (optional)' },
      { id: 'reference', title: 'Referenzbild', subtitle: 'Optionales Foto als Vorlage' },
      { id: 'notes', title: 'Zusatzbeschreibung', subtitle: 'Bleibende Details (optional)' },
      { id: 'preview', title: 'Vorschau', subtitle: 'Bild generieren & prüfen' },
    ],
    []
  );

  const steps = useMemo(
    () => allSteps.filter((step) => !(childMode && step.hiddenInChildMode)),
    [allSteps, childMode]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const clampedIndex = Math.min(stepIndex, steps.length - 1);
  const currentStep = steps[clampedIndex];
  const isFirst = clampedIndex === 0;
  const isLast = clampedIndex === steps.length - 1;

  const goToStep = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(next, steps.length - 1));
      setDirection(target >= clampedIndex ? 1 : -1);
      setStepIndex(target);
    },
    [clampedIndex, steps.length]
  );
  const goNext = useCallback(() => goToStep(clampedIndex + 1), [clampedIndex, goToStep]);
  const goBack = useCallback(() => goToStep(clampedIndex - 1), [clampedIndex, goToStep]);

  const handleSwipe = useCallback(
    (_event: unknown, info: PanInfo) => {
      const swipe = info.offset.x;
      const velocity = info.velocity.x;
      // Require a decent horizontal gesture to change step.
      if (swipe < -70 || velocity < -450) {
        if (!isLast) goNext();
      } else if (swipe > 70 || velocity > 450) {
        if (!isFirst) goBack();
      }
    },
    [goBack, goNext, isFirst, isLast]
  );

  const promptSignature = useMemo(
    () => getAvatarVisualPromptSignature(formData, referenceImageUrl),
    [formData, referenceImageUrl]
  );
  const previewSnapshotRef = useRef<{ url?: string; signature?: string }>({});

  useEffect(() => {
    if (!previewUrl) {
      previewSnapshotRef.current = {};
      return;
    }

    if (previewSnapshotRef.current.url !== previewUrl) {
      previewSnapshotRef.current = { url: previewUrl, signature: promptSignature };
      return;
    }

    if (
      previewSnapshotRef.current.signature &&
      previewSnapshotRef.current.signature !== promptSignature
    ) {
      onPreviewInvalidated?.();
    }
  }, [onPreviewInvalidated, previewUrl, promptSignature]);

  useEffect(() => {
    if (initialData) {
      setFormData((previous) =>
        enforceChildIdentity(
          { ...previous, ...initialData },
          childMode,
          lockedName,
          lockedAge
        )
      );
    }
  }, [childMode, initialData, lockedAge, lockedName]);

  const updateFormData = useCallback(
    (updates: Partial<AvatarFormData>) => {
      setFormData((previous) => {
        const next = enforceChildIdentity({ ...previous, ...updates }, childMode, lockedName, lockedAge);
        onChange?.(next);
        return next;
      });
    },
    [childMode, lockedAge, lockedName, onChange]
  );

  const handleCharacterTypeChange = useCallback(
    (characterType: AvatarFormData['characterType']) => {
      const updates: Partial<AvatarFormData> = { characterType };

      if (isHumanCharacter(characterType)) {
        updates.skinTone = 'medium';
      } else if (isAnimalCharacter(characterType)) {
        updates.skinTone = 'brown';
      } else {
        updates.skinTone = 'golden';
      }

      if (characterType !== 'other') {
        updates.customCharacterType = undefined;
      }

      updateFormData(updates);
    },
    [updateFormData]
  );

  const generatedDescription = formDataToDescription(formData);
  const isHuman = isHumanCharacter(formData.characterType as CharacterTypeId);
  const isAnimal = isAnimalCharacter(formData.characterType as CharacterTypeId);

  const renderStep = (stepId: StepId): React.ReactNode => {
    switch (stepId) {
      case 'identity':
        return childMode ? (
          <div className="rounded-xl border px-3.5 py-3 text-sm" style={{ borderColor: isDark ? '#416057' : '#c5d9d0', background: isDark ? 'rgba(82,123,112,0.16)' : '#edf7f2', color: isDark ? '#c6ddd5' : '#45695d' }}>
            <p className="font-semibold">Privater Kind-Avatar</p>
            <p className="mt-1 text-xs leading-relaxed">Dieser Avatar stellt das Kind selbst dar. Deshalb bleibt der Charaktertyp Mensch.</p>
          </div>
        ) : (
          <CharacterTypeSelector value={formData.characterType} onChange={handleCharacterTypeChange} customValue={formData.customCharacterType} onCustomChange={(value) => updateFormData({ customCharacterType: value })} darkMode={isDark} />
        );

      case 'character':
        return <NarrativeProfileFields formData={formData} updateFormData={updateFormData} compact />;

      case 'body':
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: isDark ? '#d8e5f7' : '#2d4158' }}>
                Geschlecht
              </label>
              <GenderSelector value={formData.gender} onChange={(gender) => updateFormData({ gender })} darkMode={isDark} />
            </div>

            <AgeHeightSliders
              age={formData.age}
              height={formData.height}
              characterType={formData.characterType}
              onAgeChange={(age) => updateFormData({ age })}
              onHeightChange={(height) => updateFormData({ height })}
              ageReadOnly={childMode}
              darkMode={isDark}
            />

            {isHuman && (
              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: isDark ? '#d8e5f7' : '#2d4158' }}>
                  Koerperbau
                </label>
                <BodyBuildSelector value={formData.bodyBuild} onChange={(bodyBuild) => updateFormData({ bodyBuild })} darkMode={isDark} />
              </div>
            )}
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-5">
            {!isAnimal && (
              <>
                <HairColorSelector value={formData.hairColor} onChange={(hairColor) => updateFormData({ hairColor })} darkMode={isDark} />
                <HairStyleSelector value={formData.hairStyle} onChange={(hairStyle) => updateFormData({ hairStyle })} darkMode={isDark} />
              </>
            )}

            <EyeColorSelector value={formData.eyeColor} onChange={(eyeColor) => updateFormData({ eyeColor })} darkMode={isDark} />
            <SkinFurColorSelector
              value={formData.skinTone}
              onChange={(skinTone) => updateFormData({ skinTone })}
              characterType={formData.characterType}
              darkMode={isDark}
            />
          </div>
        );

      case 'features':
        return (
          <SpecialFeaturesSelector
            value={formData.specialFeatures}
            onChange={(specialFeatures) => updateFormData({ specialFeatures })}
            darkMode={isDark}
          />
        );

      case 'reference':
        return (
          <ImageUploadCamera
            onImageSelected={(imageDataUrl) => setReferenceImageUrl(imageDataUrl)}
            currentImage={referenceImageUrl}
            onClearImage={() => setReferenceImageUrl(undefined)}
            darkMode={isDark}
          />
        );

      case 'notes':
        return (
          <>
            <p className="mb-2 text-xs" style={{ color: isDark ? '#9db2cc' : '#6d8198' }}>
              Beschreibe nur bleibende sichtbare Details. Sie werden für konsistente Bilder gespeichert.
            </p>
            <textarea
              value={formData.additionalDescription || ''}
              onChange={(event) => updateFormData({ additionalDescription: event.target.value })}
              placeholder="Beispiel: kleine Zahnlücke vorne, roter Schal und ein Muttermal auf der Wange."
              rows={4}
              className="w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus:ring-2"
              style={{
                borderColor: isDark ? '#3a5068' : '#d7c9b8',
                background: isDark ? 'rgba(31,44,61,0.75)' : 'rgba(255,255,255,0.78)',
                color: isDark ? '#e9f0fb' : '#24364b',
                boxShadow: 'none',
              }}
            />
          </>
        );

      case 'preview':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold" style={{ color: isDark ? '#d8e5f7' : '#2d4158' }}>
                Aktuelles Prompt-Preview
              </p>
              <button
                type="button"
                onClick={() => setShowDescription((previous) => !previous)}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  borderColor: isDark ? '#415972' : '#d7c9b8',
                  color: isDark ? '#c4d6ec' : '#6f6258',
                }}
              >
                <Eye className="h-3.5 w-3.5" />
                {showDescription ? 'Ausblenden' : 'Einblenden'}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showDescription && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-xl border p-3 text-xs leading-relaxed"
                  style={{
                    borderColor: isDark ? '#3a5068' : '#d7c9b8',
                    background: isDark ? 'rgba(31,44,61,0.7)' : 'rgba(255,255,255,0.72)',
                    color: isDark ? '#d3e1f4' : '#3a516a',
                  }}
                >
                  {generatedDescription}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col items-center gap-3">
              <div className="w-full max-w-[240px] overflow-hidden rounded-2xl border" style={{ borderColor: isDark ? '#3a5068' : '#d7c9b8' }}>
                {previewUrl ? (
                  <img src={previewUrl} alt="Avatar Vorschau" className="h-48 w-full object-cover" />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center text-sm font-medium" style={{ background: isDark ? 'rgba(31,44,61,0.8)' : '#efe6db', color: isDark ? '#b8cbe2' : '#4f6580' }}>
                    Noch kein Bild
                  </div>
                )}
              </div>

              {onPreview && (
                <button
                  type="button"
                  onClick={() => onPreview(formData, referenceImageUrl)}
                  disabled={isGeneratingPreview || !formData.name.trim()}
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-white disabled:opacity-55"
                  style={{
                    borderColor: 'transparent',
                    background: 'linear-gradient(135deg,var(--primary) 0%,var(--talea-border-light) 56%,var(--talea-border-soft) 100%)',
                    color: '#3a322d',
                  }}
                >
                  {isGeneratingPreview ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent border-t-white border-r-white" />
                      Generiere...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Bild generieren
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Name (always visible above the steps) */}
      <div className="space-y-2">
        <label htmlFor="avatar-name" className="text-sm font-semibold" style={{ color: isDark ? '#d8e5f7' : '#2d4158' }}>
          {childMode ? 'Name aus dem Kinderprofil' : 'Name des Avatars'}
        </label>
        <input
          id="avatar-name"
          readOnly={childMode}
          type="text"
          value={formData.name}
          onChange={(event) => updateFormData({ name: event.target.value })}
          placeholder="Wie soll dein Avatar heissen?"
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus:ring-2 read-only:cursor-not-allowed read-only:opacity-80"
          style={{
            borderColor: isDark ? '#3a5068' : '#d7c9b8',
            background: childMode ? (isDark ? 'rgba(31,61,54,0.55)' : '#edf7f2') : (isDark ? 'rgba(31,44,61,0.75)' : 'rgba(255,255,255,0.78)'),
            color: isDark ? '#e9f0fb' : '#24364b',
            boxShadow: 'none',
          }}
        />
        {childMode && (
          <p className="text-xs leading-relaxed" style={{ color: isDark ? '#9db2cc' : '#6d8198' }}>
            Name und Alter werden im Kinderprofil gepflegt und bleiben hier geschützt.
          </p>
        )}
      </div>

      {/* ── Wizard progress header ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium" style={{ color: isDark ? '#9db2cc' : '#6d8198' }}>
          <span>Schritt {clampedIndex + 1} von {steps.length}</span>
          <span className="truncate">{currentStep?.title}</span>
        </div>
        <div className="flex gap-1.5">
          {steps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              aria-label={step.title}
              onClick={() => goToStep(index)}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{
                background:
                  index < clampedIndex
                    ? 'var(--primary)'
                    : index === clampedIndex
                    ? (isDark ? '#2DD4BF' : 'var(--primary)')
                    : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Current step (swipeable) ── */}
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.section
            key={currentStep?.id}
            custom={direction}
            drag="x"
            dragElastic={0.12}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleSwipe}
            initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border p-4 min-h-[220px] touch-pan-y"
            style={{
              borderColor: isDark ? '#33495f' : 'var(--talea-border-soft)',
              background: isDark ? 'rgba(24,35,50,0.85)' : 'rgba(255,251,245,0.88)',
            }}
          >
            <div className="mb-3">
              <h3 className="text-base font-semibold" style={{ color: isDark ? '#e8f0fb' : '#223347' }}>
                {currentStep?.title}
              </h3>
              {currentStep?.subtitle && (
                <p className="mt-0.5 text-xs" style={{ color: isDark ? '#9db2cc' : '#6d8198' }}>
                  {currentStep.subtitle}
                </p>
              )}
            </div>
            {currentStep && renderStep(currentStep.id)}
          </motion.section>
        </AnimatePresence>
      </div>

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={isFirst}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: isDark ? '#3a5068' : '#d7c9b8',
            color: isDark ? '#c4d6ec' : '#6f6258',
            background: isDark ? 'rgba(31,44,61,0.5)' : 'rgba(255,255,255,0.6)',
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </button>

        <span className="text-[11px]" style={{ color: isDark ? '#7b90a9' : '#9aa7b3' }}>
          Wischen zum Blättern
        </span>

        {isLast ? (
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: isDark ? '#2DD4BF' : 'var(--primary)' }}>
            <Check className="h-4 w-4" />
            Fertig
          </span>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
            style={{ background: isDark ? '#2DD4BF' : 'var(--primary)' }}
          >
            Weiter
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default AvatarForm;


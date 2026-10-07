// AUTO-GENERATED from the web app by scripts/sync-feature-models.mjs.
import {
  AvatarVisualProfileRecord,
  AvatarFormData,
  AvatarFormField,
  AVATAR_NARRATIVE_FORM_FIELDS,
  AVATAR_VISUAL_FORM_FIELDS,
  BODY_BUILDS,
  CHARACTER_TYPES,
  DEFAULT_AVATAR_FORM_DATA,
  EYE_COLORS,
  FUR_COLORS_ANIMAL,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES_HUMAN,
  CharacterTypeId,
  formDataToDescription,
  formDataToNarrativeProfile,
  inferSpecialFeaturesFromVisualProfile,
  mergeVisualProfileForEditor,
  isHumanCharacter,
  isAnimalCharacter,
} from '@/types/avatarForm';
function parseAgeFromText(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const directMatch = text.match(/(\d+)\s*(years?\s*old|years?|jahre?)/i);
  if (directMatch) {
    const age = Number(directMatch[1]);
    if (Number.isFinite(age) && age >= 1 && age <= 150) return age;
  }

  const lower = text.toLowerCase();
  if (lower.includes('baby') || lower.includes('infant')) return 1;
  if (lower.includes('toddler')) return 3;
  if (lower.includes('young child')) return 7;
  if (lower.includes('child')) return 10;
  if (lower.includes('teen')) return 15;
  if (lower.includes('young adult')) return 24;
  if (lower.includes('adult')) return 32;
  if (lower.includes('elderly') || lower.includes('senior')) return 70;

  const anyNumber = text.match(/(\d+)/);
  if (!anyNumber) return undefined;
  const value = Number(anyNumber[1]);
  if (!Number.isFinite(value)) return undefined;
  if (value >= 1 && value <= 150) return value;
  return undefined;
}

function parseHeightFromText(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const cmMatch = text.match(/(\d{2,3})\s*cm/i);
  if (!cmMatch) return undefined;
  const height = Number(cmMatch[1]);
  if (!Number.isFinite(height)) return undefined;
  if (height < 50 || height > 250) return undefined;
  return height;
}
function isInternalVisualDescription(value?: string | null) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  const visualTokens = ['average height', 'human,', 'build,', 'skin,', ' eyes,', ' hair,'];
  return visualTokens.filter((token) => normalized.includes(token)).length >= 3;
}


export function avatarToFormData(avatar: any): Partial<AvatarFormData> {
  const formData: Partial<AvatarFormData> = {
    name: avatar.name || '',
  };

  const visualProfile = avatar.visualProfile;
  const physicalTraits = avatar.physicalTraits || {};
  const appearanceText = [physicalTraits.appearance, avatar.description].filter(Boolean).join(' ');
  const fallbackAge = parseAgeFromText(appearanceText);
  const fallbackHeight = parseHeightFromText(appearanceText);

  if (visualProfile) {
    const characterType = String(
      visualProfile.characterType || physicalTraits.characterType || ''
    ).toLowerCase();
    const matchedType = CHARACTER_TYPES
      .filter((type) => type.id !== 'other')
      .find((type) => characterType.includes(type.id) || characterType.includes(type.labelEn));
    if (matchedType) {
      formData.characterType = matchedType.id;
    } else {
      formData.characterType = characterType ? 'other' : 'human';
      formData.customCharacterType = characterType || undefined;
    }

    const genderValue = String(visualProfile.gender || '').toLowerCase();
    if (genderValue.includes('female')) {
      formData.gender = 'female';
    } else if (genderValue.includes('male')) {
      formData.gender = 'male';
    }

    const explicitAge = Number(visualProfile.ageNumeric);
    const parsedAge = parseAgeFromText(String(visualProfile.ageApprox || ''));
    formData.age =
      Number.isFinite(explicitAge) && explicitAge >= 0 && explicitAge <= 150
        ? explicitAge
        : parsedAge ?? fallbackAge ?? 8;

    const explicitHeight = Number(visualProfile.heightCm);
    formData.height =
      Number.isFinite(explicitHeight) && explicitHeight >= 50 && explicitHeight <= 250
        ? explicitHeight
        : fallbackHeight ?? DEFAULT_AVATAR_FORM_DATA.height;

    const bodyBuildValue = String(visualProfile.bodyBuild || '').toLowerCase();
    const matchedBodyBuild = BODY_BUILDS.find(
      (entry) => bodyBuildValue.includes(entry.id) || bodyBuildValue.includes(entry.labelEn.toLowerCase())
    );
    if (matchedBodyBuild) {
      formData.bodyBuild = matchedBodyBuild.id;
    }

    const hairColor = String(visualProfile.hair?.color || '').toLowerCase();
    const matchedHairColor = HAIR_COLORS.find((entry) => hairColor.includes(entry.labelEn.toLowerCase()));
    formData.hairColor = matchedHairColor?.id || 'brown';

    const hairStyle = String(visualProfile.hair?.style || visualProfile.hair?.length || '').toLowerCase();
    const matchedHairStyle = HAIR_STYLES.find((entry) => hairStyle.includes(entry.labelEn.toLowerCase()));
    formData.hairStyle = matchedHairStyle?.id || 'short';

    const eyeColor = String(visualProfile.eyes?.color || '').toLowerCase();
    const matchedEyeColor = EYE_COLORS.find((entry) => eyeColor.includes(entry.labelEn.toLowerCase()));
    formData.eyeColor = matchedEyeColor?.id || 'brown';

    const skinValue = String(visualProfile.skin?.tone || '').toLowerCase();
    if (isHumanCharacter(formData.characterType as CharacterTypeId)) {
      const matchedSkin = SKIN_TONES_HUMAN.find((entry) => skinValue.includes(entry.labelEn.toLowerCase()));
      formData.skinTone = matchedSkin?.id || 'medium';
    } else {
      const matchedFur = FUR_COLORS_ANIMAL.find((entry) => skinValue.includes(entry.labelEn.toLowerCase()));
      formData.skinTone = matchedFur?.id || 'brown';
    }

    formData.specialFeatures = inferSpecialFeaturesFromVisualProfile(visualProfile);
  }

  if (!visualProfile && avatar.physicalTraits) {
    const characterType = String(physicalTraits.characterType || '').toLowerCase();
    const matchedType = CHARACTER_TYPES.find(
      (type) =>
        characterType.includes(type.id) ||
        characterType.includes(type.labelDe.toLowerCase()) ||
        characterType.includes(type.labelEn.toLowerCase())
    );

    formData.characterType = matchedType?.id || 'human';
    formData.age = fallbackAge ?? 8;
    formData.height = fallbackHeight ?? DEFAULT_AVATAR_FORM_DATA.height;

    const appearanceLower = String(physicalTraits.appearance || '').toLowerCase();
    if (appearanceLower.includes('female') || appearanceLower.includes('weiblich')) {
      formData.gender = 'female';
    } else if (appearanceLower.includes('male') || appearanceLower.includes('maennlich')) {
      formData.gender = 'male';
    }

    const matchedBodyBuild = BODY_BUILDS.find(
      (entry) =>
        appearanceLower.includes(entry.id) || appearanceLower.includes(entry.labelEn.toLowerCase())
    );
    if (matchedBodyBuild) {
      formData.bodyBuild = matchedBodyBuild.id;
    }
  }

  const visualNotes = typeof visualProfile?.additionalNotes === 'string'
    ? visualProfile.additionalNotes.trim()
    : '';
  if (visualNotes) {
    formData.additionalDescription = visualNotes;
  } else if (avatar.description && !isInternalVisualDescription(avatar.description)) {
    formData.additionalDescription = String(avatar.description);
  }

  const narrativeProfile = avatar.narrativeProfile;
  if (narrativeProfile && typeof narrativeProfile === 'object') {
    formData.dominantPersonality = String(narrativeProfile.dominantPersonality || '');
    formData.characterTraits = Array.isArray(narrativeProfile.traits) ? narrativeProfile.traits.map(String) : [];
    formData.quirk = String(narrativeProfile.quirk || '');
    formData.catchphrase = String(narrativeProfile.catchphrase || '');
    formData.backstory = String(narrativeProfile.backstory || '');
  }

  return formData;
}

const EDITABLE_FORM_FIELDS: readonly AvatarFormField[] = [
  'name',
  ...AVATAR_VISUAL_FORM_FIELDS,
  ...AVATAR_NARRATIVE_FORM_FIELDS,
];

export function toCompleteFormData(data: Partial<AvatarFormData>): AvatarFormData {
  return {
    ...DEFAULT_AVATAR_FORM_DATA,
    ...data,
    specialFeatures: Array.isArray(data.specialFeatures)
      ? [...data.specialFeatures]
      : [],
  };
}

function normalizedFormFieldValue(
  formData: AvatarFormData,
  field: AvatarFormField
): unknown {
  const value = formData[field];
  if (field === 'specialFeatures') {
    return [...formData.specialFeatures].sort();
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value ?? null;
}

export function getDirtyFormFields(
  formData: AvatarFormData,
  initialFormData: AvatarFormData | null
): Set<AvatarFormField> {
  if (!initialFormData) return new Set();

  return new Set(
    EDITABLE_FORM_FIELDS.filter((field) =>
      JSON.stringify(normalizedFormFieldValue(formData, field)) !==
      JSON.stringify(normalizedFormFieldValue(initialFormData, field))
    )
  );
}

function uniqueProfileValues(values: unknown[]): unknown[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const signature = typeof value === 'string'
      ? value.trim().toLowerCase()
      : JSON.stringify(value);
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function mergeAnalyzedVisualProfile(
  existingProfile: AvatarVisualProfileRecord | null | undefined,
  analyzedProfile: AvatarVisualProfileRecord | null | undefined
): AvatarVisualProfileRecord {
  const existing = existingProfile && typeof existingProfile === 'object'
    ? existingProfile
    : {};
  const analyzed = analyzedProfile && typeof analyzedProfile === 'object'
    ? analyzedProfile
    : {};

  const result: AvatarVisualProfileRecord = {
    ...existing,
    ...analyzed,
    skin: { ...(existing.skin || {}), ...(analyzed.skin || {}) },
    hair: { ...(existing.hair || {}), ...(analyzed.hair || {}) },
    eyes: { ...(existing.eyes || {}), ...(analyzed.eyes || {}) },
    face: { ...(existing.face || {}), ...(analyzed.face || {}) },
    palette: { ...(existing.palette || {}), ...(analyzed.palette || {}) },
  };

  ['accessories', 'bodyFeatures', 'mustIncludeFeatures', 'forbiddenFeatures', 'consistentDescriptors'].forEach((key) => {
    const existingValues = Array.isArray(existing[key]) ? existing[key] : [];
    const analyzedValues = Array.isArray(analyzed[key]) ? analyzed[key] : [];
    if (existingValues.length > 0 || analyzedValues.length > 0) {
      result[key] = uniqueProfileValues([...existingValues, ...analyzedValues]);
    }
  });
  result.skin.distinctiveFeatures = uniqueProfileValues([
    ...(Array.isArray(existing.skin?.distinctiveFeatures)
      ? existing.skin.distinctiveFeatures
      : []),
    ...(Array.isArray(analyzed.skin?.distinctiveFeatures)
      ? analyzed.skin.distinctiveFeatures
      : []),
  ]);
  result.face.otherFeatures = uniqueProfileValues([
    ...(Array.isArray(existing.face?.otherFeatures) ? existing.face.otherFeatures : []),
    ...(Array.isArray(analyzed.face?.otherFeatures) ? analyzed.face.otherFeatures : []),
  ]);
  result.palette.primary = uniqueProfileValues([
    ...(Array.isArray(existing.palette?.primary) ? existing.palette.primary : []),
    ...(Array.isArray(analyzed.palette?.primary) ? analyzed.palette.primary : []),
  ]);
  result.palette.secondary = uniqueProfileValues([
    ...(Array.isArray(existing.palette?.secondary) ? existing.palette.secondary : []),
    ...(Array.isArray(analyzed.palette?.secondary) ? analyzed.palette.secondary : []),
  ]);

  Object.keys(existing).forEach((key) => {
    if (/(canonical|marker|invariant)/i.test(key)) {
      result[key] = existing[key];
    }
  });

  if (
    existing.clothingCanonical &&
    typeof existing.clothingCanonical === 'object'
  ) {
    result.clothingCanonical = existing.clothingCanonical;
  }

  return result;
}

export function formDataToBackendFormat(
  formData: AvatarFormData,
  isChildAvatar: boolean,
  existingVisualProfile: AvatarVisualProfileRecord | undefined,
  dirtyFields: ReadonlySet<AvatarFormField>
) {
  const characterType = CHARACTER_TYPES.find((entry) => entry.id === formData.characterType);
  const description = formDataToDescription(formData);

  return {
    name: formData.name,
    description: formData.additionalDescription?.trim() || (isChildAvatar
      ? `${formData.name} ist der persönliche Kind-Avatar und erlebt seine eigene Reise.`
      : `${formData.name} begleitet dich in Geschichten und Dokus.`),
    physicalTraits: {
      characterType:
        formData.characterType === 'other' && formData.customCharacterType
          ? formData.customCharacterType
          : characterType?.labelEn || 'human',
      appearance: description,
    },
    visualProfile: mergeVisualProfileForEditor(existingVisualProfile, formData, dirtyFields),
  };
}


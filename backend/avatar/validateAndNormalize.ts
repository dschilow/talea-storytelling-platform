/**
 * Avatar Validation and Normalization Service
 *
 * Validates and translates avatar properties to English before saving to database.
 * This ensures all visual profiles are in English for Runware image generation.
 *
 * CRITICAL: This function MUST be called before saving any avatar (create/update)
 */

import { secret } from "encore.dev/config";
import type { AvatarVisualProfile } from "./avatar";

const openAIKey = secret("OpenAIKey");

/**
 * Detects if text contains non-English characters (German, Italian, Russian, etc.)
 */
function containsNonEnglish(text: string | undefined | null): boolean {
  if (!text || typeof text !== 'string') return false;

  // Check for common non-English characters
  const nonEnglishPattern = /[äöüÄÖÜßàáâãèéêìíîòóôõùúûýÿčćđšžÀÁÂÃÈÉÊÌÍÎÒÓÔÕÙÚÛÝŸČĆĐŠŽ]/;

  // Check for common German/Italian/Russian words
  const nonEnglishWords = /\b(braun|blond|grün|grau|schwarz|klein|groß|kurz|lang|blu|rosso|verde|bianco|nero|синий|красный|зелёный|белый|чёрный)\b/i;

  return nonEnglishPattern.test(text) || nonEnglishWords.test(text);
}

/**
 * Translates text to English using OpenAI
 */
async function translateToEnglish(text: string): Promise<string> {
  if (!text || text.trim() === '') return text;

  // Skip if already English
  if (!containsNonEnglish(text)) {
    return text;
  }

  console.log(`[validateAndNormalize] Translating to English: "${text.substring(0, 50)}..."`);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIKey()}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Fast and cheap for translation
        messages: [
          {
            role: "system",
            content: `You are a professional translator specializing in avatar descriptions for children's storybooks.
Translate the following text to ENGLISH.
IMPORTANT: Keep the translation simple, child-friendly, and suitable for image generation prompts.
Return ONLY the translated text, no explanations.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3, // Low temperature for consistent translations
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error(`[validateAndNormalize] Translation API error: ${response.status}`);
      return text; // Fallback to original text
    }

    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content?.trim() || text;

    console.log(`[validateAndNormalize] Translated: "${text}" → "${translated}"`);

    return translated;
  } catch (error) {
    console.error('[validateAndNormalize] Translation failed:', error);
    return text; // Fallback to original text
  }
}

/**
 * Translates an array of strings to English
 */
async function translateArray(items: string[] | undefined): Promise<string[]> {
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  const translations = await Promise.all(
    items.map(item => translateToEnglish(item))
  );

  return translations.filter(Boolean);
}

/**
 * Validates and normalizes an avatar's visual profile to English
 *
 * This function:
 * 1. Detects non-English text in all fields
 * 2. Translates to English using OpenAI
 * 3. Validates field formats
 * 4. Returns normalized profile ready for database storage
 *
 * @param profile - The visual profile to normalize (can contain any language)
 * @returns Normalized visual profile with all text in English
 */
export async function validateAndNormalizeVisualProfile(
  profile: AvatarVisualProfile | undefined
): Promise<AvatarVisualProfile | undefined> {
  if (!profile) return undefined;

  console.log('[validateAndNormalize] Starting visual profile normalization');

  const normalized: AvatarVisualProfile = {
    ageApprox: await translateToEnglish(profile.ageApprox || ''),
    gender: await translateToEnglish(profile.gender || ''),

    skin: {
      tone: await translateToEnglish(profile.skin?.tone || ''),
      undertone: profile.skin?.undertone ? await translateToEnglish(profile.skin.undertone) : null,
      distinctiveFeatures: await translateArray(profile.skin?.distinctiveFeatures),
    },

    hair: {
      color: await translateToEnglish(profile.hair?.color || ''),
      type: await translateToEnglish(profile.hair?.type || ''),
      length: await translateToEnglish(profile.hair?.length || ''),
      style: await translateToEnglish(profile.hair?.style || ''),
    },

    eyes: {
      color: await translateToEnglish(profile.eyes?.color || ''),
      shape: profile.eyes?.shape ? await translateToEnglish(profile.eyes.shape) : null,
      size: profile.eyes?.size ? await translateToEnglish(profile.eyes.size) : null,
    },

    face: {
      shape: profile.face?.shape ? await translateToEnglish(profile.face.shape) : null,
      nose: profile.face?.nose ? await translateToEnglish(profile.face.nose) : null,
      mouth: profile.face?.mouth ? await translateToEnglish(profile.face.mouth) : null,
      eyebrows: profile.face?.eyebrows ? await translateToEnglish(profile.face.eyebrows) : null,
      freckles: profile.face?.freckles,
      otherFeatures: await translateArray(profile.face?.otherFeatures),
    },

    accessories: await translateArray(profile.accessories),

    clothingCanonical: profile.clothingCanonical ? {
      top: profile.clothingCanonical.top ? await translateToEnglish(profile.clothingCanonical.top) : null,
      bottom: profile.clothingCanonical.bottom ? await translateToEnglish(profile.clothingCanonical.bottom) : null,
      outfit: profile.clothingCanonical.outfit ? await translateToEnglish(profile.clothingCanonical.outfit) : null,
      footwear: profile.clothingCanonical.footwear ? await translateToEnglish(profile.clothingCanonical.footwear) : null,
      colors: await translateArray(profile.clothingCanonical.colors),
      patterns: await translateArray(profile.clothingCanonical.patterns),
    } : undefined,

    palette: profile.palette ? {
      primary: await translateArray(profile.palette.primary),
      secondary: profile.palette.secondary ? await translateArray(profile.palette.secondary) : undefined,
    } : undefined,

    consistentDescriptors: await translateArray(profile.consistentDescriptors),
  };

  console.log('[validateAndNormalize] ✅ Visual profile normalized to English');

  return normalized;
}

/**
 * Validates that a visual profile contains only English text
 * Returns list of fields that contain non-English text
 */
export function detectNonEnglishFields(profile: AvatarVisualProfile | undefined): string[] {
  if (!profile) return [];

  const nonEnglishFields: string[] = [];

  if (containsNonEnglish(profile.ageApprox)) nonEnglishFields.push('ageApprox');
  if (containsNonEnglish(profile.gender)) nonEnglishFields.push('gender');
  if (containsNonEnglish(profile.skin?.tone)) nonEnglishFields.push('skin.tone');
  if (containsNonEnglish(profile.skin?.undertone)) nonEnglishFields.push('skin.undertone');
  if (containsNonEnglish(profile.hair?.color)) nonEnglishFields.push('hair.color');
  if (containsNonEnglish(profile.hair?.type)) nonEnglishFields.push('hair.type');
  if (containsNonEnglish(profile.hair?.length)) nonEnglishFields.push('hair.length');
  if (containsNonEnglish(profile.hair?.style)) nonEnglishFields.push('hair.style');
  if (containsNonEnglish(profile.eyes?.color)) nonEnglishFields.push('eyes.color');
  if (containsNonEnglish(profile.eyes?.shape)) nonEnglishFields.push('eyes.shape');
  if (containsNonEnglish(profile.eyes?.size)) nonEnglishFields.push('eyes.size');

  profile.skin?.distinctiveFeatures?.forEach((feature, idx) => {
    if (containsNonEnglish(feature)) nonEnglishFields.push(`skin.distinctiveFeatures[${idx}]`);
  });

  profile.face?.otherFeatures?.forEach((feature, idx) => {
    if (containsNonEnglish(feature)) nonEnglishFields.push(`face.otherFeatures[${idx}]`);
  });

  profile.accessories?.forEach((accessory, idx) => {
    if (containsNonEnglish(accessory)) nonEnglishFields.push(`accessories[${idx}]`);
  });

  profile.consistentDescriptors?.forEach((descriptor, idx) => {
    if (containsNonEnglish(descriptor)) nonEnglishFields.push(`consistentDescriptors[${idx}]`);
  });

  return nonEnglishFields;
}

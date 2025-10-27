import { secret } from "encore.dev/config";

const openAIKey = secret("OpenAIKey");

/**
 * Translates text from any language to English using OpenAI GPT-5-mini
 * This ensures 100% English output for Runware compatibility
 */
export async function translateToEnglish(text: string): Promise<string> {
  if (!text || text.trim() === "") {
    return "";
  }

  // Quick check: if text is already mostly English, skip translation
  const germanWords = /\b(ist|und|oder|der|die|das|ein|eine|aus|hat|sind|mit|von|für|auf|zu|im|am|über|bei|durch|nach|vor|zwischen|unter|während|seit|bis|gegen|ohne|um|als|wie|wenn|dass|weil|aber|doch|jedoch|also|dann|noch|schon|nur|auch|nicht|mehr|sehr|groß|klein|alt|jung|neu|gut|schlecht|schön|hässlich|schnell|langsam|stark|schwach|hell|dunkel|warm|kalt|Jahr|Jahre|Monat|Monate|Tag|Tage|Stunde|Stunden|Minute|Minuten|Sekunde|Sekunden|Mensch|Menschen|Kind|Kinder|Junge|Mädchen|Mann|Frau|Tier|Tiere|Hund|Katze|Vogel|Fisch|Baum|Blume|Haus|Stadt|Land|Wasser|Feuer|Luft|Erde|Himmel|Sonne|Mond|Stern|Sterne|Farbe|Farben|rot|blau|grün|gelb|orange|lila|rosa|schwarz|weiß|grau|braun|Auge|Augen|Ohr|Ohren|Nase|Mund|Hand|Hände|Fuß|Füße|Kopf|Haar|Haare|Gesicht|Körper|Herz|Seele|Geist)\b/gi;
  const germanMatches = text.match(germanWords);

  if (!germanMatches || germanMatches.length === 0) {
    // Text appears to be already in English
    return text;
  }

  console.log(`[translateToEnglish] Detected ${germanMatches.length} German words, translating...`);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIKey()}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the given text from German (or any other language) to English.

IMPORTANT RULES:
- Translate EVERYTHING to English
- Keep proper names (like "Alexander", "Diego") unchanged
- Preserve numbers and measurements
- Keep the same sentence structure and meaning
- Do NOT add explanations or extra text
- Output ONLY the translated text, nothing else
- For physical descriptions, use simple, clear English words

Examples:
Input: "Alexander ist ein Mensch aus Stadt. Hat grün Augen und braun Haare."
Output: "Alexander is a human from city. Has green eyes and brown hair."

Input: "Diego ist eine orange Katze mit weißem Bauch"
Output: "Diego is an orange cat with white belly"`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[translateToEnglish] OpenAI API error:`, errorText);
      // Fallback: return original text if translation fails
      return text;
    }

    const data = (await response.json()) as any;

    // Debug: Log the full response structure
    console.log(`[translateToEnglish] OpenAI response structure:`, JSON.stringify({
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      firstChoice: data.choices?.[0],
    }, null, 2));

    const translatedText = data.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      console.error(`[translateToEnglish] Empty response from OpenAI`);
      console.error(`[translateToEnglish] Full response:`, JSON.stringify(data, null, 2));
      return text;
    }

    console.log(`[translateToEnglish] Original: "${text.substring(0, 100)}..."`);
    console.log(`[translateToEnglish] Translated: "${translatedText.substring(0, 100)}..."`);

    return translatedText;
  } catch (error) {
    console.error(`[translateToEnglish] Translation error:`, error);
    // Fallback: return original text if translation fails
    return text;
  }
}

/**
 * Translates visual profile fields to English
 */
export async function translateVisualProfile(profile: any): Promise<any> {
  if (!profile) return profile;

  const translated = { ...profile };

  // Translate characterType
  if (translated.characterType) {
    translated.characterType = await translateToEnglish(translated.characterType);
  }

  // Translate skin
  if (translated.skin) {
    translated.skin = {
      ...translated.skin,
      tone: await translateToEnglish(translated.skin.tone || ""),
      undertone: translated.skin.undertone ? await translateToEnglish(translated.skin.undertone) : undefined,
      distinctiveFeatures: await Promise.all(
        (translated.skin.distinctiveFeatures || []).map((f: string) => translateToEnglish(f))
      ),
    };
  }

  // Translate hair
  if (translated.hair) {
    translated.hair = {
      ...translated.hair,
      color: await translateToEnglish(translated.hair.color || ""),
      type: await translateToEnglish(translated.hair.type || ""),
      style: await translateToEnglish(translated.hair.style || ""),
    };
  }

  // Translate eyes
  if (translated.eyes) {
    translated.eyes = {
      ...translated.eyes,
      color: await translateToEnglish(translated.eyes.color || ""),
      shape: await translateToEnglish(translated.eyes.shape || ""),
    };
  }

  // Translate face
  if (translated.face) {
    translated.face = {
      ...translated.face,
      shape: await translateToEnglish(translated.face.shape || ""),
      nose: await translateToEnglish(translated.face.nose || ""),
      mouth: await translateToEnglish(translated.face.mouth || ""),
      eyebrows: translated.face.eyebrows ? await translateToEnglish(translated.face.eyebrows) : undefined,
      otherFeatures: await Promise.all(
        (translated.face.otherFeatures || []).map((f: string) => translateToEnglish(f))
      ),
    };
  }

  // Translate accessories
  if (translated.accessories && translated.accessories.length > 0) {
    translated.accessories = await Promise.all(
      translated.accessories.map((a: string) => translateToEnglish(a))
    );
  }

  // Translate clothing
  if (translated.clothingCanonical) {
    translated.clothingCanonical = {
      ...translated.clothingCanonical,
      top: translated.clothingCanonical.top ? await translateToEnglish(translated.clothingCanonical.top) : undefined,
      bottom: translated.clothingCanonical.bottom ? await translateToEnglish(translated.clothingCanonical.bottom) : undefined,
      outfit: translated.clothingCanonical.outfit ? await translateToEnglish(translated.clothingCanonical.outfit) : undefined,
      colors: await Promise.all(
        (translated.clothingCanonical.colors || []).map((c: string) => translateToEnglish(c))
      ),
      patterns: await Promise.all(
        (translated.clothingCanonical.patterns || []).map((p: string) => translateToEnglish(p))
      ),
    };
  }

  // Translate palette
  if (translated.palette) {
    translated.palette = {
      primary: await Promise.all(
        (translated.palette.primary || []).map((c: string) => translateToEnglish(c))
      ),
      secondary: await Promise.all(
        (translated.palette.secondary || []).map((c: string) => translateToEnglish(c))
      ),
    };
  }

  // Translate consistent descriptors
  if (translated.consistentDescriptors && translated.consistentDescriptors.length > 0) {
    translated.consistentDescriptors = await Promise.all(
      translated.consistentDescriptors.map((d: string) => translateToEnglish(d))
    );
  }

  // Translate age
  if (translated.ageApprox) {
    translated.ageApprox = await translateToEnglish(translated.ageApprox);
  }

  return translated;
}

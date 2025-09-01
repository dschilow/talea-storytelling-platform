import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { StoryConfig, Chapter } from "./generate";
import { ai } from "~encore/clients";

// ---- OpenAI Modell & Pricing (GPT-5-nano) ----
const MODEL = "gpt-5-nano";
const INPUT_COST_PER_1M = 0.05;   // $/1M Input-Token (GPT-5-nano offizieller Preis)
const OUTPUT_COST_PER_1M = 0.40;  // $/1M Output-Token (GPT-5-nano offizieller Preis)

const openAIKey = secret("OpenAIKey");

interface GenerateStoryContentRequest {
  config: StoryConfig;
  avatarDetails: Array<{
    id: string;
    name: string;
    physicalTraits: any;
    personalityTraits: any;
    imageUrl?: string | null;
  }>;
}

interface GenerateStoryContentResponse {
  title: string;
  description: string;
  coverImageUrl: string;
  chapters: Omit<Chapter, "id">[];
  metadata: {
    tokensUsed: {
      prompt: number;
      completion: number;
      reasoning: number;
      total: number;
    };
    model: string;
    processingTime: number;
    imagesGenerated: number;
    totalCost: {
      text: number;
      images: number;
      total: number;
    };
  };
}

// Vielfache-von-64 Hilfsfunktion für Runware
function normalizeRunwareDimensions(width: number, height: number): { width: number; height: number } {
  const roundToMultiple64 = (n: number) => Math.round(n / 64) * 64;
  const normalizedWidth = Math.max(128, Math.min(2048, roundToMultiple64(width)));
  const normalizedHeight = Math.max(128, Math.min(2048, roundToMultiple64(height)));
  return { width: normalizedWidth, height: normalizedHeight };
}

// Deterministischer Seed basierend auf Avatar-IDs, damit Charaktere konsistent aussehen
function deterministicSeedFrom(str: string): number {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193;
  }
  return Math.abs(hash >>> 0);
}

// Erstelle SEHR detaillierte Charakterbeschreibung für konsistente Prompts
function createDetailedCharacterDescription(avatar: any): string {
  const physical = avatar.physicalTraits || {};
  const personality = avatar.personalityTraits || {};
  
  // Alter und Geschlecht
  const age = physical.age || 8;
  const gender = physical.gender === "male" ? "boy" : physical.gender === "female" ? "girl" : "child";
  
  // Physische Merkmale mit sehr spezifischen Beschreibungen
  const hairColor = normalizeHairColor(physical.hairColor || "brown");
  const hairStyle = normalizeHairStyle(physical.hairType || "short");
  const eyeColor = normalizeEyeColor(physical.eyeColor || "brown");
  const skinTone = normalizeSkinTone(physical.skinTone || "light");
  const height = normalizeHeight(physical.height || 130, age);
  const build = normalizeBuild(physical.bodyType || 5);
  
  // Besondere Merkmale
  const specialFeatures = [];
  if (physical.glasses) specialFeatures.push("wearing round glasses");
  if (physical.freckles) specialFeatures.push("with cute freckles across the nose and cheeks");
  if (physical.dimples) specialFeatures.push("with deep dimples when smiling");
  if (physical.gap_teeth) specialFeatures.push("with a charming gap between front teeth");
  if (physical.scar) specialFeatures.push(`with a small scar on ${physical.scar_location || "left cheek"}`);
  
  // Kleidungsstil - sehr spezifisch für Konsistenz
  const clothing = getConsistentClothing(avatar.name, gender, personality);
  
  // Persönlichkeitsmerkmale für Ausdruck und Körpersprache
  const topPersonality = Object.entries(personality)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([trait]) => trait);

  const personalityExpression = getPersonalityExpression(topPersonality);
  
  const description = 
    `${avatar.name} is a ${age}-year-old ${gender} with ${hairStyle} ${hairColor} hair, bright ${eyeColor} eyes, ${skinTone} skin tone, ${height} height, and ${build} build. ` +
    `${avatar.name} is wearing ${clothing}${specialFeatures.length > 0 ? ', ' + specialFeatures.join(', ') : ''}. ` +
    `Character expressions and body language: ${personalityExpression}. ` +
    `IMPORTANT: ${avatar.name} ALWAYS looks exactly the same in every image - same hair, same eyes, same facial features, same clothing style.`;
  
  return description;
}

// Hilfsfunktionen für konsistente Beschreibungen
function normalizeHairColor(color: string): string {
  const colorMap: Record<string, string> = {
    "blond": "golden blonde",
    "blonde": "golden blonde", 
    "braun": "warm chestnut brown",
    "brown": "warm chestnut brown",
    "schwarz": "jet black",
    "black": "jet black",
    "rot": "vibrant auburn red",
    "red": "vibrant auburn red",
    "grau": "silver grey",
    "grey": "silver grey"
  };
  return colorMap[color.toLowerCase()] || color;
}

function normalizeHairStyle(style: string): string {
  const styleMap: Record<string, string> = {
    "short": "short neat",
    "curly": "bouncy curly",
    "wavy": "flowing wavy", 
    "straight": "silky straight",
    "coily": "tightly coiled"
  };
  return styleMap[style.toLowerCase()] || style;
}

function normalizeEyeColor(color: string): string {
  const colorMap: Record<string, string> = {
    "blau": "crystal blue",
    "blue": "crystal blue",
    "grün": "emerald green", 
    "green": "emerald green",
    "braun": "warm brown",
    "brown": "warm brown",
    "grau": "steel grey",
    "grey": "steel grey"
  };
  return colorMap[color.toLowerCase()] || color;
}

function normalizeSkinTone(tone: string): string {
  const toneMap: Record<string, string> = {
    "light": "fair",
    "hell": "fair",
    "medium": "olive",
    "dark": "deep",
    "dunkel": "deep",
    "tan": "sun-kissed",
    "olive": "olive"
  };
  return toneMap[tone.toLowerCase()] || tone;
}

function normalizeHeight(height: number, age: number): string {
  if (age <= 5) return "toddler size";
  if (age <= 8) return "small child size";
  if (age <= 12) return "child size";
  return "young teen size";
}

function normalizeBuild(bodyType: number): string {
  if (bodyType <= 3) return "petite";
  if (bodyType <= 7) return "average";
  return "sturdy";
}

function getConsistentClothing(name: string, gender: string, personality: any): string {
  // Erzeuge konsistente Kleidung basierend auf Charakter
  const styles = [
    "a bright red t-shirt with blue jeans and white sneakers",
    "a purple hoodie with black pants and colorful shoes", 
    "a yellow dress with white tights and brown boots",
    "a green sweater with denim overalls and red shoes",
    "a blue striped shirt with khaki shorts and sandals"
  ];
  
  // Deterministisch basierend auf Namen
  const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return styles[hash % styles.length];
}

function getPersonalityExpression(topTraits: string[]): string {
  const expressions: Record<string, string> = {
    courage: "confident posture with chest out and determined facial expression",
    intelligence: "thoughtful expression with slightly furrowed brow and attentive eyes",
    creativity: "animated gestures and bright, imaginative facial expressions",
    empathy: "kind, caring eyes and gentle, understanding smile",
    strength: "strong stance with squared shoulders and resolute expression",
    humor: "cheerful grin and twinkling eyes, often mid-laugh",
    adventure: "excited expression with wide eyes and ready-for-action posture",
    patience: "calm, serene expression with relaxed posture",
    curiosity: "wide-eyed wonder with head tilted slightly in interest",
    leadership: "authoritative but friendly posture with clear, direct gaze"
  };
  
  return topTraits.map(trait => expressions[trait] || "friendly expression").join(", ");
}

// Erstelle Genre- und Setting-spezifische Umgebungsdetails
function createEnvironmentDescription(config: StoryConfig): string {
  const genreElements: Record<string, string> = {
    adventure: "adventure gear like backpacks, maps, ropes, compasses scattered around, rocky terrain, forest paths, exciting outdoor elements",
    fantasy: "magical sparkles in the air, glowing mystical objects, enchanted forest elements, floating magical items, rainbow lights, crystal formations",
    mystery: "mysterious shadows, detective tools like magnifying glasses, hidden clues, secret passages, dramatic lighting with mystery atmosphere",
    friendship: "warm cozy environments, comfortable furniture, shared games and toys, group activity areas, heartwarming domestic settings",
    learning: "educational elements like books, chalkboards, scientific instruments, discovery tools, bright learning environments, academic materials"
  };
  
  const settingElements: Record<string, string> = {
    forest: "dense magical woodland with towering ancient trees, dappled sunlight filtering through leaves, forest floor covered in moss and wildflowers, woodland creatures",
    city: "vibrant urban landscape with tall colorful buildings, busy streets with interesting shops, city parks with playgrounds, modern architecture mixed with cozy neighborhoods",
    school: "bright cheerful classrooms with colorful decorations, hallways lined with student artwork, playground with swings and slides, library filled with books",
    home: "cozy family house with comfortable furniture, warm kitchen with family photos, garden with flowers and trees, lived-in and welcoming spaces",
    fantasy_world: "otherworldly landscape with floating islands, crystal caves that glow with inner light, rainbow bridges spanning magical chasms, talking animals and mythical creatures",
    beach: "pristine sandy coastline with gentle waves, seashells and starfish scattered on shore, beach umbrellas and sandcastles, seabirds flying overhead",
    mountains: "majestic peaks with snow-capped summits, winding hiking trails, alpine meadows filled with wildflowers, crystal-clear mountain streams"
  };
  
  const genre = genreElements[config.genre] || "adventure elements with exciting discoveries";
  const setting = settingElements[config.setting] || "beautiful natural outdoor environment";
  
  return `${setting}. Additional scene elements: ${genre}`;
}

// Extrahiere Hauptaktion und Emotion aus Kapitelinhalt für bessere Bildprompts
function extractSceneDetails(content: string, chapterTitle: string): { action: string; emotion: string; setting: string } {
  if (!content || content.length < 10) {
    return {
      action: "characters having an adventure together",
      emotion: "excitement and wonder",
      setting: "outdoor adventure scene"
    };
  }

  // Analysiere den Inhalt für Aktionen, Emotionen und Szenen
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Extrahiere Aktionen
  const actionKeywords = [
    "entdecken", "finden", "helfen", "retten", "lernen", "spielen", "bauen", "erkunden", "begegnen", "lösen",
    "discover", "find", "help", "rescue", "learn", "play", "build", "explore", "meet", "solve",
    "laufen", "springen", "klettern", "schwimmen", "fliegen", "verstecken", "suchen", "kämpfen"
  ];
  
  const emotionKeywords = [
    "freude", "aufregung", "angst", "mut", "neugier", "überraschung", "glück", "spannung", "stolz",
    "joy", "excitement", "fear", "courage", "curiosity", "surprise", "happiness", "tension", "pride"
  ];
  
  let action = "characters having an adventure together";
  let emotion = "excitement and wonder";
  let setting = "outdoor scene";
  
  // Finde erste bedeutungsvolle Aktion
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    for (const actionWord of actionKeywords) {
      if (lowerSentence.includes(actionWord)) {
        action = sentence.trim();
        break;
      }
    }
    if (action !== "characters having an adventure together") break;
  }
  
  // Bestimme Emotion basierend auf Kontext
  const contentLower = content.toLowerCase();
  if (contentLower.includes("aufregend") || contentLower.includes("spannend")) emotion = "excitement and anticipation";
  else if (contentLower.includes("glücklich") || contentLower.includes("freude")) emotion = "joy and happiness";
  else if (contentLower.includes("vorsichtig") || contentLower.includes("gefahr")) emotion = "caution and bravery";
  else if (contentLower.includes("überrascht") || contentLower.includes("staun")) emotion = "surprise and wonder";
  else if (contentLower.includes("traurig") || contentLower.includes("sorge")) emotion = "concern and determination";
  
  // Bestimme Setting-Details
  if (contentLower.includes("höhle") || contentLower.includes("cave")) setting = "inside a mysterious cave";
  else if (contentLower.includes("wald") || contentLower.includes("forest")) setting = "deep in the forest";
  else if (contentLower.includes("wasser") || contentLower.includes("water")) setting = "near a body of water";
  else if (contentLower.includes("berg") || contentLower.includes("mountain")) setting = "on a mountain";
  else if (contentLower.includes("haus") || contentLower.includes("home")) setting = "at home";
  
  return { action, emotion, setting };
}

export const generateStoryContent = api<GenerateStoryContentRequest, GenerateStoryContentResponse>(
  { expose: true, method: "POST", path: "/ai/generate-story" },
  async (req) => {
    const startTime = Date.now();
    const metadata: GenerateStoryContentResponse["metadata"] = {
      tokensUsed: { prompt: 0, completion: 0, reasoning: 0, total: 0 },
      model: MODEL,
      processingTime: 0,
      imagesGenerated: 0,
      totalCost: { text: 0, images: 0, total: 0 },
    };

    try {
      console.log("📚 Generating story with config:", JSON.stringify(req.config, null, 2));

      const storyContent = await generateStoryWithOpenAI(req.config, req.avatarDetails);
      console.log("✅ Generated story content:", storyContent.title);

      metadata.tokensUsed = storyContent.tokensUsed ?? { prompt: 0, completion: 0, reasoning: 0, total: 0 };
      
      // GPT-5-nano Kostenberechnung (berücksichtigt reasoning_tokens)
      const outputTokens = metadata.tokensUsed.completion + metadata.tokensUsed.reasoning;
      metadata.totalCost.text =
        (metadata.tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;

      console.log("🖼️ Generating high-quality images with detailed character descriptions");

      // Gemeinsamer Seed für die Geschichte (konsistente Charaktere)
      const seedBase = deterministicSeedFrom(req.avatarDetails.map(a => a.id).join("|"));

      // SEHR detaillierte Charakterbeschreibungen erstellen
      const characterDescriptions = req.avatarDetails
        .map(avatar => createDetailedCharacterDescription(avatar))
        .join("\n\n");

      // Umgebungsbeschreibung basierend auf Genre und Setting
      const environmentDescription = createEnvironmentDescription(req.config);

      // Dimensionen für Cover und Kapitel
      const coverDimensions = normalizeRunwareDimensions(600, 800);
      const chapterDimensions = normalizeRunwareDimensions(512, 512);
      
      // PROFESSIONAL COVER PROMPT - wie echte Kinderbücher
      const coverPrompt = 
        `Professional children's book cover illustration in the style of modern picture books like "Where the Wild Things Are" or "The Very Hungry Caterpillar". 

STORY TITLE: "${storyContent.title}"
STORY GENRE: ${req.config.genre}
TARGET AGE: ${req.config.ageGroup} years old

MAIN CHARACTERS (must appear exactly as described):
${characterDescriptions}

COVER SCENE: The main characters are prominently featured in the foreground, positioned to show their personalities and relationships. They should be looking directly at the viewer or engaged in the story's main theme. The background showcases the primary story setting: ${environmentDescription}.

ART STYLE REQUIREMENTS:
- Professional children's book illustration quality
- Warm, inviting colors that appeal to children and parents
- Clear, expressive character faces with distinct personalities
- Detailed but not overwhelming background
- Consistent character designs that match the descriptions exactly
- Similar to award-winning picture books by artists like Maurice Sendak, Eric Carle, or Oliver Jeffers
- Digital painting style with soft textures and appealing color palette
- Child-friendly and emotionally engaging composition

TECHNICAL SPECS:
- High resolution, print-quality artwork
- Balanced composition with clear focal points
- Perfect for book cover layout with space for title text
- Professional children's publishing standard`;

      console.log("🎨 Generating cover image...");
      
      // Cover-Bild einzeln generieren
      const coverResponse = await ai.generateImage({
        prompt: coverPrompt,
        model: "runware:101@1",
        width: coverDimensions.width,
        height: coverDimensions.height,
        steps: 35,
        CFGScale: 9.0,
        seed: seedBase,
        outputFormat: "PNG",
        negativePrompt: "realistic photography, live action, adult content, scary, dark, horror, violence, weapons, inappropriate content, text overlays, copyright symbols, watermarks, signatures, low quality, blurry, distorted faces, inconsistent character appearance, anime style, cartoon style that's not picture book appropriate"
      });

      console.log("📚 Generating chapter images individually...");
      
      // Kapitel-Bilder EINZELN generieren (kein Batch)
      const chapterResponses = [];
      for (let i = 0; i < storyContent.chapters.length; i++) {
        const chapter = storyContent.chapters[i];
        console.log(`🎨 Generating chapter ${i + 1}/${storyContent.chapters.length}: "${chapter.title}"`);
        
        // Extrahiere Szenendetails für bessere Prompts
        const sceneDetails = extractSceneDetails(chapter.content, chapter.title);
        
        // PROFESSIONAL CHAPTER ILLUSTRATION PROMPT
        const chapterPrompt = 
          `Professional children's book page illustration for chapter "${chapter.title}" in the style of award-winning picture books.

STORY CONTEXT: This is chapter ${i + 1} of "${storyContent.title}", a ${req.config.genre} story for ${req.config.ageGroup} year olds.

MAIN CHARACTERS (must appear EXACTLY as described):
${characterDescriptions}

SCENE DESCRIPTION: 
- Main action: ${sceneDetails.action}
- Character emotions: ${sceneDetails.emotion}
- Setting: ${sceneDetails.setting}
- Environment: ${environmentDescription}

SPECIFIC CHAPTER CONTENT TO ILLUSTRATE:
${chapter.content.substring(0, 300)}...

ILLUSTRATION REQUIREMENTS:
- Characters must look IDENTICAL to previous descriptions
- Show the specific action or moment from this chapter
- Characters should display the appropriate emotions: ${sceneDetails.emotion}
- Background should support the story without overwhelming the characters
- Professional children's book illustration quality
- Similar to works by Beatrix Potter, Dr. Seuss, or modern Caldecott Medal winners
- Warm, engaging colors appropriate for children
- Clear storytelling through visual composition
- Perfect for a children's book page layout

ART STYLE:
- Digital illustration with soft, appealing textures
- Child-friendly color palette
- Detailed character expressions and body language
- Environmental details that enhance the story
- Professional publishing quality
- Consistent with cover art style`;

        try {
          const chapterResponse = await ai.generateImage({
            prompt: chapterPrompt,
            model: "runware:101@1", 
            width: chapterDimensions.width,
            height: chapterDimensions.height,
            steps: 30,
            CFGScale: 8.5,
            seed: (seedBase + i * 137) >>> 0, // Unterschiedliche Seeds pro Kapitel
            outputFormat: "PNG",
            negativePrompt: "realistic photography, live action, adult content, scary, dark, horror, violence, weapons, inappropriate content, text overlays, watermarks, signatures, low quality, blurry, distorted faces, bad anatomy, inconsistent character appearance, wrong hair color, wrong eye color, different clothing, anime style, manga style"
          });
          
          chapterResponses.push(chapterResponse);
          console.log(`✅ Chapter ${i + 1} image generated successfully`);
        } catch (error) {
          console.error(`❌ Error generating chapter ${i + 1} image:`, error);
          // Fallback für fehlgeschlagene Bilder
          chapterResponses.push({
            imageUrl: generatePlaceholderImage(chapter.title),
            seed: seedBase + i,
            debugInfo: { success: false, errorMessage: "Failed to generate image" }
          });
        }
        
        // Kleine Pause zwischen Generierungen
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const coverImageUrl = coverResponse.imageUrl;
      const chaptersWithImages = storyContent.chapters.map((chapter, index) => ({
        ...chapter,
        imageUrl: chapterResponses[index]?.imageUrl || generatePlaceholderImage(chapter.title)
      }));

      metadata.imagesGenerated = 1 + chapterResponses.length;
      const imageCostPer1 = 0.0008; // Aktualisierter Placeholder cost
      metadata.totalCost.images = metadata.imagesGenerated * imageCostPer1;
      metadata.totalCost.total = metadata.totalCost.text + metadata.totalCost.images;
      metadata.processingTime = Date.now() - startTime;

      console.log("💰 Generation costs:", metadata.totalCost);
      console.log("📊 Tokens used:", metadata.tokensUsed);
      console.log("⏱️ Processing time:", metadata.processingTime, "ms");

      return {
        title: storyContent.title,
        description: storyContent.description,
        coverImageUrl,
        chapters: chaptersWithImages,
        metadata,
      };
    } catch (error) {
      console.error("❌ Error in story generation:", error);
      metadata.processingTime = Date.now() - startTime;

      throw new Error(`Story generation failed: ${error instanceof Error ? error.message : String(error)}. Please try again later.`);
    }
  }
);

async function generateStoryWithOpenAI(
  config: StoryConfig,
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any; imageUrl?: string | null }>
): Promise<{ title: string; description: string; chapters: Omit<Chapter, "id" | "imageUrl">[]; tokensUsed?: any }> {
  const MAX_RETRIES = 3;
  const avatarDescriptions = avatars
    .map((avatar) => `${avatar.name}: ${getAvatarDescription(avatar.physicalTraits, avatar.personalityTraits)}`)
    .join("\n");

  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;

  const systemPrompt = `Du bist ein preisgekrönter Kinderbuchautor im Stil von erfolgreichen Autoren wie Julia Donaldson, Axel Scheffler, oder Maurice Sendak. Du schreibst fesselnde, emotionale und durchdachte Geschichten mit:

1. STARKE CHARAKTERENTWICKLUNG - Jeder Charakter hat klare Motivationen und wächst während der Geschichte
2. SPANNUNGSAUFBAU - Jedes Kapitel endet mit einem kleinen Cliffhanger oder einer neuen Entdeckung  
3. EMOTIONALE TIEFE - Kinder können sich mit den Gefühlen und Herausforderungen der Charaktere identifizieren
4. VISUELLE STORYTELLING - Jede Szene ist lebendig und detailreich beschrieben für perfekte Illustrationen
5. PÄDAGOGISCHER WERT - Subtile Lektionen über Freundschaft, Mut, Problemlösung und Empathie
6. ALTERSGERECHTE SPRACHE - Anspruchsvoll aber verständlich, mit einem natürlichen Erzählfluss

Orientiere dich an erfolgreichen Kinderbüchern wie "Der Grüffelo", "Wo die wilden Kerle wohnen", oder "Die kleine Raupe Nimmersatt".`;

  const userPrompt = `Erstelle eine fesselnde ${config.genre} Geschichte in ${config.setting} für die Altersgruppe ${config.ageGroup}.

STORY PARAMETER:
- Länge: ${config.length} (${chapterCount} Kapitel)
- Komplexität: ${config.complexity}
- Genre: ${config.genre}
- Setting: ${config.setting}

HAUPTCHARAKTERE:
${avatarDescriptions}

${config?.learningMode?.enabled ? 
`LERNZIELE (subtil integrieren):
- Fächer: ${config.learningMode.subjects.join(", ")}
- Schwierigkeit: ${config.learningMode.difficulty}
- Lernziele: ${config.learningMode.learningObjectives.join(", ")}` : ""}

WICHTIGE STORY-ANFORDERUNGEN:
1. **EMOTIONALER STORY-BOGEN**: Beginne mit einer relatable Situation, baue Spannung auf, führe zu einem Höhepunkt und löse alles befriedigend auf
2. **CHARAKTER-MOTIVATIONEN**: Jeder Avatar sollte ein klares Ziel oder Problem haben, das die Handlung vorantreibt
3. **KONFLIKTE UND LÖSUNGEN**: Realistische Herausforderungen, die Kinder verstehen können, mit kreativen Lösungsansätzen
4. **VISUELLE SZENEN**: Jedes Kapitel muss eine klare, bildreiche Szene enthalten, die perfekt illustriert werden kann
5. **SPANNUNGSAUFBAU**: Jedes Kapitel sollte neugierig auf das nächste machen
6. **EMOTIONALE VERBINDUNG**: Kinder sollen mit den Charakteren mitfühlen und sich in sie hineinversetzen können
7. **DETAILREICHE BESCHREIBUNGEN**: Konkrete Handlungen, Schauplätze, Gegenstände und Emotionen beschreiben
8. **ALTERSGERECHTE SPRACHE**: Anspruchsvoll aber verständlich, mit lebendigen Verben und aussagekräftigen Adjektiven

KAPITEL-LÄNGE: Jedes Kapitel sollte zwischen 400-1200 Zeichen haben (abhängig von Komplexität)

Antworte NUR mit einem gültigen JSON-Objekt in folgendem Format:
{
  "title": "Fesselnder Titel der Geschichte",
  "description": "Packende Kurzbeschreibung die Lust aufs Lesen macht (50-200 Zeichen)",
  "chapters": [
    {
      "title": "Kapitel Titel der neugierig macht",
      "content": "Detaillierter, emotionaler Kapitel Inhalt mit konkreten visuellen Szenen, Charakterentwicklung und Spannungsaufbau (400-1200 Zeichen)",
      "order": 0
    }
  ]
}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${MAX_RETRIES}: Calling OpenAI API...`);
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAIKey()}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_completion_tokens: 4000,
          response_format: { type: "json_object" },
          reasoning_effort: "medium",
          verbosity: "high"
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API Fehler (Attempt ${attempt}):`, errorText);
        throw new Error(`OpenAI API Fehler: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error("Leere Antwort von OpenAI erhalten.");
      }

      let parsed;
      try {
        const cleanContent = content.replace(/```json\s*|\s*```/g, "").trim();
        parsed = JSON.parse(cleanContent);
      } catch (e) {
        console.error(`JSON Parse Fehler (Attempt ${attempt}):`, e);
        console.error("Raw content:", content);
        throw new Error(`JSON Parse Fehler: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Success!
      console.log(`Successfully generated story on attempt ${attempt}.`);
      return {
        ...parsed,
        tokensUsed: {
          prompt: data.usage?.prompt_tokens ?? 0,
          completion: data.usage?.completion_tokens ?? 0,
          reasoning: data.usage?.reasoning_tokens ?? 0,
          total: data.usage?.total_tokens ?? 0,
        }
      };
    } catch (error) {
      console.error(`Fehler bei Versuch ${attempt}/${MAX_RETRIES}:`, error);
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.log(`Warte ${delay}ms vor dem nächsten Versuch...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error("Konnte die Geschichte nach mehreren Versuchen nicht generieren.");
}

function getAvatarDescription(physical: any, personality: any): string {
  const age = physical?.age ?? "8";
  const gender =
    physical?.gender === "male" ? "Junge" : physical?.gender === "female" ? "Mädchen" : "Kind";
  const topTraits = Object.entries(personality ?? {})
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([trait]) => {
      switch (trait) {
        case "courage": return "mutig";
        case "intelligence": return "klug";
        case "creativity": return "kreativ";
        case "empathy": return "einfühlsam";
        case "strength": return "stark";
        case "humor": return "lustig";
        case "adventure": return "abenteuerlustig";
        case "patience": return "geduldig";
        case "curiosity": return "neugierig";
        case "leadership": return "führungsstark";
        default: return trait;
      }
    })
    .join(", ");
  return `${age} Jahre alter ${gender}, besonders ${topTraits}. Physische Merkmale: ${physical?.hairColor || 'braune'} Haare, ${physical?.eyeColor || 'braune'} Augen, ${physical?.skinTone || 'helle'} Haut.`;
}

function generatePlaceholderImage(prompt: string): string {
  const colors = ["#FF6B9D", "#4ECDC4", "#FFD93D", "#9F7AEA", "#48BB78", "#ED8936"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color}80;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#grad)"/>
      <text x="256" y="240" text-anchor="middle" font-family="Arial" font-size="24" fill="white" font-weight="bold">Avatales</text>
      <text x="256" y="280" text-anchor="middle" font-family="Arial" font-size="16" fill="white" opacity="0.9">Bild wird generiert...</text>
      <text x="256" y="320" text-anchor="middle" font-family="Arial" font-size="12" fill="white" opacity="0.7">${escapeXML(prompt).slice(0, 40)}</text>
    </svg>
  `;
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

function escapeXML(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

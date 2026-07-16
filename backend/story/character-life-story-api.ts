import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { storyDB } from "./db";
import { generateStoryDevMode, type DevModeAvatar } from "./dev-mode-generation";
import type { AIModel, AIProvider, Story, StoryConfig } from "./generate";

type LifeStoryStatus = "generating" | "draft" | "published" | "error";
type LifeStoryAgeGroup = "3-5" | "6-8" | "9-12" | "13+";

interface CharacterLifeStoryChapter {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  imagePrompt?: string;
  order: number;
}

export interface CharacterLifeStory {
  id: string;
  characterId: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  status: LifeStoryStatus;
  ageGroup: LifeStoryAgeGroup;
  targetWords: number;
  wordCount: number;
  version: number;
  generationMetadata?: Record<string, unknown>;
  lastError?: string;
  createdByUserId: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  chapters: CharacterLifeStoryChapter[];
}

interface LifeStoryRow {
  id: string;
  character_id: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  status: LifeStoryStatus;
  age_group: LifeStoryAgeGroup;
  target_words: number;
  word_count: number;
  version: number;
  generation_metadata: unknown;
  last_error: string | null;
  created_by_user_id: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface CharacterRow {
  id: string;
  name: string;
  role: string;
  archetype: string;
  emotional_nature: unknown;
  visual_profile: unknown;
  image_url: string | null;
  canon_settings: string[] | null;
  personality_keywords: string[] | null;
  physical_description: string | null;
  backstory: string | null;
  dominant_personality: string | null;
  secondary_traits: string[] | null;
  catchphrase: string | null;
  catchphrase_context: string | null;
  speech_style: string[] | null;
  emotional_triggers: string[] | null;
  quirk: string | null;
}

interface GetCharacterLifeStoryRequest {
  characterId: string;
}

interface GetCharacterLifeStoryResponse {
  story?: CharacterLifeStory;
}
export interface PublishedCharacterLifeStorySummary {
  id: string;
  characterId: string;
  characterName: string;
  characterRole: string;
  characterArchetype: string;
  characterImageUrl?: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  wordCount: number;
  chapterCount: number;
}

interface GenerateCharacterLifeStoryRequest {
  characterId: string;
  ageGroup?: LifeStoryAgeGroup;
  aiModel?: AIModel;
  aiProvider?: AIProvider;
  openRouterModel?: string;
}

interface UpdateLifeStoryChapterInput {
  id: string;
  title: string;
  content: string;
}

interface UpdateCharacterLifeStoryRequest {
  characterId: string;
  title?: string;
  description?: string;
  chapters?: UpdateLifeStoryChapterInput[];
}

interface SetCharacterLifeStoryStatusRequest {
  characterId: string;
  status: "draft" | "published";
}

function requireAdmin() {
  const auth = getAuthData();
  if (!auth) throw APIError.unauthenticated("Authentication required");
  if (auth.role !== "admin") throw APIError.permissionDenied("Admin access required");
  return auth;
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function countWords(value: string): number {
  return String(value || "").trim().split(/\s+/u).filter(Boolean).length;
}

async function findCharacter(characterId: string): Promise<CharacterRow> {
  const row = await storyDB.queryRow<CharacterRow>`
    SELECT
      id, name, role, archetype, emotional_nature, visual_profile, image_url,
      canon_settings, personality_keywords, physical_description, backstory,
      dominant_personality, secondary_traits, catchphrase, catchphrase_context,
      speech_style, emotional_triggers, quirk
    FROM character_pool
    WHERE id = ${characterId}
    LIMIT 1
  `;
  if (!row) throw APIError.notFound("Character not found");
  return row;
}

async function findLifeStoryRowByCharacter(characterId: string): Promise<LifeStoryRow | null> {
  return await storyDB.queryRow<LifeStoryRow>`
    SELECT *
    FROM character_life_stories
    WHERE character_id = ${characterId}
    LIMIT 1
  `;
}

async function findLifeStoryRowById(id: string): Promise<LifeStoryRow | null> {
  return await storyDB.queryRow<LifeStoryRow>`
    SELECT *
    FROM character_life_stories
    WHERE id = ${id}
    LIMIT 1
  `;
}

async function mapLifeStory(row: LifeStoryRow): Promise<CharacterLifeStory> {
  const chapterRows = await storyDB.queryAll<{
    id: string;
    title: string;
    content: string;
    image_url: string | null;
    image_prompt: string | null;
    chapter_order: number;
  }>`
    SELECT id, title, content, image_url, image_prompt, chapter_order
    FROM character_life_story_chapters
    WHERE life_story_id = ${row.id}
    ORDER BY chapter_order ASC
  `;

  const chapters = await Promise.all(chapterRows.map(async (chapter) => ({
    id: chapter.id,
    title: chapter.title,
    content: chapter.content,
    imageUrl: (await resolveImageUrlForClient(chapter.image_url || undefined)) || chapter.image_url || undefined,
    imagePrompt: chapter.image_prompt || undefined,
    order: chapter.chapter_order,
  })));

  return {
    id: row.id,
    characterId: row.character_id,
    title: row.title,
    description: row.description,
    coverImageUrl: (await resolveImageUrlForClient(row.cover_image_url || undefined)) || row.cover_image_url || undefined,
    status: row.status,
    ageGroup: row.age_group,
    targetWords: row.target_words,
    wordCount: row.word_count,
    version: row.version,
    generationMetadata: parseJsonObject(row.generation_metadata),
    lastError: row.last_error || undefined,
    createdByUserId: row.created_by_user_id,
    publishedAt: row.published_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    chapters,
  };
}

function isAntagonisticCharacter(character: CharacterRow): boolean {
  const signal = [
    character.role,
    character.archetype,
    character.dominant_personality,
    ...(character.personality_keywords || []),
  ].join(" ").toLowerCase();
  return /(antagon|villain|obstacle|boese|böse|dunkel|grausam|gleichgueltig|gleichgültig)/u.test(signal);
}

function buildCanonicalPrompt(character: CharacterRow, ageGroup: LifeStoryAgeGroup): string {
  const visual = parseJsonObject(character.visual_profile);
  const emotional = parseJsonObject(character.emotional_nature);
  const settings = (character.canon_settings || []).join(", ") || "eine passende Talea-Welt";
  const traits = [character.dominant_personality, ...(character.secondary_traits || []), ...(character.personality_keywords || [])]
    .filter(Boolean)
    .join(", ");
  const speech = (character.speech_style || []).join(", ");
  const triggers = [...(character.emotional_triggers || []), ...(Array.isArray(emotional.triggers) ? emotional.triggers : [])].join(", ");
  const antagonistRule = isAntagonisticCharacter(character)
    ? "Die Hauptfigur darf Fehler machen und Schaden verursachen. Zeige ihre Menschlichkeit, ohne ihr Verhalten zu entschuldigen und ohne plötzliche Läuterung."
    : "Die Hauptfigur soll glaubwürdig scheitern, entscheiden und wachsen; ihre Ecken und Eigenarten bleiben sichtbar.";

  const readerGuidance = ageGroup === "6-8"
    ? [
        "ZIELGRUPPE: Kinder von 6 bis 8 Jahren. Schreibe klar, konkret und gut vorlesbar.",
        "Nutze kurze, aktive Saetze und verstaendliche Woerter. Erklaere ungewohnte Woerter direkt durch die Handlung. Vermeide abstrakte Gedanken, lange Vergleiche und verschachtelte Saetze.",
        "Beginne innerhalb der ersten zwei Absaetze mit einem sichtbaren Raetsel, einer Gefahr oder einem Problem. Jede Seite braucht einen neuen, klaren Hindernis-, Ueberraschungs- oder Entscheidungsmoment.",
        "Steigere die Spannung in drei einfachen Stufen: Erst stimmt etwas nicht, dann wird der Preis groesser, dann muss die Hauptfigur handeln. Das Finale braucht Zeitdruck, eine mutige aktive Tat und eine sichtbare Folge.",
        "Wiederholungen nur als kurzer, merkbarer Refrain. Wiederhole nicht dieselbe Angeberei, Reaktion oder Regel mehrere Absaetze lang.",
      ]
    : ["Passe Satzlaenge, Wortwahl und Spannung genau an die angegebene Altersgruppe an."];

  return [
    "REDAKTIONSAUFTRAG: Schreibe die kanonische, illustrierte Lebensgeschichte dieser Talea-Figur.",
    "Dies ist eine echte literarische Ursprungsgeschichte, keine Biografie, kein Steckbrief, keine Aufzählung und keine Erklärung an das Publikum.",
    "Erzähle ausschließlich aus dem Leben der unten definierten Hauptfigur. Andere Figuren dürfen nur als notwendige Nebenfiguren auftreten und keine bekannten Nutzer-Avatare ersetzen.",
    "Form: exakt 5 Kapitel, insgesamt 1400 bis 1500 deutsche Wörter, mit klarer Ursache-Wirkung-Kette und einem vollständigen emotionalen Bogen.",
    "KANONISCHER LEBENSBOGEN: Diese Geschichte muss in erlebten Szenen klar beantworten: Woher kommt die Figur? Wer oder was war ihre erste Zugehoerigkeit? Was ist ihr passiert? Was hat sie veraendert? Und warum handelt sie heute genau so?",
    "Kapitel 1: Zeige Herkunft, fruehen Ort und das erste innere Beduerfnis der Figur. Kapitel 2: Zeige, wie sie zu ihrer ersten Gruppe, Familie, Arbeit oder Aufgabe kam. Kapitel 3: Ein konkretes Ereignis kostet sie etwas und praegt eine heutige Angst, Staerke oder Eigenart. Kapitel 4: Die Figur muss sich sichtbar entscheiden und dabei etwas riskieren. Kapitel 5: Zeige die konkrete Folge: ihren heutigen Ruf, ihre Loyalitaet, ihren Spruch, einen wichtigen Gegenstand oder ihren Platz in der Talea-Welt.",
    "Ein persoenlicher Gegenstand darf wichtig sein, aber er ist kein Ersatz fuer die Lebensgeschichte: Seine Bedeutung muss aus Herkunft und praegendem Erlebnis entstehen.",
    ...readerGuidance,
    "Der vorhandene Backstory-Kanon ist verbindlich. Verwandle ihn in erlebte Szenen mit Handlung, Dialog, Sinneseindrücken und Subtext, statt ihn nachzuerzählen.",
    "Zeige organisch, wie mindestens eine heutige Eigenschaft, Eigenart oder Haltung entstand. Der Charakter bleibt am Ende eindeutig dieselbe wiedererkennbare Figur.",
    character.catchphrase
      ? `Der kanonische Spruch lautet \"${character.catchphrase}\". Verwende ihn höchstens einmal und nur in diesem Kontext: ${character.catchphrase_context || "wenn es emotional passt"}.`
      : "Erfinde keinen markenartigen Standardspruch.",
    antagonistRule,
    "Keine Artefaktbelohnung, keine Lernpunkte, keine Persönlichkeitspunkte, kein Quiz und keine Meta-Hinweise auf App, Prompt oder Generierung.",
    "Jede Illustration muss dieselbe kanonische Erscheinung zeigen und einen konkreten Wendepunkt des jeweiligen Kapitels darstellen.",
    "",
    `KANONISCHE FIGUR: ${character.name}`,
    `Rolle / Archetyp: ${character.role} / ${character.archetype}`,
    `Vorgeschichte: ${character.backstory || "Noch knapp definiert; leite nur aus den übrigen kanonischen Feldern ab und widersprich ihnen nicht."}`,
    `Persönlichkeit: ${traits || emotional.dominant || "komplex und wiedererkennbar"}`,
    `Emotionale Auslöser: ${triggers || "aus dem Kanon ableiten"}`,
    `Sprachstil: ${speech || "zur Figur passend und unverwechselbar"}`,
    `Eigenart: ${character.quirk || "keine zusätzliche Eigenart erfinden, wenn sie nicht aus der Handlung entsteht"}`,
    `Kanonische Orte: ${settings}`,
    `Erscheinung: ${character.physical_description || visual.description || "kanonisches Referenzbild verwenden"}`,
  ].join("\n");
}

function buildAvatar(character: CharacterRow, imageUrl?: string): DevModeAvatar {
  const visual = parseJsonObject(character.visual_profile);
  const emotional = parseJsonObject(character.emotional_nature);
  const personalitySummary = [
    character.dominant_personality,
    ...(character.secondary_traits || []),
    ...(character.personality_keywords || []),
  ].filter(Boolean).join(", ");
  return {
    id: character.id,
    name: character.name,
    description: [
      character.backstory,
      character.physical_description || visual.description,
      personalitySummary ? `Persönlichkeit: ${personalitySummary}` : undefined,
      character.quirk ? `Eigenart: ${character.quirk}` : undefined,
      character.catchphrase ? `Spruch: ${character.catchphrase}` : undefined,
    ].filter(Boolean).join("\n"),
    imageUrl,
    visualProfile: visual,
    physicalTraits: {
      species: visual.species,
      description: character.physical_description || visual.description,
      colorPalette: visual.colorPalette,
    },
    personalityTraits: {
      knowledge: { value: 45 },
      creativity: { value: 50 },
      vocabulary: { value: 50 },
      courage: { value: 45 },
      curiosity: { value: 45 },
      teamwork: { value: isAntagonisticCharacter(character) ? 20 : 50 },
      empathy: { value: isAntagonisticCharacter(character) ? 25 : 55 },
      persistence: { value: 60 },
      logic: { value: 50 },
      canonicalSummary: personalitySummary || emotional.dominant,
    },
  };
}

export const getCharacterLifeStory = api<GetCharacterLifeStoryRequest, GetCharacterLifeStoryResponse>(
  { expose: true, method: "GET", path: "/story/character-pool/:characterId/life-story", auth: true },
  async ({ characterId }) => {
    const auth = getAuthData()!;
    const row = await findLifeStoryRowByCharacter(characterId);
    if (!row || (auth.role !== "admin" && row.status !== "published")) return {};
    return { story: await mapLifeStory(row) };
  }
);

export const listPublishedCharacterLifeStories = api<
  void,
  { stories: PublishedCharacterLifeStorySummary[] }
>(
  { expose: true, method: "GET", path: "/story/character-life-stories", auth: true },
  async () => {
    const rows = await storyDB.queryAll<{
      id: string;
      character_id: string;
      character_name: string;
      character_role: string;
      character_archetype: string;
      character_image_url: string | null;
      title: string;
      description: string;
      cover_image_url: string | null;
      word_count: number;
      chapter_count: number;
    }>`
      SELECT
        life.id,
        life.character_id,
        character.name AS character_name,
        character.role AS character_role,
        character.archetype AS character_archetype,
        character.image_url AS character_image_url,
        life.title,
        life.description,
        life.cover_image_url,
        life.word_count,
        COUNT(chapter.id)::int AS chapter_count
      FROM character_life_stories life
      JOIN character_pool character ON character.id = life.character_id
      LEFT JOIN character_life_story_chapters chapter ON chapter.life_story_id = life.id
      WHERE life.status = 'published'
      GROUP BY
        life.id, life.character_id, character.name, character.role,
        character.archetype, character.image_url, life.title,
        life.description, life.cover_image_url, life.word_count
      ORDER BY character.name ASC
    `;

    return {
      stories: await Promise.all(rows.map(async (row) => ({
        id: row.id,
        characterId: row.character_id,
        characterName: row.character_name,
        characterRole: row.character_role,
        characterArchetype: row.character_archetype,
        characterImageUrl: (await resolveImageUrlForClient(row.character_image_url || undefined)) || row.character_image_url || undefined,
        title: row.title,
        description: row.description,
        coverImageUrl: (await resolveImageUrlForClient(row.cover_image_url || undefined)) || row.cover_image_url || undefined,
        wordCount: row.word_count,
        chapterCount: row.chapter_count,
      }))),
    };
  }
);
export const generateCharacterLifeStory = api<GenerateCharacterLifeStoryRequest, CharacterLifeStory>(
  { expose: true, method: "POST", path: "/story/character-pool/:characterId/life-story/generate", auth: true },
  async (req) => {
    const auth = requireAdmin();
    const character = await findCharacter(req.characterId);
    const existing = await findLifeStoryRowByCharacter(req.characterId);
    const storyId = existing?.id || crypto.randomUUID();
    const ageGroup = req.ageGroup || existing?.age_group || "6-8";
    const now = new Date();

    await storyDB.exec`
      INSERT INTO character_life_stories (
        id, character_id, title, description, status, age_group,
        target_words, created_by_user_id, created_at, updated_at
      ) VALUES (
        ${storyId}, ${character.id}, ${`${character.name}: Die Geschichte davor`}, '',
        'generating', ${ageGroup}, 1400, ${auth.userID}, ${now}, ${now}
      )
      ON CONFLICT (character_id) DO UPDATE SET
        status = 'generating',
        age_group = EXCLUDED.age_group,
        last_error = NULL,
        created_by_user_id = EXCLUDED.created_by_user_id,
        updated_at = EXCLUDED.updated_at
    `;

    try {
      const canonicalImageUrl =
        (await resolveImageUrlForClient(character.image_url || undefined)) || character.image_url || undefined;
      const config: StoryConfig = {
        avatarIds: [character.id],
        genre: isAntagonisticCharacter(character) ? "Dunkel-warme Figurenlegende" : "Magische Figuren-Lebensgeschichte",
        setting: (character.canon_settings || [])[0] || "Talea",
        length: "long",
        complexity: ageGroup === "3-5" ? "simple" : ageGroup === "13+" ? "complex" : "medium",
        ageGroup,
        stylePreset: isAntagonisticCharacter(character) ? "quirky_dark_sweet" : "classic_fantasy",
        tone: isAntagonisticCharacter(character) ? "wonder" : "warm",
        language: "de",
        suspenseLevel: ageGroup === "3-5" ? 1 : ageGroup === "6-8" ? 3 : 2,
        humorLevel: isAntagonisticCharacter(character) ? 1 : 2,
        pacing: "balanced",
        pov: "personale",
        customPrompt: buildCanonicalPrompt(character, ageGroup),
        aiModel: req.aiModel || "gpt-5.4",
        aiProvider: req.aiProvider || "native",
        openRouterModel: req.openRouterModel,
        useCharacterPool: false,
        strictQualityGates: false,
        strictReleaseGateMode: "warn",
        contentType: "character_life",
        characterId: character.id,
      };

      const generated = await generateStoryDevMode({
        config,
        userId: auth.userID,
        storyId,
        avatars: [buildAvatar(character, canonicalImageUrl)],
        poolCharacters: [],
        qualityMode: "premium",
        chapterCountOverride: 5,
        disableArtifactSelection: true,
        disablePersistenceSideEffects: true,
      });

      if (!generated.chapters.length) throw new Error("Generation returned no chapters");
      const wordCount = generated.chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0);
      const metadata = {
        ...generated.metadata,
        contentType: "character_life",
        characterId: character.id,
        canonicalCharacterName: character.name,
        targetWords: { min: 1400, max: 1500 },
      };

      await using tx = await storyDB.begin();
      await tx.exec`DELETE FROM character_life_story_chapters WHERE life_story_id = ${storyId}`;
      for (const chapter of generated.chapters) {
        await tx.exec`
          INSERT INTO character_life_story_chapters (
            id, life_story_id, title, content, image_url, image_prompt,
            chapter_order, created_at, updated_at
          ) VALUES (
            ${chapter.id || crypto.randomUUID()}, ${storyId}, ${chapter.title}, ${chapter.content},
            ${chapter.imageUrl || null}, ${chapter.imagePrompt || null}, ${chapter.order}, ${now}, ${now}
          )
        `;
      }
      await tx.exec`
        UPDATE character_life_stories
        SET title = ${generated.title},
            description = ${generated.description},
            cover_image_url = ${generated.coverImageUrl || null},
            status = 'draft',
            word_count = ${wordCount},
            version = version + 1,
            generation_metadata = ${JSON.stringify(metadata)}::jsonb,
            last_error = NULL,
            published_at = NULL,
            updated_at = ${now}
        WHERE id = ${storyId}
      `;
      await tx.commit();

      const completed = await findLifeStoryRowById(storyId);
      if (!completed) throw new Error("Generated life story could not be loaded");
      return await mapLifeStory(completed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await storyDB.exec`
        UPDATE character_life_stories
        SET status = 'error', last_error = ${message.slice(0, 2000)}, updated_at = ${new Date()}
        WHERE id = ${storyId}
      `;
      throw APIError.internal(`Character life story generation failed: ${message}`);
    }
  }
);

export const updateCharacterLifeStory = api<UpdateCharacterLifeStoryRequest, CharacterLifeStory>(
  { expose: true, method: "PATCH", path: "/story/character-pool/:characterId/life-story", auth: true },
  async (req) => {
    requireAdmin();
    const row = await findLifeStoryRowByCharacter(req.characterId);
    if (!row) throw APIError.notFound("Character life story not found");
    if (row.status === "generating") throw APIError.failedPrecondition("Life story is currently generating");

    const title = req.title?.trim() || row.title;
    const description = req.description?.trim() || row.description;
    const now = new Date();
    await using tx = await storyDB.begin();
    await tx.exec`
      UPDATE character_life_stories
      SET title = ${title}, description = ${description}, status = 'draft',
          published_at = NULL, updated_at = ${now}
      WHERE id = ${row.id}
    `;
    for (const chapter of req.chapters || []) {
      const chapterTitle = chapter.title.trim();
      const chapterContent = chapter.content.trim();
      if (!chapterTitle || !chapterContent) {
        throw APIError.invalidArgument("Chapter title and content must not be empty");
      }
      await tx.exec`
        UPDATE character_life_story_chapters
        SET title = ${chapterTitle}, content = ${chapterContent}, updated_at = ${now}
        WHERE id = ${chapter.id} AND life_story_id = ${row.id}
      `;
    }
    const allChapters = await tx.queryAll<{ content: string }>`
      SELECT content FROM character_life_story_chapters WHERE life_story_id = ${row.id}
    `;
    const wordCount = allChapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0);
    await tx.exec`UPDATE character_life_stories SET word_count = ${wordCount} WHERE id = ${row.id}`;
    await tx.commit();

    const updated = await findLifeStoryRowById(row.id);
    if (!updated) throw APIError.notFound("Character life story not found");
    return await mapLifeStory(updated);
  }
);

export const setCharacterLifeStoryStatus = api<SetCharacterLifeStoryStatusRequest, CharacterLifeStory>(
  { expose: true, method: "POST", path: "/story/character-pool/:characterId/life-story/status", auth: true },
  async ({ characterId, status }) => {
    requireAdmin();
    const row = await findLifeStoryRowByCharacter(characterId);
    if (!row) throw APIError.notFound("Character life story not found");
    if (row.status === "generating") throw APIError.failedPrecondition("Life story is currently generating");

    if (status === "published") {
      const imageState = await storyDB.queryRow<{
        chapter_count: number;
        illustrated_chapter_count: number;
      }>`
        SELECT
          COUNT(*)::int AS chapter_count,
          COUNT(*) FILTER (WHERE image_url IS NOT NULL AND image_url <> '')::int AS illustrated_chapter_count
        FROM character_life_story_chapters
        WHERE life_story_id = ${row.id}
      `;
      if (!row.cover_image_url || !imageState || imageState.chapter_count === 0 || imageState.illustrated_chapter_count !== imageState.chapter_count) {
        throw APIError.failedPrecondition("A cover and one illustration per chapter are required before publishing");
      }
    }

    const now = new Date();
    await storyDB.exec`
      UPDATE character_life_stories
      SET status = ${status},
          published_at = ${status === "published" ? now : null},
          updated_at = ${now}
      WHERE id = ${row.id}
    `;
    const updated = await findLifeStoryRowById(row.id);
    if (!updated) throw APIError.notFound("Character life story not found");
    return await mapLifeStory(updated);
  }
);

export async function findCharacterLifeStoryForViewer(id: string, viewerIsAdmin: boolean): Promise<Story | null> {
  const row = await findLifeStoryRowById(id);
  if (!row || (!viewerIsAdmin && row.status !== "published")) return null;
  const lifeStory = await mapLifeStory(row);
  const character = await findCharacter(row.character_id);
  return {
    id: lifeStory.id,
    userId: lifeStory.createdByUserId,
    title: lifeStory.title,
    summary: lifeStory.description,
    description: lifeStory.description,
    coverImageUrl: lifeStory.coverImageUrl,
    config: {
      avatarIds: [],
      genre: "Figuren-Lebensgeschichte",
      setting: (character.canon_settings || [])[0] || character.name,
      length: "long",
      complexity: lifeStory.ageGroup === "3-5" ? "simple" : "medium",
      ageGroup: lifeStory.ageGroup,
      contentType: "character_life",
      characterId: character.id,
      avatars: [{ id: character.id, name: character.name, imageUrl: await resolveImageUrlForClient(character.image_url || undefined) }],
    } as StoryConfig & { avatars: Array<{ id: string; name: string; imageUrl?: string }> },
    chapters: lifeStory.chapters,
    status: "complete",
    isPublic: lifeStory.status === "published",
    metadata: lifeStory.generationMetadata,
    createdAt: lifeStory.createdAt,
    updatedAt: lifeStory.updatedAt,
  } as Story;
}
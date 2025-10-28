// Seed character pool with pre-built characters
// This should be called after migrations are complete

import { storyDB } from "./db";

export async function seedCharacterPool(): Promise<number> {
  console.log("[CharacterPool] Checking if seeding is needed...");

  // Check if characters already exist
  const existingCount = await storyDB.queryRow<{ count: number }>`
    SELECT COUNT(*)::int as count FROM character_pool WHERE id LIKE 'char_%'
  `;

  if (existingCount && existingCount.count > 0) {
    console.log(`[CharacterPool] Already seeded with ${existingCount.count} characters`);
    return existingCount.count;
  }

  console.log("[CharacterPool] Seeding character pool with 18 pre-built characters...");

  const characters = [
    // 1. GUIDE CHARACTERS
    {
      id: 'char_001_frau_mueller',
      name: 'Frau Müller',
      role: 'guide',
      archetype: 'helpful_elder',
      emotional_nature: { dominant: 'wise', secondary: ['protective', 'kind'], triggers: ['children in danger', 'nature destruction'] },
      visual_profile: {
        description: '70-year-old woman, gray hair in neat bun, kind brown eyes, green knitted shawl',
        imagePrompt: 'elderly woman with gray hair bun, kind expression, green shawl, warm smile, grandmother figure, watercolor illustration',
        species: 'human',
        colorPalette: ['green', 'gray', 'beige']
      },
      max_screen_time: 80,
      available_chapters: [1,2,3,4,5],
      canon_settings: ['forest', 'village', 'mountain']
    },
    {
      id: 'char_002_professor_lichtweis',
      name: 'Professor Lichtweis',
      role: 'guide',
      archetype: 'scholarly_mentor',
      emotional_nature: { dominant: 'curious', secondary: ['wise', 'patient', 'enthusiastic'], triggers: ['mysteries', 'learning opportunities'] },
      visual_profile: {
        description: '60-year-old professor, round glasses, wild white hair, colorful vest, always with a book',
        imagePrompt: 'elderly professor with round glasses, wild white hair, colorful vest, book in hand, enthusiastic expression, watercolor illustration',
        species: 'human',
        colorPalette: ['purple', 'white', 'gold']
      },
      max_screen_time: 75,
      available_chapters: [1,2,3,4,5],
      canon_settings: ['castle', 'village', 'city']
    },
    {
      id: 'char_003_alte_eiche',
      name: 'Die Alte Eiche',
      role: 'guide',
      archetype: 'magical_mentor',
      emotional_nature: { dominant: 'wise', secondary: ['ancient', 'protective', 'mysterious'], triggers: ['forest threats', 'lost travelers'] },
      visual_profile: {
        description: 'Ancient talking oak tree with a kind face in bark, glowing amber eyes, branches like protective arms',
        imagePrompt: 'ancient talking oak tree with wise face carved in bark, glowing amber eyes, protective branches, magical aura, watercolor illustration',
        species: 'magical_nature',
        colorPalette: ['brown', 'green', 'amber']
      },
      max_screen_time: 70,
      available_chapters: [1,2,3,5],
      canon_settings: ['forest', 'mountain']
    },

    // 2. COMPANION CHARACTERS
    {
      id: 'char_004_hirsch_silberhorn',
      name: 'Silberhorn der Hirsch',
      role: 'companion',
      archetype: 'loyal_animal',
      emotional_nature: { dominant: 'protective', secondary: ['noble', 'wise', 'brave'], triggers: ['friends in danger', 'injustice'] },
      visual_profile: {
        description: 'Noble forest deer with majestic silver antlers, deep brown eyes, magical silver shimmer on fur',
        imagePrompt: 'noble forest deer with silver antlers, majestic posture, deep brown eyes, magical silver shimmer, protective stance, watercolor illustration',
        species: 'animal',
        colorPalette: ['brown', 'silver', 'green']
      },
      max_screen_time: 70,
      available_chapters: [1,2,3,4,5],
      canon_settings: ['forest', 'mountain']
    },
    {
      id: 'char_005_luna_die_katze',
      name: 'Luna',
      role: 'companion',
      archetype: 'clever_animal',
      emotional_nature: { dominant: 'clever', secondary: ['curious', 'independent', 'loyal'], triggers: ['puzzles', 'hidden things'] },
      visual_profile: {
        description: 'Sleek black cat with bright green eyes, white paws, intelligent expression, graceful movements',
        imagePrompt: 'sleek black cat with bright green eyes, white paws, intelligent expression, graceful posture, watercolor illustration',
        species: 'animal',
        colorPalette: ['black', 'green', 'white']
      },
      max_screen_time: 65,
      available_chapters: [1,2,3,4,5],
      canon_settings: ['village', 'city', 'castle']
    },
    {
      id: 'char_006_pip_das_eichhoernchen',
      name: 'Pip',
      role: 'companion',
      archetype: 'playful_helper',
      emotional_nature: { dominant: 'playful', secondary: ['energetic', 'helpful', 'quick'], triggers: ['fun opportunities', 'friends needing help'] },
      visual_profile: {
        description: 'Energetic red squirrel with fluffy tail, bright eyes, always carrying acorns, cheerful expression',
        imagePrompt: 'energetic red squirrel with fluffy tail, bright eyes, carrying acorns, cheerful expression, playful pose, watercolor illustration',
        species: 'animal',
        colorPalette: ['red', 'orange', 'brown']
      },
      max_screen_time: 60,
      available_chapters: [2,3,4],
      canon_settings: ['forest', 'village', 'mountain']
    },

    // 3. DISCOVERY CHARACTERS
    {
      id: 'char_007_silberfunke',
      name: 'Silberfunke',
      role: 'discovery',
      archetype: 'magical_sprite',
      emotional_nature: { dominant: 'playful', secondary: ['mysterious', 'wise', 'mischievous'], triggers: ['worthy seekers', 'pure hearts'] },
      visual_profile: {
        description: 'Small glowing sprite with silver butterfly wings, sparkling trail, mischievous smile, size of a hand',
        imagePrompt: 'small glowing sprite with silver butterfly wings, sparkles and magical light trail, mischievous smile, tiny size, watercolor illustration',
        species: 'magical_creature',
        colorPalette: ['silver', 'blue', 'white']
      },
      max_screen_time: 50,
      available_chapters: [3,4,5],
      canon_settings: ['forest', 'castle', 'mountain']
    },
    {
      id: 'char_008_nebelfee',
      name: 'Die Nebelfee',
      role: 'discovery',
      archetype: 'ethereal_guide',
      emotional_nature: { dominant: 'mysterious', secondary: ['gentle', 'wise', 'elusive'], triggers: ['lost souls', 'true need'] },
      visual_profile: {
        description: 'Translucent fairy-like being made of mist and moonlight, flowing silver hair, barely visible face, ethereal presence',
        imagePrompt: 'ethereal fairy made of mist and moonlight, translucent form, flowing silver hair, gentle glow, mysterious presence, watercolor illustration',
        species: 'magical_creature',
        colorPalette: ['silver', 'white', 'blue']
      },
      max_screen_time: 45,
      available_chapters: [2,3,4],
      canon_settings: ['forest', 'mountain', 'beach']
    },
    {
      id: 'char_009_golddrache',
      name: 'Funkelflug',
      role: 'discovery',
      archetype: 'friendly_dragon',
      emotional_nature: { dominant: 'protective', secondary: ['friendly', 'wise', 'playful'], triggers: ['true friends', 'adventure'] },
      visual_profile: {
        description: 'Small friendly dragon with golden scales, large curious eyes, tiny wings, size of a large dog, playful demeanor',
        imagePrompt: 'small friendly dragon with golden scales, large curious eyes, tiny wings, playful expression, non-threatening, watercolor illustration',
        species: 'magical_creature',
        colorPalette: ['gold', 'orange', 'red']
      },
      max_screen_time: 65,
      available_chapters: [3,4,5],
      canon_settings: ['mountain', 'castle', 'forest']
    },

    // 4. OBSTACLE CHARACTERS
    {
      id: 'char_010_graf_griesgram',
      name: 'Graf Griesgram',
      role: 'obstacle',
      archetype: 'misunderstood_grump',
      emotional_nature: { dominant: 'grumpy', secondary: ['lonely', 'protective', 'misunderstood'], triggers: ['trespassers', 'noise', 'disorder'] },
      visual_profile: {
        description: 'Old nobleman with stern face, gray beard, dark formal clothes, actually just lonely and set in his ways',
        imagePrompt: 'elderly nobleman with stern expression, gray beard, dark formal Victorian clothes, lonely eyes, not truly evil, watercolor illustration',
        species: 'human',
        colorPalette: ['gray', 'black', 'purple']
      },
      max_screen_time: 60,
      available_chapters: [2,3,4],
      canon_settings: ['castle', 'village', 'city']
    },
    {
      id: 'char_011_die_nebelhexe',
      name: 'Die Nebelhexe',
      role: 'obstacle',
      archetype: 'trickster_witch',
      emotional_nature: { dominant: 'mischievous', secondary: ['clever', 'playful', 'mysterious'], triggers: ['boredom', 'challenges', 'clever opponents'] },
      visual_profile: {
        description: 'Middle-aged witch with wild curly hair, mischievous grin, colorful patchwork robes, not evil just playful',
        imagePrompt: 'witch with wild curly hair, mischievous grin, colorful patchwork robes, playful expression, not threatening, watercolor illustration',
        species: 'magical_human',
        colorPalette: ['purple', 'green', 'orange']
      },
      max_screen_time: 55,
      available_chapters: [2,3,4,5],
      canon_settings: ['forest', 'village', 'mountain']
    },
    {
      id: 'char_012_steingolem',
      name: 'Brumm der Steinwächter',
      role: 'obstacle',
      archetype: 'guardian_challenge',
      emotional_nature: { dominant: 'protective', secondary: ['strong', 'slow', 'honorable'], triggers: ['intruders', 'rule-breakers'] },
      visual_profile: {
        description: 'Large stone golem covered in moss, slow but powerful, ancient guardian with a kind heart beneath rough exterior',
        imagePrompt: 'large stone golem covered in moss, powerful but not aggressive, ancient guardian, kind glowing eyes, watercolor illustration',
        species: 'magical_creature',
        colorPalette: ['gray', 'green', 'brown']
      },
      max_screen_time: 50,
      available_chapters: [2,3,4],
      canon_settings: ['mountain', 'castle', 'forest']
    },

    // 5. SUPPORT CHARACTERS
    {
      id: 'char_013_baecker_braun',
      name: 'Bäcker Braun',
      role: 'support',
      archetype: 'helpful_villager',
      emotional_nature: { dominant: 'kind', secondary: ['helpful', 'cheerful', 'generous'], triggers: ['hungry children', 'community events'] },
      visual_profile: {
        description: 'Jovial baker with flour-dusted apron, warm smile, round belly, always smells like fresh bread',
        imagePrompt: 'friendly baker with flour-dusted apron, warm smile, round belly, holding fresh bread, cheerful expression, watercolor illustration',
        species: 'human',
        colorPalette: ['brown', 'white', 'gold']
      },
      max_screen_time: 40,
      available_chapters: [1,2,5],
      canon_settings: ['village', 'city']
    },
    {
      id: 'char_014_leuchtturmwaerterin',
      name: 'Frau Wellenreiter',
      role: 'support',
      archetype: 'sea_keeper',
      emotional_nature: { dominant: 'calm', secondary: ['wise', 'protective', 'patient'], triggers: ['storms', 'lost sailors'] },
      visual_profile: {
        description: 'Weather-worn lighthouse keeper with braided gray hair, kind sea-blue eyes, practical clothing, speaks of the ocean',
        imagePrompt: 'lighthouse keeper woman with braided gray hair, sea-blue eyes, practical clothing, weathered face, wise expression, watercolor illustration',
        species: 'human',
        colorPalette: ['blue', 'white', 'gray']
      },
      max_screen_time: 45,
      available_chapters: [1,2,3],
      canon_settings: ['beach', 'village']
    },
    {
      id: 'char_015_bibliothekar_seitenflug',
      name: 'Herr Seitenflug',
      role: 'support',
      archetype: 'knowledge_keeper',
      emotional_nature: { dominant: 'curious', secondary: ['helpful', 'organized', 'enthusiastic'], triggers: ['questions', 'book lovers'] },
      visual_profile: {
        description: 'Thin librarian with tall stature, round glasses, vest with many pockets full of bookmarks, loves sharing knowledge',
        imagePrompt: 'thin librarian with round glasses, vest with many pockets, bookmarks everywhere, enthusiastic expression, surrounded by books, watercolor illustration',
        species: 'human',
        colorPalette: ['brown', 'beige', 'gold']
      },
      max_screen_time: 40,
      available_chapters: [1,2,3],
      canon_settings: ['castle', 'village', 'city']
    },

    // 6. SPECIAL CHARACTERS
    {
      id: 'char_016_zeitweber',
      name: 'Der Zeitweber',
      role: 'special',
      archetype: 'time_mystical',
      emotional_nature: { dominant: 'mysterious', secondary: ['wise', 'ancient', 'patient'], triggers: ['time paradoxes', 'important moments'] },
      visual_profile: {
        description: 'Ageless being with flowing robes that shimmer like time itself, eyes like hourglasses, speaks in riddles about past and future',
        imagePrompt: 'mystical being with shimmering time-like robes, hourglass eyes, ageless face, mysterious presence, flowing ethereal clothing, watercolor illustration',
        species: 'magical_being',
        colorPalette: ['silver', 'blue', 'purple']
      },
      max_screen_time: 40,
      available_chapters: [3,4,5],
      canon_settings: ['castle', 'mountain', 'forest']
    },
    {
      id: 'char_017_sternentaenzerin',
      name: 'Astra',
      role: 'special',
      archetype: 'cosmic_visitor',
      emotional_nature: { dominant: 'wonder', secondary: ['gentle', 'wise', 'ethereal'], triggers: ['clear nights', 'dreamers', 'wishes'] },
      visual_profile: {
        description: 'Celestial being with skin like night sky filled with stars, flowing cosmic hair, gentle glow, brings messages from the stars',
        imagePrompt: 'celestial being with starry skin, cosmic flowing hair, gentle glow, ethereal beauty, star-filled appearance, watercolor illustration',
        species: 'cosmic_being',
        colorPalette: ['dark blue', 'silver', 'purple']
      },
      max_screen_time: 35,
      available_chapters: [4,5],
      canon_settings: ['mountain', 'beach', 'forest']
    },
    {
      id: 'char_018_traumweber',
      name: 'Morpheus',
      role: 'special',
      archetype: 'dream_weaver',
      emotional_nature: { dominant: 'gentle', secondary: ['mysterious', 'protective', 'creative'], triggers: ['nightmares', 'sleep troubles', 'dreams'] },
      visual_profile: {
        description: 'Soft-featured being wrapped in clouds and moonlight, carries a bag of dreams, gentle purple glow, comforting presence',
        imagePrompt: 'dream-like being wrapped in clouds, moonlight glow, bag of dreams, soft purple aura, comforting gentle face, watercolor illustration',
        species: 'dream_being',
        colorPalette: ['purple', 'white', 'silver']
      },
      max_screen_time: 40,
      available_chapters: [3,4,5],
      canon_settings: ['castle', 'village', 'forest']
    },
  ];

  let insertedCount = 0;
  for (const char of characters) {
    try {
      await storyDB.exec`
        INSERT INTO character_pool (
          id, name, role, archetype, emotional_nature, visual_profile,
          max_screen_time, available_chapters, canon_settings,
          recent_usage_count, total_usage_count, is_active,
          created_at, updated_at
        ) VALUES (
          ${char.id},
          ${char.name},
          ${char.role},
          ${char.archetype},
          ${JSON.stringify(char.emotional_nature)},
          ${JSON.stringify(char.visual_profile)},
          ${char.max_screen_time},
          ${char.available_chapters},
          ${char.canon_settings},
          0,
          0,
          TRUE,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
      insertedCount++;
    } catch (error) {
      console.error(`[CharacterPool] Failed to insert ${char.name}:`, error);
    }
  }

  console.log(`[CharacterPool] Seeded ${insertedCount}/${characters.length} characters successfully`);
  return insertedCount;
}

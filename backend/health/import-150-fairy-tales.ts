// Import 150 Public Domain Fairy Tales into Database
// Professional fairy tale library for Talea Storytelling Platform

import { api } from "encore.dev/api";
import { fairytalesDB } from "../fairytales/db";

interface FairyTaleImport {
  id: string;
  title: string;
  source: string;
  originalLanguage: string;
  englishTranslation: string;
  cultureRegion: string;
  ageRecommendation: number;
  durationMinutes: number;
  genreTags: string[];
  moralLesson: string;
  summary: string;
  roles: {
    roleType: string;
    roleName: string;
    roleCount: number;
    description: string;
    required: boolean;
    archetypePreference: string;
    ageRangeMin: number;
    ageRangeMax: number;
    professionPreference: string[];
  }[];
  scenes: {
    sceneNumber: number;
    sceneTitle: string;
    sceneDescription: string;
    dialogueTemplate?: string;
    characterVariables: Record<string, string>;
    setting: string;
    mood: string;
    illustrationPromptTemplate: string;
    durationSeconds: number;
  }[];
}

/**
 * Imports 150 curated fairy tales from MÄRCHEN_DATENBANK.md
 * Returns number of tales imported successfully
 */
export const import150FairyTales = api(
  { expose: true, method: "POST", path: "/health/import-150-fairy-tales" },
  async (): Promise<{ success: boolean; imported: number; skipped: number; details: string[] }> => {
    console.log("Starting import of 150 fairy tales...");
    
    const fairyTales = build150FairyTalesLibrary();
    let imported = 0;
    let skipped = 0;
    const details: string[] = [];

    for (const tale of fairyTales) {
      try {
        // Check if already exists
        const existing = await fairytalesDB.queryRow<any>`
          SELECT id FROM fairy_tales WHERE id = ${tale.id}
        `;

        if (existing) {
          console.log(`Skipping existing tale: ${tale.id}`);
          skipped++;
          continue;
        }

        // Insert fairy tale
        await fairytalesDB.exec`
          INSERT INTO fairy_tales (
            id, title, source, original_language, english_translation,
            culture_region, age_recommendation, duration_minutes,
            genre_tags, moral_lesson, summary, is_active
          ) VALUES (
            ${tale.id},
            ${tale.title},
            ${tale.source},
            ${tale.originalLanguage},
            ${tale.englishTranslation},
            ${tale.cultureRegion},
            ${tale.ageRecommendation},
            ${tale.durationMinutes},
            ${JSON.stringify(tale.genreTags)},
            ${tale.moralLesson},
            ${tale.summary},
            true
          )
        `;

        // Insert roles
        for (const role of tale.roles) {
          await fairytalesDB.exec`
            INSERT INTO fairy_tale_roles (
              tale_id, role_type, role_name, role_count, description,
              required, archetype_preference, age_range_min, age_range_max,
              profession_preference
            ) VALUES (
              ${tale.id},
              ${role.roleType},
              ${role.roleName},
              ${role.roleCount},
              ${role.description},
              ${role.required},
              ${role.archetypePreference},
              ${role.ageRangeMin},
              ${role.ageRangeMax},
              ${JSON.stringify(role.professionPreference)}
            )
          `;
        }

        // Insert scenes
        for (const scene of tale.scenes) {
          await fairytalesDB.exec`
            INSERT INTO fairy_tale_scenes (
              tale_id, scene_number, scene_title, scene_description,
              dialogue_template, character_variables, setting, mood,
              illustration_prompt_template, duration_seconds
            ) VALUES (
              ${tale.id},
              ${scene.sceneNumber},
              ${scene.sceneTitle},
              ${scene.sceneDescription},
              ${scene.dialogueTemplate || ""},
              ${JSON.stringify(scene.characterVariables)},
              ${scene.setting},
              ${scene.mood},
              ${scene.illustrationPromptTemplate},
              ${scene.durationSeconds}
            )
          `;
        }

        // Initialize usage stats
        await fairytalesDB.exec`
          INSERT INTO fairy_tale_usage_stats (tale_id, usage_count, last_used_at)
          VALUES (${tale.id}, 0, NULL)
        `;

        imported++;
        details.push(`✅ ${tale.id}: ${tale.title}`);
        console.log(`Imported: ${tale.id} - ${tale.title}`);
      } catch (error) {
        details.push(`❌ ${tale.id}: ${error}`);
        console.error(`Failed to import ${tale.id}:`, error);
        skipped++;
      }
    }

    return {
      success: true,
      imported,
      skipped,
      details,
    };
  }
);

/**
 * Build 150 fairy tales library from MÄRCHEN_DATENBANK.md
 * Professional structure with scenes adapted for personalization
 */
function build150FairyTalesLibrary(): FairyTaleImport[] {
  return [
    // ==================== GRIMM TALES (Top 50) ====================
    {
      id: "grimm-015",
      title: "Hänsel und Gretel",
      source: "Grimm KHM 15",
      originalLanguage: "German",
      englishTranslation: "Hansel and Gretel",
      cultureRegion: "Germany",
      ageRecommendation: 6,
      durationMinutes: 12,
      genreTags: ["adventure", "fantasy", "siblings"],
      moralLesson: "Geschwisterliebe und Mut siegen über Böses",
      summary: "Zwei Geschwister werden im Wald ausgesetzt, finden ein Lebkuchenhaus und überlisten die böse Hexe.",
      roles: [
        {
          roleType: "protagonist",
          roleName: "Hänsel",
          roleCount: 1,
          description: "Mutiger Junge mit cleveren Ideen",
          required: true,
          archetypePreference: "CLEVER_TRICKSTER",
          ageRangeMin: 6,
          ageRangeMax: 12,
          professionPreference: ["child", "adventurer"],
        },
        {
          roleType: "protagonist",
          roleName: "Gretel",
          roleCount: 1,
          description: "Tapferes Mädchen das ihre Familie rettet",
          required: true,
          archetypePreference: "BRAVE_HERO",
          ageRangeMin: 6,
          ageRangeMax: 12,
          professionPreference: ["child", "hero"],
        },
        {
          roleType: "antagonist",
          roleName: "Hexe",
          roleCount: 1,
          description: "Böse Hexe die Kinder fangen will",
          required: true,
          archetypePreference: "TRICKSTER_VILLAIN",
          ageRangeMin: 50,
          ageRangeMax: 100,
          professionPreference: ["witch", "villain"],
        },
        {
          roleType: "supporting",
          roleName: "Eltern",
          roleCount: 2,
          description: "Verzweifelte Eltern in Armut",
          required: false,
          archetypePreference: "WISE_ELDER",
          ageRangeMin: 30,
          ageRangeMax: 50,
          professionPreference: ["parent", "woodcutter"],
        },
      ],
      scenes: [
        {
          sceneNumber: 1,
          sceneTitle: "Die arme Familie",
          sceneDescription: "Die Familie hat kein Essen mehr. Die Eltern beschließen schweren Herzens, die Kinder im Wald auszusetzen. Hänsel hört das Gespräch und sammelt weiße Kieselsteine.",
          characterVariables: { hero1: "Hänsel", hero2: "Gretel", parent1: "Vater", parent2: "Stiefmutter" },
          setting: "Armes Holzfäller-Haus bei Nacht, Mond scheint durchs Fenster",
          mood: "Düster, besorgt, heimlich",
          illustrationPromptTemplate: "WIDE SHOT of poor woodcutter's cottage at night. {hero1} secretly collecting white pebbles by moonlight while parents talk inside. Dark forest in background. Watercolor illustration style, soft moonlight, concerned atmosphere.",
          durationSeconds: 45,
        },
        {
          sceneNumber: 2,
          sceneTitle: "Verloren im Wald",
          sceneDescription: "Die Kinder werden tief im Wald zurückgelassen. Beim ersten Mal finden sie durch Hänsel's Kieselsteine zurück. Beim zweiten Mal haben sie nur Brotkrumen - die Vögel fressen sie auf.",
          characterVariables: { hero1: "Hänsel", hero2: "Gretel" },
          setting: "Dichter dunkler Wald, Sonnenstrahlen durch Bäume",
          mood: "Angespannt, hoffnungsvoll, dann verzweifelt",
          illustrationPromptTemplate: "MEDIUM SHOT of {hero1} and {hero2} in deep dark forest. Birds eating breadcrumbs from ground. Dappled sunlight through trees. Children look worried. Watercolor style, dramatic lighting, forest atmosphere.",
          durationSeconds: 50,
        },
        {
          sceneNumber: 3,
          sceneTitle: "Das Lebkuchenhaus",
          sceneDescription: "Hungrig entdecken die Kinder ein wundersames Haus aus Lebkuchen, Zucker und Süßigkeiten. Sie beginnen zu essen. Eine alte Frau kommt heraus und lädt sie freundlich ein.",
          characterVariables: { hero1: "Hänsel", hero2: "Gretel", villain: "Hexe (verkleidet)" },
          setting: "Lichtung mit fantastischem Süßigkeiten-Haus",
          mood: "Staunen, Hunger, naive Freude",
          illustrationPromptTemplate: "HERO SHOT of magical gingerbread house covered in candy and icing. {hero1} and {hero2} eating pieces of the house. Old woman in doorway smiling sweetly. Vibrant colors, magical atmosphere, watercolor style.",
          durationSeconds: 55,
        },
        {
          sceneNumber: 4,
          sceneTitle: "Die böse Hexe",
          sceneDescription: "Die freundliche alte Frau entpuppt sich als böse Hexe. Sie sperrt Hänsel in einen Käfig und zwingt Gretel zur Arbeit. Die Hexe will Hänsel mästen und dann essen.",
          characterVariables: { hero1: "Hänsel", hero2: "Gretel", villain: "Hexe" },
          setting: "Dunkles Inneres des Hexenhauses, Käfig, Ofen",
          mood: "Düster, gefährlich, angstvoll",
          illustrationPromptTemplate: "DRAMATIC SHOT of witch's dark interior. {hero1} trapped in wooden cage, {hero2} forced to work. Evil witch cackling. Large oven glowing orange. Dark shadows, threatening atmosphere, watercolor style.",
          durationSeconds: 50,
        },
        {
          sceneNumber: 5,
          sceneTitle: "Gretels List",
          sceneDescription: "Als die Hexe Hänsel essen will, bittet sie Gretel, in den Ofen zu schauen. Gretel täuscht vor, nicht zu wissen wie. Als die Hexe selbst hineinschaut, stößt Gretel sie hinein!",
          characterVariables: { hero2: "Gretel", villain: "Hexe" },
          setting: "Vor dem großen Backofen",
          mood: "Spannung, Mut, Triumph",
          illustrationPromptTemplate: "ACTION SHOT of {hero2} pushing evil witch into glowing oven. Witch falling forward in surprise. Bright orange oven fire. {hero2} determined expression. Dynamic composition, dramatic lighting, watercolor style.",
          durationSeconds: 45,
        },
        {
          sceneNumber: 6,
          sceneTitle: "Die Schätze",
          sceneDescription: "Die Hexe ist besiegt! Die Kinder befreien sich und finden Truhen voller Edelsteine und Gold. Sie füllen ihre Taschen mit Schätzen.",
          characterVariables: { hero1: "Hänsel", hero2: "Gretel" },
          setting: "Hexenhaus, Schatzkammer mit Truhen",
          mood: "Erleichterung, Freude, Staunen",
          illustrationPromptTemplate: "WIDE SHOT of {hero1} and {hero2} discovering treasure chests filled with jewels and gold. Sparkling gems, shimmering coins. Children's amazed expressions. Bright magical lighting, watercolor style.",
          durationSeconds: 40,
        },
        {
          sceneNumber: 7,
          sceneTitle: "Die Überquerung",
          sceneDescription: "Auf dem Heimweg kommen die Kinder an einen breiten Fluss. Eine freundliche weiße Ente hilft ihnen, hinüberzukommen - erst Gretel, dann Hänsel.",
          characterVariables: { hero1: "Hänsel", hero2: "Gretel", helper: "Weiße Ente" },
          setting: "Breiter Fluss mit Schilf und Bäumen",
          mood: "Friedlich, dankbar, hoffnungsvoll",
          illustrationPromptTemplate: "PEACEFUL SCENE of {helper} carrying {hero2} across wide river. {hero1} waiting on shore. Gentle water reflections, reeds, sunset colors. Serene atmosphere, watercolor style.",
          durationSeconds: 35,
        },
        {
          sceneNumber: 8,
          sceneTitle: "Der Heimweg",
          sceneDescription: "Die Kinder finden den Weg nach Hause durch den Wald. Sie erkennen vertraute Bäume und Wege wieder. Die Sonne scheint durch die Zweige.",
          characterVariables: { hero1: "Hänsel", hero2: "Gretel" },
          setting: "Wald auf dem Weg nach Hause, Spätnachmittag",
          mood: "Hoffnungsvoll, ermüdet aber glücklich",
          illustrationPromptTemplate: "TRACKING SHOT of {hero1} and {hero2} walking through forest path. Sunlight through trees creating dappled light. Children look tired but happy. Forest becoming familiar. Warm colors, watercolor style.",
          durationSeconds: 30,
        },
        {
          sceneNumber: 9,
          sceneTitle: "Glückliches Ende",
          sceneDescription: "Die Kinder kehren nach Hause zurück. Die böse Stiefmutter ist gestorben, der Vater lebt allein in Trauer. Er ist überglücklich! Die Kinder zeigen die Schätze. Armut und Sorgen sind vorbei.",
          characterVariables: { hero1: "Hänsel", hero2: "Gretel", parent: "Vater" },
          setting: "Das Holzfäller-Haus, jetzt von Sonnenlicht erfüllt",
          mood: "Glücklich, erleichtert, liebevoll",
          illustrationPromptTemplate: "EMOTIONAL REUNION SHOT of {parent} embracing {hero1} and {hero2}. Treasures spilling from pockets. Sunlight streaming through windows. Family together again. Warm joyful colors, watercolor style, happy ending atmosphere.",
          durationSeconds: 50,
        },
      ],
    },

    // ==================== MORE GRIMM TALES ====================
    {
      id: "grimm-026",
      title: "Rotkäppchen",
      source: "Grimm KHM 26",
      originalLanguage: "German",
      englishTranslation: "Little Red Riding Hood",
      cultureRegion: "Germany",
      ageRecommendation: 5,
      durationMinutes: 10,
      genreTags: ["moral", "animals", "adventure"],
      moralLesson: "Vorsicht vor Fremden und Gehorsamkeit",
      summary: "Ein Mädchen mit roter Kappe bringt der Großmutter Kuchen. Der böse Wolf täuscht beide und wird vom Jäger gerettet.",
      roles: [
        {
          roleType: "protagonist",
          roleName: "Rotkäppchen",
          roleCount: 1,
          description: "Liebes Mädchen mit roter Kappe",
          required: true,
          archetypePreference: "INNOCENT_CHILD",
          ageRangeMin: 5,
          ageRangeMax: 10,
          professionPreference: ["child"],
        },
        {
          roleType: "antagonist",
          roleName: "Wolf",
          roleCount: 1,
          description: "Listiger böser Wolf",
          required: true,
          archetypePreference: "TRICKSTER_VILLAIN",
          ageRangeMin: 20,
          ageRangeMax: 50,
          professionPreference: ["animal", "predator"],
        },
        {
          roleType: "supporting",
          roleName: "Großmutter",
          roleCount: 1,
          description: "Kranke alte Großmutter",
          required: true,
          archetypePreference: "WISE_ELDER",
          ageRangeMin: 60,
          ageRangeMax: 80,
          professionPreference: ["elder", "grandmother"],
        },
        {
          roleType: "helper",
          roleName: "Jäger",
          roleCount: 1,
          description: "Mutiger Jäger der rettet",
          required: true,
          archetypePreference: "BRAVE_HERO",
          ageRangeMin: 25,
          ageRangeMax: 45,
          professionPreference: ["hunter", "rescuer"],
        },
      ],
      scenes: [
        {
          sceneNumber: 1,
          sceneTitle: "Der Auftrag",
          sceneDescription: "Die Mutter gibt Rotkäppchen einen Korb mit Kuchen und Wein für die kranke Großmutter. Sie warnt: 'Bleib auf dem Weg und sprich nicht mit Fremden!'",
          characterVariables: { hero: "Rotkäppchen", mother: "Mutter" },
          setting: "Gemütliches Dorfhaus, sonniger Morgen",
          mood: "Fröhlich, fürsorglich, Aufbruch",
          illustrationPromptTemplate: "WARM INTERIOR SHOT of {mother} giving basket to {hero} wearing red hooded cape. Cozy cottage kitchen, sunlight through window. {hero} smiling innocently. Basket with checkered cloth. Watercolor style, warm morning light.",
          durationSeconds: 40,
        },
        {
          sceneNumber: 2,
          sceneTitle: "Begegnung im Wald",
          sceneDescription: "Im Wald trifft Rotkäppchen den Wolf. Er fragt freundlich wohin sie geht. Das naive Mädchen erzählt ihm alles von der kranken Großmutter.",
          characterVariables: { hero: "Rotkäppchen", villain: "Wolf" },
          setting: "Waldweg mit Blumen und Bäumen",
          mood: "Scheinbar friedlich, aber gefährlich",
          illustrationPromptTemplate: "MEDIUM SHOT of {hero} in red cape meeting {villain} on forest path. Wolf acting friendly, {hero} innocent and trusting. Dappled forest light, wildflowers. Deceptively peaceful mood. Watercolor style.",
          durationSeconds: 45,
        },
        {
          sceneNumber: 3,
          sceneTitle: "Die Ablenkung",
          sceneDescription: "Der Wolf schlägt vor, Blumen zu pflücken für die Großmutter. Während Rotkäppchen spielt, rennt der Wolf zum Haus der Großmutter.",
          characterVariables: { hero: "Rotkäppchen", villain: "Wolf" },
          setting: "Blumenwiese im Wald",
          mood: "Täuschung, Zeitdruck, Ahnungslosigkeit",
          illustrationPromptTemplate: "SPLIT SCENE: {hero} picking flowers in sunny meadow (innocent), {villain} running toward grandmother's house (sinister). Contrast between peaceful and threatening. Watercolor style, dynamic composition.",
          durationSeconds: 40,
        },
        {
          sceneNumber: 4,
          sceneTitle: "Bei der Großmutter",
          sceneDescription: "Rotkäppchen erreicht das Haus. 'Großmutter' liegt im Bett. 'Was hast du für große Ohren!' - 'Damit ich dich besser hören kann!' Der Wolf in Verkleidung!",
          characterVariables: { hero: "Rotkäppchen", villain: "Wolf (als Großmutter verkleidet)", grandmother: "Großmutter (verschlungen)" },
          setting: "Großmutters Schlafzimmer, düster",
          mood: "Spannung, Gefahr, Täuschung",
          illustrationPromptTemplate: "CLOSE-UP DRAMATIC SHOT of {villain} disguised as grandmother in bed, nightcap and glasses. {hero} approaching bed with basket. 'What big teeth you have!' Dark bedroom, ominous shadows. Suspenseful atmosphere, watercolor style.",
          durationSeconds: 50,
        },
        {
          sceneNumber: 5,
          sceneTitle: "Die Rettung",
          sceneDescription: "Der Wolf verschlingt Rotkäppchen! Ein Jäger hört Schnarchen, wird misstrauisch. Er schneidet den Wolf-Bauch auf - heraus kommen Großmutter und Rotkäppchen!",
          characterVariables: { hero: "Rotkäppchen", villain: "Wolf", helper: "Jäger", grandmother: "Großmutter" },
          setting: "Großmutters Haus, dann draußen",
          mood: "Rettung, Erleichterung, Gerechtigkeit",
          illustrationPromptTemplate: "HERO RESCUE SHOT of {helper} cutting open wolf's belly with scissors. {hero} and {grandmother} emerging safe. Dramatic lighting, action composition. Relief and joy on faces. Watercolor style, triumphant mood.",
          durationSeconds: 55,
        },
        {
          sceneNumber: 6,
          sceneTitle: "Happy End",
          sceneDescription: "Sie füllen den Wolf mit Steinen. Er erwacht und stirbt beim Fluchtversuch. Alle drei essen gemeinsam den Kuchen. Rotkäppchen verspricht: 'Nie wieder vom Weg abgehen!'",
          characterVariables: { hero: "Rotkäppchen", helper: "Jäger", grandmother: "Großmutter" },
          setting: "Großmutters Haus, friedliche Atmosphäre",
          mood: "Glücklich, Lektion gelernt, Gemeinschaft",
          illustrationPromptTemplate: "WARM CONCLUSION SHOT of {hero}, {grandmother}, and {helper} sharing cake and wine at table. Cozy cottage interior, sunlight through lace curtains. Happy relieved faces. Lesson learned atmosphere. Watercolor style, golden light.",
          durationSeconds: 45,
        },
      ],
    },

    // Add more tales here - continuing with top 50 Grimm tales
    // Then Andersen tales, Russian tales, etc.
    // Structure maintained for all 150 tales

    // Example: Andersen tale
    {
      id: "andersen-001",
      title: "Die kleine Meerjungfrau",
      source: "Andersen",
      originalLanguage: "Danish",
      englishTranslation: "The Little Mermaid",
      cultureRegion: "Denmark",
      ageRecommendation: 7,
      durationMinutes: 15,
      genreTags: ["fantasy", "love", "sacrifice"],
      moralLesson: "Wahre Liebe bedeutet Opferbereitschaft",
      summary: "Eine junge Meerjungfrau verliebt sich in einen Prinzen und gibt ihre Stimme auf, um Beine zu bekommen. Trotz Opfer findet sie nicht die erhoffte Liebe.",
      roles: [
        {
          roleType: "protagonist",
          roleName: "Kleine Meerjungfrau",
          roleCount: 1,
          description: "Träumende junge Meerjungfrau",
          required: true,
          archetypePreference: "DREAMER",
          ageRangeMin: 14,
          ageRangeMax: 18,
          professionPreference: ["mermaid", "princess"],
        },
        {
          roleType: "love_interest",
          roleName: "Prinz",
          roleCount: 1,
          description: "Menschlicher Prinz",
          required: true,
          archetypePreference: "NOBLE_HERO",
          ageRangeMin: 18,
          ageRangeMax: 25,
          professionPreference: ["prince", "sailor"],
        },
        {
          roleType: "antagonist",
          roleName: "Meerhexe",
          roleCount: 1,
          description: "Dunkle Hexe der Unterwasserwelt",
          required: true,
          archetypePreference: "DARK_SORCERESS",
          ageRangeMin: 40,
          ageRangeMax: 80,
          professionPreference: ["witch", "sea_creature"],
        },
      ],
      scenes: [
        {
          sceneNumber: 1,
          sceneTitle: "Die Unterwasserwelt",
          sceneDescription: "Die kleine Meerjungfrau lebt mit ihren Schwestern im Meerespalast. Sie träumt von der Welt über dem Wasser und den Menschen.",
          characterVariables: { hero: "Kleine Meerjungfrau", sisters: "Schwestern" },
          setting: "Prachtvoller Unterwasser-Palast mit Korallen",
          mood: "Magisch, sehnsüchtig, träumerisch",
          illustrationPromptTemplate: "UNDERWATER PALACE SHOT of {hero} looking up toward surface light. Magnificent coral palace, tropical fish, shimmering water. {hero} has beautiful tail, longing expression. Magical underwater lighting, watercolor style.",
          durationSeconds: 50,
        },
        // ... more scenes for Little Mermaid
      ],
    },

    // Continue building all 150 tales...
    // This is a template showing the structure
  ];
}

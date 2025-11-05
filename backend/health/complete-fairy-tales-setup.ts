// Complete Fairy Tales Database Setup
// Creates all 6 tables and seeds with 3 fairy tales

import { api } from "encore.dev/api";
import { fairytalesDB } from "../fairytales/db";

export const completeFairyTalesSetup = api(
  { expose: true, method: "POST", path: "/health/complete-fairy-tales-setup" },
  async (): Promise<{ success: boolean; message: string; details?: any }> => {
    try {
      console.log("Starting complete fairy tales database setup...");
      const results: any = {};

      // ===== STEP 1: Drop existing tables =====
      console.log("Step 1: Dropping existing tables...");
      await fairytalesDB.exec`DROP TABLE IF EXISTS fairy_tale_usage_stats CASCADE`;
      await fairytalesDB.exec`DROP TABLE IF EXISTS generated_story_scenes CASCADE`;
      await fairytalesDB.exec`DROP TABLE IF EXISTS generated_stories CASCADE`;
      await fairytalesDB.exec`DROP TABLE IF EXISTS fairy_tale_scenes CASCADE`;
      await fairytalesDB.exec`DROP TABLE IF EXISTS fairy_tale_roles CASCADE`;
      await fairytalesDB.exec`DROP TABLE IF EXISTS fairy_tales CASCADE`;
      results.step1 = "Tables dropped";

      // ===== STEP 2: Create fairy_tales table =====
      console.log("Step 2: Creating fairy_tales table...");
      await fairytalesDB.exec`
        CREATE TABLE fairy_tales (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          source TEXT NOT NULL,
          original_language TEXT,
          english_translation TEXT,
          culture_region TEXT NOT NULL,
          age_recommendation INTEGER NOT NULL,
          duration_minutes INTEGER DEFAULT 10,
          genre_tags TEXT NOT NULL DEFAULT '[]',
          moral_lesson TEXT,
          summary TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await fairytalesDB.exec`CREATE INDEX idx_fairy_tales_source ON fairy_tales(source)`;
      await fairytalesDB.exec`CREATE INDEX idx_fairy_tales_age ON fairy_tales(age_recommendation)`;
      await fairytalesDB.exec`CREATE INDEX idx_fairy_tales_active ON fairy_tales(is_active)`;
      results.step2 = "fairy_tales table created";

      // ===== STEP 3: Create fairy_tale_roles table =====
      console.log("Step 3: Creating fairy_tale_roles table...");
      await fairytalesDB.exec`
        CREATE TABLE fairy_tale_roles (
          id SERIAL PRIMARY KEY,
          tale_id TEXT NOT NULL REFERENCES fairy_tales(id) ON DELETE CASCADE,
          role_type TEXT NOT NULL,
          role_name TEXT,
          role_count INTEGER DEFAULT 1,
          description TEXT,
          required BOOLEAN DEFAULT true,
          archetype_preference TEXT,
          age_range_min INTEGER,
          age_range_max INTEGER,
          profession_preference TEXT DEFAULT '[]',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await fairytalesDB.exec`CREATE INDEX idx_fairy_tale_roles_tale ON fairy_tale_roles(tale_id)`;
      await fairytalesDB.exec`CREATE INDEX idx_fairy_tale_roles_type ON fairy_tale_roles(role_type)`;
      results.step3 = "fairy_tale_roles table created";

      // ===== STEP 4: Create fairy_tale_scenes table =====
      console.log("Step 4: Creating fairy_tale_scenes table...");
      await fairytalesDB.exec`
        CREATE TABLE fairy_tale_scenes (
          id SERIAL PRIMARY KEY,
          tale_id TEXT NOT NULL REFERENCES fairy_tales(id) ON DELETE CASCADE,
          scene_number INTEGER NOT NULL,
          scene_title TEXT,
          scene_description TEXT NOT NULL,
          dialogue_template TEXT,
          character_variables TEXT DEFAULT '{}',
          setting TEXT,
          mood TEXT,
          illustration_prompt_template TEXT,
          duration_seconds INTEGER DEFAULT 60,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (tale_id, scene_number)
        )
      `;
      await fairytalesDB.exec`CREATE INDEX idx_fairy_tale_scenes_tale ON fairy_tale_scenes(tale_id)`;
      await fairytalesDB.exec`CREATE INDEX idx_fairy_tale_scenes_number ON fairy_tale_scenes(tale_id, scene_number)`;
      results.step4 = "fairy_tale_scenes table created";

      // ===== STEP 5: Create generated_stories table =====
      console.log("Step 5: Creating generated_stories table...");
      await fairytalesDB.exec`
        CREATE TABLE generated_stories (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          tale_id TEXT NOT NULL REFERENCES fairy_tales(id),
          title TEXT NOT NULL,
          story_text TEXT,
          character_mappings TEXT NOT NULL,
          generation_params TEXT,
          status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),
          error_message TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await fairytalesDB.exec`CREATE INDEX idx_generated_stories_user ON generated_stories(user_id)`;
      await fairytalesDB.exec`CREATE INDEX idx_generated_stories_tale ON generated_stories(tale_id)`;
      await fairytalesDB.exec`CREATE INDEX idx_generated_stories_status ON generated_stories(status)`;
      await fairytalesDB.exec`CREATE INDEX idx_generated_stories_created ON generated_stories(created_at)`;
      results.step5 = "generated_stories table created";

      // ===== STEP 6: Create generated_story_scenes table =====
      console.log("Step 6: Creating generated_story_scenes table...");
      await fairytalesDB.exec`
        CREATE TABLE generated_story_scenes (
          id SERIAL PRIMARY KEY,
          story_id TEXT NOT NULL REFERENCES generated_stories(id) ON DELETE CASCADE,
          scene_number INTEGER NOT NULL,
          scene_text TEXT NOT NULL,
          image_url TEXT,
          image_prompt TEXT,
          image_generation_status TEXT DEFAULT 'pending' CHECK (image_generation_status IN ('pending', 'generating', 'ready', 'failed')),
          consistency_score DECIMAL(3,1),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (story_id, scene_number)
        )
      `;
      await fairytalesDB.exec`CREATE INDEX idx_generated_story_scenes_story ON generated_story_scenes(story_id)`;
      await fairytalesDB.exec`CREATE INDEX idx_generated_story_scenes_number ON generated_story_scenes(story_id, scene_number)`;
      results.step6 = "generated_story_scenes table created";

      // ===== STEP 7: Create fairy_tale_usage_stats table =====
      console.log("Step 7: Creating fairy_tale_usage_stats table...");
      await fairytalesDB.exec`
        CREATE TABLE fairy_tale_usage_stats (
          tale_id TEXT PRIMARY KEY REFERENCES fairy_tales(id) ON DELETE CASCADE,
          total_generations INTEGER DEFAULT 0,
          successful_generations INTEGER DEFAULT 0,
          failed_generations INTEGER DEFAULT 0,
          avg_generation_time_seconds DECIMAL(10,2),
          last_generated_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await fairytalesDB.exec`CREATE INDEX idx_fairy_tale_usage_tale ON fairy_tale_usage_stats(tale_id)`;
      results.step7 = "fairy_tale_usage_stats table created";

      // ===== STEP 8: Seed Hänsel und Gretel =====
      console.log("Step 8: Seeding Hänsel und Gretel...");
      await fairytalesDB.exec`
        INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
        VALUES (
          'grimm-015',
          'Hänsel und Gretel',
          'grimm',
          'de',
          'Hansel and Gretel',
          'german',
          7,
          15,
          '["adventure", "dark", "moral", "family"]',
          'Cleverness and courage triumph over greed and evil',
          'Two siblings are abandoned in the forest and must use their wits to escape a wicked witch who lives in a gingerbread house.',
          true
        )
      `;
      
      // Roles for Hänsel und Gretel
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES
          ('grimm-015', 'protagonist', 'Hänsel', 1, 'Clever boy who saves his sister', true, 'hero', 6, 12, '["child"]')
      `;
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES
          ('grimm-015', 'protagonist', 'Gretel', 1, 'Brave girl who defeats the witch', true, 'hero', 6, 12, '["child"]')
      `;
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES
          ('grimm-015', 'antagonist', 'Hexe', 1, 'Evil witch who lures children', true, 'villain', 30, 200, '["witch", "villain"]')
      `;
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES
          ('grimm-015', 'supporting', 'Vater', 1, 'Poor woodcutter and father', false, 'guardian', 30, 60, '["adult", "woodcutter"]')
      `;

      // Scenes for Hänsel und Gretel (9 scenes)
      const scenes = [
        {
          scene_number: 1,
          scene_title: 'Die arme Familie',
          scene_description: '[HÄNSEL] und [GRETEL] leben mit ihrem Vater in einer kleinen Hütte am Waldrand. Die Familie ist sehr arm und hat kaum etwas zu essen.',
          character_variables: '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "SUPPORTING": "VATER"}',
          setting: 'cottage_forest_edge',
          mood: 'somber',
          illustration_prompt_template: 'Poor family in small cottage at forest edge, two children sitting at table, worried father, watercolor storybook style',
          duration_seconds: 90
        },
        {
          scene_number: 2,
          scene_title: 'Verloren im Wald',
          scene_description: '[HÄNSEL] und [GRETEL] werden tief im dunklen Wald ausgesetzt. [HÄNSEL] hat Brotkrumen ausgestreut, aber die Vögel haben sie aufgepickt.',
          character_variables: '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL"}',
          setting: 'dark_forest',
          mood: 'mysterious',
          illustration_prompt_template: 'Two children lost in dark mysterious forest, looking worried, birds flying above, mystical atmosphere',
          duration_seconds: 75
        },
        {
          scene_number: 3,
          scene_title: 'Das Lebkuchenhaus',
          scene_description: '[HÄNSEL] und [GRETEL] entdecken ein wunderschönes Haus aus Lebkuchen, Zuckerguss und Süßigkeiten. Sie sind so hungrig und beginnen zu naschen.',
          character_variables: '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL"}',
          setting: 'gingerbread_house',
          mood: 'magical',
          illustration_prompt_template: 'Enchanting gingerbread house decorated with candy and frosting, two amazed children eating, magical glowing',
          duration_seconds: 80
        },
        {
          scene_number: 4,
          scene_title: 'Die böse Hexe',
          scene_description: 'Eine alte [HEXE] kommt aus dem Haus. Sie tut freundlich, aber sie will die Kinder fangen und fressen.',
          character_variables: '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "ANTAGONIST": "HEXE"}',
          setting: 'gingerbread_house',
          mood: 'sinister',
          illustration_prompt_template: 'Evil witch with crooked smile greeting two frightened children at gingerbread house door, ominous',
          duration_seconds: 70
        },
        {
          scene_number: 5,
          scene_title: 'Gefangen',
          scene_description: '[HÄNSEL] wird in einen Käfig gesperrt. Die [HEXE] will ihn mästen. [GRETEL] muss für die Hexe arbeiten.',
          character_variables: '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "ANTAGONIST": "HEXE"}',
          setting: 'witch_cottage_interior',
          mood: 'tense',
          illustration_prompt_template: 'Boy locked in cage, girl working in kitchen, witch checking on boy, dark interior',
          duration_seconds: 85
        },
        {
          scene_number: 6,
          scene_title: 'Gretels List',
          scene_description: '[GRETEL] ist sehr clever. Als die [HEXE] in den Ofen schauen will, stößt [GRETEL] sie hinein und schließt die Tür!',
          character_variables: '{"PROTAGONIST2": "GRETEL", "ANTAGONIST": "HEXE"}',
          setting: 'witch_cottage_interior',
          mood: 'triumphant',
          illustration_prompt_template: 'Brave girl pushing evil witch into oven, dramatic moment of victory, heroic action',
          duration_seconds: 65
        },
        {
          scene_number: 7,
          scene_title: 'Die Befreiung',
          scene_description: '[GRETEL] befreit [HÄNSEL] aus dem Käfig. Sie finden Schätze und Edelsteine im Haus der Hexe.',
          character_variables: '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL"}',
          setting: 'witch_cottage_interior',
          mood: 'joyful',
          illustration_prompt_template: 'Girl freeing boy from cage, treasure chests with jewels around them, happy reunion',
          duration_seconds: 70
        },
        {
          scene_number: 8,
          scene_title: 'Der Heimweg',
          scene_description: '[HÄNSEL] und [GRETEL] finden den Weg nach Hause. Ein weißer Schwan hilft ihnen über den Fluss.',
          character_variables: '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL"}',
          setting: 'river_forest',
          mood: 'peaceful',
          illustration_prompt_template: 'Two children riding on white swan across river, forest in background, hopeful journey home',
          duration_seconds: 75
        },
        {
          scene_number: 9,
          scene_title: 'Glückliches Ende',
          scene_description: 'Zurück zu Hause freut sich der [VATER] riesig. Mit den Schätzen ist die Familie nie wieder arm. Sie leben glücklich zusammen.',
          character_variables: '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "SUPPORTING": "VATER"}',
          setting: 'cottage_forest_edge',
          mood: 'happy',
          illustration_prompt_template: 'Family reunion at cottage, father hugging children, treasure visible, warm happy ending',
          duration_seconds: 80
        }
      ];

      for (const scene of scenes) {
        await fairytalesDB.exec`
          INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, illustration_prompt_template, duration_seconds)
          VALUES (
            'grimm-015',
            ${scene.scene_number},
            ${scene.scene_title},
            ${scene.scene_description},
            ${scene.character_variables},
            ${scene.setting},
            ${scene.mood},
            ${scene.illustration_prompt_template},
            ${scene.duration_seconds}
          )
        `;
      }
      
      results.step8 = "Hänsel und Gretel seeded (1 tale, 4 roles, 9 scenes)";

      // ===== STEP 9: Seed Rotkäppchen =====
      console.log("Step 9: Seeding Rotkäppchen...");
      await fairytalesDB.exec`
        INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
        VALUES (
          'grimm-026',
          'Rotkäppchen',
          'grimm',
          'de',
          'Little Red Riding Hood',
          'german',
          5,
          10,
          '["moral", "adventure", "animals"]',
          'Always listen to your parents and be careful of strangers',
          'A little girl wearing a red hood visits her grandmother but encounters a cunning wolf on the way.',
          true
        )
      `;

      // Roles
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES ('grimm-026', 'protagonist', 'Rotkäppchen', 1, 'Innocent girl with red hood', true, 'innocent', 5, 10, '["child"]')
      `;
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES ('grimm-026', 'antagonist', 'Wolf', 1, 'Cunning and hungry wolf', true, 'trickster', 5, 100, '["wolf", "animal", "villain"]')
      `;
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES ('grimm-026', 'supporting', 'Großmutter', 1, 'Kind elderly grandmother', false, 'elder', 60, 100, '["grandmother", "elder"]')
      `;
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES ('grimm-026', 'helper', 'Jäger', 1, 'Brave hunter who saves them', false, 'hero', 25, 50, '["hunter", "adult", "hero"]')
      `;

      results.step9 = "Rotkäppchen seeded (1 tale, 4 roles)";

      // ===== STEP 10: Seed Die Bremer Stadtmusikanten =====
      console.log("Step 10: Seeding Die Bremer Stadtmusikanten...");
      await fairytalesDB.exec`
        INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
        VALUES (
          'grimm-027',
          'Die Bremer Stadtmusikanten',
          'grimm',
          'de',
          'The Town Musicians of Bremen',
          'german',
          5,
          12,
          '["adventure", "animals", "teamwork", "humor"]',
          'Teamwork and friendship can overcome any obstacle',
          'Four aging animals - a donkey, dog, cat, and rooster - run away to become musicians and outsmart a band of robbers.',
          true
        )
      `;

      // Roles
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES ('grimm-027', 'protagonist', 'Esel', 1, 'Wise old donkey, leader', true, 'sage', 10, 100, '["donkey", "animal"]')
      `;
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES ('grimm-027', 'protagonist', 'Hund', 1, 'Loyal hunting dog', true, 'loyal_companion', 8, 100, '["dog", "animal"]')
      `;
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES ('grimm-027', 'protagonist', 'Katze', 1, 'Clever cat', true, 'trickster', 8, 100, '["cat", "animal"]')
      `;
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
        VALUES ('grimm-027', 'protagonist', 'Hahn', 1, 'Loud rooster', true, 'jester', 5, 100, '["rooster", "bird", "animal"]')
      `;

      results.step10 = "Die Bremer Stadtmusikanten seeded (1 tale, 4 roles)";

      // ===== STEP 11: Initialize usage stats =====
      console.log("Step 11: Initializing usage stats...");
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_usage_stats (tale_id, total_generations, successful_generations)
        VALUES ('grimm-015', 0, 0)
      `;
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_usage_stats (tale_id, total_generations, successful_generations)
        VALUES ('grimm-026', 0, 0)
      `;
      await fairytalesDB.exec`
        INSERT INTO fairy_tale_usage_stats (tale_id, total_generations, successful_generations)
        VALUES ('grimm-027', 0, 0)
      `;
      results.step11 = "Usage stats initialized for 3 tales";

      // ===== FINAL: Verify counts =====
      console.log("Final: Verifying data...");
      const talesCount = await fairytalesDB.queryRow<{ count: string }>`SELECT COUNT(*) as count FROM fairy_tales`;
      const rolesCount = await fairytalesDB.queryRow<{ count: string }>`SELECT COUNT(*) as count FROM fairy_tale_roles`;
      const scenesCount = await fairytalesDB.queryRow<{ count: string }>`SELECT COUNT(*) as count FROM fairy_tale_scenes`;
      const statsCount = await fairytalesDB.queryRow<{ count: string }>`SELECT COUNT(*) as count FROM fairy_tale_usage_stats`;

      results.final_counts = {
        fairy_tales: talesCount ? parseInt(talesCount.count) : 0,
        fairy_tale_roles: rolesCount ? parseInt(rolesCount.count) : 0,
        fairy_tale_scenes: scenesCount ? parseInt(scenesCount.count) : 0,
        fairy_tale_usage_stats: statsCount ? parseInt(statsCount.count) : 0
      };

      console.log("✅ Complete fairy tales setup finished successfully!");
      return {
        success: true,
        message: "All 6 fairy tales tables created and seeded with 3 complete fairy tales",
        details: results
      };
    } catch (error) {
      console.error("❌ Error during fairy tales setup:", error);
      return {
        success: false,
        message: `Setup failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
);

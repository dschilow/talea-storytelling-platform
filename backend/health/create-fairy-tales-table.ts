import { api } from "encore.dev/api";
import { fairytalesDB } from "../fairytales/db";

export interface DirectSQLResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Direct SQL test endpoint to create fairy_tales table
 */
export const createFairyTalesTable = api(
  { expose: true, method: "POST", path: "/health/create-fairy-tales-table", auth: false },
  async (): Promise<DirectSQLResponse> => {
    try {
      console.log("Creating fairy_tales table...");
      
      // Drop if exists (for testing)
      await fairytalesDB.exec`DROP TABLE IF EXISTS fairy_tales CASCADE`;
      
      // Create table
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
      
      console.log("✅ fairy_tales table created!");
      
      // Create indexes
      await fairytalesDB.exec`CREATE INDEX idx_fairy_tales_source ON fairy_tales(source)`;
      await fairytalesDB.exec`CREATE INDEX idx_fairy_tales_age ON fairy_tales(age_recommendation)`;
      await fairytalesDB.exec`CREATE INDEX idx_fairy_tales_active ON fairy_tales(is_active)`;
      
      console.log("✅ Indexes created!");
      
      // Insert test data
      await fairytalesDB.exec`
        INSERT INTO fairy_tales (id, title, source, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
        VALUES 
          ('grimm-015', 'Hänsel und Gretel', 'Grimm', 'Deutschland', 6, 15, '["adventure", "dark", "moral"]', 'Geschwisterliebe und Mut', 'Zwei Geschwister werden im Wald ausgesetzt und finden das Hexenhaus.', true),
          ('grimm-026', 'Rotkäppchen', 'Grimm', 'Deutschland', 5, 10, '["classic", "moral", "danger"]', 'Vorsicht vor Fremden', 'Ein Mädchen mit roter Kappe besucht die Großmutter und begegnet dem bösen Wolf.', true),
          ('grimm-027', 'Die Bremer Stadtmusikanten', 'Grimm', 'Deutschland', 4, 12, '["friendship", "adventure", "humor"]', 'Gemeinsam sind wir stark', 'Vier Tiere schließen sich zusammen, um in Bremen Stadtmusikanten zu werden.', true)
      `;
      
      console.log("✅ Test data inserted!");
      
      return {
        success: true,
        message: "fairy_tales table created successfully with 3 test entries"
      };
    } catch (err: any) {
      console.error("❌ Error:", err);
      return {
        success: false,
        message: "Failed to create table",
        error: err.message
      };
    }
  }
);

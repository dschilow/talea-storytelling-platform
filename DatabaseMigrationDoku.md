# Database Migration Dokumentation

## Übersicht

Dieses Dokument beschreibt, wie Database Migrations in der Talea-App durchgeführt werden, insbesondere wenn die automatischen Encore.dev Migrations in Railway nicht funktionieren.

## Problem

Encore.dev führt normalerweise SQL-Migrations automatisch beim Deployment aus. In Railway Docker-Containern werden jedoch manchmal die SQL-Migrations-Dateien nicht in den Container kopiert, wodurch die automatische Migration fehlschlägt.

## Lösung: API-basierte Migrations

Wir haben ein Emergency API-Endpoint erstellt, das SQL-Befehle über HTTP ausführen kann.

### 1. API Endpoint erstellen

**Datei:** `backend/story/run-migration-sql.ts`

```typescript
import { api } from "encore.dev/api";
import { storyDB } from "./db";

interface RunMigrationSQLRequest {
  sql: string;
  migrationName: string;
}

interface RunMigrationSQLResponse {
  success: boolean;
  message: string;
  statementsExecuted?: number;
}

export const runMigrationSQL = api<RunMigrationSQLRequest, RunMigrationSQLResponse>(
  { expose: true, method: "POST", path: "/story/run-migration-sql", auth: false },
  async (req) => {
    console.log(`[Migration API] Received migration request: ${req.migrationName}`);
    console.log(`[Migration API] SQL length: ${req.sql.length} characters`);

    try {
      let executedCount = 1;

      try {
        // Versuche zunächst, als einzelne Transaktion auszuführen
        await storyDB.exec([req.sql] as any);
        console.log(`[Migration API] ✅ SQL executed successfully as single transaction`);
      } catch (error: any) {
        // Falls das fehlschlägt, führe Statement für Statement aus
        console.log(`[Migration API] Single execution failed, trying statement-by-statement...`);

        const statements = req.sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`[Migration API] Executing ${statements.length} SQL statements...`);

        executedCount = 0;
        for (const [index, statement] of statements.entries()) {
          try {
            await storyDB.exec([statement] as any);
            executedCount++;
          } catch (error: any) {
            // Ignoriere "already exists" Fehler (Idempotenz)
            if (error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
              console.log(`[Migration API] Statement ${index + 1} skipped (already exists)`);
              executedCount++;
              continue;
            }
            throw error;
          }
        }
      }

      return {
        success: true,
        message: `Migration ${req.migrationName} completed successfully. Executed ${executedCount} statements.`,
        statementsExecuted: executedCount,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Migration ${req.migrationName} failed: ${error.message || error.toString()}`,
      };
    }
  }
);
```

**Wichtig:**
- `auth: false` - Endpoint ist ohne Authentifizierung zugänglich (nur für Emergency-Fälle!)
- Statement-by-Statement Fallback für komplexe Migrations
- Idempotenz durch Ignorieren von "already exists" Fehlern

### 2. Endpoint registrieren

**Datei:** `backend/story/encore.service.ts`

```typescript
import "./run-migration-sql";
```

### 3. Migration Scripts erstellen

#### Beispiel: Artifact Pool System

**Migration 1: Tabellen erstellen**

**Datei:** `backend/story/migrations/9_create_artifact_pool.up.sql`

```sql
-- Create artifact_pool table
CREATE TABLE IF NOT EXISTS artifact_pool (
    id TEXT PRIMARY KEY,
    name_de TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_de TEXT NOT NULL,
    description_en TEXT NOT NULL,
    category TEXT NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'common',
    story_role TEXT NOT NULL,
    discovery_scenarios TEXT[] NOT NULL DEFAULT '{}',
    usage_scenarios TEXT[] NOT NULL DEFAULT '{}',
    emoji TEXT,
    visual_keywords TEXT[] NOT NULL DEFAULT '{}',
    genre_adventure DECIMAL(3,2) DEFAULT 0.5,
    genre_fantasy DECIMAL(3,2) DEFAULT 0.5,
    genre_mystery DECIMAL(3,2) DEFAULT 0.5,
    genre_nature DECIMAL(3,2) DEFAULT 0.5,
    genre_friendship DECIMAL(3,2) DEFAULT 0.5,
    genre_courage DECIMAL(3,2) DEFAULT 0.5,
    genre_learning DECIMAL(3,2) DEFAULT 0.5,
    recent_usage_count INTEGER DEFAULT 0,
    total_usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    last_used_in_story_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_artifact_pool_category ON artifact_pool(category);
CREATE INDEX IF NOT EXISTS idx_artifact_pool_rarity ON artifact_pool(rarity);
CREATE INDEX IF NOT EXISTS idx_artifact_pool_active ON artifact_pool(is_active);

-- Junction table for story-artifact relationships
CREATE TABLE IF NOT EXISTS story_artifacts (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    artifact_id TEXT NOT NULL REFERENCES artifact_pool(id),
    discovery_chapter INTEGER,
    usage_chapter INTEGER,
    is_unlocked BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_story_artifacts_story ON story_artifacts(story_id);
CREATE INDEX IF NOT EXISTS idx_story_artifacts_artifact ON story_artifacts(artifact_id);
CREATE INDEX IF NOT EXISTS idx_story_artifacts_unlocked ON story_artifacts(is_unlocked);
```

**Down Migration:** `9_create_artifact_pool.down.sql`

```sql
DROP TABLE IF EXISTS story_artifacts CASCADE;
DROP TABLE IF EXISTS artifact_pool CASCADE;
```

**Migration 2: Daten einfügen**

**Datei:** `backend/story/migrations/10_seed_artifact_pool.up.sql`

```sql
INSERT INTO artifact_pool (id, name_de, name_en, description_de, description_en, ...) VALUES
('artifact_001', 'Kristallschwert', 'Crystal Sword', 'Ein glänzendes Schwert...', 'A gleaming sword...', ...),
('artifact_002', 'Zeitkompass', 'Time Compass', 'Ein magischer Kompass...', 'A magical compass...', ...),
-- ... 98 weitere Artefakte
('artifact_100', '...', '...', '...', '...', ...);
```

### 4. Bun-Script zum Ausführen der Migrations

**Datei:** `execute-migrations-via-api.ts`

```typescript
#!/usr/bin/env bun
import { readFile } from "fs/promises";
import { join } from "path";

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

async function runMigration(migrationPath: string, migrationName: string): Promise<boolean> {
  console.log(`\n🔄 Running ${migrationName}...`);

  try {
    // SQL-Datei lesen
    const sql = await readFile(migrationPath, "utf-8");
    console.log(`  📄 SQL file size: ${sql.length} characters`);

    // An API senden
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: sql,
        migrationName: migrationName,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log(`  ✅ ${migrationName} completed successfully`);
        console.log(`     ${result.message || ""}`);
        if (result.statementsExecuted) {
          console.log(`     Executed ${result.statementsExecuted} SQL statements`);
        }
        return true;
      } else {
        console.log(`  ❌ ${migrationName} failed`);
        console.log(`     ${result.message || ""}`);
        return false;
      }
    } else {
      console.log(`  ❌ HTTP Error ${response.status}`);
      const text = await response.text();
      console.log(`     ${text}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("🚀 Talea Migration Runner (API Mode)\n");

  // Migrations in Reihenfolge definieren
  const migrationsDir = join(import.meta.dir, "backend", "story", "migrations");
  const migrations = [
    { file: "9_create_artifact_pool.up.sql", name: "9_create_artifact_pool" },
    { file: "10_seed_artifact_pool.up.sql", name: "10_seed_artifact_pool" },
  ];

  // Jede Migration ausführen
  let successCount = 0;
  for (const migration of migrations) {
    const migrationPath = join(migrationsDir, migration.file);

    const success = await runMigration(migrationPath, migration.name);
    if (success) {
      successCount++;
    } else {
      console.log(`\n⚠️  Migration failed. Stopping here.`);
      break;
    }
  }

  // Zusammenfassung
  console.log(`\n📊 Final Results:`);
  console.log(`  Migrations executed: ${successCount}/${migrations.length}`);

  if (successCount === migrations.length) {
    console.log("\n🎉 SUCCESS! All migrations completed!");
  } else {
    console.log(`\n⚠️  Warning: Only ${successCount}/${migrations.length} migrations completed.`);
  }
}

main().catch(console.error);
```

### 5. Migrations ausführen

```bash
# Alle Migrations ausführen
bun run execute-migrations-via-api.ts
```

**Erwartete Ausgabe:**

```
🚀 Talea Migration Runner (API Mode)

🔄 Running 9_create_artifact_pool...
  📄 SQL file size: 2847 characters
  ✅ 9_create_artifact_pool completed successfully
     Migration 9_create_artifact_pool completed successfully. Executed 7 statements.
     Executed 7 SQL statements

🔄 Running 10_seed_artifact_pool...
  📄 SQL file size: 50336 characters
  ✅ 10_seed_artifact_pool completed successfully
     Migration 10_seed_artifact_pool completed successfully. Executed 1 statements.
     Executed 1 SQL statements

📊 Final Results:
  Migrations executed: 2/2

🎉 SUCCESS! All migrations completed!
```

### 6. Verifizierung in Railway Postgres

Nach erfolgreicher Migration in Railway Postgres Dashboard:

```sql
-- Anzahl der Artefakte prüfen
SELECT COUNT(*) FROM artifact_pool;
-- Ergebnis: 100

-- Nach Rarity gruppieren
SELECT rarity, COUNT(*) FROM artifact_pool GROUP BY rarity ORDER BY COUNT(*) DESC;

-- Erste 10 Artefakte ansehen
SELECT name_de, name_en, category, rarity, emoji
FROM artifact_pool
ORDER BY name_de
LIMIT 10;

-- Alle Kategorien anzeigen
SELECT DISTINCT category FROM artifact_pool ORDER BY category;

-- Junction-Tabelle prüfen
SELECT COUNT(*) FROM story_artifacts;
-- Ergebnis: 0 (wird erst gefüllt, wenn User Stories lesen)
```

### 7. Audio-Doku Migration (Doku Service)

Diese Migration liegt im Doku-Service, nicht im Story-Service.

**Datei:** `backend/doku/migrations/3_create_audio_dokus.up.sql`

**Runner:** `execute-migrations-via-api.ts` (Gruppe `audio`)

```bash
bun run execute-migrations-via-api.ts audio
```

**Verifizieren:**

```sql
SELECT COUNT(*) FROM audio_dokus;
SELECT id, title, is_public, created_at FROM audio_dokus ORDER BY created_at DESC LIMIT 5;
```

## Tipps für eigene Migrations

### 1. Migration-Dateinamen

Encore.dev erfordert **sequentielle Nummerierung**:

✅ **Richtig:**
- `9_create_artifact_pool.up.sql`
- `10_seed_artifact_pool.up.sql`
- `11_add_new_column.up.sql`

❌ **Falsch:**
- `9b_create_indexes.up.sql` (Buchstaben nach Nummer nicht erlaubt)
- `create_tables.up.sql` (Nummer fehlt)

### 2. Idempotenz sicherstellen

Verwende immer `IF NOT EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS my_table (...);
CREATE INDEX IF NOT EXISTS idx_my_index ON my_table(column);
```

Dies ermöglicht mehrfaches Ausführen ohne Fehler.

### 3. Down-Migrations erstellen

Für jede `.up.sql` auch eine `.down.sql` erstellen:

**9_create_artifact_pool.up.sql:**
```sql
CREATE TABLE IF NOT EXISTS artifact_pool (...);
```

**9_create_artifact_pool.down.sql:**
```sql
DROP TABLE IF EXISTS artifact_pool CASCADE;
```

### 4. Große Seed-Daten

Für große INSERT-Statements (> 100 Zeilen):

```sql
-- Nutze ein einzelnes INSERT mit mehreren VALUES
INSERT INTO my_table (col1, col2, col3) VALUES
('val1', 'val2', 'val3'),
('val4', 'val5', 'val6'),
-- ... viele weitere
('valN', 'valN+1', 'valN+2');
```

Nicht 100 einzelne INSERT-Statements!

### 5. Foreign Keys

Achte auf die Reihenfolge beim Löschen:

```sql
-- Falsch: artifact_pool hat Foreign Keys von story_artifacts
DROP TABLE IF EXISTS artifact_pool CASCADE;
DROP TABLE IF EXISTS story_artifacts;

-- Richtig: Zuerst die Tabelle mit FK löschen
DROP TABLE IF EXISTS story_artifacts CASCADE;
DROP TABLE IF EXISTS artifact_pool CASCADE;
```

## Schnellreferenz: Neue Tabelle hinzufügen

### Schritt 1: SQL-Migration erstellen

```bash
# Nächste Nummer finden (z.B. 11)
ls backend/story/migrations/

# Migration erstellen
touch backend/story/migrations/11_create_my_table.up.sql
touch backend/story/migrations/11_create_my_table.down.sql
```

### Schritt 2: SQL schreiben

**11_create_my_table.up.sql:**
```sql
CREATE TABLE IF NOT EXISTS my_table (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_my_table_name ON my_table(name);
```

**11_create_my_table.down.sql:**
```sql
DROP TABLE IF EXISTS my_table CASCADE;
```

### Schritt 3: Migration Script anpassen

**execute-migrations-via-api.ts:**
```typescript
const migrations = [
  { file: "9_create_artifact_pool.up.sql", name: "9_create_artifact_pool" },
  { file: "10_seed_artifact_pool.up.sql", name: "10_seed_artifact_pool" },
  { file: "11_create_my_table.up.sql", name: "11_create_my_table" }, // NEU
];
```

### Schritt 4: Ausführen

```bash
bun run execute-migrations-via-api.ts
```

### Schritt 5: Verifizieren in Railway

```sql
SELECT * FROM my_table;
```

## Troubleshooting

### Problem: "Table already exists"

**Lösung:** Verwende `IF NOT EXISTS` in deinem SQL:
```sql
CREATE TABLE IF NOT EXISTS my_table (...);
```

### Problem: "Migration timeout"

**Lösung:**
- Große Seed-Daten in kleinere Batches aufteilen
- Oder: Timeout im Script erhöhen

### Problem: "Foreign key constraint violation"

**Lösung:**
- Prüfe die Reihenfolge der Tabellen-Erstellung
- Parent-Tabellen müssen zuerst erstellt werden
- Beim Löschen: Child-Tabellen zuerst löschen

### Problem: "Tabelle nicht in Railway sichtbar"

**Mögliche Ursachen:**
1. **Falsches Schema:** Prüfe mit `SELECT * FROM pg_tables WHERE tablename = 'my_table';`
2. **Falsche Datenbank:** Encore hat separate DBs pro Service
3. **Transaction nicht committed:** Verwende das API-Endpoint, es committed automatisch

**Verifizierung:**
```sql
-- Alle Tabellen anzeigen
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_type = 'BASE TABLE' AND table_schema = 'public'
ORDER BY table_name;
```

### Problem: "API Endpoint gibt 'unauthenticated' zurück"

**Lösung:**
- Stelle sicher, dass `auth: false` im API-Endpoint gesetzt ist
- Oder: Nutze das `/story/run-migration-sql` Endpoint, das bereits auth: false hat

## Zusammenfassung

1. **API Endpoint erstellen** (`run-migration-sql.ts`) für Emergency-Migrations
2. **SQL-Migrations schreiben** mit `IF NOT EXISTS` für Idempotenz
3. **Bun-Script erstellen** zum Ausführen der Migrations via API
4. **Migrations ausführen** mit `bun run execute-migrations-via-api.ts`
5. **In Railway verifizieren** mit SQL-Queries

Diese Methode funktioniert zuverlässig, auch wenn Encore's automatische Migrations in Docker fehlschlagen.

## Beispiel-Projekt: Artifact Pool System

Das komplette Artifact Pool System wurde mit dieser Methode implementiert:

- ✅ 2 Migrations (Tabellen + Seed)
- ✅ 100 Artefakte eingefügt
- ✅ 2 Tabellen: `artifact_pool` + `story_artifacts`
- ✅ 6 Indizes für Performance
- ✅ Komplett idempotent und wiederholbar

Alle Scripts befinden sich im Root-Verzeichnis:
- `execute-migrations-via-api.ts` - Haupt-Migration-Runner
- `seed-artifacts-now.ts` - Schnelles Seeding
- `verify-artifacts.ts` - Verifizierung
- `create-test-table.ts` - Datenbank-Connection testen

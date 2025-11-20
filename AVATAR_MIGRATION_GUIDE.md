# Avatar Migration - Manuelle Anleitung

## Problem

Die automatischen Encore-Migrationen funktionieren nicht auf Railway, da:
1. Encore lokal die Migration nur auf der lokalen DB ausführt
2. Direkte Verbindung zur Railway PostgreSQL schlägt mit Timeout fehl
3. Die Railway-Datenbank ist nur innerhalb des Railway-Netzwerks erreichbar

## ✅ Lösung 1: Über Railway Dashboard (EMPFOHLEN)

Da du sagst, du kannst keine Queries im Railway Dashboard ausführen, müssen wir eine andere Methode verwenden.

## ✅ Lösung 2: Backend API Endpoint (FUNKTIONIERT)

Ich habe einen API-Endpoint erstellt, der die Migration ausführt:

### Schritt 1: Backend neu deployen

```bash
cd backend
# Pushe die Änderungen zu Railway
git add .
git commit -m "Add migration API endpoint"
git push
```

### Schritt 2: Migration ausführen

Sobald das Backend deployed ist, führe aus:

```bash
node run-avatar-migration-api.cjs
```

Oder manuell via curl/Postman:

**Check Schema:**
```bash
curl https://talea-storytelling-platform-production.up.railway.app/avatar/check-schema
```

**Run Migration:**
```bash
curl -X POST https://talea-storytelling-platform-production.up.railway.app/avatar/run-migration-sql \
  -H "Content-Type: application/json" \
  -d '{
    "migrationSql": "ALTER TABLE avatars ADD COLUMN inventory TEXT DEFAULT '\''[]'\''; ALTER TABLE avatars ADD COLUMN skills TEXT DEFAULT '\''[]'\'';",
    "migrationName": "8_add_inventory_and_skills"
  }'
```

## ✅ Lösung 3: psql Client (wenn installiert)

Falls du PostgreSQL-Client-Tools installiert hast:

```bash
.\run-avatar-migration.ps1
```

## Migration SQL (Zum Kopieren)

Falls du die SQL manuell irgendwo eingeben musst:

```sql
ALTER TABLE avatars ADD COLUMN inventory TEXT DEFAULT '[]';
ALTER TABLE avatars ADD COLUMN skills TEXT DEFAULT '[]';
```

## Verifikation

Um zu prüfen, ob die Migration erfolgreich war:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'avatars'
AND column_name IN ('inventory', 'skills');
```

Sollte 2 Zeilen zurückgeben:
- inventory | text | '[]'::text
- skills | text | '[]'::text

## Nächste Schritte

Nach erfolgreicher Migration:
1. Backend neu starten (auf Railway automatisch)
2. Frontend testen (Story lesen -> Rewards bekommen)
3. Avatar Detail Screen öffnen -> Tab "Schatzkammer" sollte angezeigt werden

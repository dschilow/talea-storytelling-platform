# 🐘 Railway PostgreSQL Setup für Talea

## 📋 Übersicht

Deine App nutzt **PostgreSQL** als Production Database auf Railway. Encore.dev unterstützt beide:
- **Lokal**: SQLite (automatisch für Development)
- **Railway**: PostgreSQL (für Production)

---

## 🚀 PostgreSQL Setup auf Railway

### Schritt 1: PostgreSQL Datenbank erstellen

1. **Railway Dashboard öffnen**
   - Gehe zu deinem Projekt

2. **Neue Datenbank hinzufügen**
   - Klick auf "+ New" (oben rechts)
   - Wähle "Database"
   - Wähle "Add PostgreSQL"

3. **Datenbank wird provisioniert**
   - Railway erstellt automatisch eine PostgreSQL Instanz
   - Dauert ~30 Sekunden

---

### Schritt 2: PostgreSQL Connection URL kopieren

1. **Klick auf die PostgreSQL Datenbank** im Railway Dashboard

2. **Tab "Connect"** öffnen

3. **Kopiere die "Database URL"**
   ```
   Format:
   postgresql://user:password@host:port/database

   Beispiel:
   postgresql://postgres:xY9kLm3n@containers-us-west-1.railway.app:5432/railway
   ```

---

### Schritt 3: Encore Datenbanken konfigurieren

Encore verwendet **mehrere Datenbanken**. Wir müssen für jede eine PostgreSQL-Verbindung erstellen.

#### Benötigte Datenbanken:

1. **avatar** - Avatar-Daten, Memories, Personality
2. **user** - Benutzerprofile, Rollen
3. **story** - Geschichten, Kapitel
4. **doku** - Dokumentationen
5. **personality_tracking** - AI Personality Updates

---

### Schritt 4: Environment Variables setzen

#### Option A: Eine gemeinsame PostgreSQL Datenbank (empfohlen für Start)

Railway Dashboard → Settings → Variables:

```bash
# Haupt-Database URL (wird von Railway automatisch gesetzt)
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway

# Encore nutzt diese automatisch für alle Datenbanken
# wenn keine spezifischen URLs gesetzt sind
```

**Das war's!** Encore erstellt automatisch separate **Schemas** in derselben PostgreSQL Datenbank für jede logische Datenbank.

#### Option B: Separate PostgreSQL Datenbanken (für große Apps)

Falls du später separate Datenbanken brauchst:

```bash
# Separate Datenbanken erstellen in Railway:
# + New → Database → PostgreSQL (5x wiederholen)

# Dann Environment Variables setzen:
ENCORE_DB_AVATAR_URL=postgresql://...
ENCORE_DB_USER_URL=postgresql://...
ENCORE_DB_STORY_URL=postgresql://...
ENCORE_DB_DOKU_URL=postgresql://...
ENCORE_DB_PERSONALITY_TRACKING_URL=postgresql://...
```

**Für den Anfang: Option A reicht vollkommen!** ✅

---

### Schritt 5: Migrations ausführen

Encore führt Migrations **automatisch beim Start** aus.

1. **Deploy deine App**:
   ```bash
   git push origin main
   ```

2. **Logs checken**:
   ```bash
   railway logs
   ```

3. **Erwartete Log-Ausgaben**:
   ```
   ✅ Running database migrations for: avatar
   ✅ Applied migration: 1_create_avatars.up.sql
   ✅ Applied migration: 2_add_visual_profile.up.sql
   ✅ Running database migrations for: user
   ✅ Applied migration: 1_create_users.up.sql
   ...
   ✅ All migrations completed successfully
   ```

---

## 🔍 PostgreSQL Datenbank überprüfen

### Via Railway Dashboard:

1. PostgreSQL Datenbank öffnen
2. Tab "Data" → Query
3. SQL ausführen:

```sql
-- Alle Tabellen anzeigen
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema');

-- Avatare zählen
SELECT COUNT(*) FROM avatars;

-- User zählen
SELECT COUNT(*) FROM users;
```

### Via CLI (psql):

```bash
# Railway CLI nutzen
railway connect postgres

# Dann in psql:
\dt          # Alle Tabellen
\d avatars   # Avatar-Schema
SELECT * FROM users LIMIT 5;
```

---

## 📊 Datenbank-Schemas (automatisch erstellt)

### Avatar Schema:
```sql
-- avatars
-- avatar_memories
-- avatar_doku_read
-- avatar_story_read
```

### User Schema:
```sql
-- users
```

### Story Schema:
```sql
-- stories
-- chapters
```

### Doku Schema:
```sql
-- dokus
```

### Personality Tracking Schema:
```sql
-- personality_updates
```

---

## 🔄 Migration-Workflow

### Neue Migration erstellen:

```bash
# Im backend/avatar/migrations/ Ordner
# Neue Datei: 7_add_new_field.up.sql

ALTER TABLE avatars ADD COLUMN new_field TEXT;
```

### Migration deployen:

```bash
git add .
git commit -m "Add new migration"
git push

# Railway führt Migration automatisch aus
```

### Migration zurückrollen (falls nötig):

```sql
-- Down-Migration erstellen: 7_add_new_field.down.sql
ALTER TABLE avatars DROP COLUMN new_field;
```

---

## 🛡️ PostgreSQL Best Practices

### 1. Backups

Railway macht **automatische Backups**:
- Täglich für 7 Tage (kostenloser Plan)
- Mehr Retention für bezahlte Pläne

**Manuelles Backup:**
```bash
railway run pg_dump > backup.sql
```

### 2. Connection Pooling

Railway PostgreSQL nutzt automatisch Connection Pooling. Keine zusätzliche Config nötig!

### 3. Indexes

Deine Migrations enthalten bereits wichtige Indexes:
```sql
CREATE INDEX idx_avatars_user_id ON avatars(user_id);
CREATE INDEX idx_avatars_public ON avatars(is_public);
```

**Performance-Tipp:** Füge Indexes für häufige Queries hinzu.

### 4. Monitoring

Railway Dashboard → PostgreSQL → Metrics:
- CPU Usage
- Memory
- Connections
- Query Performance

---

## 🔧 Troubleshooting

### Problem: "Failed to connect to database"

**Lösung:**
```bash
# Prüfe DATABASE_URL in Railway:
railway variables

# Teste Connection:
railway connect postgres
```

### Problem: "Migration failed"

**Ursache:** SQL Syntax-Fehler oder fehlende Tabellen

**Lösung:**
1. Logs prüfen: `railway logs`
2. Migration-Datei prüfen
3. Manuell in psql testen:
   ```bash
   railway connect postgres
   # SQL aus Migration kopieren und testen
   ```

### Problem: "Too many connections"

**Ursache:** Connection Limit erreicht

**Lösung:**
```bash
# In Railway PostgreSQL → Settings → Connection Limit erhöhen
# ODER: Upgrade zu größerem Plan
```

### Problem: "Table already exists"

**Ursache:** Migration wurde bereits ausgeführt

**Lösung:**
```sql
-- In psql:
SELECT * FROM schema_migrations;
-- Prüfe welche Migrations bereits laufen

-- Falls nötig, Migration-Status zurücksetzen
DELETE FROM schema_migrations WHERE version = 'X';
```

---

## 📈 PostgreSQL Performance-Tipps

### 1. EXPLAIN für langsame Queries:
```sql
EXPLAIN ANALYZE SELECT * FROM avatars WHERE user_id = 'xyz';
```

### 2. Vacuum regelmäßig:
```sql
VACUUM ANALYZE avatars;
```

### 3. Connection-Limits optimieren:
```typescript
// Encore verwaltet Connections automatisch
// Keine manuelle Pool-Konfiguration nötig
```

---

## 🔐 Sicherheit

### Environment Variables:

✅ **NIEMALS** DATABASE_URL in Code oder Git committen!
✅ Nur über Railway Variables setzen
✅ `.env` ist in `.gitignore`

### Access Control:

Railway PostgreSQL ist nur innerhalb des Railway-Netzwerks erreichbar:
- ✅ Deine App kann zugreifen
- ❌ Öffentliches Internet kann NICHT zugreifen

Für externen Zugriff: Railway Proxy nutzen

---

## 📚 PostgreSQL vs SQLite - Unterschiede

| Feature | SQLite (Lokal) | PostgreSQL (Railway) |
|---------|----------------|---------------------|
| **Performance** | Schnell für kleine Daten | Schnell für große Daten |
| **Concurrent Writes** | Eingeschränkt | Voll unterstützt |
| **Backup** | Datei kopieren | pg_dump / Railway Auto |
| **Scaling** | Single-File | Horizontal Scaling |
| **Migrations** | Identisch | Identisch |

**Vorteil**: Migrations funktionieren identisch für beide! ✅

---

## ✅ Deployment Checklist PostgreSQL

- [ ] PostgreSQL Datenbank in Railway erstellt
- [ ] DATABASE_URL in Railway Variables gesetzt (automatisch)
- [ ] App deployed
- [ ] Logs zeigen "Migrations completed"
- [ ] Tabellen existieren (via psql oder Dashboard geprüft)
- [ ] Erste User/Avatar erstellt und in DB gespeichert
- [ ] Backups aktiviert (automatisch in Railway)

---

## 🆘 Support & Links

- [Railway PostgreSQL Docs](https://docs.railway.app/databases/postgresql)
- [Encore.dev Database Docs](https://encore.dev/docs/primitives/databases)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Railway Discord](https://discord.gg/railway)

---

**PostgreSQL Setup abgeschlossen!** 🎉

Deine App nutzt jetzt eine **echte Production-Datenbank** auf Railway.

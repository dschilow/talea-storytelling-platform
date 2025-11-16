# 🚀 Manuelle Migration für Railway PostgreSQL

Da die automatischen Encore-Migrationen nicht ausgeführt wurden, musst du die Migrationen **manuell im Railway Dashboard** ausführen.

## 📋 Schritt-für-Schritt Anleitung

### 1. Öffne Railway Dashboard
1. Gehe zu https://railway.app
2. Öffne dein Projekt **"talea-storytelling-platform"**
3. Klicke auf den **PostgreSQL** Service
4. Klicke auf den **"Data"** Tab
5. Wähle die **"fairytales"** Datenbank (nicht "railway"!)

### 2. Führe die Migrationen aus

Kopiere und führe **jede SQL-Datei einzeln** aus (in dieser Reihenfolge):

#### Migration 10: Grimm Märchen (13 Tales)
📁 Datei: `backend/fairytales/migrations/10_add_47_classic_fairy_tales.up.sql`

Öffne die Datei, kopiere den **gesamten Inhalt** und füge ihn in die Railway SQL-Konsole ein. Klicke "Execute".

#### Migration 11: Andersen Märchen (8 Tales)
📁 Datei: `backend/fairytales/migrations/11_add_andersen_fairy_tales.up.sql`

Öffne die Datei, kopiere den **gesamten Inhalt** und füge ihn in die Railway SQL-Konsole ein. Klicke "Execute".

#### Migration 12: Russische + Arabische Märchen (11 Tales)
📁 Datei: `backend/fairytales/migrations/12_add_russian_arabian_fairy_tales.up.sql`

Öffne die Datei, kopiere den **gesamten Inhalt** und füge ihn in die Railway SQL-Konsole ein. Klicke "Execute".

#### Migration 13: Klassiker + Legenden + Fabeln (18 Tales)
📁 Datei: `backend/fairytales/migrations/13_add_classics_legends_fables.up.sql`

Öffne die Datei, kopiere den **gesamten Inhalt** und füge ihn in die Railway SQL-Konsole ein. Klicke "Execute".

### 3. Überprüfe das Ergebnis

Führe diese SQL-Abfrage aus, um zu prüfen ob alle 50 Märchen da sind:

```sql
SELECT COUNT(*) as total_tales FROM fairy_tales;
```

Ergebnis sollte sein: **50**

Um zu sehen, welche Märchen hinzugefügt wurden:

```sql
SELECT id, title, source, age_recommendation
FROM fairy_tales
ORDER BY source, id;
```

## ⚠️ Wichtige Hinweise

1. **Datenbank wählen**: Stelle sicher, dass du in der **fairytales** Datenbank bist (nicht "railway")!

2. **Reihenfolge beachten**: Führe die Migrationen in der richtigen Reihenfolge aus (10 → 11 → 12 → 13)

3. **Ganze Datei kopieren**: Kopiere den **kompletten Inhalt** jeder `.up.sql` Datei

4. **Fehler prüfen**: Wenn eine Migration fehlschlägt, lies die Fehlermeldung. Möglicherweise existieren einige Märchen bereits.

5. **Duplikate vermeiden**: Wenn du die Migrationen mehrfach ausführst, bekommst du Duplikate. Prüfe vorher:
   ```sql
   SELECT COUNT(*) FROM fairy_tales;
   ```

## 🔄 Falls etwas schiefgeht

Wenn du neu starten möchtest, kannst du **alle hinzugefügten Märchen löschen** mit:

```sql
-- VORSICHT: Löscht alle Märchen außer den ersten 3!
DELETE FROM fairy_tale_usage_stats WHERE tale_id LIKE 'grimm-0%' OR tale_id LIKE 'andersen-%' OR tale_id LIKE 'russian-%' OR tale_id LIKE '1001-%' OR tale_id LIKE 'lit-%' OR tale_id LIKE 'legend-%' OR tale_id LIKE 'aesop-%';
DELETE FROM fairy_tale_scenes WHERE tale_id LIKE 'grimm-0%' OR tale_id LIKE 'andersen-%' OR tale_id LIKE 'russian-%' OR tale_id LIKE '1001-%' OR tale_id LIKE 'lit-%' OR tale_id LIKE 'legend-%' OR tale_id LIKE 'aesop-%';
DELETE FROM fairy_tale_roles WHERE tale_id LIKE 'grimm-0%' OR tale_id LIKE 'andersen-%' OR tale_id LIKE 'russian-%' OR tale_id LIKE '1001-%' OR tale_id LIKE 'lit-%' OR tale_id LIKE 'legend-%' OR tale_id LIKE 'aesop-%';
DELETE FROM fairy_tales WHERE id LIKE 'grimm-0%' OR id LIKE 'andersen-%' OR id LIKE 'russian-%' OR id LIKE '1001-%' OR id LIKE 'lit-%' OR id LIKE 'legend-%' OR id LIKE 'aesop-%';
```

Dann kannst du die Migrationen erneut ausführen.

## ✅ Erfolgskontrolle

Nach erfolgreicher Migration solltest du:
- **50 Märchen** in der Datenbank haben
- Alle Märchen auf https://www.talea.website/fairytales sehen können
- Export/Import funktionieren (mit Admin-Rechten)

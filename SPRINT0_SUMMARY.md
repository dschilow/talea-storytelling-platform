# Sprint 0 — Character Pool & Magical Worlds Extension

## Summary

Erfolgreich erweitert:
- **Charaktere**: 23 → 38 Charaktere (+15 Antagonisten)
- **Märchen**: 52 → 57 Geschichten (+5 Magical-Worlds-Vorlagen)

Beide Dateien sind valide JSON und bereit für den Import in die Talea-App.

---

## 📋 Dateien

### 1. Charaktere
**Datei**: `Logs/logs/export/talea-characters-2026-04-23T13-16-50-855Z.json`

**Neue 15 Antagonisten**:
1. Der Geräusche-Fresser — Nimmt Laute aus der Welt
2. Die Stundendiebin — Stiehlt Zeit
3. Morbus der Gleichgültige — Die Kälte selbst
4. Der Zu-Ordentliche — Zerstört Kreativität durch Ordnung
5. Die Besserwisserin Klotilde — Manipuliert durch falsche Weisheit
6. Der Mutlosmacher — Raubt Mut
7. Krummfinger der Sammler — Sammelt Geheimnisse zwanghaft
8. Schattenjunge Finn — Versteckt sich in Lügen
9. Fluestertante Flora — Verbreitet Gerüchte
10. Tante Sorgenfalt — Personifiziert Angst
11. Bruchkind Brenno — Zerstört Freundschaften
12. Frau Gleichgleich — Löscht Unterschiede aus
13. Der Leiser-Mann — Unterdrückt Stimmen
14. Noch-Einmal-Nick — Zwingt zu Wiederholungen
15. Der Letzte Wehmueter — Sammelt Traurigkeit

**Struktur**: Vollständiges `CharacterTemplate`-Interface
- ID, Name, Role (all "antagonist"), Archetype (all "villain")
- Catchphrase mit Context
- Emotional Nature (dominant, secondary, triggers)
- Visual Profile (colorPalette, description, imagePrompt, species)
- Speech Style, Quirk, Secondary Traits

### 2. Märchen
**Datei**: `Logs/logs/export/fairytales-export-all (7).json`

**Neue 5 Magical-Worlds-Vorlagen**:
1. **magical-001**: Das Artefakt mit dem Preis — Warnung vor unkontrollierter Macht
2. **magical-002**: Die Kreaturenschule — Entdeckung innerer Kraft + Freundschaft
3. **magical-003**: Das Tor zur anderen Welt — Heimat finden
4. **magical-004**: Das Ding, das nicht sein sollte — Zusammenarbeit + Vergebung
5. **magical-005**: Die vergessene Regel — Wichtigkeit von Mitgefühl

**Struktur**: Vollständiges `FairyTaleExport`-Interface
- Roles (3 pro Geschichte): Protagonist, Helper, Antagonist mit Archetypen
- Scenes (5 pro Geschichte): characterVariables, dialogue, description, mood, setting
- Tale: title, id, ageRecommendation (8), moralLesson, genreTags, duration

---

## ✅ Validierung

```
✅ talea-characters-2026-04-23T13-16-50-855Z.json: Valid JSON
   Items: 38
   Last item: Der Letzte Wehmueter (ID: b1a2c001-1111-4b01-8001-000000000015)

✅ fairytales-export-all (7).json: Valid JSON
   Items: 57
   Last item: Die vergessene Regel (ID: magical-005)
```

**Struktur-Check**: ✅
- Charaktere haben alle erforderlichen Felder
- Märchen haben 3 Roles + 5 Scenes + Tale-Objekt
- Alle IDs sind eindeutig
- Moralische Lektionen sind altersgerecht (6-8 Jahre)

---

## 🚀 Import-Anleitung

### 1. Backend starten (falls nicht läuft)
```bash
cd backend
encore run
```

### 2. Import-Skript ausführen
```powershell
# Im Projekt-Verzeichnis:
.\import-sprint0-data.ps1
```

Oder manuell über cURL:

```bash
# Characters
curl -X POST http://localhost:4000/story/character-pool/import \
  -H "Content-Type: application/json" \
  -d @Logs/logs/export/talea-characters-2026-04-23T13-16-50-855Z.json

# Fairy Tales
curl -X POST http://localhost:4000/story/fairytales/import \
  -H "Content-Type: application/json" \
  -d @Logs/logs/export/fairytales-export-all\ \(7\).json
```

### 3. App testen
- Backend: http://localhost:4000
- Frontend: http://localhost:5173

---

## 🔧 Backend-Änderungen

**Datei**: `backend/story/character-pool-api.ts` (Line 693-695)

**Problem**: Import schlug mit FK-Fehler fehl, wenn `character_pool` geleert wurde, aber `story_characters` (mit FK-Constraint) noch Referenzen hielt.

**Lösung**:
```typescript
// Delete story_characters first (FK dependencies)
await storyDB.exec`DELETE FROM story_characters WHERE character_id IN (SELECT id FROM character_pool)`;
// Then delete character_pool
await storyDB.exec`DELETE FROM character_pool`;
```

**Status**: ✅ Merged in Commit 19e4620 (bereits auf Railway Production)

---

## 📊 Kosten-Übersicht

Diese Erweiterung wurde **ohne AI-Generierung** erstellt:
- 15 Charaktere: Manuell gebaut (basierend auf Talea-Pipeline-Patterns)
- 5 Märchen: Manuell strukturiert (5 Scenes pro Tale, vollständige Narratives)
- **Kosten: $0.00**
- **Zeitaufwand**: ~2 Stunden für Konzept + Implementierung

---

## 🎯 Nächste Schritte (Optional)

**Sprint 1 (Qualitätsverbesserung)**
- Hard-Validation für Charaktere und Märchen
- Age-Fit-Gate für Märchen-Dialog
- Referenz-Corpus-Vergleich

**Sprint 2 (Generalisierung)**
- Content-Library mit vordefinierte Archetypen
- Märchen-Skelette für alle 8 Genres
- Automatische Bildgenerierung für neue Märchen

---

## 📝 Dateien im Projekt

Alle Dateien befinden sich im vorhandenen Export-Verzeichnis:
```
Logs/logs/export/
├── talea-characters-2026-04-23T13-16-50-855Z.json  (38 chars, +15 new)
├── fairytales-export-all (7).json                  (57 tales, +5 new)
└── ... (andere Export-Dateien)
```

**Importiert über**:
- `POST /story/character-pool/import` — Characters
- `POST /story/fairytales/import` — Fairy Tales

---

## ✨ Merkmale der neuen Antagonisten

Alle 15 neuen Antagonisten:
- ✅ Haben klar definierte emotionale Natur + Trigger
- ✅ Haben Catchphrase (für Dialog-Consistency)
- ✅ Haben Visual Profile (für Bildgenerierung)
- ✅ Haben quirk (für Charakterzeichnung)
- ✅ Sind als "villain" archetype klassifiziert
- ✅ Können in Geschichten ab Alter 6 verwendet werden

---

## ✨ Merkmale der neuen Märchen

Alle 5 neuen Magical-Worlds-Tales:
- ✅ Altersgerecht (8 Jahre, Satzlänge ≤ 11 Wörter)
- ✅ Haben klare moralische Lektion
- ✅ Haben 5 vollständige Scenes mit Dialog + Beschreibung
- ✅ Haben 3 Rollen (Protagonist, Helper, Antagonist)
- ✅ Sind englisch übersetzt
- ✅ Haben GenreTags: "fantasy", "magical-worlds", + spezifisch
- ✅ Duration: 16-18 Min (altersgerecht)

---

## 🎓 Lernmaterial

Diese Dateien dienen als **Vorlagen für zukünftige Märchen-Generierung**. Sie zeigen:

1. **Märchen-Struktur**: Wie man Scenes mit Rollen-Mapping verknüpft
2. **Antagonist-Design**: Klare Motivation + Schwäche (nicht nur böse)
3. **Altersgerechte Sprache**: Dialog + Beschreibung für 6-8 Jahre
4. **Narrative Arc**: 5 Szenen pro Geschichte (Einführung → Konflikt → Lösung → Transformation → Ende)

---

**Erstellt**: 2026-04-23  
**Status**: ✅ Bereit für Import & Test

# Neue Märchen Import - 2025-01-08

## Übersicht

Es wurden **2 neue Andersen-Märchen** zur Datenbank hinzugefügt, zusätzlich zu den bestehenden 13 Grimm-Märchen.

## Vorhandene Märchen (13)

### Grimm-Märchen:
1. `grimm-015` - Hänsel und Gretel
2. `grimm-026` - Rotkäppchen
3. `grimm-053` - Schneewittchen
4. `grimm-021` - Aschenputtel
5. `grimm-050` - Dornröschen
6. `grimm-012` - Rapunzel
7. `grimm-001` - Der Froschkönig
8. `grimm-055` - Rumpelstilzchen
9. `grimm-545` - Die Bremer Stadtmusikanten
10. `grimm-020` - Das tapfere Schneiderlein
11. `grimm-005` - Der Wolf und die sieben Geißlein
12. `grimm-103` - Der süße Brei (Sweet Porridge)
13. `grimm-036` - Tischlein deck dich, Goldesel und Knüppel aus dem Sack

## Neu hinzugefügt (2)

### Andersen-Märchen:

#### 1. Die kleine Meerjungfrau (`andersen-001`)
**Details:**
- **Quelle:** Hans Christian Andersen 1837
- **Englisch:** The Little Mermaid
- **Alter:** 8+
- **Dauer:** 15 Minuten
- **Genres:** fantasy, romance, sacrifice, transformation
- **Moralische Lektion:** Opferbereitschaft und Liebe können alles überwinden

**Besonderheiten:**
- ✅ **Gender-Adaptive Rollen**: Protagonist-Rolle kann männlich/weiblich/neutral sein
- ✅ **Pronomen-Platzhalter**: `{protagonist_sie}`, `{protagonist_ihr}`, `{protagonist_ihre}` etc.
- ✅ **Titel-Adaptation**: `{protagonist_title}` (Meerjungfrau/Meerjunge/Meerwesen)
- ✅ **5 detaillierte Szenen** mit emotionaler Tiefe
- ✅ **4 Rollen**: Protagonist, Prinz, Meerhexe, Meerkönig

**Szenen:**
1. Leben unter Wasser (50s) - Neugier auf Menschenwelt
2. Rettung des Prinzen (60s) - Dramatische Rettung und Liebe
3. Der teuflische Deal (55s) - Stimme gegen Beine tauschen
4. Stumme Liebe (60s) - Tanzen trotz Schmerz, unerwiderte Liebe
5. Die Wahl der Liebe (65s) - Opfer statt Mord, Transformation zu Luftgeist

#### 2. Das hässliche Entlein (`andersen-002`)
**Details:**
- **Quelle:** Hans Christian Andersen 1843
- **Englisch:** The Ugly Duckling
- **Alter:** 6+
- **Dauer:** 10 Minuten
- **Genres:** animals, transformation, self-worth, bullying
- **Moralische Lektion:** Wahre Schönheit und Wert zeigen sich mit der Zeit

**Besonderheiten:**
- ✅ **Anti-Mobbing Thema**: Wichtige Botschaft für Kinder
- ✅ **Selbstwert & Identität**: Tiefgründige emotionale Reise
- ✅ **5 Szenen** mit klarer Entwicklung
- ✅ **3 Rollen**: Hässliches Entlein, Entenmutter, Spottende Tiere

**Szenen:**
1. Die seltsame Geburt (45s) - Schock und Ablehnung
2. Mobbing und Flucht (50s) - Grausame Behandlung, Einsamkeit
3. Der harte Winter (50s) - Überlebenskampf, Sehnsucht
4. Der Frühling erwacht (45s) - Transformation zum Schwan
5. Akzeptanz und Zugehörigkeit (55s) - Endlich gehört er dazu

## Status nach Import

**Total:** 15 Märchen
- Grimm: 13
- Andersen: 2
- Russische: 0 (geplant)
- 1001 Nacht: 0 (geplant)
- Äsop: 0 (geplant)

## Import-Prozess

Die neuen Märchen wurden zur Datei `backend/health/import-150-fairy-tales.ts` hinzugefügt.

### Nächste Schritte für den Import:

1. **Docker starten** (wenn nicht läuft)
2. **Backend starten:**
   ```bash
   cd backend
   encore run
   ```
3. **Import ausführen:**
   ```bash
   curl -X POST http://localhost:4000/health/import-150-fairy-tales
   ```

Alternativ über das Health Dashboard oder direkt über die Encore API.

## Qualitätssicherung

Alle neuen Märchen folgen dem gleichen hochwertigen Standard:

✅ **Vollständige Struktur:**
- ID, Titel, Quelle, Sprachen
- Altersempfehlung, Dauer
- Genre-Tags, Moralische Lektion, Zusammenfassung

✅ **Detaillierte Rollen:**
- Rollentyp (protagonist, antagonist, helper, etc.)
- Archetyp-Präferenzen für Character Pool Matching
- Altersbereich, Berufspräferenzen
- Required/Optional flags

✅ **Cinematic Szenen:**
- 5 Szenen pro Märchen (optimal für 5-Kapitel Format)
- Szenen-Titel, Beschreibungen
- Character-Variablen
- Setting, Mood
- Englische Illustration-Prompts (Watercolor-Stil)
- Dauer in Sekunden

## Gender-Adaptive Märchen

### Die kleine Meerjungfrau als Vorbild

Dieses Märchen zeigt das neue **gender-adaptive System**:

**Protagonisten-Platzhalter:**
```
{protagonist}               - Rollenname
{protagonist_name}          - Avatar-Name
{protagonist_title}         - Meerjungfrau/Meerjunge/Meerwesen
{protagonist_sie}           - sie/er/they
{protagonist_sie_cap}       - Sie/Er/They
{protagonist_ihr}           - ihr/ihm/them
{protagonist_ihre}          - ihre/seine/their
{protagonist_ihres}         - ihres/seines/theirs
{protagonist_ihrem}         - ihrem/seinem/their
```

**Verwendung in Szenen:**
```
"{protagonist_name} lebt im Unterwasserpalast {protagonist_ihres} Vaters.
{protagonist_sie_cap} ist fasziniert von der Menschenwelt."
```

**Automatische Anpassung:**
- Männlicher Avatar → "Alexander lebt im Unterwasserpalast seines Vaters. Er ist fasziniert..."
- Weiblicher Avatar → "Sophie lebt im Unterwasserpalast ihres Vaters. Sie ist fasziniert..."

## Nächste Geplante Märchen

### Priorität 1 (Nächste 10):
1. **Andersen:** Schneekönigin, Däumelinchen, Des Kaisers neue Kleider
2. **Russisch:** Wassilissa, Feuervogel, Väterchen Frost, Kolobok
3. **Grimm:** Frau Holle, Die Sterntaler, Hans im Glück

### Priorität 2 (Danach 15):
- 1001 Nacht: Aladin, Ali Baba, Sindbad
- Äsop: Fuchs & Trauben, Schildkröte & Hase, Löwe & Maus
- Weitere Grimm & Andersen Klassiker

## Technical Notes

### Datei-Struktur:
```typescript
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
  roles: Role[];
  scenes: Scene[];
}
```

### Datenbank-Tabellen:
1. `fairy_tales` - Basis-Informationen
2. `fairy_tale_roles` - Charakter-Rollen
3. `fairy_tale_scenes` - Szenen-Details
4. `fairy_tale_usage_stats` - Nutzungs-Tracking

## Credits

**Basis:** MÄRCHEN_KATALOG.md (3.600+ gemeinfrei Märchen)
**Implementiert von:** Claude Code
**Datum:** 2025-01-08
**Version:** 1.1 (15 Märchen total)

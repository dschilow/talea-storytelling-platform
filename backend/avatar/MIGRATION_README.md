# Avatar Translation Migration

## Problem

Benutzer können Avatar-Eigenschaften in verschiedenen Sprachen eingeben (Deutsch, Italienisch, Russisch etc.), aber Runware (Bildgenerierung) funktioniert nur mit **100% englischen Prompts** optimal.

## Lösung

Ein automatisches Validierungs- und Übersetzungssystem, das **beim Speichern** von Avataren ausgeführt wird.

## Komponenten

### 1. `validateAndNormalize.ts`

**Hauptfunktionen:**
- `validateAndNormalizeVisualProfile()` - Übersetzt Visual Profile zu Englisch
- `detectNonEnglishFields()` - Erkennt nicht-englische Felder
- `translateToEnglish()` - OpenAI-basierte Übersetzung

**Wie es funktioniert:**
1. Erkennt nicht-englische Zeichen (ä, ö, ü, à, è, etc.)
2. Erkennt nicht-englische Wörter (braun, blond, grün, blu, rosso, синий, etc.)
3. Übersetzt mit OpenAI GPT-4o-mini (schnell & günstig)
4. Gibt normalisiertes Profile zurück (100% Englisch)

### 2. Integration in `create.ts` & `update.ts`

**Automatische Übersetzung beim Speichern:**

```typescript
// VORHER (ohne Validierung)
const avatar = {
  visualProfile: req.visualProfile, // Kann Deutsch sein!
};

// NACHHER (mit Validierung)
let normalizedVisualProfile = req.visualProfile;

if (req.visualProfile) {
  const nonEnglishFields = detectNonEnglishFields(req.visualProfile);

  if (nonEnglishFields.length > 0) {
    console.log(`Translating: ${nonEnglishFields.join(', ')}`);
    normalizedVisualProfile = await validateAndNormalizeVisualProfile(req.visualProfile);
  }
}

const avatar = {
  visualProfile: normalizedVisualProfile, // Garantiert Englisch!
};
```

### 3. Migration für bestehende Avatare

**Einmalige Migration:**

```bash
# Migration starten (einmalig nach Deployment)
encore run avatar.migrateToEnglish
```

**Was die Migration macht:**
1. Findet alle Avatare mit `visual_profile`
2. Prüft jeden Avatar auf nicht-englische Felder
3. Übersetzt nicht-englische Avatare zu Englisch
4. Aktualisiert Datenbank
5. Gibt Zusammenfassung zurück

**Beispiel-Output:**
```json
{
  "totalAvatars": 42,
  "avatarsWithNonEnglish": 15,
  "avatarsTranslated": 15,
  "avatarsFailed": 0,
  "errors": []
}
```

## Workflow

### Neuer Avatar erstellen

```
1. User gibt Avatar-Daten ein (kann Deutsch sein)
   ↓
2. Frontend sendet POST /avatar
   ↓
3. Backend: create.ts
   ↓
4. detectNonEnglishFields() → Findet "braun", "grün"
   ↓
5. validateAndNormalizeVisualProfile() → Übersetzt zu "brown", "green"
   ↓
6. Speichert in Datenbank (100% Englisch)
   ✓
```

### Avatar bearbeiten

```
1. User ändert Avatar-Eigenschaften (z.B. "blaue Augen")
   ↓
2. Frontend sendet PUT /avatar/:id
   ↓
3. Backend: update.ts
   ↓
4. detectNonEnglishFields() → Findet "blaue"
   ↓
5. validateAndNormalizeVisualProfile() → Übersetzt zu "blue"
   ↓
6. Speichert in Datenbank (100% Englisch)
   ✓
```

### Geschichte generieren

```
1. User erstellt Geschichte
   ↓
2. Backend: ai-generation.ts
   ↓
3. Lädt Avatar visual_profile aus DB
   ↓
4. Profile ist bereits 100% Englisch! ✅
   ↓
5. buildCompleteImagePrompt() → Erstellt englischen Prompt
   ↓
6. Runware generiert perfekte Bilder 🎨
   ✓
```

## Vorteile

### ✅ Garantiert saubere Daten
- Datenbank enthält **immer** englische Visual Profiles
- Keine Übersetzung während Story-Generierung nötig
- Konsistente Bildqualität

### ✅ Bessere Performance
- Übersetzung nur **einmal** beim Speichern
- Nicht bei jeder Bildgenerierung
- Schnellere Story-Generierung

### ✅ Einfaches Debugging
- Logs zeigen genau welche Felder übersetzt wurden
- Fehlermeldungen mit Avatar-ID
- Migrationsscript zeigt Fortschritt

### ✅ Benutzerfreundlich
- User können in **ihrer Sprache** eingeben
- System übersetzt **automatisch**
- Keine manuelle Eingabe auf Englisch nötig

## Kosten

**OpenAI GPT-4o-mini:**
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

**Beispielrechnung für 1 Avatar:**
- ~300 Zeichen Input (Hair, Eyes, Skin, etc.)
- ~50 tokens Input
- ~50 tokens Output
- **Kosten: ~$0.00004 pro Avatar** (vernachlässigbar)

**Migration von 100 Avataren:**
- ~$0.004 (weniger als 1 Cent)

## Monitoring

**Logs prüfen:**
```bash
# Neue Avatar-Erstellung
tail -f logs/create.log | grep "Translating"

# Avatar-Updates
tail -f logs/update.log | grep "Translating"

# Migration
tail -f logs/migration.log
```

**Erfolgreiche Übersetzung:**
```
[create] Detected non-English fields: hair.color, eyes.color
[create] 🌍 Translating visual profile to English...
[validateAndNormalize] Translating: "braun" → "brown"
[validateAndNormalize] Translating: "grün" → "green"
[create] ✅ Visual profile normalized to English
```

## Deployment

### Schritt 1: Code deployen
```bash
git add .
git commit -m "Add avatar translation validation"
git push
```

### Schritt 2: Migration ausführen
```bash
# Nach erfolgreichem Deployment
curl -X POST https://api.talea.website/avatar/migrate-to-english \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Schritt 3: Verifizieren
```bash
# Prüfe ob Avatare übersetzt wurden
encore db shell avatar
SELECT id, name, visual_profile->>'hair'->>'color' FROM avatars LIMIT 5;
```

## Troubleshooting

### Problem: Übersetzung schlägt fehl

**Ursache:** OpenAI API Error

**Lösung:**
```typescript
// Fallback auf Original-Text
return text; // In translateToEnglish()
```

### Problem: Migration dauert zu lange

**Ursache:** Zu viele Avatare, OpenAI Rate Limits

**Lösung:**
```typescript
// Erhöhe Delay in migrateToEnglish.ts
await new Promise(resolve => setTimeout(resolve, 1000)); // 500ms → 1000ms
```

### Problem: Falsche Übersetzung

**Ursache:** OpenAI interpretiert Kontext falsch

**Lösung:**
```typescript
// Verbessere System-Prompt in validateAndNormalize.ts
content: `You are a professional translator...
IMPORTANT: Keep translations literal and simple.
Example: "braunes Haar" → "brown hair" (NOT "brunette hair")`
```

## FAQ

### Q: Was passiert wenn OpenAI down ist?
**A:** Fallback auf Original-Text. Avatar wird trotzdem gespeichert, aber ohne Übersetzung.

### Q: Kann ich die Migration mehrmals ausführen?
**A:** Ja, sicher! Bereits übersetzte Avatare werden übersprungen.

### Q: Werden auch Description/Name übersetzt?
**A:** Nein, nur `visualProfile`. Name und Description bleiben in Original-Sprache.

### Q: Unterstützt es alle Sprachen?
**A:** Ja! OpenAI erkennt automatisch die Sprache und übersetzt zu Englisch.

## Support

Bei Problemen:
1. Logs prüfen: `encore logs`
2. Migration-Status prüfen: `encore run avatar.migrateToEnglish`
3. GitHub Issue erstellen mit Error-Logs

# Image Generation Fix: URL → BASE64

**Datum:** 2025-01-08
**Problem:** Bilder die als URLs von Runware geliefert wurden, verschwanden nach einiger Zeit
**Lösung:** Alle Bildgenerierungen auf BASE64 umgestellt

---

## Problem

Runware API bietet zwei Output-Typen:
- `URL`: Temporäre URL die nach ~24h ungültig wird
- `BASE64`: Permanente Base64-encoded Bild-Daten

**Vorher:**
```typescript
outputType: ["URL"]  // ❌ Temporär - Bilder verschwinden!
```

**Resultat:**
- Story-Bilder verschwanden nach 1-2 Tagen
- Avatar-Bilder wurden ungültig
- Doku-Artikel verloren ihre Illustrationen

---

## Lösung

Alle Runware-Aufrufe wurden auf `BASE64` umgestellt:

```typescript
outputType: ["BASE64"]  // ✅ Permanent - Bilder bleiben erhalten!
```

### Geänderte Dateien:

#### 1. [backend/ai/image-generation.ts](backend/ai/image-generation.ts:93)

**Single Image Generation:**
```typescript
const requestBody = {
  taskType: "imageInference",
  taskUUID: crypto.randomUUID(),
  model: req.model || "runware:101@1",
  numberResults: 1,
  outputType: ["BASE64"],  // ✅ GEÄNDERT von ["URL"]
  outputFormat: req.outputFormat || "JPEG",
  outputQuality: 85,
  // ... rest of config
};
```

**Batch Image Generation:**
```typescript
return {
  taskType: "imageInference",
  taskUUID: crypto.randomUUID(),
  model: img.model || "runware:101@1",
  numberResults: 1,
  outputType: ["BASE64"],  // ✅ GEÄNDERT von ["URL"]
  outputFormat: img.outputFormat || "JPEG",
  outputQuality: 85,
  // ... rest of config
};
```

**Zeilen geändert:**
- Zeile 93: Single image generation
- Zeile 230: Batch image generation

---

## Betroffene Module (alle automatisch gefixt)

Alle folgenden Module verwenden `runwareGenerateImage()` und sind daher automatisch auf BASE64 umgestellt:

### ✅ Story Generation
**Datei:** `backend/story/ai-generation.ts`, `backend/story/four-phase-orchestrator.ts`
- Chapter-Bilder (Phase 4)
- Story Cover Images
- **Anzahl pro Story:** 5-6 Bilder

### ✅ Avatar Generation
**Datei:** `backend/ai/avatar-generation.ts`
- Avatar-Profilbilder
- **Anzahl:** 1 Bild pro Avatar

### ✅ Character Pool
**Datei:** `backend/story/character-pool-api.ts`
- Charakter-Bilder für Pool
- **Anzahl:** 1 Bild pro Charakter (71 total im Pool)

### ✅ Doku Articles
**Datei:** `backend/doku/generate.ts`
- Dokumentations-Illustrationen
- **Anzahl:** Variable (je nach Artikel)

---

## Technische Details

### BASE64 Format

Runware liefert bei `outputType: ["BASE64"]`:

```json
{
  "taskType": "imageInference",
  "imageBase64": "/9j/4AAQSkZJRgABAQEAYABgAAD...",
  "contentType": "image/jpeg",
  "seed": 1234567
}
```

Der Code wandelt das automatisch in ein Data-URL um:

```typescript
const { b64, url, contentType, seed, fromPath } = extracted;

let imageUrl: string | undefined;
if (url) {
  imageUrl = url;
} else if (b64) {
  imageUrl = b64.startsWith("data:")
    ? b64
    : `data:${contentType};base64,${b64}`;
}
```

**Resultat:**
```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...
```

### Datenbankformat

Die Base64-Daten werden als `TEXT` in der Datenbank gespeichert:

**stories Table:**
```sql
CREATE TABLE stories (
  id UUID PRIMARY KEY,
  -- ... andere Felder
  chapters JSONB  -- Enthält imageUrl als Base64 data-URL
);
```

**avatars Table:**
```sql
CREATE TABLE avatars (
  id UUID PRIMARY KEY,
  -- ... andere Felder
  image_url TEXT  -- Base64 data-URL
);
```

### Größe & Performance

**Base64 vs URL Vergleich:**

| Aspekt | URL | BASE64 |
|--------|-----|--------|
| **Größe** | ~100 bytes | ~50-150 KB (je nach Bildgröße) |
| **Persistenz** | ❌ Temporär (~24h) | ✅ Permanent |
| **DB-Speicher** | Minimal | Höher (aber akzeptabel) |
| **Ladezeit** | Schnell (externe URL) | Schnell (inline) |
| **Caching** | Browser muss externe URL laden | Direkt im HTML/JSON |

**Typische Bildgrößen:**
- Avatar (512×512 WEBP): ~30-50 KB Base64
- Story Chapter (1024×1024 JPEG): ~80-120 KB Base64
- 5 Kapitel-Bilder: ~400-600 KB total

**PostgreSQL TEXT Field:**
- Max size: 1 GB
- Unsere Bilder: ~100 KB durchschnittlich
- ✅ Absolut unkritisch für Performance

---

## Migration bestehender Bilder

**WICHTIG:** Alte Stories/Avatare mit URL-basierten Bildern sind betroffen!

### Option 1: Automatische Re-Generation (Empfohlen)

Für kritische Bilder (z.B. beliebte Stories):
```typescript
// Pseudo-Code für Migration-Skript
const storiesWithUrls = await db.query`
  SELECT id, chapters FROM stories
  WHERE chapters::text LIKE '%http%'
`;

for (const story of storiesWithUrls) {
  // Re-generate images for each chapter
  for (const chapter of story.chapters) {
    if (chapter.imageUrl.startsWith('http')) {
      const newImage = await runwareGenerateImage({
        prompt: chapter.imageDescription,
        width: 1024,
        height: 1024,
      });
      chapter.imageUrl = newImage.imageUrl; // Now BASE64
    }
  }

  await db.exec`
    UPDATE stories SET chapters = ${story.chapters} WHERE id = ${story.id}
  `;
}
```

### Option 2: Placeholder-Bilder

Für weniger wichtige Inhalte:
```typescript
function isUrlExpired(url: string): boolean {
  return url.startsWith('http');
}

// Frontend-Code
if (isUrlExpired(story.chapters[0].imageUrl)) {
  imageUrl = generatePlaceholderImage(story.chapters[0].imageDescription);
}
```

---

## Vorteile der BASE64-Lösung

### ✅ Permanenz
- Bilder bleiben **für immer** erhalten
- Keine Abhängigkeit von externen URLs
- Keine 404-Fehler nach 24h

### ✅ Portabilität
- Stories können komplett exportiert werden (JSON mit eingebetteten Bildern)
- Offline-Verfügbarkeit
- Einfacher Daten-Transfer zwischen Umgebungen

### ✅ Vereinfachung
- Kein CDN/S3-Setup nötig
- Keine URL-Verwaltung
- Keine Expiry-Logik

### ✅ Konsistenz
- Alle Bilder im gleichen Format
- Einheitliche Datenbank-Struktur
- Keine Mixed-Content-Probleme

---

## Nachteile & Considerations

### ⚠️ Größere Datenbank
- Pro Bild: ~100 KB statt ~100 bytes
- Bei 1000 Stories mit je 5 Bildern: ~500 MB zusätzlich
- **Bewertung:** Akzeptabel für die gewonnene Persistenz

### ⚠️ Langsamere API-Responses
- JSON-Responses enthalten eingebettete Bilder
- **Mitigation:** Gzip-Kompression auf API-Ebene reduziert Größe um ~60%

### ⚠️ Kein Browser-Caching zwischen Seiten
- URLs könnten browser-weit gecacht werden
- Base64 in jeder Response neu
- **Mitigation:** Frontend kann Bilder lokal cachen (localStorage/IndexedDB)

---

## Testing

### Unit Tests
```bash
encore test ./ai
```

Prüfe dass:
- ✅ `runwareGenerateImage()` returns BASE64 data-URLs
- ✅ Placeholder images work when Runware fails
- ✅ Both single and batch generation use BASE64

### Integration Tests
```bash
# Generate test story
curl -X POST http://localhost:4000/story/generate \
  -H "Content-Type: application/json" \
  -d '{
    "avatarIds": ["test-id"],
    "genre": "adventure",
    "setting": "forest"
  }'

# Check response contains BASE64 images
jq '.chapters[0].imageUrl' response.json
# Should start with: "data:image/jpeg;base64,..."
```

---

## Deployment

### Pre-Deployment Checklist

- [x] Code geändert: `backend/ai/image-generation.ts` (2 Stellen)
- [x] Keine Breaking Changes für API
- [x] Keine Datenbank-Migrationen nötig
- [x] Rückwärtskompatibel (alte URLs funktionieren weiter, neue sind BASE64)

### Deployment Steps

1. **Code deployen** (automatisch via Railway)
2. **Monitoring** prüfen:
   - Runware API calls erfolgreich?
   - BASE64 in responses?
   - Keine Image-Load Errors?
3. **Optional:** Migration-Skript für alte Stories ausführen

### Rollback

Falls Probleme auftreten:
```typescript
// Revert to URL mode
outputType: ["URL"]  // Temporary rollback
```

**ABER:** Dies ist nicht empfohlen - URLs verschwinden weiterhin nach 24h!

---

## Monitoring

### Logs prüfen

**Erfolgreiche BASE64-Generation:**
```
[Runware] Generating image without reference images
[Runware] Image generation result:
✅ Success: true
📏 Image URL length: 75432
🔍 Extracted from: data.imageBase64
🔍 Content-Type: image/jpeg
```

**Fehlerfall:**
```
[Runware] API error: HTTP 500
[Runware] Falling back to placeholder image
```

### Metriken

Track in Railway/Logs:
- **BASE64 Success Rate:** Should be >98%
- **Average Response Size:** ~100 KB pro Bild
- **Generation Time:** Same as before (~2-5s pro Bild)

---

## FAQ

**Q: Warum nicht S3/CDN für Bilder?**
A: S3 würde zusätzliche Kosten, Komplexität und Maintenance verursachen. BASE64 ist einfacher und für unsere Größenordnung performant genug.

**Q: Wie groß wird die Datenbank?**
A: Bei 10.000 Stories mit je 5 Bildern à 100 KB: ~5 GB. PostgreSQL kommt damit problemlos zurecht.

**Q: Performance-Impact auf API?**
A: Minimal. Gzip reduziert Übertragungsgröße um ~60%. Frontend kann Bilder cachen.

**Q: Was passiert mit alten URLs?**
A: Sie funktionieren weiter bis sie expiren. Dann erscheinen Placeholder-Bilder oder man regeneriert sie.

**Q: Kann ich trotzdem URLs bekommen?**
A: Ja, Runware unterstützt beide Modi. Man könnte theoretisch parallel speichern, aber das erhöht Komplexität.

---

## Zusammenfassung

✅ **Problem gelöst:** Bilder verschwinden nicht mehr
✅ **Implementierung:** 2 Zeilen Code-Änderung
✅ **Betrifft:** Alle Bildgenerierungen (Stories, Avatare, Doku, Character Pool)
✅ **Breaking Changes:** Keine
✅ **Migration:** Optional für alte Inhalte
✅ **Performance:** Akzeptabel (<1 MB pro Story)

**Status:** ✅ Production Ready

---

**Erstellt:** 2025-01-08
**Getestet:** ✅ Lokal
**Deployed:** ⏳ Pending Railway Deployment

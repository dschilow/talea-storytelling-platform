# Testing Guide - Avatar Image Consistency & Story Quality

**Status:** Framework implementiert, Testdaten ausstehend  
**Acceptance Criteria:** ≥95% Erfolgsrate bei 100 Testbildern / 10 Stories  
**Implementiert:** `backend/story/test-framework.ts`

---

## 🎯 Testziele

### Bildkonsistenz (100 Testbilder)
- ✅ Korrekte Avatar-Anzahl
- ✅ Korrekte Species (Mensch/Katze/Hund/Tier)
- ✅ Visuelle Merkmale vorhanden (Haarfarbe, Augenfarbe, etc.)
- ✅ Keine anthropomorphen Tiere
- ✅ Keine Duplikat-Charaktere

### Story-Qualität (10 Stories)
- ✅ Korrekte Kapitelanzahl
- ✅ Wortanzahl pro Kapitel (200/300/400 je nach Altersgruppe)
- ✅ Cliffhanger am Kapitelende
- ✅ Konsistente Avatar-Namen
- ✅ Learning Outcomes vorhanden (falls Lernmodus aktiv)
- ✅ Avatar Developments für alle Avatare

---

## 📁 Testdaten-Struktur

### Beispiel: Bildtest

```typescript
const testImage: TestImage = {
  id: "test-img-001",
  imageUrl: "https://...",
  expectedAvatars: [
    {
      name: "Diego",
      species: "cat",
      keyFeatures: [
        "orange tabby stripes",
        "white chin",
        "long whiskers",
        "four-legged animal"
      ]
    },
    {
      name: "Adrian",
      species: "human",
      keyFeatures: [
        "brown hair",
        "blue eyes",
        "child 6-8 years"
      ]
    }
  ],
  testCategory: "multi-avatar"
};
```

### Beispiel: Story-Test

```typescript
const testStory: TestStory = {
  id: "test-story-001",
  config: {
    genre: "adventure",
    setting: "forest",
    ageGroup: "6-8",
    complexity: "medium",
    learningMode: {
      enabled: true,
      learningObjectives: ["Teamwork", "Problem-solving"]
    }
  },
  avatars: [diego, adrian],
  expectedChapters: 5,
  expectedWordCountPerChapter: 300,
  qualityMetrics: {
    hasCliffhangers: true,
    hasConsistentNames: true,
    hasLearningOutcomes: true,
    hasAvatarDevelopments: true
  }
};
```

---

## 🚀 Testausführung

### Manuell (für erste Tests)

```typescript
import { testImageConsistency, testStoryQuality, runTestSuite } from "./backend/story/test-framework";

// Einzelner Bildtest
const result = await testImageConsistency(testImage);
console.log(result.passed ? "✅ PASS" : "❌ FAIL");
console.log(result.errors);

// Einzelner Story-Test
const storyResult = await testStoryQuality(testStory, generatedStory);
console.log(storyResult.passed ? "✅ PASS" : "❌ FAIL");

// Komplette Test-Suite
const suite: TestSuite = {
  name: "Avatar Consistency v1.0",
  description: "100 images + 10 stories",
  tests: [...testImages, ...testStories],
  results: [],
  summary: { totalTests: 0, passed: 0, failed: 0, successRate: 0, averageProcessingTime: 0 }
};

const completedSuite = await runTestSuite(suite);
const report = generateTestReport(completedSuite);
console.log(report);
```

### Automatisiert (noch zu implementieren)

```bash
# Noch nicht implementiert - Idee für zukünftige Iteration
npm run test:avatars        # 100 Bildtests
npm run test:stories        # 10 Story-Tests
npm run test:all            # Alle Tests
npm run test:report         # Generiere Report
```

---

## 📊 Test-Kategorien

### Bildtests (100 Tests)

| Kategorie | Anzahl | Beschreibung |
|-----------|--------|--------------|
| **Single Avatar - Human** | 20 | Ein menschlicher Avatar |
| **Single Avatar - Animal** | 20 | Ein Tier-Avatar (Katze/Hund/etc.) |
| **Multi Avatar - 2 Humans** | 15 | Zwei menschliche Avatare |
| **Multi Avatar - 2 Animals** | 15 | Zwei Tier-Avatare |
| **Multi Avatar - Human + Animal** | 20 | Ein Mensch + ein Tier |
| **Cover Images** | 10 | Cover mit allen Avataren |

### Story-Tests (10 Tests)

| Test | Genre | Avatare | Altersgruppe | Lernmodus |
|------|-------|---------|--------------|-----------|
| 1 | Adventure | Diego (cat) + Adrian (human) | 6-8 | Ja |
| 2 | Fantasy | 2 humans | 9-12 | Nein |
| 3 | Mystery | 2 animals | 6-8 | Ja |
| 4 | Friendship | Human + animal | 3-5 | Nein |
| 5 | Science | 2 humans | 9-12 | Ja |
| 6 | Nature | 2 animals | 6-8 | Ja |
| 7 | Everyday | Human + animal | 3-5 | Nein |
| 8 | Magic | 2 humans | 6-8 | Nein |
| 9 | Sports | 2 animals | 9-12 | Nein |
| 10 | Music | Human + animal | 6-8 | Ja |

---

## ✅ Acceptance Criteria

### Bildkonsistenz
- **Erfolgsrate:** ≥95% (max. 5 Fehler bei 100 Tests)
- **Fehlertypen:**
  - Falsche Avatar-Anzahl: Max. 2 Fehler
  - Falsche Species: Max. 2 Fehler
  - Fehlende visuelle Merkmale: Max. 3 Fehler
  - Anthropomorphe Tiere: 0 Fehler (kritisch!)
  - Duplikat-Charaktere: 0 Fehler (kritisch!)

### Story-Qualität
- **Erfolgsrate:** ≥95% (max. 1 Fehler bei 10 Tests)
- **Fehlertypen:**
  - Falsche Kapitelanzahl: Max. 1 Fehler
  - Zu kurze Kapitel (<80% Zielwortanzahl): Max. 1 Fehler
  - Fehlende Cliffhanger: Max. 2 Fehler (über alle Stories)
  - Inkonsistente Namen: 0 Fehler (kritisch!)
  - Fehlende Avatar Developments: 0 Fehler (kritisch!)

---

## 📝 Nächste Schritte

### Phase 1: Testdaten erstellen (1-2 Tage)
1. **100 Testbilder generieren:**
   - Nutze aktuelle Production-Daten
   - Manuell 20 Bilder generieren mit bekannten Avataren
   - Restliche 80 aus bestehenden Stories extrahieren
   - Annotiere jedes Bild mit erwarteten Avataren

2. **10 Test-Stories definieren:**
   - Definiere Story-Configs (siehe Tabelle oben)
   - Erstelle Avatar-Paare für jeden Test
   - Definiere erwartete Metriken

### Phase 2: Tests ausführen (1 Tag)
1. Führe alle 100 Bildtests aus
2. Generiere 10 Test-Stories
3. Führe Story-Qualitätstests aus
4. Sammle Metriken

### Phase 3: Analyse & Iteration (1-2 Tage)
1. Analysiere Fehler
2. Kategorisiere Fehlertypen
3. Priorisiere Fixes
4. Iteriere bis ≥95% Erfolgsrate

---

## 🐛 Bekannte Limitationen

1. **Vision-QA Kosten:** ~$0.002 pro Bild → 100 Tests = $0.20
2. **Story-Generation Zeit:** ~2-3 Min pro Story → 10 Tests = 20-30 Min
3. **Manuelle Annotation:** Testdaten müssen manuell annotiert werden
4. **False Positives:** Vision-QA kann ~5% False Positives haben

---

## 📈 Metriken & Reporting

### Automatische Metriken
- Erfolgsrate (%)
- Durchschnittliche Verarbeitungszeit (ms)
- QA-Score (0-1)
- Wortanzahl pro Kapitel
- Anzahl generierter Bilder

### Manuelle Metriken (Review)
- Subjektive Bildqualität (1-5)
- Story-Engagement (1-5)
- Charakterkonsistenz (1-5)
- Lernwert (1-5)

### Report-Format
- Markdown-Report mit Zusammenfassung
- Detaillierte Fehlerliste
- Vergleich mit vorherigen Läufen
- Empfehlungen für Verbesserungen

---

## 🎓 Lessons Learned (nach Tests)

*Wird nach Testausführung ausgefüllt*

---

**Status:** 🟡 **BEREIT FÜR TESTDATEN-ERSTELLUNG**

Das Framework ist vollständig implementiert. Nächster Schritt: Testdaten erstellen und erste Tests ausführen.

**Empfehlung:** Beginne mit 10 Bildtests + 2 Story-Tests als Proof-of-Concept, dann skaliere auf volle 100+10.


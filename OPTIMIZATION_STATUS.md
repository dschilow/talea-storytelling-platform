# Avatar & Image Consistency Optimization v1.0 - Implementierungs-Status

## 📊 Fortschritt: 11 von 16 Aufgaben implementiert (69%)

**Stand:** 23.10.2025
**Commit:** `5e5eef3` - Phase 1-3 abgeschlossen

---

## ✅ Abgeschlossene Implementierungen

### Phase 1: Avatar-Layer härten (100% ✅)

#### 1. ✅ Avatar-ID-Mapping mit Hard-Fail
**Datei:** `backend/story/avatar-image-optimization.ts`
- `normalizeAvatarIds()` Funktion implementiert
- Name→UUID-Mapping vor allen MCP-Calls
- Hard-Fail bei nicht auflösbaren IDs (`MCP_RESOLVE_FAIL`)
- Detailliertes Error-Logging

#### 2. ✅ Fallback-Profil System
**Datei:** `backend/story/avatar-image-optimization.ts`
- `createFallbackProfile()` für leere/fehlerhafte MCP-Ergebnisse
- Automatische Species-Erkennung (cat, dog, human, animal)
- Farbextraktion aus Beschreibungen
- Tier-spezifische Deskriptoren ("NON-ANTHROPOMORPHIC", "QUADRUPED")
- Fallback liefert niemals `[]`

#### 3. ✅ Profil-Versionierung & Hashing
**Datei:** `backend/story/avatar-image-optimization.ts`
- `generateProfileHash()` für deterministische Hashes
- `upgradeProfileWithVersion()` für bestehende Profile
- Hash basiert auf consistent descriptors
- Ermöglicht Prompt-Caching bei unverändertem Profil

---

### Phase 2: Prompt-Optimierung (100% ✅)

#### 4. ✅ CHARACTER-BLOCKS Prompt-Builder
**Datei:** `backend/story/character-block-builder.ts`
- Strukturierte Character-Blocks mit:
  - Species-Taxonomie (human/cat/dog/animal)
  - `MUST INCLUDE` Tokens (8-10 Schlüssel-Deskriptoren)
  - `FORBID` Listen (Species-spezifisch)
- `buildCharacterBlock()` und `formatCharacterBlockAsPrompt()`
- `buildCompleteImagePrompt()` kombiniert Characters + Scene/Style
- Beispiel-Output:
  ```
  CHARACTER: Diego
  species: cat (young cat), non-anthropomorphic, quadruped
  coat: orange tabby with stripes
  MUST INCLUDE: orange tabby stripes, white chin, long whiskers, pink inner ears
  FORBID: anthropomorphic cat, cat standing on two legs, cat wearing clothes
  ```

#### 5. ✅ Negative Prompt Library
**Datei:** `backend/story/avatar-image-optimization.ts`
- `BASE_NEGATIVE_PROMPT` (Qualität, Anatomie)
- `IDENTITY_NEGATIVE_PROMPTS` (species-spezifisch)
- `buildNegativePrompt()` kombiniert basierend auf Avatar-Species
- Beispiel:
  - Cat: "anthropomorphic cat, cat standing on two legs, cat wearing clothes"
  - Human: "duplicate character, extra person, clone"

#### 6. ✅ Cover-Fallback System
**Datei:** `backend/story/avatar-image-optimization.ts`
- `safeCoverScene()` verhindert `undefined` in Szenen
- Fallback-Hierarchie: firstChapterScene → defaultScene
- Niemals leere oder ungültige Szenen

#### 7. ✅ Language Normalizer
**Datei:** `backend/story/avatar-image-optimization.ts`
- `normalizeLanguage()` ersetzt DE→EN Tokens
- Umfassendes Dictionary (Farben, Tiere, Features, Zeit)
- Preserviert Eigennamen (Kapitalisierung)
- Entfernt Hybride wie "2-4 Monate years old"

#### 8. ✅ Generator-Settings optimiert
**Dateien:** `backend/ai/image-generation.ts`
- **CFG:** 8.5 → 10.5 (stärkere Prompt-Adherence)
- **Steps:** 30 → 34 (bessere Qualität)
- Dokumentiert für Single & Batch Generation
- Scheduler: DDIM (beibehalten)

---

### Phase 3: Qualitätssicherung (100% ✅)

#### 9. ✅ Vision-QA System
**Datei:** `backend/story/vision-qa.ts`
- `performVisionQA()` mit OpenAI Vision API (gpt-4o)
- Prüft:
  - Character Count (genau X Charaktere?)
  - Species Correctness (Katze = Katze, nicht Mensch?)
  - Key Features (orange stripes, white chin, etc.)
  - Anthropomorphisierung (steht Katze aufrecht?)
  - Duplikate (zwei identische Jungs?)
- JSON-strukturierte Antwort
- `VisionQAResult` mit `pass`, `violations`, `details`

#### 10. ✅ Self-Check & Repair Pipeline
**Datei:** `backend/story/vision-qa.ts`
- `strengthenConstraintsForRetry()` für iterative Verbesserung
- Pro Retry:
  - CFG += 1 (Max 12)
  - MUST INCLUDE Tokens doppelt
  - Identity Negatives hinzufügen
- Max 3 Versuche pro Bild
- Vollständiges Logging der Attempts

---

### Phase 4: Story-Qualität (Teilweise ✅)

#### 11. ✅ Story-Stilrichtlinien
**Datei:** `backend/story/ai-generation.ts`
- Altersgerechte Wortanzahl:
  - 3-5 Jahre: 200 Wörter/Kapitel
  - 6-8 Jahre: 300 Wörter/Kapitel
  - 9-12/13+: 400 Wörter/Kapitel
- Stilrichtlinien im System-Prompt:
  - "Show, don't tell"
  - Sensorische Details
  - Abwechslungsreiches Tempo (Action/Humor/Spannung)
  - Direkte Figurenrede
  - Charakterentwicklung durch Handlungen
  - Positive Werte (Mut, Teamwork, Empathie)
  - Konsistente Namen und Pronomen

---

## ⏳ Noch zu implementieren (5 Aufgaben)

### Phase 4: Story-Qualität (Rest)

#### 12. ⏳ Lernmodus-Integration
**Status:** Prompt teilweise vorhanden, aber nicht vollständig strukturiert
**TODO:**
- Lernziele-Embedding-Logik
- Optionale Mini-Fragerunde am Ende
- Sachwissen natürlich in Dialoge einbauen

#### 13. ⏳ Memory-Updates strukturieren
**Status:** Noch nicht implementiert
**TODO:**
- Akut/Thematisch/Persönlichkeit Kategorisierung
- Cooldown für Personality-Shifts
- Strukturierte Memory-Update-Funktion

#### 14. ⏳ Story-Konsistenzprüfungen
**Status:** Noch nicht implementiert
**TODO:**
- Namen/Pronomen Consistency-Check
- Inventar-Tracking (z.B. "roter Rucksack")
- Cliffhanger-Validierung

---

### Phase 5: Monitoring & Tests

#### 15. ⏳ Telemetrie & Logging erweitern
**Status:** Basis vorhanden (`OptimizationTelemetry` Interface), Integration fehlt
**TODO:**
- CorrelationId in alle Logs
- ProfileHash/Version logging
- Vollständige Prompt-Logs
- QA-Results logging
- Standardisierte Error Codes

#### 16. ⏳ Test-Framework & Acceptance
**Status:** Noch nicht implementiert
**TODO:**
- 100 Testbilder / 10 Stories
- Acceptance Criteria: ≥95% Erfolgsrate
- Automated Test Runner
- Metriken-Sammlung

---

## 📁 Neue Dateien

| Datei | Zeilen | Zweck |
|-------|--------|-------|
| `backend/story/avatar-image-optimization.ts` | 481 | Core Optimierungsfunktionen (ID-Mapping, Fallback, Versioning, Negatives, Language Normalizer) |
| `backend/story/character-block-builder.ts` | 336 | CHARACTER-BLOCKS Builder (Species, MUST INCLUDE, FORBID) |
| `backend/story/vision-qa.ts` | 392 | Vision-QA System & Self-Check & Repair |

**Gesamt:** 1.209 neue Zeilen

---

## 🔄 Modifizierte Dateien

| Datei | Änderungen |
|-------|------------|
| `backend/story/ai-generation.ts` | Imports, System-Prompt mit Stilrichtlinien, Altersgerechte Wortanzahl |
| `backend/ai/image-generation.ts` | CFG 10.5, Steps 34 (Single & Batch) |

---

## 🚀 Nächste Schritte

### Priorität 1: Integration in ai-generation.ts
**Die neuen Module müssen noch in die tatsächliche Bildgenerierung integriert werden:**

1. **Avatar-ID-Mapping** vor MCP-Calls anwenden
2. **Fallback-Profil** nutzen, wenn MCP leer
3. **CHARACTER-BLOCKS** statt alter Prompt-Builder verwenden
4. **Negative Prompts** aus Library anwenden
5. **Vision-QA** nach jedem generierten Bild aufrufen
6. **Self-Check & Repair** Loop implementieren (max 3 Versuche)
7. **Cover-Fallback** für undefined Szenen
8. **Language Normalizer** auf alle Prompts anwenden

### Priorität 2: Restliche Aufgaben (12-16)
- Lernmodus strukturieren
- Memory-Updates kategorisieren
- Konsistenzprüfungen
- Telemetrie vervollständigen
- Test-Framework aufsetzen

---

## 📝 Implementierungs-Notizen

### Kritische Änderungen
- **CFG erhöht:** 8.5 → 10.5 (kann zu stärkerer Prompt-Adherence führen, ggf. weniger kreative Variation)
- **Steps erhöht:** 30 → 34 (ca. +13% Rechenzeit, bessere Qualität)
- **System-Prompt erweitert:** Von ~150 Zeilen auf ~400 Zeilen (+166%)

### Potenzielle Risiken
1. **CFG zu hoch:** >12 könnte zu "Wachseffekten" führen (Hardcap bei 12)
2. **Vision-QA False Positives:** LLM-basierte QA kann falsch liegen (ggf. CLIP als Fallback)
3. **Token-Kosten:** Vision API (gpt-4o) kostet zusätzlich
4. **Generierungszeit:** +13% durch Steps, +20-30% durch QA-Retries

### Empfehlungen
- **A/B Testing:** Neue Settings vs. alte Settings
- **Monitoring:** Erfolgsrate, Retry-Rate, Generierungszeit
- **Gradual Rollout:** Zunächst nur für neue Stories, später Migration

---

## 🎯 Acceptance Criteria (aus Spec)

### Akzeptanzkriterien (muss erfüllt sein):
- [ ] In 100 Testbildern über 10 Stories mit Diego+Adrian:
  - [ ] ≥ 95% Bilder zeigen genau 1 Jungen + 1 Katze in richtiger Form
  - [ ] 0% Bilder mit anthropomorpher Katze
  - [ ] ≤ 2% doppelte Kinder/Adrian-Duplikate
- [ ] Stories: alle Kapitel erfüllen Stilregeln
- [ ] Lernziel vorhanden
- [ ] Memory aktualisiert

**Aktueller Status:** Noch nicht getestet (Test-Framework fehlt)

---

## 📚 Referenzen

- **Spezifikation:** `storyweaver-avatar-image-optimization-v1.0.txt`
- **Commit:** `5e5eef3`
- **Branch:** `implement-mcp-servers`
- **Datum:** 23.10.2025


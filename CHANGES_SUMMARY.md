# Änderungen Zusammenfassung - AI Model Selection & Cost Tracking

## ✅ Behobene Probleme

### 1. Backend-Fehler behoben
- **Problem**: `ReferenceError: MODEL is not defined`
- **Lösung**: Model-Config nun in `generateStoryContent()` korrekt initialisiert
- **Datei**: [ai-generation.ts:353-355](backend/story/ai-generation.ts#L353-L355)

### 2. Preise aktualisiert
Alle Model-Preise auf neueste OpenAI-Preise aktualisiert:

| Model | Input ($/1M) | Output ($/1M) | Vorher |
|-------|-------------|--------------|---------|
| gpt-5-nano | $0.050 | $0.400 | $0.50 / $1.50 |
| gpt-5-mini | $0.250 | $2.000 | $5.00 / $15.00 |
| gpt-5 | $1.250 | $10.000 | NEU |
| gpt-5-pro | $15.00 | $120.00 | NEU |
| gpt-4.1-nano | $0.20 | $0.80 | NEU |
| gpt-4.1-mini | $0.80 | $3.20 | $1.00 / $4.00 |
| gpt-4.1 | $3.00 | $12.00 | NEU |
| o4-mini | $4.00 | $16.00 | NEU |

**Dateien**:
- [ai-generation.ts:135-192](backend/story/ai-generation.ts#L135-L192)
- [generate.ts:68-76](backend/story/generate.ts#L68-L76)

### 3. Frontend Model-Auswahl implementiert

**StoryWizardScreen**:
- AI Model zu StoryConfig hinzugefügt
- Default: `gpt-5-mini`
- Prop an StoryParametersStep weitergegeben

**Dateien**:
- [StoryWizardScreen.tsx:40-41](frontend/screens/Story/StoryWizardScreen.tsx#L40-L41)
- [StoryWizardScreen.tsx:72](frontend/screens/Story/StoryWizardScreen.tsx#L72)
- [StoryWizardScreen.tsx:243-247](frontend/screens/Story/StoryWizardScreen.tsx#L243-L247)

**StoryParametersStep**:
- UI-Sektion für Model-Auswahl hinzugefügt
- 8 Modelle zur Auswahl
- Visuelles Design mit Icons und Kosten
- "Empfohlen"-Badge für gpt-5-mini

**Datei**: [StoryParametersStep.tsx:48-169](frontend/screens/Story/steps/StoryParametersStep.tsx#L48-L169)

## 📊 Verfügbare Modelle im Frontend

1. ⚡ **GPT-5 Nano** - $0.05/1M - Schnell & günstig
2. ✨ **GPT-5 Mini** ⭐ - $0.25/1M - Empfohlen
3. 🌟 **GPT-5** - $1.25/1M - Beste Qualität
4. 🔷 **GPT-4.1 Nano** - $0.20/1M - Sehr günstig
5. 💎 **GPT-4.1 Mini** - $0.80/1M - GPT-4 Qualität
6. 💠 **GPT-4.1** - $3.00/1M - Premium
7. 🎯 **o4 Mini** - $4.00/1M - Reasoning
8. 👑 **GPT-5 Pro** - $15/1M - Höchste Qualität

## 🗄️ Datenbank

Migration **4_add_cost_tracking** erstellt:
```sql
ALTER TABLE stories ADD COLUMN tokens_input INTEGER;
ALTER TABLE stories ADD COLUMN tokens_output INTEGER;
ALTER TABLE stories ADD COLUMN tokens_total INTEGER;
ALTER TABLE stories ADD COLUMN cost_input_usd REAL;
ALTER TABLE stories ADD COLUMN cost_output_usd REAL;
ALTER TABLE stories ADD COLUMN cost_total_usd REAL;
ALTER TABLE stories ADD COLUMN cost_mcp_usd REAL;
ALTER TABLE stories ADD COLUMN model_used TEXT;
```

## 📝 Nächste Schritte

1. ⏳ **Migration anwenden**: `encore db migrate up`
2. ⏳ **Cost-Anzeige** in StoriesScreen unter dem Cover
3. ⏳ **MCP API Kosten** tracking implementieren
4. ⏳ **Tests** für verschiedene Modelle

## 🧪 Testing

Teste die verschiedenen Modelle:
1. Öffne Story Wizard
2. Gehe zu "Parameter" Step
3. Wähle ein AI Model
4. Erstelle Geschichte
5. Prüfe Logs für Kosten-Output
6. Prüfe DB für gespeicherte Kosten

**Expected Log Output**:
```
[ai-generation] 🤖 Using model: gpt-5-mini (Input: $0.25/1M, Output: $2/1M)
[ai-generation] 💰 Cost breakdown:
  Input: 12500 tokens × $0.25/1M = $0.0031
  Output: 8300 tokens × $2/1M = $0.0166
  Total: $0.0197
```

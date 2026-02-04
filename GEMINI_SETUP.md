# Google Gemini 3.0 Flash Integration

## Übersicht

Die Talea Plattform unterstützt jetzt **Google Gemini 3.0 Flash** als Alternative zu OpenAI-Modellen für die Story-Generierung. Gemini 3.0 Flash ist während der Preview-Phase **kostenlos** und bietet hochwertige, kreative Geschichten.

## Vorteile von Gemini 3.0 Flash

- 🆓 **Kostenlos** während der Preview-Phase
- ⚡ **Schnell** - Optimiert für niedrige Latenz
- 🎨 **Kreativ** - Hervorragend für kreatives Storytelling
- 🌍 **Mehrsprachig** - Unterstützt Deutsch, Englisch und viele weitere Sprachen
- 📚 **Lange Kontexte** - Bis zu 1M Token Input-Kontext

## Setup-Anleitung

### 1. Google AI Studio API Key erhalten

1. Besuche [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Melde dich mit deinem Google-Konto an
3. Klicke auf **"Get API Key"** oder **"Create API Key"**
4. Kopiere den generierten API Key

### 2. API Key in Encore konfigurieren

#### Lokal (Development)

```bash
# Im Backend-Verzeichnis
cd backend
encore secret set --dev GeminiAPIKey
# Füge deinen API Key ein, wenn du danach gefragt wirst
```

#### Production (Railway/Encore Cloud)

```bash
# Production Secret setzen
encore secret set --prod GeminiAPIKey
# Füge deinen API Key ein
```

Alternativ über das Encore Dashboard:
1. Gehe zu [encore.dev](https://app.encore.dev)
2. Wähle dein Projekt aus
3. Navigiere zu **Settings** → **Secrets**
4. Füge ein neues Secret hinzu:
   - Name: `GeminiAPIKey`
   - Value: Dein API Key

### 3. Verwendung im Story Wizard

1. Öffne den **Story Wizard** im Frontend
2. Navigiere zum **Parameters Step**
3. Wähle **"Gemini 3.0 Flash"** als AI Model
4. Das Modell wird automatisch verwendet, wenn der API Key konfiguriert ist

## Technische Details

### Model-Konfiguration

```typescript
"gemini-3.0-flash": {
  name: "gemini-3.0-flash",
  inputCostPer1M: 0.00,       // FREE während Preview
  outputCostPer1M: 0.00,      // FREE während Preview
  maxCompletionTokens: 8192,
  supportsReasoningEffort: false,
}
```

### API-Endpunkt

```
https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent
```

### Safety Settings

Die Integration verwendet `BLOCK_NONE` für alle Safety-Kategorien, da Talea ausschließlich kinderfreundliche Geschichten generiert.

### Response Format

Gemini wird konfiguriert, um **JSON** direkt zurückzugeben:
```typescript
responseMimeType: "application/json"
```

## Code-Struktur

### Neue Dateien

- `backend/story/gemini-generation.ts` - Gemini API Integration
  - `generateWithGemini()` - Hauptfunktion für Story-Generierung
  - `isGeminiConfigured()` - Prüft ob API Key gesetzt ist

### Geänderte Dateien

- `backend/story/generate.ts` - `AIModel` Type erweitert
- `backend/story/ai-generation.ts` - Model-Routing Logik
- `frontend/screens/Story/StoryWizardScreen.tsx` - Type Definition
- `frontend/screens/Story/steps/StoryParametersStep.tsx` - UI für Model-Auswahl

## Testing

### Manuelle Tests

1. Erstelle einen neuen Avatar
2. Starte den Story Wizard
3. Wähle "Gemini 3.0 Flash" als Model
4. Generiere eine Geschichte
5. Prüfe die Qualität und Konsistenz

### Expected Behavior

- ✅ Geschichte wird erfolgreich generiert
- ✅ JSON-Format ist korrekt
- ✅ Alle Charaktere werden konsistent dargestellt
- ✅ Deutsch/Englisch wird korrekt verwendet
- ✅ Token-Tracking funktioniert
- ✅ Kosten werden als $0.00 angezeigt

## Troubleshooting

### "Gemini API key not configured"

**Problem:** Der API Key wurde nicht gesetzt oder ist nicht verfügbar.

**Lösung:**
```bash
encore secret set --dev GeminiAPIKey
# oder für Production:
encore secret set --prod GeminiAPIKey
```

### "Gemini API error: 400"

**Problem:** Ungültige Request-Parameter.

**Lösung:** Prüfe die Console-Logs für Details. Häufige Ursachen:
- Ungültiger API Key
- Zu lange Prompts (>1M Token)
- Ungültige JSON-Struktur im Prompt

### "Invalid response from Gemini API"

**Problem:** Gemini hat kein valides JSON zurückgegeben.

**Lösung:**
- Prüfe ob `responseMimeType: "application/json"` gesetzt ist
- Eventuell ist der System-Prompt nicht klar genug
- Retry mit leicht angepasstem Prompt

## Kosten & Limits

### Preview-Phase (Aktuell)

- **Input:** Kostenlos
- **Output:** Kostenlos
- **Rate Limits:** 15 Requests/Minute, 1M Tokens/Minute

### Nach Preview-Phase

Google wird voraussichtlich folgende Preise einführen:
- **Input:** ~$0.075/1M Tokens (geschätzt)
- **Output:** ~$0.30/1M Tokens (geschätzt)

Die Preise werden automatisch in der `MODEL_CONFIGS` aktualisiert, sobald bekannt.

## Weitere Ressourcen

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Gemini 3.0 Flash Announcement](https://blog.google/technology/ai/google-gemini-ai-update-december-2024/)

## Support

Bei Fragen oder Problemen:
1. Prüfe die Console-Logs: `encore logs`
2. Teste mit OpenAI als Fallback
3. Erstelle ein Issue auf GitHub

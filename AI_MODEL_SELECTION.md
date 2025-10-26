# AI Model Selection für Story-Generierung

## Übersicht

Das Backend unterstützt jetzt die Auswahl verschiedener AI-Modelle für die Story-Generierung mit automatischem Cost-Tracking.

## Verfügbare Modelle

| Model | Input Cost ($/1M) | Output Cost ($/1M) | Max Tokens | Beschreibung |
|-------|------------------|-------------------|------------|--------------|
| **gpt-5-nano** | $0.50 | $1.50 | 16,000 | Günstigstes Model, schnell |
| **gpt-5-mini** (Default) | $5.00 | $15.00 | 16,000 | Beste Balance aus Qualität/Preis |
| **gpt-4.1-mini** | $1.00 | $4.00 | 16,384 | GPT-4 Qualität, günstig |
| **gpt-4o-mini** | $0.15 | $0.60 | 16,384 | Sehr günstig, gute Qualität |
| **gpt-4o** | $2.50 | $10.00 | 16,384 | Höchste Qualität |

## Nutzung

### Backend API

```typescript
const story = await api.story.generate({
  config: {
    avatarIds: ['avatar-1', 'avatar-2'],
    genre: 'adventure',
    setting: 'forest',
    length: 'medium',
    complexity: 'simple',
    ageGroup: '6-8',
    aiModel: 'gpt-4o-mini', // <-- Model auswählen
  },
});
```

### Frontend (StoryWizard)

Das Model kann im Story-Wizard als zusätzliche Option hinzugefügt werden:

```typescript
<select value={config.aiModel || 'gpt-5-mini'} onChange={...}>
  <option value="gpt-5-nano">GPT-5 Nano (günstig)</option>
  <option value="gpt-5-mini">GPT-5 Mini (empfohlen)</option>
  <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
  <option value="gpt-4o-mini">GPT-4o Mini (sehr günstig)</option>
  <option value="gpt-4o">GPT-4o (beste Qualität)</option>
</select>
```

## Cost Tracking

Kosten werden automatisch berechnet und in der Datenbank gespeichert:

### Story-Objekt

```typescript
{
  id: 'story-123',
  title: 'Die magische Reise',
  // ... andere Felder

  // Cost tracking
  tokensInput: 12500,
  tokensOutput: 8300,
  tokensTotal: 20800,
  costInputUSD: 0.0625,    // $0.0625
  costOutputUSD: 0.1245,   // $0.1245
  costTotalUSD: 0.187,     // $0.187
  costMcpUSD: 0.0,         // MCP API Kosten (TODO)
  modelUsed: 'gpt-5-mini',
}
```

### Datenbank

Die Kosten werden in folgenden Spalten gespeichert:

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

## Migration anwenden

```bash
cd backend
encore db migrate up
```

## Logs

Im Backend werden die Kosten automatisch geloggt:

```
[ai-generation] 🤖 Using model: gpt-5-mini (Input: $5/1M, Output: $15/1M)
[ai-generation] 💰 Cost breakdown:
  Input: 12500 tokens × $5/1M = $0.0625
  Output: 8300 tokens × $15/1M = $0.1245
  Total: $0.1870
```

## Frontend-Anzeige

Die Kosten können in der Story-Übersicht unter dem Cover angezeigt werden:

```typescript
{story.costTotalUSD && (
  <div className="cost-info">
    <p>Model: {story.modelUsed}</p>
    <p>Tokens: {story.tokensTotal?.toLocaleString()}</p>
    <p>Cost: ${story.costTotalUSD.toFixed(4)}</p>
  </div>
)}
```

## Nächste Schritte

1. ✅ Model-Auswahl im Backend implementiert
2. ✅ Cost-Tracking in DB gespeichert
3. ✅ Migration erstellt
4. ⏳ Model-Auswahl im Frontend (StoryWizard) hinzufügen
5. ⏳ Cost-Anzeige in StoriesScreen implementieren
6. ⏳ MCP API Kosten tracking implementieren

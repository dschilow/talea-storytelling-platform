# Talea MCP Validator Server

MCP (Model Context Protocol) Server for validating and normalizing story responses and avatar developments.

## Features

- ✅ Validate complete story responses from OpenAI
- ✅ Validate avatar development data
- ✅ Normalize legacy trait names to canonical IDs
- ✅ Generate detailed validation reports
- ✅ Support for base traits and knowledge subcategories
- ✅ Protected API with MCP API Key

## Environment Variables

```bash
MCP_SERVER_API_KEY=mcp_sk_xxx
PORT=8080
NODE_ENV=production
```

## Available MCP Tools

### 1. `validate_story_response`
Validates a complete story response from OpenAI.

**Input:**
```json
{
  "storyData": {
    "title": "The Dragon's Quest",
    "description": "An adventure story",
    "chapters": [...],
    "coverImageDescription": {...},
    "avatarDevelopments": [...],
    "learningOutcomes": [...]
  }
}
```

**Output:**
```json
{
  "isValid": true,
  "normalized": {...}
}
```

### 2. `validate_avatar_developments`
Validates avatar development data.

**Input:**
```json
{
  "developments": [
    {
      "name": "Max",
      "changedTraits": [
        { "trait": "courage", "change": 3 },
        { "trait": "knowledge.physics", "change": 5 }
      ]
    }
  ]
}
```

### 3. `normalize_trait_updates`
Normalizes trait update data.

**Input:**
```json
{
  "updates": [
    { "trait": "mut", "change": 2 },
    { "trait": "physics", "change": 5 }
  ]
}
```

**Output:**
```json
{
  "isValid": true,
  "normalized": [
    { "trait": "courage", "change": 2, "originalTrait": "mut" },
    { "trait": "knowledge.physics", "change": 5, "originalTrait": "physics" }
  ]
}
```

### 4. `get_validation_report`
Generates comprehensive validation report.

**Input:**
```json
{
  "storyData": {...}
}
```

**Output:**
```json
{
  "overall": true,
  "storyStructure": true,
  "chapters": true,
  "avatarDevelopments": true,
  "learningOutcomes": true,
  "errors": [],
  "warnings": []
}
```

## Valid Trait IDs

### Base Traits
- `courage`
- `intelligence`
- `creativity`
- `empathy`
- `strength`
- `humor`
- `adventure`
- `patience`
- `curiosity`
- `leadership`
- `teamwork`

### Knowledge Subcategories
- `knowledge.history`
- `knowledge.biology`
- `knowledge.physics`
- `knowledge.geography`
- `knowledge.astronomy`
- `knowledge.mathematics`
- `knowledge.chemistry`

## API Endpoints

### `GET /health`
Health check endpoint.

### `POST /mcp`
Main MCP endpoint for validation tools.

**Headers:**
```
X-MCP-API-Key: <mcp_api_key>
```

## Development

```bash
npm install
npm run dev
npm run build
npm start
```

## Docker Deployment

```bash
docker build -t talea-mcp-validator .
docker run -p 8080:8080 \
  -e MCP_SERVER_API_KEY=mcp_sk_xxx \
  talea-mcp-validator
```

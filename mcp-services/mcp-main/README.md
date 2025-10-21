# Talea MCP Main Server

MCP (Model Context Protocol) Server for Avatar Visual Profiles, Memories, and Personality Traits.

## Features

- ✅ Get avatar visual profiles for consistent image generation
- ✅ Retrieve and search avatar memories from past stories
- ✅ Build detailed image prompts from visual profiles
- ✅ Add new memories after story completion
- ✅ Get avatar personality traits
- ✅ Secure authentication via Clerk tokens
- ✅ Protected API with MCP API Key

## Environment Variables

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/railway
CLERK_SECRET_KEY=sk_test_xxx
MCP_SERVER_API_KEY=mcp_sk_xxx
PORT=3000
NODE_ENV=production
```

## Available MCP Tools

### 1. `get_avatar_visual_profile`
Get complete visual profile for a single avatar.

**Input:**
```json
{
  "avatarId": "avatar_123"
}
```

### 2. `get_multiple_avatar_profiles`
Get visual profiles for multiple avatars.

**Input:**
```json
{
  "avatarIds": ["avatar_123", "avatar_456"]
}
```

### 3. `build_consistent_image_prompt`
Generate detailed image prompt from visual profile.

**Input:**
```json
{
  "avatarId": "avatar_123",
  "sceneDescription": "in a magical forest",
  "action": "running towards castle",
  "expression": "smiling happily",
  "clothing": "wearing red raincoat"
}
```

### 4. `get_avatar_memories`
Get all memories for an avatar.

**Input:**
```json
{
  "avatarId": "avatar_123",
  "limit": 50
}
```

### 5. `search_memories_by_context`
Search memories by keyword.

**Input:**
```json
{
  "avatarId": "avatar_123",
  "searchTerm": "dragon",
  "limit": 20
}
```

### 6. `add_avatar_memory`
Add new memory after story completion.

**Input:**
```json
{
  "avatarId": "avatar_123",
  "storyId": "story_456",
  "storyTitle": "The Dragon's Quest",
  "experience": "Learned to be brave when facing the dragon",
  "emotionalImpact": "positive",
  "personalityChanges": [
    { "trait": "courage", "change": 3 },
    { "trait": "knowledge.history", "change": 5 }
  ]
}
```

### 7. `get_avatar_personality`
Get avatar's personality traits.

**Input:**
```json
{
  "avatarId": "avatar_123"
}
```

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "talea-mcp-main",
  "version": "1.0.0",
  "timestamp": "2025-01-20T12:00:00.000Z"
}
```

### `POST /mcp`
Main MCP endpoint for tool calls.

**Headers:**
```
Authorization: Bearer <clerk_token>
X-MCP-API-Key: <mcp_api_key>
```

**Body:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_avatar_visual_profile",
    "arguments": {
      "avatarId": "avatar_123"
    }
  }
}
```

### `GET /sse`
Server-Sent Events endpoint for real-time MCP communication.

**Headers:**
```
Authorization: Bearer <clerk_token>
X-MCP-API-Key: <mcp_api_key>
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Docker Deployment

```bash
# Build image
docker build -t talea-mcp-main .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e CLERK_SECRET_KEY=sk_test_xxx \
  -e MCP_SERVER_API_KEY=mcp_sk_xxx \
  talea-mcp-main
```

## Railway Deployment

1. Create new Railway service
2. Set environment variables
3. Connect to PostgreSQL database
4. Deploy from GitHub repository

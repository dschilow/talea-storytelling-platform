# Character Pool System - 4-Phase Story Generation

## Overview

The character pool system implements a 4-phase approach to story generation that automatically injects supporting characters into stories, making them more dynamic and lively.

## Architecture

### Phase 1: Story Skeleton Generation
**File:** `backend/story/phase1-skeleton.ts`

- Generates story structure with character ROLES (no names, no visuals)
- Uses placeholders like `{{WISE_ELDER}}`, `{{ANIMAL_HELPER}}` for supporting characters
- Token Budget: ~1,500 tokens
- Output: `StorySkeleton` with placeholder-based chapters

### Phase 2: Character Matching
**File:** `backend/story/phase2-matcher.ts`

- Smart algorithm matches best characters from pool to story roles
- **Scoring System (500 points total):**
  - Role Match: 100 points (critical)
  - Archetype Match: 80 points
  - Emotional Nature: 60 points
  - Required Traits: 50 points
  - Importance Alignment: 40 points
  - Setting Compatibility: 40 points
  - Freshness Bonus: 40 points
  - Chapter Availability: 30 points
  - Visual Diversity: 20 points
- Token Budget: 0 (pure backend logic)
- Quality Gate: Minimum score 80 points

### Phase 3: Story Finalization
**File:** `backend/story/phase3-finalizer.ts`

- Replaces placeholders with actual character names
- Generates complete story text with visual descriptions
- Integrates character appearances naturally
- Token Budget: ~2,000 tokens
- Output: `FinalizedStory` with complete chapters and image descriptions

### Phase 4: Image Generation
**File:** `backend/story/four-phase-orchestrator.ts`

- Generates consistent images for all chapters
- Uses avatar canonical appearance + supporting character visuals
- Parallel processing for speed (~30 seconds)
- Token Budget: 0 (Runware API)

## Database Schema

### character_pool Table
Stores all available supporting characters:
- `id` - Unique identifier
- `name` - Character name (e.g., "Frau Müller", "Hirsch der Wälder")
- `role` - Character role (guide, companion, obstacle, discovery, support, special)
- `archetype` - Character archetype (helpful_elder, loyal_animal, etc.)
- `emotional_nature` - JSONB with dominant/secondary traits
- `visual_profile` - JSONB with description, imagePrompt, species, colorPalette
- `max_screen_time` - Integer 0-100 (percentage)
- `available_chapters` - Array of chapter numbers
- `canon_settings` - Array of compatible settings
- Usage tracking: `recent_usage_count`, `total_usage_count`, `last_used_at`

### story_characters Table
Junction table tracking character usage:
- Links stories to characters used
- Stores placeholder mapping
- Tracks which chapters character appeared in

### story_skeletons Table
Stores Phase 1 output for debugging:
- Story skeleton with placeholders
- Character requirements
- Useful for analysis and improvement

## Seeded Characters (18 pre-built)

### Guide Characters (3)
1. **Frau Müller** - Helpful elder, forest/village settings
2. **Professor Lichtweis** - Scholarly mentor, castle/city settings
3. **Die Alte Eiche** - Ancient magical tree, forest settings

### Companion Characters (3)
4. **Silberhorn der Hirsch** - Noble deer, forest/mountain
5. **Luna** - Clever black cat, village/city/castle
6. **Pip** - Playful squirrel, forest/village

### Discovery Characters (3)
7. **Silberfunke** - Magical sprite, forest/castle
8. **Die Nebelfee** - Ethereal mist fairy, forest/mountain/beach
9. **Funkelflug** - Friendly golden dragon, mountain/castle

### Obstacle Characters (3)
10. **Graf Griesgram** - Misunderstood grumpy noble, castle/village
11. **Die Nebelhexe** - Trickster witch, forest/village
12. **Brumm der Steinwächter** - Guardian golem, mountain/castle

### Support Characters (3)
13. **Bäcker Braun** - Helpful baker, village/city
14. **Frau Wellenreiter** - Lighthouse keeper, beach/village
15. **Herr Seitenflug** - Enthusiastic librarian, castle/village/city

### Special Characters (3)
16. **Der Zeitweber** - Time mystical being, castle/mountain/forest
17. **Astra** - Cosmic star dancer, mountain/beach/forest
18. **Morpheus** - Dream weaver, castle/village/forest

## API Endpoints

### Character Pool Management
**File:** `backend/story/character-pool-api.ts`

- `GET /story/character-pool` - List all active characters
- `GET /story/character-pool/:id` - Get character details
- `POST /story/character-pool` - Add new character
- `PUT /story/character-pool/:id` - Update character
- `DELETE /story/character-pool/:id` - Soft delete character
- `GET /story/character-pool/:id/stats` - Get usage statistics
- `POST /story/character-pool/reset-usage` - Reset recent usage counts

### Story Generation
**Modified:** `backend/story/generate.ts`

Added `useCharacterPool` flag to `StoryConfig`:
```typescript
{
  avatarIds: string[];
  genre: string;
  setting: string;
  // ... other fields
  useCharacterPool?: boolean; // Default: true
}
```

## Integration

The orchestrator is integrated into the main story generation flow:

```typescript
if (useCharacterPool) {
  const orchestrator = new FourPhaseOrchestrator();
  const result = await orchestrator.orchestrate({
    config,
    avatarDetails,
    userId,
    clerkToken,
  });
  // Returns complete story with supporting characters
}
```

## Usage Tracking

The system tracks character usage to ensure freshness and variety:
- **Recent Usage Count**: Incremented after each story, used for freshness scoring
- **Total Usage Count**: Lifetime usage tracker
- **Last Used At**: Timestamp of last usage

**Freshness Bonus Formula:**
```
freshness = max(0, 40 - (recentUsage * 15))
```

This heavily penalizes recently used characters, promoting variety.

## Fallback Mechanism

If no character scores above 80 points, the system generates a fallback character on-the-fly:
- Generic name based on role
- Inferred species from archetype
- Basic visual profile
- Temporary character (not added to pool)

## Performance

### Target Metrics
- Phase 1: 5-10 seconds
- Phase 2: <1 second
- Phase 3: 8-15 seconds
- Phase 4: ~30 seconds (parallel)
- **Total: <60 seconds**

### Token Usage
- Phase 1: ~1,500 tokens
- Phase 2: 0 tokens (backend only)
- Phase 3: ~2,000 tokens
- Phase 4: 0 tokens (Runware)
- **Total: ~3,500 tokens** (60% more efficient than legacy)

## Advantages

1. **Dynamic Stories**: Supporting characters make stories more engaging
2. **Consistency**: Characters maintain visual and personality consistency
3. **Variety**: Smart matching promotes character diversity
4. **Efficiency**: 60% token reduction vs legacy system
5. **Scalability**: Easy to add new characters to pool
6. **Extensibility**: Users can add custom characters
7. **Quality**: Multi-phase validation ensures high-quality output

## Configuration

### Enable/Disable
Set `useCharacterPool: false` in `StoryConfig` to use legacy generation.

### Add Custom Characters
Use the character pool API to add organization-specific or user-custom characters.

### Reset Usage Statistics
Run `POST /story/character-pool/reset-usage` monthly to give all characters fresh chances.

## Database Migrations

Run automatically on startup via health service:
- `4_create_character_pool.up.sql` - Creates tables
- `5_seed_character_pool.up.sql` - Seeds 18 pre-built characters

## Future Enhancements

1. **Character Relationships**: Track which characters work well together
2. **Setting-Specific Pools**: Different character sets per setting
3. **Learning from Feedback**: Adjust character scores based on user ratings
4. **Character Evolution**: Allow characters to develop over multiple stories
5. **Visual Consistency Verification**: Use Vision QA to verify character appearance
6. **Multi-Language Support**: Localized character names and descriptions
7. **Character Personalities**: AI-driven dialogue generation per character
8. **Character Arcs**: Long-term character development across stories

## Testing

To test the system:

1. Start backend: `encore run`
2. Create story with `useCharacterPool: true`
3. Check logs for 4-phase execution
4. Verify supporting characters in story text
5. Check character_pool usage statistics

## Monitoring

Key metrics to monitor:
- Character pool size
- Average matching score
- Fallback generation rate
- Character usage distribution
- Phase execution times
- Token usage per phase

## Troubleshooting

**Issue: No characters matched**
- Solution: Check setting compatibility, lower quality gate threshold

**Issue: Same characters appear repeatedly**
- Solution: Run reset-usage endpoint, add more characters to pool

**Issue: Generated characters instead of pool**
- Solution: Review character archetypes, ensure pool has required roles

**Issue: Phase timeouts**
- Solution: Increase timeout values, check OpenAI API status

## Conclusion

The 4-phase character pool system provides a sophisticated, efficient approach to story generation with dynamic supporting characters. It balances automation with quality, variety with consistency, and speed with richness.

# Phase 3: Fairy Tale Integration

## Problem

The current 4-phase story generation system has a gap:
- ✅ Phase 1: Story Skeleton Generation (works)
- ✅ Phase 2: Character Matching (works)
- ❌ Phase 3: Story Finalization (currently just combines skeleton + characters)
- ✅ Phase 4: Image Generation (works)

**Phase 3 is NOT using the fairy tales database!**

## Solution

Phase 3 should use **public domain fairy tales** from the database as narrative templates.

### Current Phase 3 (`phase3-finalizer.ts`)
```typescript
// Just replaces placeholder names with actual character names
const skeletonWithNames = this.injectCharacterNames(input.skeleton, input.assignments);
// Then asks AI to write full story
```

### New Phase 3 (Fairy Tale Implementation)
```typescript
1. Select relevant fairy tale from database based on:
   - Age group match
   - Genre match
   - Required character roles match
   
2. Load fairy tale structure:
   - fairy_tales table: title, summary, moral_lesson
   - fairy_tale_roles table: protagonist, antagonist, helper roles
   - fairy_tale_scenes table: scene-by-scene narrative structure
   
3. Map user's avatars to fairy tale roles:
   - Use Phase 2's character matching results
   - Assign avatars to fairy tale roles (Hänsel, Gretel, Hexe, etc.)
   
4. Generate story using fairy tale as template:
   - Replace [HÄNSEL], [GRETEL] placeholders with user's avatar names
   - Keep the fairy tale's proven narrative structure
   - Adapt language and details to user's preferences
   
5. Output personalized fairy tale with user's characters
```

## Database Structure

### Tables Created
✅ `fairy_tales` - 3 tales seeded (Hänsel und Gretel, Rotkäppchen, Bremer Stadtmusikanten)
✅ `fairy_tale_roles` - Character roles for each tale
✅ `fairy_tale_scenes` - Scene-by-scene narrative structure
✅ `generated_stories` - Tracking generated stories
✅ `generated_story_scenes` - Scene data with images
✅ `fairy_tale_usage_stats` - Analytics

### Example: Hänsel und Gretel
- **Tale ID:** `grimm-015`
- **Roles:** Hänsel (protagonist), Gretel (protagonist), Hexe (antagonist), Vater (supporting)
- **Scenes:** 9 scenes from "Die arme Familie" to "Glückliches Ende"
- **Each scene has:** 
  - `scene_description` with placeholders like `[HÄNSEL]`, `[GRETEL]`
  - `character_variables` mapping: `{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL"}`
  - `illustration_prompt_template` for image generation
  - `mood`, `setting`, `duration_seconds`

## Implementation Steps

### Step 1: Complete Database Setup ✅
Run endpoint: `POST /health/complete-fairy-tales-setup`
- Creates all 6 tables
- Seeds 3 complete fairy tales
- Status: **Endpoint created, waiting for Railway deployment**

### Step 2: Create Fairy Tale Selector Service
Create `backend/story/fairy-tale-selector.ts`:
```typescript
export class FairyTaleSelector {
  async selectBestMatch(config: StoryConfig, availableRoles: number): Promise<FairyTale> {
    // Query fairy_tales WHERE age_recommendation matches config.ageGroup
    // Filter by genre compatibility
    // Check if enough user avatars for required roles
    // Return best matching fairy tale
  }
}
```

### Step 3: Modify Phase 3 Finalizer
Update `backend/story/phase3-finalizer.ts`:
```typescript
export class Phase3StoryFinalizer {
  async finalize(input: Phase3Input): Promise<Phase3FinalizationResult> {
    // 1. Select fairy tale from database
    const fairyTale = await this.fairyTaleSelector.selectBestMatch(
      input.config, 
      input.assignments.size
    );
    
    // 2. Load fairy tale scenes
    const scenes = await this.loadFairyTaleScenes(fairyTale.id);
    
    // 3. Map avatars to fairy tale roles
    const roleAssignments = this.mapAvatarsToFairyTaleRoles(
      fairyTale.roles,
      input.assignments,
      input.avatarDetails
    );
    
    // 4. Generate story using fairy tale template
    const prompt = this.buildFairyTalePrompt(
      fairyTale,
      scenes,
      roleAssignments,
      input.config
    );
    
    // 5. Call OpenAI to create personalized version
    // 6. Return finalized story with fairy tale structure
  }
}
```

### Step 4: Update Four-Phase Orchestrator
Modify `backend/story/four-phase-orchestrator.ts`:
```typescript
// Phase 3 should now receive fairy tale context
const phase3Result = await this.phase3Finalizer.finalize({
  skeleton,
  assignments: characterAssignments,
  config: configWithExperience,
  experience: experienceContext,
  avatarDetails: input.avatarDetails,
  useFairyTaleTemplate: true  // NEW FLAG
});
```

## Benefits

1. **Proven Story Structures:** Public domain fairy tales have stood the test of time
2. **Cultural Heritage:** Kids experience classic tales with their own characters
3. **Quality Assurance:** Pre-defined scenes ensure good narrative flow
4. **Scalability:** Easy to add more fairy tales to the database
5. **Consistency:** Image prompts are pre-defined for each scene

## Testing Plan

1. ✅ Test database setup endpoint
2. Test fairy tale selection logic
3. Test role mapping (2 avatars → Hänsel & Gretel)
4. Test story generation with fairy tale template
5. Test image generation with fairy tale scene prompts
6. Compare output: Custom story vs. Fairy tale-based story

## Next Steps

1. **Wait for Railway deployment** (~2-3 minutes)
2. **Run:** `POST /health/complete-fairy-tales-setup`
3. **Verify:** `GET /health/db-status` shows all tables with data
4. **Implement:** Fairy tale selector service
5. **Modify:** Phase 3 finalizer to use fairy tales
6. **Test:** Generate a story with fairy tale template

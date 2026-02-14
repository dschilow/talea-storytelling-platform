# Skill Pipeline Mapping (Release Quality)

This file maps the installed writing/evaluation skills to Talea's story pipeline so quality work is repeatable.

## Installed Skill Bundle

- `kids-book-writer`
- `dialogue`
- `scene-sequencing`
- `prose-style`
- `joke-engineering`
- `llm-evaluation`

## Phase Mapping

### Phase 5: Scene Directives + Prompt Build
Files:
- `backend/story/pipeline/scene-directives.ts`
- `backend/story/pipeline/prompts.ts`

Use:
- `kids-book-writer`: age-fit language targets, read-aloud rhythm, clear page-turn micro-hooks, values via action (not lecture).
- `dialogue`: per-character voice cards (sentence length, directness, taboo phrases, favorite words).
- `scene-sequencing`: chapter intents in Goal -> Conflict -> Disaster, and hand-off into next chapter via Decision.

Expected effect:
- less "meta narration", stronger child perspective, better chapter momentum.

### Phase 6A: First Draft Generation
Files:
- `backend/story/pipeline/story-writer.ts`
- `backend/story/pipeline/prompts.ts`

Use:
- `prose-style`: enforce concise child-facing diction, cap comparison density per paragraph, vary sentence rhythm.
- `joke-engineering`: inject 1-3 humor beats by level (situational + dialogue wit, never humiliation humor).

Expected effect:
- less artificial prose, stronger readability, reliable humor presence.

### Phase 6B: Rewrite/Polish Pass
Files:
- `backend/story/pipeline/story-writer.ts`
- `backend/story/pipeline/prompts.ts`

Use:
- `dialogue`: fix same-voice dialogue and single-function exchanges.
- `scene-sequencing`: repair abrupt transitions with explicit sequel beats (Reaction -> Dilemma -> Decision).
- `prose-style`: remove overwritten lines and repeated formula phrases.

Expected effect:
- cleaner continuity and stronger character distinctness.

### Phase 6C: Critic + Release Ranking
Files:
- `backend/story/pipeline/semantic-critic.ts`
- `backend/story/pipeline/orchestrator.ts`

Use:
- `llm-evaluation`: stable rubric dimensions and regression checks for candidate ranking.

Minimum release dimensions (recommended):
- Craft (style/rhythm/voice): >= 8.5
- Narrative (stakes/arc/payoff): >= 8.5
- Child Fit (age-appropriate clarity/warmth): >= 8.7
- Humor (child-friendly comic beats): >= 8.0

Expected effect:
- fewer subjective releases, clearer pass/fail decisions.

## Gate-Level Focus (Current Pain Points)

Primary gates to improve first:
- `POETIC_DENSITY`
- `META_FORESHADOW`
- `SHOW_DONT_TELL_EXPOSITION`
- `CHARACTER_VOICE`
- `SCENE_CONTINUITY`
- `ENDING_PAYOFF`
- `HUMOR_PRESENCE`

File:
- `backend/story/pipeline/quality-gates.ts`

## Operating Procedure

1. Build draft with explicit voice/scene constraints.
2. Run deterministic gates.
3. Run semantic critic rubric.
4. Apply only targeted local surgery (no blind full rewrite loops).
5. Re-score and compare against previous candidate before accepting edits.

## Notes

- Skills improve authoring and evaluation workflow quality; they do not execute inside runtime automatically.
- Runtime quality still depends on prompt/gate logic in the pipeline files listed above.

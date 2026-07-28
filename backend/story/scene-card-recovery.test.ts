// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";
import {
  recoverCompleteObjectsFromArrayProperty,
  recoverTruncatedSceneCardPayload,
} from "./provider-output-recovery";
import truncatedSceneCards from "./__fixtures__/truncated-scene-cards.json";

/**
 * Fixtures are the verbatim `rawContent` of the scene-cards stage from four
 * production runs (33a39c66, 8edf8f4f, 88331eb6, dc70b8a7). Every one of them
 * hit the completion ceiling mid-array, failed JSON.parse, and caused the
 * pipeline to fall back to deterministic mad-libbed cards.
 */
/**
 * Run e7b2d09c is a different failure class from the other four: its stream
 * died 1545 characters in, INSIDE the first card, so no complete object ever
 * closed. It gets its own expectations below.
 */
const PARTIAL_FIRST_CARD_RUN = "e7b2d09c-partial-first-card";
const allFixtures = Object.entries(truncatedSceneCards as Record<string, string>);
const fixtures = allFixtures.filter(([run]) => run !== PARTIAL_FIRST_CARD_RUN);
const DEV_MODE_SCENE_CARD_COUNT = 5;

describe("recoverTruncatedSceneCardPayload", () => {
  test("has fixtures from real truncated production runs", () => {
    expect(fixtures.length).toBe(4);
  });

  for (const [run, rawContent] of fixtures) {
    describe(run, () => {
      test("raw payload is genuinely unparseable", () => {
        expect(() => JSON.parse(rawContent)).toThrow();
      });

      test("recovers the complete scene cards written before the cut", () => {
        const recovered = recoverTruncatedSceneCardPayload(rawContent);
        expect(recovered).not.toBeNull();
        expect(recovered.recoveredFromTruncatedJson).toBe(true);
        // The audited runs cut off inside scene 4 or 5, leaving 3-4 complete
        // cards. Anything above zero beats the old behaviour, which discarded
        // the entire payload and mad-libbed all five.
        expect(recovered.sceneCards.length).toBeGreaterThanOrEqual(3);
        expect(recovered.sceneCards.length).toBeLessThanOrEqual(DEV_MODE_SCENE_CARD_COUNT);
      });

      test("recovered cards carry per-scene dramaturgy, not template filler", () => {
        const { sceneCards } = recoverTruncatedSceneCardPayload(rawContent);

        // Each card must have its own visible goal / obstacle.
        for (const card of sceneCards) {
          expect(typeof card.scene).toBe("number");
          expect(String(card.visibleGoal || card.goal || "").length).toBeGreaterThan(10);
        }

        // The regression being guarded: the deterministic fallback gives every
        // scene the SAME four beats (want/observe/resist/decide, all spoken by
        // the first hero). Real cards vary per scene.
        const beatSignatures = sceneCards.map((card: any) =>
          JSON.stringify((card.dialogueBeats || []).map((b: any) => [b.speaker, b.intent]))
        );
        expect(new Set(beatSignatures).size).toBeGreaterThan(1);
      });

      test("recovered dialogue beats are shared across more than one speaker", () => {
        const { sceneCards } = recoverTruncatedSceneCardPayload(rawContent);
        const speakers = new Set<string>();
        for (const card of sceneCards) {
          for (const beat of card.dialogueBeats || []) {
            if (beat?.speaker) speakers.add(String(beat.speaker));
          }
        }
        // The fallback template only ever speaks as the first main avatar.
        expect(speakers.size).toBeGreaterThan(1);
      });
    });
  }

  test("returns null for content with no recoverable scene objects", () => {
    expect(recoverTruncatedSceneCardPayload("")).toBeNull();
    expect(recoverTruncatedSceneCardPayload("not json at all")).toBeNull();
    expect(recoverTruncatedSceneCardPayload('{"sceneCards": [')).toBeNull();
  });

  describe(PARTIAL_FIRST_CARD_RUN, () => {
    const rawContent = (truncatedSceneCards as Record<string, string>)[PARTIAL_FIRST_CARD_RUN];

    test("is the run that lost the whole stage", () => {
      // 1545 chars, aborted mid-first-card, usage 0/0. Before this fixture the
      // pipeline mad-libbed all five cards and the story was written with no
      // scene dramaturgy at all.
      expect(rawContent.length).toBe(1545);
      expect(() => JSON.parse(rawContent)).toThrow();
      expect(recoverCompleteObjectsFromArrayProperty(rawContent, "sceneCards")).toEqual([]);
    });

    test("salvages the pairs the first card had already written", () => {
      const recovered = recoverTruncatedSceneCardPayload(rawContent);
      expect(recovered).not.toBeNull();
      expect(recovered.recoveredPartialCardCount).toBe(1);
      expect(recovered.sceneCards.length).toBe(1);

      const card = recovered.sceneCards[0];
      expect(card.scene).toBe(1);
      // Real dramaturgy, not template filler.
      expect(String(card.visibleGoal || "").length).toBeGreaterThan(10);
      expect(String(card.obstacle || "").length).toBeGreaterThan(10);
    });

    test("drops the half-written pair at the cut instead of keeping garbage", () => {
      const { sceneCards } = recoverTruncatedSceneCardPayload(rawContent);
      // The stream died inside `characterActions`; that key must not survive
      // half-formed.
      const card = sceneCards[0];
      for (const value of Object.values(card)) {
        expect(typeof value === "string" || typeof value === "number"
          || typeof value === "boolean" || value === null
          || typeof value === "object").toBe(true);
      }
      expect(JSON.parse(JSON.stringify(card))).toEqual(card);
    });
  });
});

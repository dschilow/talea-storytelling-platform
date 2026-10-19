// @ts-ignore Bun executes these tests; it is not a dependency of the browser bundle.
import { expect, test } from "bun:test";
import { recoverGeneratedStoryAfterFailure } from "./storyGenerateWithModelFallback";

test("a disconnected Wunder request can complete after the old recovery window without generating again", async () => {
  let lookups = 0;
  const complete = { status: "complete", chapters: [{ content: "Fertig." }] };
  const result = await recoverGeneratedStoryAfterFailure({ get: async request => {
    expect(request).toEqual({ id: "same-story", profileId: "same-profile" });
    return ++lookups === 120 ? complete : { status: "generating", chapters: [] };
  } }, "same-story", "same-profile", { maxWaitMs: 15 * 60_000, sleep: async () => {} });
  expect(result).toBe(complete);
  expect(lookups).toBe(120);
});

test("the longer wait still stops immediately when the server marks generation failed", async () => {
  let lookups = 0, sleeps = 0;
  const result = await recoverGeneratedStoryAfterFailure({ get: async () => {
    lookups++; return { status: "error", chapters: [] };
  } }, "failed-story", undefined, { maxWaitMs: 15 * 60_000, sleep: async () => { sleeps++; } });
  expect(result).toBeNull(); expect(lookups).toBe(1); expect(sleeps).toBe(0);
});

test("leaving the wizard stops polling without showing a failed generation", async () => {
  let stopped = false, lookups = 0;
  const result = await recoverGeneratedStoryAfterFailure({ get: async () => {
    lookups++; return { status: "generating", chapters: [] };
  } }, "running-story", undefined, { maxWaitMs: 15 * 60_000, shouldStop: () => stopped, sleep: async () => { stopped = true; } });
  expect(result).toBeNull(); expect(lookups).toBe(1);
});

test("ordinary recovery retains its bounded three-minute window", async () => {
  let lookups = 0;
  const result = await recoverGeneratedStoryAfterFailure({ get: async () => {
    lookups++; return { status: "generating", chapters: [] };
  } }, "ordinary-story", undefined, { sleep: async () => {} });
  expect(result).toBeNull(); expect(lookups).toBe(90);
});

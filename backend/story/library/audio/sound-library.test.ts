import { describe, expect, test } from "bun:test";
import type { LlmCallResult, LlmRequest, StorybookLlm } from "../../storybook/llm";
import type { AudioScript, ScriptPart } from "../types";
import {
  applySoundPlan,
  findCandidates,
  lengthFits,
  planSoundCasting,
  soundIdOf,
  soundStorageKey,
  soundWishes,
  stemWord,
  trackSoundCache,
  wishKey,
  type SoundEntry,
} from "./sound-library";

function entry(kind: SoundEntry["kind"], prompt: string, seconds: number, extra: Partial<SoundEntry> = {}): SoundEntry {
  const storageKey = soundStorageKey(kind, prompt, seconds);
  return { id: soundIdOf(storageKey), kind, prompt, seconds, label: prompt.slice(0, 40), description: prompt, tags: [], storageKey, uses: 0, blocked: false, origin: "Andere Reihe S1E1", ...extra };
}

function script(parts: Array<Pick<ScriptPart, "lines" | "scenes">>): AudioScript {
  return { version: 1, speakers: [], notes: [], parts: parts.map((part, index) => ({ kind: "chapter", chapterIndex: index, title: `Kapitel ${index + 1}`, ...part })) };
}

function fakeLlm(answer: (request: LlmRequest) => unknown): StorybookLlm & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  const llm = (async (request: LlmRequest): Promise<LlmCallResult> => {
    calls.push(request);
    return { text: JSON.stringify(answer(request)), modelUsed: request.model, usage: { prompt: 100, completion: 50, total: 150, costUSD: 0.0001 }, durationMs: 1 };
  }) as StorybookLlm & { calls: LlmRequest[] };
  llm.calls = calls;
  return llm;
}

const failingLlm: StorybookLlm = async () => {
  throw new Error("no model in this test");
};

const DOOR = "interior wooden apartment door closing gently with a latch click";
const COINS = "a few euro coins gently clinking onto a wooden outdoor market table";
const LIVING = "quiet apartment living room, faint street traffic through the window";

describe("sound library: keywords", () => {
  test("stems join the forms of a word", () => {
    expect(["closing", "closes", "closed", "close"].map(stemWord)).toEqual(["clos", "clos", "clos", "clos"]);
    expect(stemWord("footsteps")).toBe(stemWord("footstep"));
    expect(stemWord("dripping")).toBe(stemWord("drip"));
    expect(stemWord("bubbles")).toBe(stemWord("bubble"));
    expect(stemWord("glass")).toBe("glass");
    expect(stemWord("falling")).toBe(stemWord("fall"));
  });

  test("a spot effect fits when its length is close; a loop always fits", () => {
    expect(lengthFits("sfx", 1.5, 1)).toBe(true);
    expect(lengthFits("sfx", 2, 6)).toBe(false);
    expect(lengthFits("sfx", 4, 3)).toBe(true);
    expect(lengthFits("sfx", 0.5, 2)).toBe(false);
    expect(lengthFits("ambience", 0, 0)).toBe(true);
  });
});

describe("sound library: wishes and candidates", () => {
  const screenplay = script([
    {
      scenes: [{ startLine: 0, place: "Wohnzimmer", ambience: "quiet apartment living room, faint street traffic through a closed window" }],
      lines: [
        { speaker: "ERZAEHLER", text: "Die Tür ging zu.", sounds: [{ sound: "interior wooden apartment door closing softly with a latch click", at: "zu", seconds: 1 }] },
        { speaker: "ERZAEHLER", text: "Noch einmal.", sounds: [{ sound: "interior wooden apartment door closing softly with a latch click.", seconds: 1 }] },
        { speaker: "ERZAEHLER", text: "Münzen.", sounds: [{ sound: "small euro coins clinking softly on a wooden market table outdoors", seconds: 1 }] },
      ],
    },
  ]);

  test("every distinct sound once, in order; the same prompt with a full stop is the same wish", () => {
    const wishes = soundWishes(screenplay);
    expect(wishes.map((wish) => wish.kind)).toEqual(["ambience", "sfx", "sfx"]);
    expect(wishes[1].seconds).toBe(1);
  });

  test("the differently worded library sound is the top candidate; blocked and too short ones are not offered", () => {
    const library = [
      entry("sfx", DOOR, 1),
      entry("sfx", COINS, 1),
      entry("sfx", "interior wooden door closing with a latch click", 4, { label: "zu lang" }),
      entry("sfx", "wooden door closing gently with a click", 1, { blocked: true }),
      entry("ambience", LIVING, 0),
    ];
    const wishes = soundWishes(screenplay);
    const candidates = findCandidates(wishes, library, wishes.map(() => true));
    expect(candidates[0][0].ref).toBe(library[4].id);
    expect(candidates[1][0].ref).toBe(library[0].id);
    expect(candidates[1].some((candidate) => candidate.ref === library[2].id || candidate.ref === library[3].id)).toBe(false);
    expect(candidates[2][0].ref).toBe(library[1].id);
  });

  test("an earlier new sound of the same episode is a candidate too", () => {
    const wishes = [
      { kind: "sfx" as const, prompt: "big friendly dog bark in a hallway, comical", seconds: 1 },
      { kind: "sfx" as const, prompt: "one loud friendly dog bark from the hallway, comic not scary", seconds: 1 },
    ];
    const candidates = findCandidates(wishes, [], [true, true]);
    expect(candidates[0]).toEqual([]);
    expect(candidates[1][0].ref).toBe("w0");
  });
});

describe("sound library: casting", () => {
  const library = [entry("sfx", DOOR, 1), entry("ambience", LIVING, 0)];

  test("a re-recording keeps the sounds its screenplay names; the same prompt is taken without asking", async () => {
    const screenplay = script([
      {
        scenes: [{ startLine: 0, place: "Wohnzimmer", ambience: LIVING }],
        lines: [{ speaker: "ERZAEHLER", text: "Tür.", sounds: [{ sound: "door shuts", seconds: 1, libraryId: library[0].id }] }],
      },
    ]);
    const plan = await planSoundCasting({ script: screenplay, library, llm: failingLlm, model: "luna", origin: "Bruno S1E2" });
    expect(plan.stats).toMatchObject({ wishes: 2, fromLibrary: 2, fresh: 0, askedLlm: 0 });
    applySoundPlan(screenplay, plan);
    expect(screenplay.parts[0].lines[0].sounds![0]).toMatchObject({ sound: DOOR, seconds: 1, libraryId: library[0].id });
    expect(screenplay.parts[0].scenes[0].ambienceLibraryId).toBe(library[1].id);
  });

  test("Luna's choices: a library sound, the same new sound as before, a new one with its description", async () => {
    const screenplay = script([
      {
        scenes: [{ startLine: 0, place: "Flur", ambience: "" }],
        lines: [
          { speaker: "ERZAEHLER", text: "Bellen.", sounds: [{ sound: "big friendly dog bark in a hallway, comical", seconds: 1 }] },
          { speaker: "ERZAEHLER", text: "Wieder.", sounds: [{ sound: "one loud friendly dog bark from the hallway, comic not scary", seconds: 1 }] },
          { speaker: "ERZAEHLER", text: "Tür.", sounds: [{ sound: "wooden apartment door closes softly, latch clicks", seconds: 0.8 }] },
        ],
      },
    ]);
    const llm = fakeLlm((request) => {
      expect(request.user).toContain("#0");
      expect(request.user).toContain("W0");
      return {
        sounds: [
          { i: 0, label: "Großer Hund bellt freundlich", description: "One deep friendly bark of a big dog in a hallway, comic.", tags: ["dog", "bark", "woof", "big", "friendly", "hallway"] },
          { i: 1, use: "W0" },
          { i: 2, use: "L1" },
        ],
      };
    });
    const plan = await planSoundCasting({ script: screenplay, library, llm, model: "luna", origin: "Bruno S1E2" });
    expect(llm.calls).toHaveLength(1);
    expect(plan.stats).toMatchObject({ wishes: 3, fromLibrary: 1, sameInEpisode: 1, fresh: 1, askedLlm: 3 });
    expect(plan.fresh[0]).toMatchObject({ kind: "sfx", label: "Großer Hund bellt freundlich", tags: ["dog", "bark", "woof", "big", "friendly", "hallway"], origin: "Bruno S1E2", seconds: 1 });
    expect(plan.fresh[0].id).toBe(soundIdOf(plan.fresh[0].storageKey));
    expect(plan.used).toEqual([library[0].id]);

    applySoundPlan(screenplay, plan);
    const sounds = screenplay.parts[0].lines.map((line) => line.sounds![0]);
    expect(sounds[1]).toMatchObject({ sound: "big friendly dog bark in a hallway, comical", libraryId: plan.fresh[0].id });
    expect(sounds[2]).toMatchObject({ sound: DOOR, seconds: 1, libraryId: library[0].id });
  });

  test("an id Luna was not offered, a missing answer or a failed call make the sound new, with a plain description", async () => {
    const screenplay = script([
      { scenes: [], lines: [{ speaker: "ERZAEHLER", text: "Tür.", sounds: [{ sound: "wooden apartment door closes softly, latch clicks", seconds: 1 }] }] },
    ]);
    const invented = await planSoundCasting({ script: screenplay, library, llm: fakeLlm(() => ({ sounds: [{ i: 0, use: "L7" }] })), model: "luna", origin: "x" });
    expect(invented.stats.fresh).toBe(1);
    expect(invented.fresh[0].description).toBe("wooden apartment door closes softly, latch clicks");
    expect(invented.fresh[0].tags).toContain("door");

    const failed = await planSoundCasting({ script: screenplay, library, llm: failingLlm, model: "luna", origin: "x" });
    expect(failed.stats).toMatchObject({ fresh: 1, fromLibrary: 0 });
  });

  test("a blocked sound is never offered and a screenplay that names it is cast anew", async () => {
    const blocked = [{ ...library[0], blocked: true }];
    const screenplay = script([{ scenes: [], lines: [{ speaker: "ERZAEHLER", text: "Tür.", sounds: [{ sound: DOOR, seconds: 1, libraryId: library[0].id }] }] }]);
    const llm = fakeLlm(() => ({ sounds: [{ i: 0, label: "Tür", description: "A door closes.", tags: ["door", "close", "latch"] }] }));
    const plan = await planSoundCasting({ script: screenplay, library: blocked, llm, model: "luna", origin: "x" });
    expect(llm.calls[0].user).toContain("kein Kandidat");
    expect(plan.stats.fresh).toBe(1);
  });

  test("sounds made for this episode before do not count as found in the library", async () => {
    const own = [entry("sfx", DOOR, 1, { origin: "Bruno S1E1" })];
    const screenplay = script([{ scenes: [], lines: [{ speaker: "ERZAEHLER", text: "Tür.", sounds: [{ sound: DOOR, seconds: 1 }] }] }]);
    const plan = await planSoundCasting({ script: screenplay, library: own, llm: failingLlm, model: "luna", origin: "Bruno S1E1" });
    expect(plan.stats.fromLibrary).toBe(0);
    expect(plan.used).toEqual([own[0].id]);
  });

  test("large screenplays are decided in batches", async () => {
    const lines = Array.from({ length: 45 }, (_, index) => ({ speaker: "ERZAEHLER", text: `Zeile ${index}.`, sounds: [{ sound: `unique sound number ${index} of a strange machine part ${"xyzw"[index % 4]}`, seconds: 1 }] }));
    const llm = fakeLlm(() => ({ sounds: [] }));
    const plan = await planSoundCasting({ script: script([{ scenes: [], lines }]), library: [], llm, model: "luna", origin: "x" });
    expect(llm.calls).toHaveLength(2);
    expect(plan.stats.fresh).toBe(45);
  });
});

describe("sound library: storage", () => {
  test("the keys match the studio mix (ambience with its suffix, spot effects by rounded length)", () => {
    expect(soundStorageKey("ambience", LIVING, 0)).toBe(soundStorageKey("ambience", LIVING, 12));
    expect(soundStorageKey("sfx", DOOR, 1.04)).toBe(soundStorageKey("sfx", DOOR, 1));
    expect(soundStorageKey("sfx", DOOR, 1)).not.toBe(soundStorageKey("sfx", DOOR, 2));
    expect(wishKey({ kind: "sfx", prompt: `${DOOR}.`, seconds: 1 })).toBe(wishKey({ kind: "sfx", prompt: DOOR.toUpperCase(), seconds: 1 }));
  });

  test("the tracked cache notes sounds that were loaded or generated", async () => {
    const stored = new Map<string, Buffer>([["a", Buffer.from("x")]]);
    const present = new Set<string>();
    const cache = trackSoundCache({ load: async (key) => stored.get(key) ?? null, save: async (key, audio) => void stored.set(key, audio) }, present);
    await cache.load("a");
    await cache.load("missing");
    await cache.save("b", Buffer.from("y"));
    expect([...present].sort()).toEqual(["a", "b"]);
  });
});

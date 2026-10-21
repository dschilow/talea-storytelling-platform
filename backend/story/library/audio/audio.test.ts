import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SEED_EPISODES, SEED_SERIES } from "../seed";
import type { ScriptPart } from "../types";
import { DEFAULT_NARRATOR, NARRATOR_ID, pickVoice, resolveSeriesCast, type AccountVoice } from "./casting";
import { musicRefused, scoreKey, scorePrompt, soundFallbackPrompt } from "./score";
import { checkFidelity, cleanLineText, closingPart, openingPart, quotedLines, speakerKey, splitLongLine, spokenWords } from "./screenplay";
import { GAPS, anchorTime, buildTimeline, type RenderedPart, type ScoreTrack } from "./timeline";
import { checkTake, germanNumber, listenWords, planTakes } from "./qa";

const ACCOUNT: AccountVoice[] = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "..", "scripts", "game-voices", "voices-account.json"), "utf8")).map(
  (voice: { voice_id: string; name: string; labels?: Record<string, string>; description?: string }) => ({ voiceId: voice.voice_id, name: voice.name, labels: voice.labels, description: voice.description }),
);

describe("screenplay text", () => {
  test("speaker keys are plain upper-case ASCII", () => {
    expect(speakerKey("frau-grimmbach")).toBe("FRAU-GRIMMBACH");
    expect(speakerKey("Socken-Schnüffler")).toBe("SOCKEN-SCHNUEFFLER");
    expect(speakerKey("Der Mann mit dem Fischhut")).toBe("DER-MANN-MIT-DEM-FISCHHUT");
  });

  test("a line keeps one leading tag, known reactions, and loses quotes and stray directions", () => {
    expect(cleanLineText("[grumpy, offended] „Flocken.“ [sighs] Extra-Flocken!", "grumpy")).toBe("[grumpy, offended] Flocken. [sighs] Extra-Flocken!");
    expect(cleanLineText("Hab ich's nicht gesagt? [door creaks] (leise)", "grumpy, gruff")).toBe("[grumpy, gruff] Hab ich's nicht gesagt?");
    // German or overlong tags are not v4 direction: the persona takes over.
    expect(cleanLineText("[wütend] Nein!", "strict")).toBe("[strict] Nein!");
    expect(cleanLineText("[laughs]", "warm")).toBe("");
  });

  test("long narrator lines are split at sentence ends and keep their sounds", () => {
    const sentence = "Im Treppenhaus stand Frau Grimmbach mit ihrem Heft und sah sehr streng aus. ";
    const line = { speaker: "ERZAEHLER", text: `[warm, playful] ${sentence.repeat(9)}Dann machte es RUMMS.`, sounds: [{ sound: "heavy thud", at: "RUMMS" }] };
    const parts = splitLongLine(line);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.text.startsWith("[warm, playful] "))).toBe(true);
    expect(parts[parts.length - 1].sounds?.[0].at).toBe("RUMMS");
    expect(parts.flatMap((part) => spokenWords(part.text)).length).toBe(spokenWords(line.text).length);
  });

  test("opening and closing are spoken by the narrator", () => {
    const opening = openingPart({ title: "Bruno, der Flunkerfisch" }, 1, 3, "Der „Hund“");
    expect(opening.lines[0].text).toBe("[warm, playful] Bruno, der Flunkerfisch. [pause] Folge drei: Der Hund.");
    expect(closingPart("")).toBeNull();
    expect(closingPart("Nächsten Freitag: Ella flunkert.")!.lines[0].speaker).toBe("ERZAEHLER");
  });
});

describe("fidelity", () => {
  const chapter = SEED_EPISODES[0].chapters[0].text;

  test("finds every quoted line of the prose", () => {
    const quotes = quotedLines(chapter);
    expect(quotes.length).toBeGreaterThan(15);
    expect(quotes).toContain("Den will ich");
  });

  test("a faithful adaptation passes, a summary fails", () => {
    const faithful = chapter
      .split(/\n\n+/)
      .flatMap((paragraph) => paragraph.split(/(?<=[.!?“])\s+/))
      .map((sentence) => ({ speaker: "ERZAEHLER", text: `[warm] ${sentence.replace(/[„“]/g, "")}` }));
    expect(checkFidelity(chapter, faithful).passed).toBe(true);
    const summary = [{ speaker: "ERZAEHLER", text: "[warm] Mats kauft einen Goldfisch, der sprechen kann, und flunkert von einem Hund." }];
    const report = checkFidelity(chapter, summary);
    expect(report.passed).toBe(false);
    expect(report.missingQuotes.length).toBeGreaterThan(10);
  });
});

describe("casting", () => {
  test("seed series: Captain Comedy narrates, every speaking figure has its own voice from the account", () => {
    const account = new Set(ACCOUNT.map((voice) => voice.voiceId));
    for (const { series, bible } of SEED_SERIES) {
      expect(bible.audio?.narrator.voiceId).toBe(DEFAULT_NARRATOR.voiceId);
      expect(bible.audio?.scoreStyleEn.length).toBeGreaterThan(40);
      const voices = Object.values(bible.audio!.cast).filter((role) => !role.silent).map((role) => role.voiceId!);
      expect(new Set(voices).size).toBe(voices.length);
      expect(voices).not.toContain(DEFAULT_NARRATOR.voiceId);
      for (const voiceId of voices) expect(account.has(voiceId)).toBe(true);
      for (const character of bible.characters) expect(bible.audio!.cast[character.id], `${series.id}/${character.id}`).toBeDefined();
    }
  });

  test("admin choice wins, a voice missing from the account is replaced, silent figures stay silent", () => {
    const { bible } = SEED_SERIES[0];
    const voices = ACCOUNT.filter((voice) => voice.voiceId !== bible.audio!.cast.mats.voiceId);
    const { cast, autoPicks } = resolveSeriesCast({
      bible,
      characters: bible.characters,
      overrides: [{ speakerId: "ella", voiceId: "zndmYEEoWWxRYyEL2ZZY", persona: "precise", source: "admin" }],
      voices,
    });
    const byId = new Map(cast.map((voice) => [voice.speakerId, voice]));
    expect(cast[0].speakerId).toBe(NARRATOR_ID);
    expect(byId.get("ella")).toMatchObject({ voiceId: "zndmYEEoWWxRYyEL2ZZY", persona: "precise", source: "admin" });
    expect(byId.get("bruno")).toMatchObject({ voiceId: bible.audio!.cast.bruno.voiceId, source: "series" });
    expect(byId.get("kater-kaiser")?.silent).toBe(true);
    const mats = byId.get("mats")!;
    expect(mats.source).toBe("auto");
    expect(mats.replaced).toBe(bible.audio!.cast.mats.voiceId);
    expect(autoPicks.map((pick) => pick.speakerId)).toEqual(["mats"]);
    const used = cast.filter((voice) => voice.voiceId).map((voice) => voice.voiceId);
    expect(new Set(used).size).toBe(used.length);
  });

  test("automatic picks prefer German voices that fit and are stable", () => {
    const hint = { gender: "female" as const, age: "old" as const, seed: "oma" };
    const first = pickVoice(hint, ACCOUNT, new Set());
    expect(first?.labels?.language).toBe("de");
    expect(first?.labels?.age).toBe("old");
    expect(pickVoice(hint, ACCOUNT, new Set())?.voiceId).toBe(first!.voiceId);
    expect(pickVoice(hint, ACCOUNT, new Set([first!.voiceId]))?.voiceId).not.toBe(first!.voiceId);
  });
});

describe("timeline", () => {
  const part = (kind: ScriptPart["kind"], lines: number, chapterIndex?: number): ScriptPart => ({
    kind,
    ...(chapterIndex !== undefined ? { chapterIndex } : {}),
    title: kind,
    lines: Array.from({ length: lines }, (_, index) => ({ speaker: "ERZAEHLER", text: `[warm] Zeile ${index} RUMMS`, ...(index === 1 ? { sounds: [{ sound: "thud", at: "RUMMS", seconds: 1 }] } : {}) })),
    scenes: kind === "chapter" ? [{ startLine: 0, place: "Flur", ambience: "quiet hallway", music: "mischief" }] : [],
  });
  const rendered = (p: ScriptPart, seconds: number): RenderedPart => ({
    part: p,
    segments: [{ path: `${p.kind}.mp3`, seconds }],
    lineSpans: p.lines.map((_, index) => ({ start: (index * seconds) / p.lines.length, end: ((index + 1) * seconds) / p.lines.length })),
    words: p.lines.flatMap((_, index) => [{ word: "RUMMS", start: ((index + 0.5) * seconds) / p.lines.length, end: ((index + 0.7) * seconds) / p.lines.length }]),
    seconds,
  });
  const score = new Map<string, ScoreTrack>([
    ["theme", { mood: "theme", path: "theme.mp3", seconds: 22 }],
    ["bridge", { mood: "bridge", path: "bridge.mp3", seconds: 7 }],
    ["mischief", { mood: "mischief", path: "mischief.mp3", seconds: 60 }],
  ]) as Map<never, ScoreTrack>;

  test("theme before the title, bridges between chapters, theme under the teaser", () => {
    const parts = [rendered(part("opening", 1), 4), rendered(part("chapter", 4, 0), 100), rendered(part("chapter", 4, 1), 100), rendered(part("closing", 1), 6)];
    const timeline = buildTimeline(parts, score);
    expect(timeline.partStarts[0]).toBe(GAPS.leadInWithTheme);
    expect(timeline.chapterStarts[0]).toBeCloseTo(GAPS.leadInWithTheme + 4 + GAPS.afterOpening, 5);
    expect(timeline.chapterStarts[1]).toBeCloseTo(timeline.chapterStarts[0] + 100 + GAPS.bridge, 5);
    const music = timeline.cues.filter((cue) => cue.type === "music");
    expect(music.filter((cue) => cue.assetPath === "theme.mp3").length).toBe(2);
    expect(music.filter((cue) => cue.assetPath === "bridge.mp3").length).toBe(1);
    expect(music.filter((cue) => cue.assetPath === "mischief.mp3").length).toBe(2);
    expect(timeline.seconds).toBeCloseTo(timeline.partStarts[3] + 6 + GAPS.tailWithTheme, 5);
    const pieces = timeline.voice.reduce((sum, piece) => sum + ("silence" in piece ? piece.silence : parts.find((entry) => entry.segments[0].path === piece.path)!.seconds), 0);
    expect(pieces).toBeCloseTo(timeline.seconds, 5);
  });

  test("a sound lands on its word", () => {
    const chapter = rendered(part("chapter", 4, 0), 100);
    const timeline = buildTimeline([chapter], score);
    const sfx = timeline.cues.filter((cue) => cue.type === "sfx");
    expect(sfx.length).toBe(1);
    expect(sfx[0].start).toBeCloseTo(timeline.chapterStarts[0] + 37.5 - 0.08, 5);
    expect(anchorTime(chapter.words, { start: 0, end: 25 }, "nichtda")).toBe(0);
  });
});

describe("score", () => {
  test("prompts are instrumental and the cache key follows the style", () => {
    const { prompt, seconds } = scorePrompt("pizzicato strings", "theme");
    expect(prompt).toMatch(/no vocals/);
    expect(seconds).toBeGreaterThan(10);
    expect(scoreKey("bruno", "a", "theme")).not.toBe(scoreKey("bruno", "b", "theme"));
  });

  test("the sound-generation stand-in stays under its 450 characters, only a real refusal switches to it", () => {
    for (const { bible } of SEED_SERIES) {
      for (const mood of ["theme", "bridge", "mischief", "adventure", "mystery", "heart", "spooky", "finale"] as const) {
        const prompt = soundFallbackPrompt(bible.audio!.scoreStyleEn, mood);
        expect(prompt.length).toBeLessThanOrEqual(450);
        expect(prompt).toMatch(/No vocals\.$/);
      }
    }
    expect(musicRefused({ status: 429 })).toBe(false);
    expect(musicRefused({ status: 402 })).toBe(true);
    expect(musicRefused(new Error("network"))).toBe(false);
  });
});

describe("listening check", () => {
  const lines = [
    { speaker: "ERZAEHLER", text: "[warm, playful] Bruno plusterte die Kiemen auf." },
    { speaker: "BRUNO", text: "[grumpy] Ich bin ein Fisch. Ich mache gar nichts. Ich bin nur der Fisch, bei dem es passiert." },
    { speaker: "FRAU-GRIMMBACH", text: "[strict] Eintrag sechsundvierzig: Pony bei Brandts im dritten Stock. Bellt!" },
    { speaker: "BRUNO", text: "[gruff] Blubb." },
  ];

  test("numbers in a transcript match the written-out words", () => {
    expect(germanNumber(46)).toBe("sechsundvierzig");
    expect(germanNumber(21)).toBe("einundzwanzig");
    expect(germanNumber(300)).toBe("dreihundert");
    expect(listenWords("Eintrag 46.")).toEqual(["eintrag", "sechsundvierzig"]);
  });

  test("a clean take passes, even when a one-word line is misheard", () => {
    const heard = "Bruno plusterte die Kiemen auf. Ich bin ein Fisch. Ich mache gar nichts. Ich bin nur der Fisch, bei dem es passiert. Eintrag 46: Pony bei Brandts im dritten Stock. Bellt! Blub.";
    expect(checkTake(lines, heard).passed).toBe(true);
  });

  test("the measured failures of 2026-10-21 are caught: a dropped line and an invented sentence", () => {
    const dropped = checkTake(lines, "Es wurde Fisch, bei dem es passiert. Eintrag 46: Pony bei Brandts im dritten Stock. Bellt! Blubb.");
    expect(dropped.passed).toBe(false);
    expect(dropped.missingLines).toContain(0);
    const invented = checkTake(lines, "Bruno plusterte die Kiemen auf. Ich bin ein Fisch. Ich mache gar nichts. Ich bin nur der Fisch, bei dem es passiert. Eintrag 46. Der ganze Geist war sehr stark. Er hatte einen Schoß. Er ließ den Heft in den Stock. Welt. Blubb.");
    expect(invented.passed).toBe(false);
    expect(invented.inventedRun).toContain("geist");
  });

  test("takes stay under the limit and prefer to cut where a scene starts", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({ speaker: "ERZAEHLER", text: `[warm] ${"Wort ".repeat(20)}${index}` }));
    const takes = planTakes(many, [0, 12, 25], 1600);
    expect(takes[0].from).toBe(0);
    expect(takes[takes.length - 1].to).toBe(30);
    for (let index = 1; index < takes.length; index += 1) expect(takes[index].from).toBe(takes[index - 1].to);
    for (const take of takes) expect(many.slice(take.from, take.to).reduce((sum, line) => sum + line.text.length + 1, 0)).toBeLessThanOrEqual(1600);
    expect(takes.map((take) => take.from)).toContain(12);
  });
});

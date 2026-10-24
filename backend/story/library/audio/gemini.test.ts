import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SEED_SERIES } from "../seed";
import type { AudioScript, ScriptPart } from "../types";
import { NARRATOR_ID, resolveSeriesCast, type AccountVoice } from "./casting";
import { assignEngineVoices, geminiFigures, recastScript, seriesCastMembers, seriesHints } from "./cast-members";
import { audioCosts, engineInfo, estimateVoices, geminiVoiceCost, normalizeEngine, proseVolume, scriptVolume } from "./engines";
import { checkClip, expectedSeconds, gapBetween, LINE_GAPS, renderWithGemini } from "./gemini-render";
import { GEMINI_NARRATOR, GEMINI_VOICES, describeFigure, figureHint, geminiLine, pickGeminiVoice, resolveGeminiCast } from "./gemini-voices";
import { SpeechError, openRouterSpeech, type SpeechPort } from "./openrouter-speech";
import { analyzeSpeech, applyGain, cut, safeGainDb, samplesFromPcm, wavBuffer } from "./pcm";
import { NARRATOR_KEY } from "./screenplay";
import { estimateWordTimes } from "./timeline";

const ACCOUNT: AccountVoice[] = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "scripts", "game-voices", "voices-account.json"), "utf8")).map(
  (voice: { voice_id: string; name: string; labels?: Record<string, string>; description?: string }) => ({ voiceId: voice.voice_id, name: voice.name, labels: voice.labels, description: voice.description }),
);
const series = (id: string) => SEED_SERIES.find((entry) => entry.series.id === id)!;

/** 16-bit PCM: `lead` seconds of silence, `tone` seconds of a 220 Hz tone at `amplitude`, `tail` seconds of silence. */
function pcm(lead: number, tone: number, tail: number, amplitude = 0.3, rate = 24_000): Buffer {
  const samples = new Int16Array(Math.round((lead + tone + tail) * rate));
  const from = Math.round(lead * rate);
  for (let index = 0; index < Math.round(tone * rate); index += 1) samples[from + index] = Math.round(Math.sin((2 * Math.PI * 220 * index) / rate) * amplitude * 32767);
  return Buffer.from(samples.buffer);
}

describe("engines", () => {
  test("engine names and families", () => {
    expect(normalizeEngine("Gemini-Lite")).toBe("gemini-lite");
    expect(normalizeEngine("gpt")).toBeUndefined();
    expect(engineInfo(undefined).id).toBe("elevenlabs");
    expect(engineInfo("gemini-flash").family).toBe("gemini");
  });

  test("Gemini bills 25 audio tokens per second (measured: 7.6 s ≈ $0.00116)", () => {
    expect(geminiVoiceCost("gemini-lite", 7.6, 32)).toBeCloseTo(0.001156, 5);
    expect(geminiVoiceCost("gemini-flash", 10, 0)).toBeCloseTo(0.00225, 6);
  });

  test("estimates: an episode is far cheaper on Gemini than on ElevenLabs", () => {
    const volume = { billedChars: 12931, spokenChars: 10222, lines: 167 };
    const eleven = estimateVoices("elevenlabs", volume).usd;
    const lite = estimateVoices("gemini-lite", volume);
    expect(eleven).toBeCloseTo(1.034, 2);
    expect(lite.usd).toBeLessThan(eleven / 5);
    expect(lite.seconds).toBeGreaterThan(600);
    expect(estimateVoices("gemini-flash", volume).usd).toBeGreaterThan(lite.usd);
    expect(proseVolume(11267).billedChars).toBeGreaterThan(12000);
  });

  test("cost breakdown adds up", () => {
    const costs = audioCosts({ scriptUSD: 0.1, voicesUSD: 0.12, soundsUSD: 0.5, musicUSD: 0 });
    expect(costs.totalUSD).toBeCloseTo(0.72, 4);
  });
});

describe("Gemini voices", () => {
  test("the catalog has 30 voices (14 female, 16 male), the narrator among them", () => {
    expect(GEMINI_VOICES.length).toBe(30);
    expect(GEMINI_VOICES.filter((voice) => voice.gender === "female").length).toBe(14);
    expect(GEMINI_VOICES.some((voice) => voice.name === GEMINI_NARRATOR)).toBe(true);
  });

  test("figures are read from the visual profile, the ElevenLabs labels and the name", () => {
    const bruno = series("bruno-der-flunkerfisch").bible.characters;
    const hint = (id: string) => {
      const character = bruno.find((entry) => entry.id === id)!;
      return figureHint({ name: character.name, personality: character.personality, visual: character.visualProfileEn, ageYears: character.ageYears });
    };
    expect(hint("ella")).toMatchObject({ gender: "female", age: "child", ageYears: 8, creature: false });
    expect(hint("mats")).toMatchObject({ gender: "male", age: "child", ageYears: 6 });
    expect(hint("bruno").creature).toBe(true);
    // A fish-shaped hat does not make a fish.
    expect(hint("fischhut-mann")).toMatchObject({ gender: "male", age: "old", creature: false });
    expect(hint("frau-grimmbach")).toMatchObject({ gender: "female", age: "old" });
    // Jona is a boy: the hand-picked ElevenLabs voice says so, the name does not.
    const jona = series("die-monster-muellabfuhr").bible.characters.find((entry) => entry.id === "jona")!;
    expect(figureHint({ name: "Jona", labels: { gender: "male", age: "young" }, ageYears: jona.ageYears }).gender).toBe("male");
  });

  test("picks follow gender, age and persona and never repeat a voice", () => {
    const used = new Set<string>([GEMINI_NARRATOR]);
    const girl = pickGeminiVoice({ gender: "female", age: "child", persona: "calm, precise", seed: "ella" }, used);
    used.add(girl.name);
    const boy = pickGeminiVoice({ gender: "male", age: "child", persona: "excited, fast, loud", seed: "mats" }, used);
    used.add(boy.name);
    const grandma = pickGeminiVoice({ gender: "female", age: "old", persona: "strict, curt", seed: "grimmbach" }, used);
    expect(girl.gender).toBe("female");
    expect(girl.ages).toContain("child");
    expect(boy.name).toBe("Fenrir");
    expect(grandma.ages).toContain("old");
    expect(new Set([girl.name, boy.name, grandma.name, GEMINI_NARRATOR]).size).toBe(4);
    // Deterministic for the same seed.
    expect(pickGeminiVoice({ gender: "male", persona: "relaxed", seed: "papa" }, new Set()).name).toBe(pickGeminiVoice({ gender: "male", persona: "relaxed", seed: "papa" }, new Set()).name);
  });

  test("series cast: narrator Puck, unique voices, silent cat, admin choice and stored picks win", () => {
    const { bible } = series("bruno-der-flunkerfisch");
    const { cast } = resolveSeriesCast({ bible, characters: bible.characters, overrides: [], voices: ACCOUNT });
    const figures = geminiFigures(bible.characters, cast, ACCOUNT);
    const first = resolveGeminiCast({ figures, overrides: [], narratorId: NARRATOR_ID });
    const narrator = first.cast.find((entry) => entry.speakerId === NARRATOR_ID)!;
    expect(narrator.voice).toBe(GEMINI_NARRATOR);
    expect(first.cast.find((entry) => entry.speakerId === "kater-kaiser")!.silent).toBe(true);
    const voiced = first.cast.filter((entry) => !entry.silent).map((entry) => entry.voice);
    expect(new Set(voiced).size).toBe(voiced.length);
    expect(first.autoPicks.length).toBe(voiced.length - 1);
    const voiceOf = (id: string) => first.cast.find((entry) => entry.speakerId === id)!.voice!;
    expect(GEMINI_VOICES.find((voice) => voice.name === voiceOf("frau-grimmbach"))!.gender).toBe("female");
    expect(GEMINI_VOICES.find((voice) => voice.name === voiceOf("mats"))!.gender).toBe("male");

    const again = resolveGeminiCast({
      figures,
      overrides: [...first.autoPicks.map((pick) => ({ speakerId: pick.speakerId, voiceId: pick.voiceId, source: pick.source })), { speakerId: "ella", voiceId: "Zephyr", source: "admin" as const }, { speakerId: "kater-kaiser", voiceId: "Algieba", source: "admin" as const }],
      narratorId: NARRATOR_ID,
    });
    expect(again.autoPicks).toEqual([]);
    expect(again.cast.find((entry) => entry.speakerId === "ella")!).toMatchObject({ voice: "Zephyr", source: "admin" });
    expect(again.cast.find((entry) => entry.speakerId === "kater-kaiser")!).toMatchObject({ voice: "Algieba", silent: false });
    expect(again.cast.find((entry) => entry.speakerId === "mats")!.voice).toBe(voiceOf("mats"));
  });

  test("a line: the tone tag becomes direction, reactions stay in the text", () => {
    const line = geminiLine({ text: "[grumpy, offended] Flocken. [sighs] Extra-Flocken!" }, { name: "Bruno", persona: "grumpy, gruff, vain", narrator: false, hint: { gender: "male", creature: true } });
    expect(line.text).toBe("Flocken. [sighs] Extra-Flocken!");
    expect(line.instructions).toContain("You are Bruno, a talking creature with a male voice");
    expect(line.instructions).toContain("Voice: grumpy, gruff, vain.");
    expect(line.instructions).toContain("Tone of this line: grumpy, offended.");
    const narration = geminiLine({ text: "[warm, playful] Es war einmal." }, { name: "Erzähler", persona: "warm, playful storyteller", narrator: true, hint: {} });
    expect(narration.instructions).toContain("narrator of a German children's radio play");
    expect(narration.instructions).not.toContain("Tone of this line: warm, playful storyteller");
    expect(describeFigure({ gender: "male", age: "child", ageYears: 6 })).toBe("a six-year-old boy");
    expect(describeFigure({ gender: "female", age: "old" })).toBe("an old woman");
  });
});

describe("cast members across engines", () => {
  const { bible } = series("bruno-der-flunkerfisch");
  const { cast } = resolveSeriesCast({ bible, characters: bible.characters, overrides: [], voices: ACCOUNT });
  const gemini = resolveGeminiCast({ figures: geminiFigures(bible.characters, cast, ACCOUNT), overrides: [], narratorId: NARRATOR_ID }).cast;

  test("Gemini members carry both voices and hints", () => {
    const members = seriesCastMembers(bible.characters, cast, { family: "gemini", geminiCast: gemini, voices: ACCOUNT });
    const narrator = members.find((member) => member.key === NARRATOR_KEY)!;
    expect(narrator.geminiVoice).toBe(GEMINI_NARRATOR);
    expect(narrator.voiceId).toBe("8tJgFGd1nr7H5KLTvjjt");
    const mats = members.find((member) => member.key === "MATS")!;
    expect(mats).toMatchObject({ gender: "male", age: "child", silent: false });
    expect(mats.geminiVoice).toBeTruthy();
    expect(members.find((member) => member.key === "KATER-KAISER")!.silent).toBe(true);
  });

  test("an ElevenLabs screenplay is recast for Gemini; a guest without a Gemini voice gets one", () => {
    const script: AudioScript = {
      version: 1,
      speakers: [
        { key: NARRATOR_KEY, name: "Erzähler", characterId: NARRATOR_ID, voiceId: "8tJgFGd1nr7H5KLTvjjt", persona: "warm, playful storyteller", source: "series" },
        { key: "MATS", name: "Mats Brandt", characterId: "mats", voiceId: "TmOgotzOZDmhlttFp4Lu", persona: "excited, fast, loud", source: "series" },
        { key: "VERKAEUFER", name: "Verkäufer", voiceId: "re2r5d74PqDzicySNW0I", persona: "gruff, bored", source: "episode", gender: "male", age: "adult" },
      ],
      parts: [],
      notes: [],
    };
    const members = seriesCastMembers(bible.characters, cast, { family: "gemini", geminiCast: gemini, voices: ACCOUNT });
    const recast = assignEngineVoices(recastScript(script, members), "gemini", ACCOUNT, seriesHints(bible.characters, cast, ACCOUNT));
    const voices = recast.speakers.map((speaker) => speaker.geminiVoice);
    expect(voices.every(Boolean)).toBe(true);
    expect(new Set(voices).size).toBe(3);
    expect(recast.speakers[0].geminiVoice).toBe(GEMINI_NARRATOR);
    expect(recast.speakers[2].voiceId).toBe("re2r5d74PqDzicySNW0I");
    // A Gemini-only speaker gets an ElevenLabs voice when the script goes back to ElevenLabs.
    const back = assignEngineVoices({ ...recast, speakers: [...recast.speakers, { key: "FEE", name: "Fee", voiceId: "", geminiVoice: "Aoede", persona: "light", source: "episode", gender: "female" }] }, "elevenlabs", ACCOUNT, new Map());
    expect(back.speakers[3].voiceId).toBeTruthy();
  });
});

describe("PCM editing", () => {
  test("finds the speech inside Gemini's padding and keeps a pre- and post-roll", () => {
    const samples = samplesFromPcm(pcm(0.5, 1.2, 0.8));
    const activity = analyzeSpeech(samples)!;
    expect(activity.start / 24_000).toBeCloseTo(0.44, 1);
    expect(activity.end / 24_000).toBeCloseTo(1.84, 1);
    expect(activity.levelDb).toBeCloseTo(-13.5, 0);
    expect(analyzeSpeech(new Int16Array(24_000))).toBeNull();
  });

  test("cuts fade in and out, gain never clips", () => {
    const samples = samplesFromPcm(pcm(0, 0.5, 0, 0.9));
    const piece = cut(samples, 100, 5000);
    expect(piece.length).toBe(4900);
    expect(Math.abs(piece[0])).toBe(0);
    expect(safeGainDb(12, 0.9)).toBeLessThan(1);
    const louder = applyGain(samples, safeGainDb(12, 0.9));
    expect(Math.max(...louder.map(Math.abs))).toBeLessThanOrEqual(32767 * 0.98);
  });

  test("odd-length buffers and WAV header", () => {
    expect(samplesFromPcm(Buffer.from([1, 0, 2, 0, 3])).length).toBe(2);
    const wav = wavBuffer(new Int16Array(240));
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.length).toBe(44 + 480);
  });
});

describe("editing lines together", () => {
  const line = (speaker: string, text: string, sounds?: Array<{ sound: string; at?: string }>) => ({ speaker, text, ...(sounds ? { sounds } : {}) });

  test("radio-play gaps", () => {
    expect(gapBetween(line("ERZAEHLER", "[warm] Es klingelte."), line("ERZAEHLER", "[warm] Lange."), false)).toBe(LINE_GAPS.sameSpeaker);
    expect(gapBetween(line("ELLA", "[calm] Warum machst du das?"), line("MATS", "[excited] Weil ich es kann und weil es lustig ist!"), false)).toBe(LINE_GAPS.afterQuestion);
    expect(gapBetween(line("ELLA", "[alarmed] Mats, NICHT…"), line("MATS", "[nervous] Das ist ganz anders, ehrlich!"), false)).toBe(LINE_GAPS.cutIn);
    expect(gapBetween(line("MATS", "[excited] Den will ich haben, sofort!"), line("BRUNO", "[gruff] Blubb."), false)).toBe(LINE_GAPS.quickReply);
    expect(gapBetween(line("MATS", "[excited] Den will ich."), line("ERZAEHLER", "[warm] Da!"), true)).toBe(LINE_GAPS.scene);
    expect(gapBetween(line("MATS", "[excited] Den will ich haben, sofort!"), line("ERZAEHLER", "[warm] Die Tür ging auf und alle schauten.", [{ sound: "door" }]), false)).toBeCloseTo(LINE_GAPS.reply + LINE_GAPS.soundFirst, 5);
    expect(gapBetween(line("MATS", "x"), undefined, false)).toBe(0);
  });

  test("the length check catches silent, runaway and truncated clips, and spares short reactions", () => {
    const text = "[warm] Das Treppenhaus war still, nur das Aquarium blubberte leise vor sich hin.";
    const expected = expectedSeconds(text);
    expect(checkClip(text, expected).ok).toBe(true);
    expect(checkClip(text, null).ok).toBe(false);
    expect(checkClip(text, expected * 3).ok).toBe(false);
    expect(checkClip(text, expected * 0.3).ok).toBe(false);
    expect(checkClip("[gruff] Blubb.", 1.9).ok).toBe(true);
    expect(checkClip("[gruff] Blubb.", 6).ok).toBe(false);
    expect(expectedSeconds("[sighs] Na gut. [laughs]")).toBeGreaterThan(expectedSeconds("Na gut."));
  });

  test("estimated word times stay inside the line and in order", () => {
    const words = estimateWordTimes("[amused] Und dann machte es RUMMS.", 2, 4);
    expect(words.map((word) => word.word)).toEqual(["Und", "dann", "machte", "es", "RUMMS"]);
    expect(words[0].start).toBe(2);
    expect(words[4].end).toBeLessThanOrEqual(4);
    expect(words.every((word, index) => index === 0 || word.start >= words[index - 1].end)).toBe(true);
  });
});

describe("recording with Gemini (fake speech)", () => {
  const part = (lines: Array<{ speaker: string; text: string }>, scenes: ScriptPart["scenes"] = []): ScriptPart => ({ kind: "chapter", chapterIndex: 0, title: "Kapitel 1", lines, scenes });
  const script = (parts: ScriptPart[]): AudioScript => ({
    version: 1,
    speakers: [
      { key: NARRATOR_KEY, name: "Erzähler", voiceId: "", geminiVoice: "Puck", persona: "warm, playful storyteller", source: "series" },
      { key: "ELLA", name: "Ella", voiceId: "", geminiVoice: "Erinome", persona: "calm, precise", source: "series" },
    ],
    parts,
    notes: [],
  });
  const cast = new Map([
    [NARRATOR_KEY, { voice: "Puck", name: "Erzähler", persona: "warm, playful storyteller", narrator: true, hint: {} }],
    ["ELLA", { voice: "Erinome", name: "Ella", persona: "calm, precise", narrator: false, hint: { gender: "female" as const, age: "child" as const } }],
  ]);
  const tmpDir = mkdtempSync(join(tmpdir(), "gemini-render-test-"));

  test("lines are trimmed, levelled per speaker and spaced; spans are exact", async () => {
    const requests: Array<{ voice: string; text: string; instructions?: string }> = [];
    const speech: SpeechPort = async (request) => {
      requests.push(request);
      const seconds = expectedSeconds(request.text);
      // Ella answers quietly; the editor brings her to the narrator's level.
      return { pcm: pcm(0.3, seconds, 0.6, request.voice === "Erinome" ? 0.08 : 0.3), sampleRate: 24_000 };
    };
    const { parts, stats } = await renderWithGemini({
      script: script([part([
        { speaker: NARRATOR_KEY, text: "[warm, playful] Ella schob ihre Brille hoch und sah Mats an." },
        { speaker: "ELLA", text: "[calm] Das ist wissenschaftlich unmöglich, Mats." },
        { speaker: NARRATOR_KEY, text: "[amused] Mats grinste nur." },
      ])]),
      engine: "gemini-lite",
      speech,
      cast,
      tmpDir,
    });
    expect(requests.map((request) => request.voice)).toEqual(["Puck", "Erinome", "Puck"]);
    expect(requests[1].text).toBe("Das ist wissenschaftlich unmöglich, Mats.");
    expect(requests[1].instructions).toContain("a young girl");
    const [rendered] = parts;
    expect(rendered.lineSpans.length).toBe(3);
    const spans = rendered.lineSpans.map((span) => span!);
    // Padding gone: each line is about as long as its speech plus pre/post roll.
    expect(spans[0].end - spans[0].start).toBeCloseTo(expectedSeconds("Ella schob ihre Brille hoch und sah Mats an.") + 0.2, 1);
    expect(spans[1].start - spans[0].end).toBeCloseTo(LINE_GAPS.reply, 2);
    expect(rendered.seconds).toBeCloseTo(spans[2].end, 3);
    expect(rendered.words.find((word) => word.word === "grinste")!.start).toBeGreaterThanOrEqual(spans[2].start);
    const wav = samplesFromPcm(readFileSync((rendered.segments[0] as { path: string }).path).subarray(44));
    const level = (span: { start: number; end: number }) => analyzeSpeech(wav.subarray(Math.round(span.start * 24_000), Math.round(span.end * 24_000)))!.levelDb;
    expect(Math.abs(level(spans[1]) - level(spans[0]))).toBeLessThan(1);
    expect(stats.requests).toBe(3);
    expect(stats.retakes).toBe(0);
    expect(stats.costUSD).toBeCloseTo(geminiVoiceCost("gemini-lite", stats.billedSeconds, stats.inputTokens), 8);
  });

  test("a silent or runaway clip is recorded again; the best take stays and is flagged when all fail", async () => {
    let calls = 0;
    const flaky: SpeechPort = async (request) => {
      calls += 1;
      return calls === 1 ? { pcm: pcm(0.5, 0, 0.5), sampleRate: 24_000 } : { pcm: pcm(0.2, expectedSeconds(request.text), 0.3), sampleRate: 24_000 };
    };
    const one = await renderWithGemini({ script: script([part([{ speaker: "ELLA", text: "[calm] Okay. Plan B, und zwar sofort." }])]), engine: "gemini-lite", speech: flaky, cast, tmpDir });
    expect(one.stats.retakes).toBe(1);
    expect(one.stats.flagged).toEqual([]);

    const runaway: SpeechPort = async () => ({ pcm: pcm(0.1, 20, 0.1), sampleRate: 24_000 });
    const two = await renderWithGemini({ script: script([part([{ speaker: "ELLA", text: "[calm] Okay. Plan B, und zwar sofort." }])]), engine: "gemini-lite", speech: runaway, cast, tmpDir });
    expect(two.stats.requests).toBe(3);
    expect(two.stats.flagged.length).toBe(1);
    expect(two.stats.flagged[0].reason).toContain("zu lang");
  });

  test("a refused line is tried once more without its tags", async () => {
    const seen: string[] = [];
    const picky: SpeechPort = async (request) => {
      seen.push(request.text);
      if (request.text.includes("[")) throw new SpeechError("bad tag", 400);
      return { pcm: pcm(0.1, expectedSeconds(request.text), 0.1), sampleRate: 24_000 };
    };
    await renderWithGemini({ script: script([part([{ speaker: "ELLA", text: "[calm] Na gut. [sighs] Dann eben nicht." }])]), engine: "gemini-lite", speech: picky, cast, tmpDir });
    expect(seen).toEqual(["Na gut. [sighs] Dann eben nicht.", "Na gut. Dann eben nicht."]);
  });

  test("scene gaps between lines", async () => {
    const speech: SpeechPort = async (request) => ({ pcm: pcm(0.1, expectedSeconds(request.text), 0.1), sampleRate: 24_000 });
    const { parts } = await renderWithGemini({
      script: script([part([{ speaker: NARRATOR_KEY, text: "[warm] Am Abend war es still im Haus." }, { speaker: NARRATOR_KEY, text: "[warm] Am Morgen klingelte es." }], [{ startLine: 0, place: "Wohnung" }, { startLine: 1, place: "Treppenhaus" }])]),
      engine: "gemini-lite",
      speech,
      cast,
      tmpDir,
    });
    const spans = parts[0].lineSpans.map((span) => span!);
    expect(spans[1].start - spans[0].end).toBeCloseTo(LINE_GAPS.scene, 2);
  });
});

describe("OpenRouter speech client", () => {
  const ok = () => new Response(new Uint8Array(4800), { status: 200, headers: { "content-type": "audio/pcm;rate=24000;channels=1", "x-generation-id": "gen-1" } });

  test("busy is retried, the answer carries rate and generation id", async () => {
    let calls = 0;
    const speech = openRouterSpeech({ apiKey: "k", backoffMs: 1, fetchImpl: (async () => (++calls === 1 ? new Response("busy", { status: 429 }) : ok())) as unknown as typeof fetch });
    const result = await speech({ model: "google/gemini-3.8-flash-lite-tts", voice: "Puck", text: "Hallo" });
    expect(calls).toBe(2);
    expect(result.sampleRate).toBe(24_000);
    expect(result.generationId).toBe("gen-1");
  });

  test("a refused request is not retried", async () => {
    let calls = 0;
    const speech = openRouterSpeech({ apiKey: "k", backoffMs: 1, fetchImpl: (async () => (++calls, new Response("{\"error\":\"bad\"}", { status: 400 }))) as unknown as typeof fetch });
    await expect(speech({ model: "m", voice: "Puck", text: "Hallo" })).rejects.toMatchObject({ status: 400 });
    expect(calls).toBe(1);
  });

  test("the request is OpenAI-compatible with PCM and instructions", async () => {
    let body: Record<string, unknown> = {};
    const speech = openRouterSpeech({ apiKey: "k", fetchImpl: (async (_url: string, init: RequestInit) => ((body = JSON.parse(String(init.body))), ok())) as unknown as typeof fetch });
    await speech({ model: "google/gemini-3.8-flash-tts", voice: "Leda", text: "Hallo", instructions: "warm" });
    expect(body).toEqual({ model: "google/gemini-3.8-flash-tts", input: "Hallo", voice: "Leda", response_format: "pcm", instructions: "warm" });
  });
});

describe("screenplay volume", () => {
  test("billed characters include tags, spoken ones do not", () => {
    const volume = scriptVolume({ parts: [{ kind: "chapter", title: "x", scenes: [], lines: [{ speaker: "A", text: "[warm] Hallo du." }] }] });
    expect(volume).toEqual({ billedChars: 16, spokenChars: 9, lines: 1 });
  });
});

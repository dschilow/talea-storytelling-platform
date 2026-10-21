/**
 * Records one episode as an audio drama: cast → screenplay → voices → score →
 * timeline → studio mix. No database here (production.ts stores the result),
 * so a script can run the whole chain against the live services.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { mixStudioMaster, resolveTaleaBumper } from "../../../doku/audio-render";
import { synthesizeDialogueWithTimestamps } from "../../../tts/elevenlabs-dialogue";
import { transcribeTake } from "./transcribe";
import type { CostLedger, StorybookLlm } from "../../storybook/llm";
import { LIBRARY_MODELS } from "../engine";
import type { AudioScript, EpisodeAudio, EpisodeContent, ScoreMood, ScriptPart, ScriptSpeaker, SeriesBible, SeriesCharacter, SeriesInfo } from "../types";
import { NARRATOR_ID, pickVoice, type AccountVoice, type ResolvedVoice } from "./casting";
import { prepareScore, probeSeconds, type ScorePorts } from "./score";
import {
  NARRATOR_KEY,
  adaptChapter,
  assembleScript,
  billedCharacters,
  castEpisodeSpeakers,
  dialogueScript,
  speakerKey,
  type CastMember,
} from "./screenplay";
import { buildTimeline, estimateLineSpans, type RenderedPart } from "./timeline";
import { checkTake, planTakes, type TakeCheck } from "./qa";

const ROLE_LABELS: Record<string, string> = { protagonist: "Hauptfigur", sidekick: "Sidekick", antagonist: "Gegenspieler", recurring: "Nebenfigur der Reihe" };
/** The account takes two requests at once (Creator plan). */
const VOICE_CONCURRENCY = 2;
/** ElevenLabs: dialogue is reliable up to ~2,000 characters per request; longer chapters lost lines. */
const TAKE_MAX_CHARS = 1600;
const TAKE_ATTEMPTS = 3;
/** Breath between two takes of the same chapter. */
const TAKE_GAP_SECONDS = 0.35;
const LISTENING_CHECK = process.env.TALEA_AUDIO_QA !== "off";
/** Spot effects and ambience beds one drama may generate (a 13-minute episode uses 30–50). */
const MAX_SOUND_ASSETS = 70;

export interface DramaInput {
  series: SeriesInfo;
  bible: SeriesBible;
  season: number;
  episode: number;
  content: EpisodeContent;
  /** Active characters of the series. */
  characters: SeriesCharacter[];
  /** Voices of the narrator and the series characters (resolveSeriesCast). */
  seriesCast: ResolvedVoice[];
  /** The ElevenLabs account's voices. */
  voices: AccountVoice[];
  llm: StorybookLlm;
  ledger: CostLedger;
  scorePorts: ScorePorts;
  /** Record again from this screenplay instead of writing a new one (voices of the series are re-resolved). */
  script?: AudioScript;
  report?: (step: string) => Promise<void>;
  log?: (message: string) => void;
}

export interface DramaResult {
  script: AudioScript;
  audio: Buffer;
  seconds: number;
  chapterStarts: number[];
  stats: NonNullable<EpisodeAudio["stats"]>;
}

interface RecordedTake {
  partIndex: number;
  from: number;
  to: number;
  files: Array<{ path: string; seconds: number }>;
  words: RenderedPart["words"];
  lineSpans: Array<{ start: number; end: number } | null>;
  seconds: number;
  attempts: number;
  check: TakeCheck | null;
}

function describe(character: SeriesCharacter): string {
  return [ROLE_LABELS[character.role] ?? "", character.ageYears ? `${character.ageYears} Jahre` : "", character.personality, character.speechStyle ? `Sprechweise: ${character.speechStyle}` : ""]
    .filter(Boolean)
    .join(". ")
    .replace(/\.\./g, ".");
}

/** Narrator and series characters as cast members of the screenplay. */
export function seriesCastMembers(characters: SeriesCharacter[], seriesCast: ResolvedVoice[]): CastMember[] {
  const narrator = seriesCast.find((voice) => voice.speakerId === NARRATOR_ID);
  const members: CastMember[] = [
    { key: NARRATOR_KEY, name: "Erzähler", characterId: NARRATOR_ID, description: "Erzählt die Geschichte.", persona: narrator?.persona || "warm, playful storyteller", silent: false, voiceId: narrator?.voiceId, voiceName: narrator?.voiceName, source: narrator?.source === "admin" ? "admin" : "series" },
  ];
  for (const character of characters) {
    const voice = seriesCast.find((entry) => entry.speakerId === character.id);
    if (!voice) continue;
    members.push({
      key: speakerKey(character.id),
      name: character.name,
      characterId: character.id,
      description: describe(character),
      persona: voice.persona,
      silent: voice.silent || !voice.voiceId,
      voiceId: voice.voiceId,
      voiceName: voice.voiceName,
      source: voice.source,
    });
  }
  return members;
}

const toSpeaker = (member: CastMember): ScriptSpeaker => ({
  key: member.key,
  name: member.name,
  ...(member.characterId ? { characterId: member.characterId } : {}),
  voiceId: member.voiceId!,
  ...(member.voiceName ? { voiceName: member.voiceName } : {}),
  persona: member.persona,
  source: member.source,
});

/** A stored screenplay with today's voices of the series (episode guests keep theirs). */
export function recastScript(script: AudioScript, seriesMembers: CastMember[]): AudioScript {
  const current = new Map(seriesMembers.filter((member) => !member.silent).map((member) => [member.key, member]));
  return {
    ...script,
    speakers: script.speakers.map((speaker) => {
      const member = current.get(speaker.key);
      return member?.voiceId ? { ...speaker, voiceId: member.voiceId, voiceName: member.voiceName, persona: member.persona, source: member.source } : speaker;
    }),
  };
}

/** Stages 1–2: the episode's own speakers get voices, every chapter becomes a screenplay. */
export async function writeAudioScript(input: DramaInput): Promise<AudioScript> {
  const say = input.log ?? ((message: string) => console.log(`[library-audio] ${message}`));
  const report = input.report ?? (async () => undefined);
  const seriesMembers = seriesCastMembers(input.characters, input.seriesCast);
  const voiceName = new Map(input.voices.map((voice) => [voice.voiceId, voice.name.trim()]));

  await report("cast");
  const used = new Set(seriesMembers.map((member) => member.voiceId).filter((id): id is string => Boolean(id)));
  const drafts = await castEpisodeSpeakers({
    series: input.series,
    bible: input.bible,
    content: input.content,
    seriesCast: seriesMembers,
    freeVoices: input.voices.filter((voice) => !used.has(voice.voiceId)),
    llm: input.llm,
    ledger: input.ledger,
    model: LIBRARY_MODELS.support,
  });
  const episodeMembers: CastMember[] = drafts.map((draft) => {
    const guest = input.content.guests.find((entry) => entry.id === draft.guestId);
    const description = guest?.role ? `Gast dieser Folge: ${guest.role}.` : "Nebenfigur dieser Folge.";
    if (!draft.speaks) return { key: draft.key, name: draft.name, characterId: draft.guestId, description, persona: draft.persona, silent: true, source: "episode" };
    let voiceId = draft.voiceId && voiceName.has(draft.voiceId) && !used.has(draft.voiceId) ? draft.voiceId : undefined;
    if (!voiceId) {
      const creature = /(monster|tier|hund|drache|geist|wesen|kobold)/i.test(`${draft.name} ${description}`);
      voiceId = pickVoice({ gender: draft.gender, age: draft.age, creature, seed: draft.key }, input.voices, used)?.voiceId;
    }
    if (voiceId) used.add(voiceId);
    return { key: draft.key, name: draft.name, characterId: draft.guestId, description, persona: draft.persona, silent: !voiceId, voiceId, voiceName: voiceId ? voiceName.get(voiceId) : undefined, source: "episode" };
  });
  const cast = [...seriesMembers, ...episodeMembers];
  say(`cast: ${cast.map((member) => `${member.key}${member.silent ? " (stumm)" : `=${member.voiceName ?? member.voiceId}`}`).join(", ")}`);

  await report("script");
  const chapters = await Promise.all(
    input.content.chapters.map((_, chapterIndex) =>
      adaptChapter({ series: input.series, bible: input.bible, content: input.content, chapterIndex, cast, llm: input.llm, ledger: input.ledger, model: LIBRARY_MODELS.writer }),
    ),
  );
  for (const chapter of chapters) {
    say(`chapter ${(chapter.part.chapterIndex ?? 0) + 1}: ${chapter.part.lines.length} lines, quotes ${Math.round(chapter.fidelity.quoteCoverage * 100)} %, words ${Math.round(chapter.fidelity.wordRatio * 100)} %`);
  }
  return assembleScript({
    series: input.series,
    season: input.season,
    episode: input.episode,
    content: input.content,
    speakers: cast.filter((member) => !member.silent && member.voiceId).map(toSpeaker),
    chapters,
    notes: input.seriesCast.filter((voice) => voice.replaced).map((voice) => `${voice.name}: Stimme ${voice.replaced} gibt es im ElevenLabs-Konto nicht mehr, neu besetzt.`),
  });
}

export async function renderAudioDrama(input: DramaInput): Promise<DramaResult> {
  const say = input.log ?? ((message: string) => console.log(`[library-audio] ${message}`));
  const report = input.report ?? (async () => undefined);
  const started = Date.now();
  const script = input.script ? recastScript(input.script, seriesCastMembers(input.characters, input.seriesCast)) : await writeAudioScript(input);

  const voiceMap = Object.fromEntries(script.speakers.map((speaker) => [speaker.key, speaker.voiceId]));
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "library-audio-"));
  try {
    /* 3: voices in takes of ≤ 1,600 characters, each one listened to and recorded again when a line is missing */
    await report("voices");
    const jobs = script.parts.flatMap((part, partIndex) =>
      planTakes(part.lines, part.scenes.map((scene) => scene.startLine), TAKE_MAX_CHARS).map((take) => ({ partIndex, ...take })),
    );
    const takes: RecordedTake[] = new Array(jobs.length);
    let nextTake = 0;
    await Promise.all(
      Array.from({ length: Math.min(VOICE_CONCURRENCY, jobs.length) }, async () => {
        while (nextTake < jobs.length) {
          const index = nextTake++;
          const job = jobs[index];
          takes[index] = await recordTake(script.parts[job.partIndex], job.partIndex, job.from, job.to, `${index + 1}`, voiceMap, tmpDir);
          const take = takes[index];
          say(`voices: take ${index + 1}/${jobs.length} (${script.parts[job.partIndex].title}, lines ${job.from + 1}-${job.to}) ${take.seconds.toFixed(1)} s${take.check ? `, heard ${Math.round(take.check.coverage * 100)} %${take.attempts > 1 ? ` after ${take.attempts} takes` : ""}${take.check.passed ? "" : " — CHECK"}` : ""}`);
        }
      }),
    );
    const rendered = script.parts.map((part, partIndex) => assemblePart(part, takes.filter((take) => take.partIndex === partIndex)));
    for (const take of takes) {
      if (take.check && !take.check.passed) {
        const part = script.parts[take.partIndex];
        const missing = take.check.missingLines.map((line) => `„${part.lines[take.from + line].text.replace(/\[[^\]]*\]\s*/g, "").slice(0, 60)}“`);
        script.notes.push(`${part.title}: nach ${take.attempts} Aufnahmen nicht ganz sauber (gehört ${Math.round(take.check.coverage * 100)} %)${missing.length ? `, fehlt evtl.: ${missing.join(", ")}` : ""}${take.check.inventedRun ? `, zusätzlich gehört: „${take.check.inventedRun}“` : ""}. Bitte anhören.`);
      }
    }
    const retakes = takes.reduce((sum, take) => sum + take.attempts - 1, 0);

    /* 4: the series score */
    await report("music");
    const sceneMoods = script.parts.flatMap((part) => part.scenes.map((scene) => scene.music)).filter((mood): mood is ScoreMood => Boolean(mood));
    const score = await prepareScore({
      seriesSlug: input.series.slug,
      styleEn: input.bible.audio?.scoreStyleEn || `playful orchestral music for a children's series, ${input.bible.world.tone}`,
      moods: ["theme", "bridge", ...sceneMoods],
      tmpDir,
      ports: input.scorePorts,
    });
    if (score.failed.length) script.notes.push(`Musik fehlt: ${score.failed.map((entry) => `${entry.mood} (${entry.error.slice(0, 120)})`).join(", ")}`);
    say(`music: ${[...score.tracks.keys()].join(", ")}${score.composed.length ? ` (new: ${score.composed.join(", ")})` : ""}${score.fallbacks.length ? ` — sound-generation fallback for ${score.fallbacks.join(", ")}` : ""}`);

    /* 5: timeline and studio mix */
    await report("mix");
    const timeline = buildTimeline(rendered, score.tracks);
    const sounds = timeline.cues.filter((cue) => cue.type === "sfx").length;
    const mix = await mixStudioMaster({
      tmpDir,
      voice: timeline.voice,
      timelineSec: timeline.seconds,
      cues: timeline.cues,
      introPath: null,
      outroPath: await resolveTaleaBumper("outro"),
      maxGeneratedAssets: MAX_SOUND_ASSETS,
      bitrate: "192k",
      logTag: `LibraryAudio ${input.series.slug} s${input.season}e${input.episode}`,
    });
    const seconds = (await measureSeconds(mix.audio, tmpDir)) || timeline.seconds;
    say(`mix: ${(seconds / 60).toFixed(1)} min, ${timeline.cues.length} cues (${sounds} sounds), ${mix.generatedAssets} generated sound assets`);
    return {
      script,
      audio: mix.audio,
      seconds,
      chapterStarts: timeline.chapterStarts.map((value) => Number(value.toFixed(2))),
      stats: {
        llmCostUSD: Number(input.ledger.totals().costUSD.toFixed(4)),
        voiceCharacters: billedCharacters(script),
        sounds,
        soundAssets: mix.generatedAssets,
        takes: takes.length,
        retakes,
        music: score.fallbacks.length ? `Soundgenerator (${score.fallbacks.join(", ")})` : score.composed.length ? `neu komponiert: ${score.composed.join(", ")}` : "aus dem Serien-Archiv",
        seconds: Math.round((Date.now() - started) / 1000),
      },
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function measureSeconds(audio: Buffer, tmpDir: string): Promise<number> {
  const file = path.join(tmpDir, "measure.mp3");
  await fs.writeFile(file, audio);
  return probeSeconds(file);
}

/**
 * One take: lines [from, to) of a part through ElevenLabs text-to-dialogue with
 * timestamps (German, one request), then listened to with speech-to-text. A take
 * with a missing line or an invented sentence is recorded again with another
 * seed; the best of up to three takes stays.
 */
async function recordTake(part: ScriptPart, partIndex: number, from: number, to: number, name: string, voiceMap: Record<string, string>, tmpDir: string): Promise<RecordedTake> {
  const lines = part.lines.slice(from, to);
  const script = dialogueScript({ ...part, lines });
  let best: RecordedTake | null = null;
  for (let attempt = 1; attempt <= TAKE_ATTEMPTS; attempt += 1) {
    let timed: Awaited<ReturnType<typeof synthesizeDialogueWithTimestamps>>;
    try {
      timed = await synthesizeDialogueWithTimestamps({
        script,
        speakerVoiceMap: voiceMap,
        languageCode: "de",
        maxCharsPerRequest: 1900,
        ...(attempt > 1 ? { seed: Math.floor(Math.random() * 4_000_000_000) } : {}),
      });
    } catch (error) {
      if (best || attempt === TAKE_ATTEMPTS) {
        if (best) break;
        throw error;
      }
      console.warn(`[library-audio] take ${name} failed, trying again: ${(error as Error).message}`);
      continue;
    }

    const files: RecordedTake["files"] = [];
    const words: RecordedTake["words"] = [];
    const lineSpans: RecordedTake["lineSpans"] = lines.map((): { start: number; end: number } | null => null);
    let offset = 0;
    for (const [segmentIndex, segment] of timed.segments.entries()) {
      const file = path.join(tmpDir, `take-${name}-${attempt}-${segmentIndex + 1}.mp3`);
      await fs.writeFile(file, segment.audio);
      const probed = await probeSeconds(file);
      const seconds = probed > 0 ? probed : segment.alignmentDurationSec;
      files.push({ path: file, seconds });
      for (const word of segment.words) words.push({ word: word.word, start: word.start + offset, end: word.end + offset });
      for (const span of segment.turnSpans) {
        const line = span.index - 1;
        if (line >= 0 && line < lineSpans.length) lineSpans[line] = { start: span.start + offset, end: span.end + offset };
      }
      offset += seconds;
    }
    if (!lineSpans.some(Boolean)) {
      estimateLineSpans({ ...part, lines }, offset).forEach((span, line) => (lineSpans[line] = span));
    }

    let check: TakeCheck | null = null;
    if (LISTENING_CHECK) {
      try {
        const heard = await transcribeTake(Buffer.concat(timed.segments.map((segment) => segment.audio)));
        check = checkTake(lines, heard);
      } catch (error) {
        console.warn(`[library-audio] take ${name}: listening check unavailable: ${(error as Error).message}`);
      }
    }
    const take: RecordedTake = { partIndex, from, to, files, words, lineSpans, seconds: offset, attempts: attempt, check };
    if (!best || (check && (!best.check || check.score > best.check.score))) best = { ...take };
    best.attempts = attempt;
    if (!check || check.passed) break;
    console.warn(`[library-audio] take ${name} attempt ${attempt}: heard ${Math.round(check.coverage * 100)} %, missing lines ${check.missingLines.join(",") || "-"}${check.inventedRun ? `, invented "${check.inventedRun}"` : ""} — recording again`);
  }
  return best!;
}

/** The takes of a part back to back, with a breath between them; times relative to the part. */
function assemblePart(part: ScriptPart, takes: RecordedTake[]): RenderedPart {
  const segments: RenderedPart["segments"] = [];
  const words: RenderedPart["words"] = [];
  const lineSpans: RenderedPart["lineSpans"] = part.lines.map((): { start: number; end: number } | null => null);
  let offset = 0;
  takes.sort((a, b) => a.from - b.from).forEach((take, index) => {
    if (index > 0) {
      segments.push({ silence: TAKE_GAP_SECONDS });
      offset += TAKE_GAP_SECONDS;
    }
    for (const file of take.files) segments.push(file);
    for (const word of take.words) words.push({ ...word, start: word.start + offset, end: word.end + offset });
    take.lineSpans.forEach((span, line) => {
      if (span) lineSpans[take.from + line] = { start: span.start + offset, end: span.end + offset };
    });
    offset += take.seconds;
  });
  return { part, segments, lineSpans, words, seconds: offset };
}

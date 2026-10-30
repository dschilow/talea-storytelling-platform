/**
 * Records one episode as an audio drama: cast → screenplay → voices → score →
 * timeline → studio mix. No database here (production.ts stores the result),
 * so a script can run the whole chain against the live services.
 *
 * The voices come from one of two engines (engines.ts): ElevenLabs v4 in
 * dialogue takes, or Gemini 3.8 TTS line by line (gemini-render.ts). Screenplay,
 * music, sounds and mix are the same for both, so a recording with the other
 * engine is a fair comparison and "Neu vertonen" can switch engines.
 *
 * The screenplay's sounds are cast from the sound library every story shares
 * (sound-library.ts) while the voices record; only sounds nobody has made yet
 * are generated, and they join the library with a description.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { mixStudioMaster, resolveOriginsIntro, resolveTaleaBumper, type SoundCachePort } from "../../../doku/audio-render";
import { synthesizeDialogueWithTimestamps } from "../../../tts/elevenlabs-dialogue";
import { transcribeTake } from "./transcribe";
import type { CostLedger, StorybookLlm } from "../../storybook/llm";
import { LIBRARY_MODELS } from "../engine";
import type { AudioScript, EpisodeAudioStats, EpisodeContent, ScoreMood, ScriptPart, SeriesBible, SeriesCharacter, SeriesInfo, VoiceEngine } from "../types";
import { pickVoice, type AccountVoice, type ResolvedVoice } from "./casting";
import { assignEngineVoices, recastScript, seriesCastMembers, seriesHints, speakerHint, toSpeaker } from "./cast-members";
import { audioCosts, defaultVoiceEngine, engineInfo, musicCost, soundCost } from "./engines";
import { figureHint, pickGeminiVoice, type GeminiCastEntry, type SpeakerDirection } from "./gemini-voices";
import { renderWithGemini } from "./gemini-render";
import type { SpeechPort } from "./openrouter-speech";
import { applySoundPlan, planSoundCasting, trackSoundCache, type SoundLibraryPort, type SoundPlan } from "./sound-library";
import { prepareScore, probeSeconds, scorePrompt, type ScorePorts } from "./score";
import { EPISODE_INTRO_CROSSFADE_SECONDS } from "./intro";
import {
  NARRATOR_KEY,
  adaptChapter,
  assembleScript,
  billedCharacters,
  castEpisodeSpeakers,
  dialogueScript,
  type CastMember,
} from "./screenplay";
import { buildTimeline, estimateLineSpans, type RenderedPart } from "./timeline";
import { checkTake, planTakes, type TakeCheck } from "./qa";

/** The account takes two requests at once (Creator plan). */
const VOICE_CONCURRENCY = 2;
/** ElevenLabs: dialogue is reliable up to ~2,000 characters per request; longer chapters lost lines. */
const TAKE_MAX_CHARS = 1600;
const TAKE_ATTEMPTS = 3;
/** Breath between two takes of the same chapter. */
const TAKE_GAP_SECONDS = 0.35;
/**
 * Listening check (speech-to-text per take, re-record on a missing line). Off by
 * default since 2026-10-21: the editor does not want to pay for speech-to-text and
 * re-recordings on top of the voices; the short takes alone fixed the dropped lines.
 */
const LISTENING_CHECK = process.env.TALEA_AUDIO_QA === "on";
/** Spot effects and ambience beds one drama may generate (a 13-minute episode uses 30–50). */
const MAX_SOUND_ASSETS = 70;

export { geminiFigures, seriesCastMembers, seriesHints, recastScript, assignEngineVoices } from "./cast-members";

export interface DramaInput {
  series: SeriesInfo;
  bible: SeriesBible;
  season: number;
  episode: number;
  content: EpisodeContent;
  /** Active characters of the series. */
  characters: SeriesCharacter[];
  /** ElevenLabs voices of the narrator and the series characters (resolveSeriesCast); persona and silence come from here for every engine. */
  seriesCast: ResolvedVoice[];
  /** The ElevenLabs account's voices (may be empty when recording with Gemini). */
  voices: AccountVoice[];
  llm: StorybookLlm;
  ledger: CostLedger;
  scorePorts: ScorePorts;
  /** Voice engine; the server default (defaultVoiceEngine) when missing. */
  engine?: VoiceEngine;
  /** Gemini voices of the narrator and the series characters (resolveGeminiCast); required for Gemini engines. */
  geminiCast?: GeminiCastEntry[];
  /** Speech synthesis for Gemini engines (OpenRouter). */
  speech?: SpeechPort;
  /** Generated sounds kept between recordings. */
  soundCache?: SoundCachePort;
  /** Sounds shared by every story (needs the sound cache): the screenplay's sounds are cast from it, new ones join it. */
  soundLibrary?: SoundLibraryPort;
  /** Leave out spot effects and ambience (music stays): a cheaper test recording. */
  withoutSounds?: boolean;
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
  engine: VoiceEngine;
  stats: EpisodeAudioStats;
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

/** What a voice engine hands to the timeline. */
interface RecordedVoices {
  parts: RenderedPart[];
  takes: number;
  retakes: number;
  requests: number;
  voiceSeconds: number;
  costUSD: number;
  notes: string[];
}

/** Stages 1–2: the episode's own speakers get voices, every chapter becomes a screenplay. */
export async function writeAudioScript(input: DramaInput): Promise<AudioScript> {
  const say = input.log ?? ((message: string) => console.log(`[library-audio] ${message}`));
  const report = input.report ?? (async () => undefined);
  const family = engineInfo(input.engine).family;
  const seriesMembers = seriesCastMembers(input.characters, input.seriesCast, { family, geminiCast: input.geminiCast, voices: input.voices });
  const voiceName = new Map(input.voices.map((voice) => [voice.voiceId, voice.name.trim()]));

  await report("cast");
  const used = new Set(seriesMembers.map((member) => member.voiceId).filter((id): id is string => Boolean(id)));
  const usedGemini = new Set(seriesMembers.map((member) => member.geminiVoice).filter((id): id is string => Boolean(id)));
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
    const hint = figureHint({ name: draft.name, personality: `${description} ${draft.persona}`, gender: draft.gender, age: draft.age });
    let voiceId = draft.voiceId && voiceName.has(draft.voiceId) && !used.has(draft.voiceId) ? draft.voiceId : undefined;
    if (!voiceId) voiceId = pickVoice({ gender: hint.gender, age: hint.age, creature: hint.creature, seed: draft.key }, input.voices, used)?.voiceId;
    if (voiceId) used.add(voiceId);
    let geminiVoice: string | undefined;
    if (family === "gemini") {
      geminiVoice = pickGeminiVoice({ ...hint, persona: draft.persona, seed: draft.key }, usedGemini).name;
      usedGemini.add(geminiVoice);
    }
    return {
      key: draft.key,
      name: draft.name,
      characterId: draft.guestId,
      description,
      persona: draft.persona,
      // On ElevenLabs a figure without a free voice cannot speak; Gemini always has one.
      silent: family === "gemini" ? false : !voiceId,
      voiceId,
      voiceName: voiceId ? voiceName.get(voiceId) : undefined,
      geminiVoice,
      source: "episode",
      ...(hint.gender ? { gender: hint.gender } : {}),
      ...(hint.age ? { age: hint.age } : {}),
      creature: Boolean(hint.creature),
    };
  });
  const cast = [...seriesMembers, ...episodeMembers];
  const voiceOf = (member: CastMember) => (family === "gemini" ? member.geminiVoice : member.voiceName ?? member.voiceId);
  say(`cast (${engineInfo(input.engine).label}): ${cast.map((member) => `${member.key}${member.silent ? " (stumm)" : `=${voiceOf(member)}`}`).join(", ")}`);

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
    // Gemini voices that are still missing are assigned before recording (assignEngineVoices); ElevenLabs members without a voice are silent.
    speakers: cast.filter((member) => !member.silent && (family === "gemini" || member.voiceId)).map(toSpeaker),
    chapters,
    notes: family === "elevenlabs" ? input.seriesCast.filter((voice) => voice.replaced).map((voice) => `${voice.name}: Stimme ${voice.replaced} gibt es im ElevenLabs-Konto nicht mehr, neu besetzt.`) : [],
  });
}

export async function renderAudioDrama(input: DramaInput): Promise<DramaResult> {
  const say = input.log ?? ((message: string) => console.log(`[library-audio] ${message}`));
  const report = input.report ?? (async () => undefined);
  const started = Date.now();
  const engine: VoiceEngine = input.engine ?? defaultVoiceEngine();
  const info = engineInfo(engine);
  if (info.family === "gemini" && !input.speech) throw new Error(`${info.label}: keine Sprachsynthese angeschlossen (OpenRouter-Key fehlt?).`);
  const seriesMembers = seriesCastMembers(input.characters, input.seriesCast, { family: info.family, geminiCast: input.geminiCast, voices: input.voices });
  const written = input.script ? recastScript(input.script, seriesMembers) : await writeAudioScript({ ...input, engine });
  const script = assignEngineVoices(written, info.family, input.voices, seriesHints(input.characters, input.seriesCast, input.voices));

  // The sounds are cast from the shared library while the voices record (it only changes sounds, never lines).
  const library = !input.withoutSounds && input.soundCache ? input.soundLibrary : undefined;
  const origin = `${input.series.title} S${input.season}E${input.episode}`;
  const soundPlanning: Promise<SoundPlan | null> = library
    ? library
        .list()
        .then((entries) => planSoundCasting({ script, library: entries, llm: input.llm, ledger: input.ledger, model: LIBRARY_MODELS.support, origin, log: say }))
        .catch((error) => {
          say(`sound library unavailable, every sound is made for this recording: ${(error as Error).message}`);
          return null;
        })
    : Promise.resolve(null);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "library-audio-"));
  try {
    /* 3: voices */
    await report("voices");
    const recorded = info.family === "gemini" ? await recordWithGemini(script, engine, input, tmpDir, say) : await recordWithElevenLabs(script, tmpDir, say);
    script.notes.push(...recorded.notes);
    const soundPlan = await soundPlanning;
    if (soundPlan) applySoundPlan(script, soundPlan);

    /* 4: the series score */
    await report("music");
    const sceneMoods = script.parts.flatMap((part) => part.scenes.map((scene) => scene.music)).filter((mood): mood is ScoreMood => Boolean(mood));
    const styleEn = input.bible.audio?.scoreStyleEn || `playful orchestral music for a children's series, ${input.bible.world.tone}`;
    const score = await prepareScore({
      seriesSlug: input.series.slug,
      styleEn,
      moods: ["theme", "bridge", ...sceneMoods],
      tmpDir,
      ports: input.scorePorts,
    });
    if (score.failed.length) script.notes.push(`Musik fehlt: ${score.failed.map((entry) => `${entry.mood} (${entry.error.slice(0, 120)})`).join(", ")}`);
    say(`music: ${[...score.tracks.keys()].join(", ")}${score.composed.length ? ` (new: ${score.composed.join(", ")})` : ""}${score.fallbacks.length ? ` — sound-generation fallback for ${score.fallbacks.join(", ")}` : ""}`);

    /* 5: timeline and studio mix */
    await report("mix");
    const timeline = buildTimeline(recorded.parts, score.tracks);
    const cues = input.withoutSounds ? timeline.cues.filter((cue) => cue.type === "music") : timeline.cues;
    const sounds = cues.filter((cue) => cue.type === "sfx").length;
    const present = new Set<string>();
    const introPath = await resolveOriginsIntro();
    if (!introPath) throw new Error("Das Talea-Origins-Intro fehlt im Build.");
    const introSeconds = await probeSeconds(introPath);
    if (introSeconds <= 0) throw new Error("Die Dauer des Talea-Origins-Intros konnte nicht ermittelt werden.");
    const mix = await mixStudioMaster({
      tmpDir,
      voice: timeline.voice,
      timelineSec: timeline.seconds,
      cues,
      introPath,
      outroPath: await resolveTaleaBumper("outro"),
      maxGeneratedAssets: MAX_SOUND_ASSETS,
      bitrate: "192k",
      logTag: `LibraryAudio ${input.series.slug} s${input.season}e${input.episode}`,
      soundCache: input.soundCache ? trackSoundCache(input.soundCache, present) : undefined,
    });
    const seconds = (await measureSeconds(mix.audio, tmpDir)) || timeline.seconds;
    say(`mix: ${(seconds / 60).toFixed(1)} min, ${cues.length} cues (${sounds} sounds), ${mix.generatedAssets} sound assets generated, ${mix.reusedAssets} reused`);
    if (library && soundPlan) await registerSounds(library, soundPlan, present, say);

    const composedMusic = score.composed.filter((mood) => !score.fallbacks.includes(mood)).reduce((sum, mood) => sum + scorePrompt(styleEn, mood).seconds, 0);
    const musicBySound = score.fallbacks.reduce((sum, mood) => sum + Math.min(30, scorePrompt(styleEn, mood).seconds), 0);
    const costs = audioCosts({
      scriptUSD: input.ledger.totals().costUSD,
      voicesUSD: recorded.costUSD,
      soundsUSD: soundCost(mix.generatedSeconds),
      musicUSD: musicCost(composedMusic) + soundCost(musicBySound),
    });
    say(`costs (${info.label}): voices $${costs.voicesUSD.toFixed(3)}, sounds $${costs.soundsUSD.toFixed(3)}, music $${costs.musicUSD.toFixed(3)}, script $${costs.scriptUSD.toFixed(3)} = $${costs.totalUSD.toFixed(3)}`);
    return {
      script,
      audio: mix.audio,
      seconds,
      // mixStudioMaster crossfades the intro into the programme for 0.8 seconds.
      chapterStarts: timeline.chapterStarts.map((value) => Number((value + introSeconds - EPISODE_INTRO_CROSSFADE_SECONDS).toFixed(2))),
      engine,
      stats: {
        llmCostUSD: Number(input.ledger.totals().costUSD.toFixed(4)),
        voiceCharacters: billedCharacters(script),
        sounds,
        soundAssets: mix.generatedAssets,
        reusedSounds: mix.reusedAssets,
        ...(soundPlan ? { librarySounds: soundPlan.stats.fromLibrary } : {}),
        takes: recorded.takes,
        retakes: recorded.retakes,
        voiceSeconds: Math.round(recorded.voiceSeconds),
        voiceRequests: recorded.requests,
        music: score.fallbacks.length ? `Soundgenerator (${score.fallbacks.join(", ")})` : score.composed.length ? `neu komponiert: ${score.composed.join(", ")}` : "aus dem Serien-Archiv",
        seconds: Math.round((Date.now() - started) / 1000),
        costs,
      },
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * New sounds whose audio now exists join the library (a sound the generator
 * failed or the asset cap left out does not); every library sound played counts
 * one use. A storage error costs the library an entry, never the recording.
 */
async function registerSounds(library: SoundLibraryPort, plan: SoundPlan, present: Set<string>, say: (message: string) => void): Promise<void> {
  const added = plan.fresh.filter((entry) => present.has(entry.storageKey)).map((entry) => ({ ...entry, uses: 1 }));
  try {
    if (added.length) await library.add(added);
    if (plan.used.length) await library.markUsed(plan.used);
    say(`sound library: ${added.length} new sounds stored, ${plan.used.length} reused`);
  } catch (error) {
    say(`sound library: could not store the sounds: ${(error as Error).message}`);
  }
}

async function measureSeconds(audio: Buffer, tmpDir: string): Promise<number> {
  const file = path.join(tmpDir, "measure.mp3");
  await fs.writeFile(file, audio);
  return probeSeconds(file);
}

/* ── Gemini: line by line ───────────────────────────────────────────────── */

async function recordWithGemini(script: AudioScript, engine: VoiceEngine, input: DramaInput, tmpDir: string, say: (message: string) => void): Promise<RecordedVoices> {
  const hints = seriesHints(input.characters, input.seriesCast, input.voices);
  const cast = new Map<string, SpeakerDirection & { voice: string }>();
  for (const speaker of script.speakers) {
    if (!speaker.geminiVoice) continue;
    cast.set(speaker.key, { voice: speaker.geminiVoice, name: speaker.name, persona: speaker.persona, narrator: speaker.key === NARRATOR_KEY, hint: speakerHint(speaker, hints) });
  }
  say(`voices (${engineInfo(engine).label}): ${[...cast.entries()].map(([key, entry]) => `${key}=${entry.voice}`).join(", ")}`);
  const { parts, stats } = await renderWithGemini({ script, engine, speech: input.speech!, cast, tmpDir, log: say });
  say(`voices: ${stats.requests} requests, ${stats.retakes} retakes, ${stats.billedSeconds.toFixed(0)} s billed, $${stats.costUSD.toFixed(4)}`);
  return {
    parts,
    takes: script.parts.reduce((sum, part) => sum + part.lines.length, 0),
    retakes: stats.retakes,
    requests: stats.requests,
    voiceSeconds: parts.reduce((sum, part) => sum + part.seconds, 0),
    costUSD: stats.costUSD,
    notes: [
      ...stats.recovered.map((line) => `${line.label} (${line.voice}): nach Anbieter-Ablehnung mit neutraler Regie${line.engine !== engine ? ` auf ${engineInfo(line.engine).label}` : ""} aufgenommen — bitte anhören.`),
      ...stats.flagged.map((flag) => `${flag.part}, Zeile ${flag.line} („${flag.text}“): ${flag.reason} — bitte anhören.`),
    ],
  };
}

/* ── ElevenLabs: dialogue takes ─────────────────────────────────────────── */

async function recordWithElevenLabs(script: AudioScript, tmpDir: string, say: (message: string) => void): Promise<RecordedVoices> {
  const voiceMap = Object.fromEntries(script.speakers.map((speaker) => [speaker.key, speaker.voiceId]));
  // Takes of ≤ 1,600 characters, each one listened to (when enabled) and recorded again when a line is missing.
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
  const parts = script.parts.map((part, partIndex) => assemblePart(part, takes.filter((take) => take.partIndex === partIndex)));
  const notes: string[] = [];
  for (const take of takes) {
    if (take.check && !take.check.passed) {
      const part = script.parts[take.partIndex];
      const missing = take.check.missingLines.map((line) => `„${part.lines[take.from + line].text.replace(/\[[^\]]*\]\s*/g, "").slice(0, 60)}“`);
      notes.push(`${part.title}: nach ${take.attempts} Aufnahmen nicht ganz sauber (gehört ${Math.round(take.check.coverage * 100)} %)${missing.length ? `, fehlt evtl.: ${missing.join(", ")}` : ""}${take.check.inventedRun ? `, zusätzlich gehört: „${take.check.inventedRun}“` : ""}. Bitte anhören.`);
    }
  }
  const attempts = takes.reduce((sum, take) => sum + take.attempts, 0);
  // Every attempt is billed (retakes only happen with the listening check on); tags count as characters.
  const billed = takes.reduce((sum, take) => sum + take.attempts * script.parts[take.partIndex].lines.slice(take.from, take.to).reduce((chars, line) => chars + line.text.length, 0), 0);
  return {
    parts,
    takes: takes.length,
    retakes: attempts - takes.length,
    requests: attempts,
    voiceSeconds: parts.reduce((sum, part) => sum + part.seconds, 0),
    costUSD: (billed / 1000) * (engineInfo("elevenlabs").usdPer1kChars ?? 0),
    notes,
  };
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

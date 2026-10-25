/**
 * Local test of the library store against the local Encore database: seed sync,
 * visibility, progress, the collectible hand-over and the sound library — no
 * Clerk login needed.
 *
 *   cd backend
 *   encore exec -- bun scripts/library-smoke.ts
 *
 * Leaves nothing behind: the test profile's progress is deleted at the end.
 */

import { storyDB } from "../story/db";
import { dbSoundLibrary, ensureLibrary, getBible, getSound, isVisible, listEpisodes, listProgress, listSeries, listSounds, saveProgress, updateSound } from "../story/library/store";
import type { SoundEntry } from "../story/library/audio/sound-library";

const profileId = `smoke-profile-${Date.now()}`;
const userId = "smoke-user";
const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failures.push(message);
};

await ensureLibrary();
// A second call in the same process must be a no-op, a fresh sync must not duplicate anything.
await ensureLibrary();

const series = await listSeries();
check(series.length === 2, `2 series (${series.map((entry) => entry.info.title).join(", ")})`);

for (const entry of series) {
  const bible = await getBible(entry.info.id, entry.activeBibleVersion);
  const episodes = await listEpisodes(entry.info.id);
  const visible = episodes.filter((episode) => isVisible(episode));
  check(Boolean(bible && bible.characters.length >= 6), `${entry.info.title}: bible v${bible?.version} with ${bible?.characters.length} characters`);
  check(episodes.length === 10, `${entry.info.title}: 10 planned episodes (${episodes.map((episode) => `${episode.episode}:${episode.status}`).join(" ")})`);
  check(visible.length === 1 && visible[0].episode === 1, `${entry.info.title}: episode 1 is visible (“${visible[0]?.content?.title}”)`);
  check(visible[0]?.content?.chapters.length === 3, `${entry.info.title}: episode 1 has 3 chapters`);
  check(Boolean(visible[0]?.content?.chapters.every((chapter) => chapter.image?.url)), `${entry.info.title}: every chapter has a picture`);
}

const firstEpisode = (await listEpisodes(series[0].info.id))[0];
const first = await saveProgress({ profileId, userId, episodeId: firstEpisode.id, chapterIndex: 1, finished: false });
check(first === false, "progress: reading chapter 2 is not a finish");
const finished = await saveProgress({ profileId, userId, episodeId: firstEpisode.id, chapterIndex: 2, finished: true });
check(finished === true, "progress: first finish hands over the collectible");
const again = await saveProgress({ profileId, userId, episodeId: firstEpisode.id, chapterIndex: 0, finished: true });
check(again === false, "progress: reading it again does not hand it over twice");
const rows = await listProgress(profileId);
check(rows.length === 1 && Boolean(rows[0].finishedAt), "progress: one row, finished");

await storyDB.exec`DELETE FROM library_progress WHERE profile_id = ${profileId}`;

// The sound library: new entries, an existing id keeps its edits, uses count, blocking.
const soundId = `smoke-sound-${Date.now()}`;
const sound: SoundEntry = { id: soundId, kind: "sfx", prompt: "smoke test door closing", seconds: 1.5, label: "Rauchtest-Tür", description: "A door closes.", tags: ["door", "close"], storageKey: `sounds/v1/sfx/${soundId}.mp3`, uses: 1, blocked: false, origin: "Smoke S1E1" };
await dbSoundLibrary.add([sound]);
await updateSound(soundId, { description: "A wooden door closes softly, latch clicks." });
await dbSoundLibrary.add([{ ...sound, description: "overwritten?" }]);
await dbSoundLibrary.markUsed([soundId]);
const stored = await getSound(soundId);
check(stored?.description === "A wooden door closes softly, latch clicks." && stored.uses === 2, `sounds: an existing id keeps its edited description, uses counted (${stored?.uses})`);
check(stored?.seconds === 1.5 && stored.tags.join(",") === "door,close" && stored.kind === "sfx", "sounds: length, keywords and kind survive the round trip");
await updateSound(soundId, { blocked: true });
check((await listSounds()).find((entry) => entry.id === soundId)?.blocked === true, "sounds: blocked");
await storyDB.exec`DELETE FROM library_sounds WHERE id = ${soundId}`;

console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nAll checks passed");
process.exit(failures.length ? 1 : 0);

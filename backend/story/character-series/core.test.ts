// @ts-ignore Bun test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  avatarSeriesFingerprint,
  chooseSeries,
  classifySeriesAvatars,
  effectiveSeriesEpisode,
  extractSeriesLog,
  logsForEpisode,
  nextSeriesEpisode,
  seriesPrompt,
  validateSeriesAvatarCount,
  validateSeriesLog,
  type CharacterSeriesBible,
  type SeriesEpisodeLog,
} from "./core";
import { getSeriesEpisodeBlueprint, getUnlockedSeriesEnsemble, SERIES_ENSEMBLE_BIBLES, SERIES_EPISODE_PLANS, SERIES_PLAN_FILES } from "./episode-plans";
import { seriesAuthoring, seriesContext } from "./authoring";
import { buildBrief } from "../storybook/context";
import bibles from "./series-bibles.json";
import { readOneShot } from "../episode/engine";

const series = bibles as CharacterSeriesBible[];

describe("persönliche Figurenserien", () => {
  test("catalogue has at least five different, complete deployable bibles", () => {
    expect(series.length).toBeGreaterThanOrEqual(5);
    expect(new Set(series.map((bible) => bible.id)).size).toBe(series.length);
    expect(new Set(series.map((bible) => bible.characterId)).size).toBe(series.length);
    for (const bible of series) {
      expect(bible.bible.length).toBeGreaterThan(1500);
      expect(bible.genres.length).toBeGreaterThan(0);
    }
  });

  test("catalogue genres use wizard values and support its matching worlds", () => {
    const wizardGenres = ["fairy_tales", "adventure", "magic", "animals", "scifi", "modern"];
    for (const bible of series) for (const genre of bible.genres) expect(wizardGenres).toContain(genre);
    for (const genre of ["fairy_tales", "adventure", "magic", "animals", "modern"]) {
      expect(chooseSeries(series, genre, {}).genres).toContain(genre);
    }
  });

  test("automatic choice follows the genre and rotates equally fitting worlds", () => {
    const match = series.filter((bible) => bible.genres.includes("adventure"));
    expect(match.length).toBeGreaterThan(1);
    const chosen = chooseSeries(series, "adventure", { [match[0].id]: 2 });
    expect(chosen.genres).toContain("adventure");
    expect(chosen.id).not.toBe(match[0].id);
  });

  test("only literal evidence present in the final text is accepted", () => {
    const text = "Tilda öffnete die schwere Tür. Der Kompass fiel ins Wasser. Mina fing ihn auf.";
    const identity = { episode: 1, storyId: "story-1", avatarIds: ["mina"] };
    const log = validateSeriesLog({
      events: [{ fact: "Ein Kompass fällt ins Wasser", quote: "Der Kompass fiel ins Wasser." }, { fact: "Falscher Schluss", quote: "Der Kompass wurde zerstört." }],
      relationships: [{ fact: "Eine erfundene Freundschaft", quote: "Sie waren seit Jahren Freunde." }],
      openThreads: [],
    }, text, identity);
    expect(log.events).toHaveLength(1);
    expect(log.relationships).toHaveLength(0);
    expect(log.events[0].quote).toBe("Der Kompass fiel ins Wasser.");
  });

  test("a missing or stale log falls back to compact, literal excerpts without asserting a plot", () => {
    const text = "Tilda öffnete die schwere Tür. Der Kompass fiel ins Wasser. Mina fing ihn auf.";
    const fallback = extractSeriesLog({ storyText: text, episode: 2, storyId: "s", avatarIds: ["mina"] });
    expect(fallback.events.length).toBeGreaterThan(0);
    for (const event of fallback.events) expect(text).toContain(event.quote);
    expect(fallback.relationships).toEqual([]);
    expect(fallback.openThreads).toEqual([]);
  });

  test("first episode stages the origin, continuation names only participating avatars", () => {
    const avatars = [{ id: "mina", name: "Mina" }, { id: "leo", name: "Leo" }];
    expect(seriesPrompt(series[0], [], avatars)).toContain("Ursprungsgeschehen");
    const history: SeriesEpisodeLog[] = [{ episode: 1, storyId: "s", avatarIds: ["mina"], events: [{ fact: "not a source", quote: "Mina fand den Schlüssel." }], relationships: [], openThreads: [] }];
    const prompt = seriesPrompt(series[0], history, avatars);
    expect(prompt).toContain("Mina [mina]");
    expect(prompt).not.toContain("Leo [leo]");
    expect(prompt).toContain("Mina fand den Schlüssel.");
    expect(prompt).not.toContain("not a source");
  });

  test("deleted earlier episodes leave a gap; numbering follows the last retained episode", () => {
    const entry = (episode: number): SeriesEpisodeLog => ({ episode, storyId: `s${episode}`, avatarIds: ["mina"], events: [{ fact: "", quote: "Mina fand den Schlüssel." }], relationships: [], openThreads: [] });
    const retained = [entry(2), entry(4)];
    expect(nextSeriesEpisode(retained)).toBe(5);
    expect(seriesPrompt(series[0], retained, [{ id: "mina", name: "Mina" }])).toContain("Dies ist Folge 5.");
    expect(nextSeriesEpisode([])).toBe(1);
    expect(() => nextSeriesEpisode([entry(2), entry(2)])).toThrow();
    expect(() => nextSeriesEpisode([entry(4), entry(2)])).toThrow();
    expect(() => nextSeriesEpisode([entry(0)])).toThrow();
  });

  test("structured header is separated from the reader's manuscript", () => {
    const parsed = readOneShot('SERIENLOG: {"events":[{"fact":"Fund","quote":"Mina fand den Schlüssel."}],"relationships":[],"openThreads":[]}\nTITEL: Der Schlüssel\nBESCHREIBUNG: Ein Abenteuer.\nKAPITEL 1: Fund\nMina fand den Schlüssel.');
    expect(parsed.story.seriesLogCandidate).toBeDefined();
    expect(parsed.story.chapters[0].text).not.toContain("SERIENLOG");
  });

  test("all 5 series have 20 pre-planned episodes, staggered 3-character ensembles, avatarRoles and generated FLUX 3 portraits", () => {
    expect(SERIES_ENSEMBLE_BIBLES).toHaveLength(15);
    const publicRoot = join(import.meta.dir, "..", "..", "..", "frontend", "public");
    for (const member of SERIES_ENSEMBLE_BIBLES) {
      expect(member.debutEpisode).toBeGreaterThanOrEqual(1);
      expect(member.debutEpisode).toBeLessThanOrEqual(10);
      expect(member.debutScene.length).toBeGreaterThan(30);
      expect(member.origin.length).toBeGreaterThan(30);
      expect(member.voice.length).toBeGreaterThan(20);
      expect(member.catchphrase.length).toBeGreaterThan(10);
      expect(member.look.length).toBeGreaterThan(25);
      expect(member.imageUrl).toBeDefined();
      expect(existsSync(join(publicRoot, ...member.imageUrl!.replace(/^\//, "").split("/")))).toBe(true);
    }

    for (const bible of series) {
      const planFile = SERIES_PLAN_FILES[bible.id];
      expect(planFile).toBeDefined();
      expect(planFile.ensemble).toHaveLength(3);
      const episodes = SERIES_EPISODE_PLANS[bible.id];
      expect(episodes).toHaveLength(20);
      episodes.forEach((ep, idx) => {
        expect(ep.episode).toBe(idx + 1);
        expect(ep.season).toBe(idx < 10 ? 1 : 2);
        expect(ep.titleIdea.length).toBeGreaterThan(4);
        expect(ep.hook.length).toBeGreaterThan(40);
        expect(ep.slapstick.length).toBeGreaterThan(40);
        expect(ep.suspense.length).toBeGreaterThan(40);
        expect(ep.avatarRole && ep.avatarRole.length).toBeGreaterThan(35);
        expect(ep.joke.length).toBeGreaterThan(15);
        expect(ep.keyVisual.length).toBeGreaterThan(35);
        expect(ep.clue.length).toBeGreaterThan(25);
        if (ep.guestId) {
          const unlocked = getUnlockedSeriesEnsemble(bible.id, ep.episode);
          expect(unlocked.some((m) => m.id === ep.guestId)).toBe(true);
        }
      });
    }
  });

  test("staggered debuts hide later characters and admin episodeOverride jumps to target episode blueprint", () => {
    expect(getUnlockedSeriesEnsemble("nebelfee", 1)).toHaveLength(0);
    expect(getUnlockedSeriesEnsemble("nebelfee", 2).map((m) => m.id)).toEqual(["milo-postmaus"]);
    expect(getUnlockedSeriesEnsemble("nebelfee", 4).map((m) => m.id)).toEqual(["milo-postmaus", "riko-rabe"]);
    expect(getUnlockedSeriesEnsemble("nebelfee", 7).map((m) => m.id)).toEqual(["milo-postmaus", "riko-rabe", "borste-dachs"]);

    const b = buildBrief({
      config: { avatarIds: ["a1", "a2"], genre: "magic", setting: "forest", ageGroup: "6-8", length: "medium", complexity: "medium", avatarIsHero: false },
      band: "6-8",
      budget: { pages: 3, wordsPerPageMin: 450, wordsPerPageMax: 650, totalWordsMin: 1350, totalWordsMax: 1950, maxCast: 2, maxCharactersPerImage: 3 },
      heroes: [{ id: "a1", name: "Alexander" }, { id: "a2", name: "Adrian" }],
      candidates: [],
      artifacts: [],
      seed: "test-override",
    });
    const nebelfeeBible = series.find((s) => s.id === "nebelfee")!;
    b.characterSeries = { bible: nebelfeeBible, logs: [], episodeOverride: 7 };
    const ctx = seriesContext(b);
    expect(ctx).toContain("episode 7");
    expect(ctx).toContain(getSeriesEpisodeBlueprint("nebelfee", 7)!.titleIdea);
    expect(ctx).toContain("GRAND DEBUT IN THIS EPISODE");
    expect(ctx).toContain("Borste");
  });

  test("avatar count rule (1..3) and re-introduction of new or modified avatars", () => {
    expect(() => validateSeriesAvatarCount([])).toThrow("mindestens ein und höchstens drei");
    expect(() => validateSeriesAvatarCount([{}, {}, {}, {}])).toThrow("mindestens ein und höchstens drei");
    expect(() => validateSeriesAvatarCount([{}, {}, {}])).not.toThrow();

    const alexV1 = { id: "a1", name: "Alexander", description: "kurze braune Haare", visualProfile: { hair: { color: "brown" } } };
    const alexV2 = { id: "a1", name: "Alexander", description: "rote Ritterrüstung und Brille", visualProfile: { hair: { color: "brown" }, accessories: ["glasses"] } };
    const adrian = { id: "a2", name: "Adrian", description: "blond mit Zahnlücke" };
    const lina = { id: "a3", name: "Lina", description: "lockige Haare" };

    const log1: SeriesEpisodeLog = {
      episode: 1,
      storyId: "s1",
      avatarIds: ["a1", "a2"],
      avatarFingerprints: { a1: avatarSeriesFingerprint(alexV1), a2: avatarSeriesFingerprint(adrian) },
      events: [{ fact: "Start", quote: "Sie fanden den Stiefel." }],
      relationships: [],
      openThreads: [],
    };
    const classified = classifySeriesAvatars([log1], [alexV2, adrian, lina]);
    expect(classified.familiar.map((a) => a.id)).toEqual(["a2"]);
    expect(classified.changed.map((a) => a.id)).toEqual(["a1"]);
    expect(classified.newcomers.map((a) => a.id)).toEqual(["a3"]);

    const b = buildBrief({
      config: { avatarIds: ["a1", "a2", "a3"], genre: "magic", setting: "forest", ageGroup: "6-8", length: "medium", complexity: "medium", avatarIsHero: false },
      band: "6-8",
      budget: { pages: 3, wordsPerPageMin: 450, wordsPerPageMax: 650, totalWordsMin: 1350, totalWordsMax: 1950, maxCast: 2, maxCharactersPerImage: 3 },
      heroes: [alexV2, adrian, lina],
      candidates: [],
      artifacts: [],
      seed: "test-reintro",
    });
    b.characterSeries = { bible: series[0], logs: [log1] };
    const ctx = seriesContext(b);
    expect(ctx).toContain("NEU IN DIESER SERIE");
    expect(ctx).toContain("Lina [a3]");
    expect(ctx).toContain("SEIT DEM LETZTEN BESUCH VERÄNDERT");
    expect(ctx).toContain("Alexander [a1]");
    expect(effectiveSeriesEpisode([log1], 5)).toBe(5);
    expect(logsForEpisode([log1], 1)).toHaveLength(0);
  });

  test("seriesAuthoring adapts genre coloring, feelings, rhymes, learning mode and custom wishes to the episode", () => {
    const b = buildBrief({
      config: {
        avatarIds: ["a1", "a2"],
        genre: "fairy_tales",
        setting: "fantasy",
        ageGroup: "6-8",
        length: "medium",
        complexity: "medium",
        emotionalFlavors: ["lachfreude", "prickeln"],
        humorLevel: 2,
        suspenseLevel: 2,
        allowRhymes: true,
        hasTwist: true,
        requireMoral: true,
        customPrompt: "Ein blauer Gummistiefel taucht auf",
        learningMode: {
          enabled: true,
          subjects: ["science"],
          difficulty: "beginner",
          learningObjectives: ["Warum Nebel entsteht"],
          assessmentType: "quiz",
        },
      } as any,
      band: "6-8",
      budget: { pages: 3, wordsPerPageMin: 450, wordsPerPageMax: 650, totalWordsMin: 1350, totalWordsMax: 1950, maxCast: 2, maxCharactersPerImage: 3 },
      heroes: [{ id: "a1", name: "Alexander" }, { id: "a2", name: "Adrian" }],
      candidates: [],
      artifacts: [],
      seed: "test-wizard-options",
    });
    b.characterSeries = { bible: series.find((s) => s.id === "nebelfee")!, logs: [] };
    const authoring = seriesAuthoring(b);
    const userPrompt = authoring.user();
    expect(authoring.system).toContain("WISSEN:");
    expect(userPrompt).toContain("Genre coloring — Fairy Tale (Märchen)");
    expect(userPrompt).toContain("The story should feel: funny, exciting, with a thrill");
    expect(userPrompt).toContain("Rhymes (mandatory)");
    expect(userPrompt).toContain("Surprising twist (mandatory)");
    expect(userPrompt).toContain("LEARNING MODE (mandatory");
    expect(userPrompt).toContain("Warum Nebel entsteht");
    expect(userPrompt).toContain("Ein blauer Gummistiefel taucht auf");
  });
});

// @ts-ignore Bun test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { chooseSeries, extractSeriesLog, nextSeriesEpisode, seriesPrompt, validateSeriesLog, type CharacterSeriesBible, type SeriesEpisodeLog } from "./core";
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
});

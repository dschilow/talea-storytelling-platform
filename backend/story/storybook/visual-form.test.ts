// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { assembleFlux3ImagePrompt, describeReferenceLooks, type VisualEntity } from "./illustration-stage";
import { figurePortraitRequest } from "./book/illustrations";
import { buildQaPrompt, correctionFor, parseQaReport, qaSeverity, qaStatus, qaSeverityParts } from "./images";
import { isTerrainFigure } from "./visual-form";

const path: VisualEntity = { id: "schlurfo", name: "Schlurfo", kind: "character", role: "cast", species: "creature", isHuman: false, appearance: "A living ochre garden path with rounded pebble eyes, a small moss moustache, and soft grassy edges that curl into loops.", forbidden: [], referenceUrl: "https://example.test/schlurfo.webp" };

describe("Der Weg macht Kringel: the form and the actual pictured action", () => {
  test("the path is terrain through portrait, picture and QA; scenery does not turn a fox or fairy into terrain", () => {
    expect(isTerrainFigure(path)).toBe(true);
    for (const appearance of ["orange fox with a garden path behind it", "a small fairy in a garden", "a wooden crate with painted fields"]) expect(isTerrainFigure({ ...path, appearance })).toBe(false);
    const portrait = figurePortraitRequest(path, "s");
    const caption = assembleFlux3ImagePrompt({ scene: "Schlurfo curls around the cabbage.", onStage: [path], spriteOrder: [path] });
    expect(portrait.prompt).toContain("long surface remains its body");
    expect(portrait.prompt).not.toContain("standing upright");
    expect(caption).toContain("one face and distinctive features are embedded together at a single spot");
    expect(buildQaPrompt([path], "A loop around the cabbage.", true)).toContain("A separate upright mascot");
  });

  test("a poor reference description cannot overwrite the canonical terrain form", async () => {
    const entity = { ...path, id: "terrain-cache-regression", referenceKey: "terrain-ref" };
    const result = await describeReferenceLooks(async request => ({ text: JSON.stringify({ looks: { e1: "an upright round moss creature with pebble eyes" }, tags: { e1: "upright moss creature" } }), modelUsed: request.model, usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 }, durationMs: 1 }), [entity], "test");
    expect(result.entities[0].appearance).toBe(path.appearance);
    expect(result.entities[0].tag).toBeUndefined();
  });

  test("a missing defining prop triggers a targeted redraw despite high figure and scene scores", () => {
    const report = parseQaReport(JSON.stringify({ characterCounts: { Adrian: 1 }, identityMatch: 1, sceneMatch: .9, sceneDefects: ["The leaf Adrian ducks under is missing"], sceneFixes: ["Place the broad cabbage leaf overhead above Adrian's crouched head."] }), ["Adrian"])!;
    expect(qaSeverity(report, 1)).toBeGreaterThanOrEqual(10);
    expect(qaStatus(report, qaSeverityParts(report, 1))).toBe("flawed");
    expect(correctionFor(report)).toContain("Place the broad cabbage leaf overhead");
    expect(correctionFor({ ...report, sceneFixes: [] })).toContain("physical support and target");
    const counted = parseQaReport(JSON.stringify({ characterCounts: { Adrian: 1 }, identityMatch: 1, sceneMatch: .9, sceneDefects: ["Nine cups instead of the seven needed for the seven drops"], sceneFixes: ["Arrange seven separate clay cups under the flower, all visible."] }), ["Adrian"])!;
    expect(qaStatus(counted, qaSeverityParts(counted, 1))).toBe("flawed");
    expect(correctionFor(counted)).toContain("Arrange seven separate clay cups");
  });
});

// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { assembleFlux3ImagePrompt, MODERN_CHILDRENS_BOOK_STYLE, withoutTextNegations, wordlessLine, type VisualEntity } from "./illustration-stage";

const alex: VisualEntity = { id: "a", name: "Alexander", kind: "character", role: "hero", species: "human", isHuman: true, appearance: "brown-haired boy in a pale green shirt", forbidden: [] };
const fox: VisualEntity = { id: "f", name: "Bo", kind: "character", role: "cast", species: "fox", isHuman: false, appearance: "orange fox with round glasses and green vest", forbidden: [] };
const artifact: VisualEntity = { id: "map", name: "Sternenkarte", kind: "artifact", role: "artifact", species: "object", isHuman: false, appearance: "a parchment map marked with a blue star", forbidden: [] };

describe("Flux 3 complete picture-book captions", () => {
  test("keeps the entire director's action and maps a mixed reference sheet without counting an object as a character", () => {
    const scene = `Low view from table height. ${"Leaves frame the edge of the window. ".repeat(23)}Alexander points at the star while Bo lifts the lantern.`;
    const prompt = assembleFlux3ImagePrompt({ scene, onStage: [alex, fox, artifact], spriteOrder: [alex, artifact, fox], correction: "The lantern stays in Bo's paw." });
    expect(prompt).toContain(scene);
    expect(prompt).toContain(MODERN_CHILDRENS_BOOK_STYLE);
    expect(prompt).toContain("1. Alexander; 2. Sternenkarte (object); 3. Bo");
    expect(prompt).toContain("Exactly 2 characters");
    expect(prompt).toContain("The lantern stays in Bo's paw.");
    expect(prompt).toContain(artifact.appearance);
    expect(prompt).not.toContain("two five-fingered hands");
  });

  test("a creature without a pool portrait keeps its appearance and place in the headcount", () => {
    const prompt = assembleFlux3ImagePrompt({ scene: "Alexander reaches toward the blue songbird.", onStage: [alex], spriteOrder: [alex], elements: [{ name: "Blauchen", noun: "blue songbird", look: "tiny blue bird with a white breast", figure: true }] });
    expect(prompt).toContain("Exactly 2 characters");
    expect(prompt).toContain("tiny blue bird with a white breast");
    expect(prompt).toContain("each visible once");
  });

  test("links each action to its visible identity and keeps signature body parts with their owner", () => {
    const prompt = assembleFlux3ImagePrompt({ scene: "Alexander lifts the lantern while Bo opens the map.", onStage: [{ ...alex, tag: "brown-haired boy in pale green shirt" }, { ...fox, appearance: `${fox.appearance}, bushy tail` }], spriteOrder: [alex, fox] });
    expect(prompt).toContain("Alexander (brown-haired boy in pale green shirt) lifts the lantern");
    expect(prompt).toContain("Only Bo has a tail");
  });

  test("a vignette retains the medium while describing an unoccupied scene", () => {
    const prompt = assembleFlux3ImagePrompt({ scene: "A leaf boat beside the well.", onStage: [], spriteOrder: [], vignette: true });
    expect(prompt).toContain(MODERN_CHILDRENS_BOOK_STYLE);
    expect(prompt).toContain("unoccupied setting");
    expect(prompt).not.toContain("Eyes follow the action");
    expect(prompt).not.toContain("reference image");
  });
});

describe("story 26fdd23f: no writing asked for", () => {
  test("a director's negation about writing leaves the scene, everything else stays", () => {
    expect(withoutTextNegations("The castle playroom opens into a calm, uncluttered background above, with no lettering.")).toBe("The castle playroom opens into a calm, uncluttered background above.");
    expect(withoutTextNegations("A wooden sign with no text stands by the gate. No writing anywhere. Mina waves.")).toBe("A wooden sign stands by the gate. Mina waves.");
    expect(withoutTextNegations("A page without words or numbers lies open; the fox reads it.")).toBe("A page lies open; the fox reads it.");
    expect(withoutTextNegations("Nobody notices the knot.")).toBe("Nobody notices the knot.");
  });

  test("the closing line names only the things in the picture that could carry writing", () => {
    expect(wordlessLine("Mina runs through the meadow.")).toBe("A wordless illustration.");
    expect(wordlessLine("His piece stands on the final square of the game board.")).toContain("The board's squares show only colours");
    const prompt = assembleFlux3ImagePrompt({ scene: "Alexander laughs in the meadow, with no lettering.", onStage: [alex], spriteOrder: [alex] });
    expect(prompt).not.toMatch(/lettering|Books, maps, signs/);
    expect(prompt).toContain("A wordless illustration.");
  });
});

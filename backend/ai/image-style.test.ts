// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { TALEA_IMAGE_STYLE, withTaleaImageStyle } from "./image-style";
import { buildPortraitPrompt, buildScenePrompt } from "../story/library/images";
import { assembleFlux3ImagePrompt, assembleImagePrompt } from "../story/storybook/illustration-stage";
import { buildDokuImagePrompt } from "../doku/doku-images";
import { buildWizardAssetPrompt, WIZARD_ASSET_SPECS } from "./wizard-asset-specs";

describe("one Talea Originals illustration medium", () => {
  test("the shared medium matches both published series and reaches scene, portrait, fallback and tile prompts", () => {
    for (const name of ["bruno-der-flunkerfisch", "die-monster-muellabfuhr"]) {
      const bible = JSON.parse(readFileSync(new URL(`../story/library/seed/series/${name}.bible.json`, import.meta.url), "utf8"));
      expect(TALEA_IMAGE_STYLE).toBe(bible.bible.imageStyleEn);
    }
    const scene = "A small wooden boat beside the garden well.";
    const prompts = [
      buildPortraitPrompt("old concept style", { visualProfileEn: "orange fox with round glasses and green vest" }),
      buildScenePrompt(scene, "old concept style", [], []),
      assembleImagePrompt({ scene, onStage: [], spriteOrder: [], vignette: true }),
      assembleFlux3ImagePrompt({ scene, onStage: [], spriteOrder: [], vignette: true }),
      buildDokuImagePrompt(scene), buildDokuImagePrompt(scene, 1),
      buildWizardAssetPrompt(WIZARD_ASSET_SPECS[0]),
    ];
    for (const prompt of prompts) {
      expect(prompt).toContain(TALEA_IMAGE_STYLE);
      expect(prompt).not.toContain("old concept style");
    }
  });

  test("legacy pool hints yield to the shared medium without losing identity, action or complete captions", () => {
    const identity = "Anna, 6yo girl, green eyes, blonde braids, colorful dress with cardigan and white socks";
    const prompt = withTaleaImageStyle(`${identity}. Axel Scheffler storybook style. Anna reaches for a red apple.`);
    expect(prompt).toContain(TALEA_IMAGE_STYLE);
    expect(prompt).toContain(identity);
    expect(prompt).toContain("Anna reaches for a red apple.");
    expect(prompt).not.toContain("Axel Scheffler");
    expect(withTaleaImageStyle(prompt)).toBe(prompt);
    const caption = `Anna reaches for a red apple.\n${TALEA_IMAGE_STYLE}.`;
    expect(withTaleaImageStyle(caption)).toBe(caption);
    expect(withTaleaImageStyle("")).toBe("");
  });
});

// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { FLUX3_KLEIN_MODEL, runwareImageModelOptions, runwareReferenceSettings, type RunwareReferenceRegion } from "./runware-image-model-options";

describe("Runware image model parameters", () => {
  test("FLUX 3 Klein uses its supported safety and output parameters", () => {
    const options = runwareImageModelOptions({ model: "bfl:flux@3-image-klein", CFGScale: 4, negativePrompt: "extra people", outputFormat: "JPEG" });
    expect(options).toEqual({ outputFormat: "JPG", steps: 16, acceleration: "high", safety: { checkContent: true } });
    expect(options).not.toHaveProperty("CFGScale");
    expect(options).not.toHaveProperty("negativePrompt");
    expect(options).not.toHaveProperty("checkNSFW");
  });

  test("the existing FLUX.2 parameters remain unchanged", () => {
    expect(runwareImageModelOptions({ model: "runware:400@4", CFGScale: 5, steps: 6, negativePrompt: "extra people", outputFormat: "JPEG" }))
      .toEqual({ outputFormat: "JPEG", steps: 6, acceleration: "high", CFGScale: 5, checkNSFW: true, negativePrompt: "extra people" });
  });

  test('two identities bind their own horizontal sheet cells without swapping coordinate axes', () => {
    const regions: RunwareReferenceRegion[] = [
      { id: 'captain', description: 'Captain', referenceIndex: 0, sourceBox: [0, 0, 1000, 500], targetBox: [150, 50, 900, 430] },
      { id: 'child', description: 'Child', referenceIndex: 0, sourceBox: [0, 500, 1000, 1000], targetBox: [200, 550, 950, 970] },
    ];
    const settings = runwareReferenceSettings(FLUX3_KLEIN_MODEL, regions, 2);
    expect(settings).toEqual({ settings: { boundingBoxes: regions } });
    expect(settings.settings?.boundingBoxes[1].sourceBox).toEqual([0, 500, 1000, 1000]);
    expect(settings.settings?.boundingBoxes[0]).not.toBe(regions[0]);
    expect(regions[0].sourceBox).toEqual([0, 0, 1000, 500]);
  });

  test('a redraw can bind the sheet in attachment two instead of the first scene attachment', () => {
    const region: RunwareReferenceRegion = { id: 'child', description: 'Child', referenceIndex: 1, sourceBox: [0, 500, 1000, 1000], targetBox: [100, 400, 900, 900] };
    expect(runwareReferenceSettings(FLUX3_KLEIN_MODEL, [region], 3).settings?.boundingBoxes[0].referenceIndex).toBe(1);
    expect(() => runwareReferenceSettings(FLUX3_KLEIN_MODEL, [region], 1)).toThrow('Referenzregion');
  });

  test('FLUX.2 and requests without bindings never receive unsupported region settings', () => {
    const invalid = [{ id: '', referenceIndex: 9 }] as RunwareReferenceRegion[];
    expect(runwareReferenceSettings('runware:400@2', invalid, 0)).toEqual({});
    expect(runwareReferenceSettings(FLUX3_KLEIN_MODEL, undefined, 2)).toEqual({});
    expect(runwareReferenceSettings(FLUX3_KLEIN_MODEL, [], 2)).toEqual({});
  });

  test('invalid bounds, reference indices and duplicate identity tokens stop before a provider call', () => {
    const region: RunwareReferenceRegion = { id: 'captain', description: 'Captain', referenceIndex: 0, sourceBox: [0, 0, 1000, 500], targetBox: [100, 100, 900, 900] };
    for (const invalid of [
      { ...region, sourceBox: [0, 0, 1001, 500] },
      { ...region, sourceBox: [0, 600, 1000, 500] },
      { ...region, targetBox: [900, 100, 100, 900] },
      { ...region, targetBox: [0, 0, NaN, 900] },
      { ...region, referenceIndex: -1 },
      { ...region, referenceIndex: 0.5 },
    ]) expect(() => runwareReferenceSettings(FLUX3_KLEIN_MODEL, [invalid] as RunwareReferenceRegion[], 2)).toThrow('Referenzregion');
    expect(() => runwareReferenceSettings(FLUX3_KLEIN_MODEL, [region, region], 2)).toThrow('Referenzregion');
  });
});

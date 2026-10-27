// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { runwareImageModelOptions } from "./runware-image-model-options";

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
});

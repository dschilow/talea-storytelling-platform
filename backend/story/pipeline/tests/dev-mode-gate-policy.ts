import assert from "assert";
import { shouldBlockPremiumPotentialGateFailure } from "../dev-mode-gate-policy";

console.log("\n=== dev-mode premium gate policy ===");

{
  const blocks = shouldBlockPremiumPotentialGateFailure({
    qualityMode: "premium",
    debug: false,
  });
  assert.strictEqual(blocks, true, "default premium policy must block weak candidates");
  console.log("  ok default premium policy blocks weak candidates");
}

{
  const blocks = shouldBlockPremiumPotentialGateFailure({
    qualityMode: "premium",
    strictQualityGates: false,
    strictReleaseGateMode: "warn",
    debug: false,
  });
  assert.strictEqual(blocks, false, "explicit warn lane should keep failed candidates inspectable");
  console.log("  ok explicit warn lane stays non-blocking");
}

{
  const blocks = shouldBlockPremiumPotentialGateFailure({
    qualityMode: "premium",
    strictQualityGates: true,
    strictReleaseGateMode: "warn",
    debug: false,
  });
  assert.strictEqual(blocks, true, "strictQualityGates=true must keep premium gate blocking");
  console.log("  ok strictQualityGates keeps premium gate blocking");
}

{
  const blocks = shouldBlockPremiumPotentialGateFailure({
    qualityMode: "premium",
    strictQualityGates: false,
    strictReleaseGateMode: "block",
    debug: false,
  });
  assert.strictEqual(blocks, true, "strictReleaseGateMode=block must keep premium gate blocking");
  console.log("  ok strictReleaseGateMode=block keeps premium gate blocking");
}

{
  const blocks = shouldBlockPremiumPotentialGateFailure({
    qualityMode: "premium",
    strictQualityGates: true,
    strictReleaseGateMode: "block",
    debug: true,
  });
  assert.strictEqual(blocks, false, "debug mode must short-circuit the premium strict-fail");
  console.log("  ok debug mode short-circuits premium strict-fail");
}

{
  const blocks = shouldBlockPremiumPotentialGateFailure({
    qualityMode: "efficient",
    strictQualityGates: true,
    strictReleaseGateMode: "block",
    debug: false,
  });
  assert.strictEqual(blocks, false, "efficient mode should never use the premium blocking policy");
  console.log("  ok efficient mode ignores premium blocking policy");
}

console.log("\nAll premium gate policy checks passed.");

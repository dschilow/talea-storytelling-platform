// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { mock } from "bun:test";
import {
  acceptedGeneratedImageUrl,
  isUsableGeneratedImageResult,
  isUsableGeneratedImageUrl,
} from "../../../helpers/imageResultGuard";
import {
  buildEntityNeutralCompositionPrompt,
  looksLikeEnglishImagePrompt,
} from "../../dev-mode-image-prompt-quality";
import { selectAdaptiveVisualQaCandidates } from "../../dev-mode-visual-qa-selection";
import { buildVisualQaPrompt } from "../../dev-mode-visual-qa";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${label}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

console.log("\n[image-result] failed/SVG results never become illustrations");
{
  const svg = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
  check("SVG URL rejected", !isUsableGeneratedImageUrl(svg));
  check("provider failure rejected", !isUsableGeneratedImageResult({
    imageUrl: "https://cdn.example/failure.jpg",
    debugInfo: { success: false, contentType: "image/jpeg" },
  }));
  check("successful raster accepted", acceptedGeneratedImageUrl({
    imageUrl: "https://cdn.example/image.webp",
    debugInfo: { success: true, contentType: "image/webp" },
  }) === "https://cdn.example/image.webp");
}

console.log("\n[visual-qa] attachment numbering and adaptive risk selection");
{
  const prompt = buildVisualQaPrompt({
    imageUrl: "generated",
    expectedCharacters: [
      { name: "Ari", entityType: "human child", referenceIndex: 1 },
      { name: "Momo", entityType: "orange cat", referenceIndex: 2 },
    ],
    referenceNames: ["Ari", "Momo"],
    scenePrompt: "Ari and Momo inspect a chair.",
  });
  check("generated illustration fixed to attachment #1", /Attachment #1 is the generated illustration/.test(prompt));
  check("first identity maps to attachment #2", /canonical reference #1 = attachment #2/.test(prompt), prompt);
  check("second identity maps to attachment #3", /canonical reference #2 = attachment #3/.test(prompt), prompt);
  check("QA requires explicit figure count", /observedCharacterCount/.test(prompt), prompt);
  check("QA requires OCR transcription", /visibleTextStrings/.test(prompt) && /OCR sweep/.test(prompt), prompt);

  const selected = selectAdaptiveVisualQaCandidates([
    { id: "cover", kind: "cover" as const, expectedCharacterCount: 2, referenceCount: 2, scenePrompt: "Two portraits." },
    { id: "calm", kind: "chapter" as const, order: 1, expectedCharacterCount: 2, referenceCount: 2, scenePrompt: "Two friends stand in a garden." },
    { id: "chair", kind: "chapter" as const, order: 2, expectedCharacterCount: 2, referenceCount: 2, scenePrompt: "One child pulls a chair while a robot reaches under the table." },
  ]);
  check("adaptive budget remains two calls", selected.length === 2, JSON.stringify(selected));
  check("cover is always inspected", selected[0]?.id === "cover", JSON.stringify(selected));
  check("highest-risk interior selected despite two-ref cap", selected[1]?.id === "chair", JSON.stringify(selected));
}

console.log("\n[prompt-quality] English detection and entity-neutral framing");
{
  check("English kitchen prompt is retained", looksLikeEnglishImagePrompt(
    "A warm kitchen glows at dusk while two friends inspect a tiny brass compass."
  ));
  check("German prompt is rejected", !looksLikeEnglishImagePrompt(
    "In der warmen Kueche betrachten die Kinder eine geheimnisvolle Karte."
  ));
  check("umlaut cast name no longer disqualifies an English prompt", looksLikeEnglishImagePrompt(
    "Hexe Kräuterweis lifts her amber lantern while Adrian tugs the heavy leather satchel out of a puddle.",
    ["Hexe Kräuterweis", "Adrian"]
  ));
  check("German prose is still rejected when a cast name is whitelisted", !looksLikeEnglishImagePrompt(
    "Hexe Kräuterweis hebt ihre Laterne und Adrian zieht den schweren Ranzen aus der Pfütze.",
    ["Hexe Kräuterweis", "Adrian"]
  ));
  check("function words inside cast names are never masked", !looksLikeEnglishImagePrompt(
    "Der letzte Wehmueter steht in der Halle und die Kinder folgen ihm langsam.",
    ["Der Letzte Wehmueter"]
  ));
  const composition = buildEntityNeutralCompositionPrompt([
    { name: "Ari", entityType: "human child", sourceKind: "avatar", referenceIndex: 1 },
    { name: "Momo", entityType: "orange tabby cat", sourceKind: "pool", referenceIndex: 2 },
    { name: "Whirl", entityType: "sentient wind without head face neck or limbs", sourceKind: "story" },
  ]);
  check("three-figure left-center-right lock emitted", /exactly three visible characters only/.test(composition) && /Ari, Momo, Whirl/.test(composition), composition);
  check("canonical identity region remains in frame", /canonical identity-defining region fully inside/.test(composition), composition);
  check("non-human full body explicitly required", /complete body[^:]*: Momo/i.test(composition), composition);
  check("canonical joint cropping is forbidden", /Never crop through a canonical head, neck, torso, limb, major joint/.test(composition), composition);
  check("headless entities never receive invented anatomy", /never invent a head, face, neck, limb, or joint/.test(composition), composition);
}

console.log("\n[retry] unusable provider results consume the retry budget instead of skipping the image");
{
  let imageProviderCalls = 0;
  mock.module("~encore/clients", () => ({
    ai: {
      generateImage: async () => {
        imageProviderCalls += 1;
        if (imageProviderCalls === 1) {
          return {
            imageUrl: "",
            debugInfo: {
              success: false,
              errorMessage: "soft provider failure",
              responseReceived: { data: [{ cost: 0.001 }] },
            },
          };
        }
        return {
          imageUrl: "https://cdn.example/recovered.jpg",
          debugInfo: {
            success: true,
            contentType: "image/jpeg",
            responseReceived: { data: [{ cost: 0.002 }] },
          },
        };
      },
    },
  }));
  mock.module("../../../helpers/pubsubTimeout", () => ({
    publishWithTimeout: async () => undefined,
  }));
  mock.module("../../../log/logger", () => ({ logTopic: {} }));
  mock.module("../../../helpers/bucket-storage", () => ({
    resolveImageUrlForClient: async (url: string) => url,
  }));
  mock.module("../reference-images", () => ({
    buildReferenceImages: () => [],
    selectReferenceSlots: () => [],
  }));
  mock.module("../cost-ledger", () => ({
    extractRunwareCostMetrics: (payload: any) => {
      const cost = Number(payload?.data?.[0]?.cost);
      return {
        providerCostUSD: Number.isFinite(cost) ? cost : null,
        providerCostCredits: null,
        matches: Number.isFinite(cost)
          ? [{ path: "data.0.cost", key: "cost", value: cost }]
          : [],
      };
    },
  }));

  const { generateWithRetry } = await import("../image-generator");
  const recovered = await generateWithRetry({
    prompt: "A complete English picture-book scene prompt with clear action.",
    negativePrompt: "duplicate characters",
    referenceImages: [],
    maxRetries: 1,
    retryDelayMs: 0,
  });
  check("soft failure is retried", imageProviderCalls === 2, String(imageProviderCalls));
  check("retry returns recovered raster", recovered.imageUrl === "https://cdn.example/recovered.jpg", String(recovered.imageUrl));
  check("failed and successful provider cost accumulate", recovered.providerCostUSD === 0.003, String(recovered.providerCostUSD));
  check("retry attempts remain visible to accounting", recovered.metadata?.attempts === 2 && recovered.metadata?.rejectedImageResults === 1, JSON.stringify(recovered.metadata));
}
console.log(`\n=== Image pipeline guard results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);

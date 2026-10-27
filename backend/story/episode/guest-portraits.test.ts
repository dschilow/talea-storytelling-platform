// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { MODERN_CHILDRENS_BOOK_STYLE, type VisualEntity } from "../storybook/illustration-stage";
import { generateStorybookImages, type ImageRequest } from "../storybook/images";
import { prepareGuestPortraits } from "./guest-portraits";

const kork: VisualEntity = { id: "kork", name: "Kork", kind: "character", role: "cast", species: "thing", isHuman: false,
  appearance: "Palm-sized brass snail with a round copper shell, broad flat foot, hinged mouth and tiny blue captain's hat", forbidden: [] };
const hero: VisualEntity = { id: "alex", name: "Alexander", kind: "character", role: "hero", species: "human", isHuman: true,
  appearance: "a boy with brown hair", forbidden: [], referenceUrl: "https://example.test/hero.jpg" };

describe("story-local guest portraits", () => {
  test("the same Kork portrait reaches every scene where he appears", async () => {
    const requests: ImageRequest[] = [];
    const prepared = await prepareGuestPortraits({ entities: [hero, kork], guestIds: ["kork"], seed: "story",
      provider: async (request) => { requests.push(request); return { url: "stored:kork", viewUrl: "https://example.test/kork.jpg", costUSD: .002 }; },
      readableReference: async () => undefined,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].prompt).toContain("brass snail");
    expect(requests[0].prompt).not.toContain("standing upright");
    expect(prepared.portraits).toEqual([{ id: "kork", name: "Kork", url: "stored:kork", status: "ready" }]);
    expect(prepared.costUSD).toBe(.002);
    const sheets: string[][] = [];
    const shot = (page: number, onStage: string[]) => ({ page, scene: "A scene in a garden.", onStage, artifactVisible: false });
    await generateStorybookImages({ entities: prepared.entities, seed: "story",
      illustrations: { cover: shot(0, ["alex", "kork"]), pages: [shot(1, ["kork"]), shot(2, ["alex"])] },
      buildReference: async (subjects) => { sheets.push(subjects.map((subject) => subject.imageUrl)); return { urls: ["https://example.test/sheet.jpg"], mode: "sprite", subjects: [] }; },
      provider: async () => ({ url: "https://example.test/scene.jpg" }),
    });
    expect(sheets.filter((sheet) => sheet.includes("https://example.test/kork.jpg"))).toHaveLength(2);
    expect(sheets.some((sheet) => sheet.length === 1 && sheet[0] === hero.referenceUrl)).toBe(true);
  });

  test("failed, unreadable and missing-look portraits preserve the planned appearance and report costs", async () => {
    const short = { ...kork, id: "short", appearance: "snail" };
    const broken = { ...kork, id: "broken" };
    const unreadable = { ...kork, id: "private" };
    const prepared = await prepareGuestPortraits({ entities: [hero, short, broken, unreadable], guestIds: ["short", "broken", "private"], seed: "s",
      provider: async (request) => { if (request.prompt.includes("snail")) throw new Error("offline"); return {}; },
      readableReference: async () => undefined,
    });
    expect(prepared.calls).toBe(2);
    expect(prepared.entities).toEqual([hero, short, broken, unreadable]);
    expect(prepared.portraits.map((p) => p.status)).toEqual(["missing-look", "failed", "failed"]);
    const privateResult = await prepareGuestPortraits({ entities: [unreadable], guestIds: ["private"], seed: "s",
      provider: async () => ({ url: "stored:private", costUSD: .003 }), readableReference: async () => undefined });
    expect(privateResult.portraits[0].status).toBe("unreadable");
    expect(privateResult.costUSD).toBe(.003);
    expect(privateResult.entities[0].appearance).toBe(kork.appearance);
  });

  test("the episode's modern Originals style reaches both guest portraits and the pictures that reuse them", async () => {
    const portraits: ImageRequest[] = [];
    const prepared = await prepareGuestPortraits({ entities: [hero, kork], guestIds: ["kork"], seed: "story", portraitStyle: MODERN_CHILDRENS_BOOK_STYLE,
      provider: async (request) => { portraits.push(request); return { url: "https://example.test/kork.jpg" }; },
      readableReference: async (url) => url,
    });
    expect(portraits[0].prompt).toContain(MODERN_CHILDRENS_BOOK_STYLE);
    const pictures: ImageRequest[] = [];
    const sheet = "https://example.test/identity-sheet.jpg";
    await generateStorybookImages({ entities: prepared.entities, seed: "story", imageStyle: MODERN_CHILDRENS_BOOK_STYLE, imagePromptProfile: "flux3-modern",
      actionDirection: "Characters are engaged in the action.",
      illustrations: { cover: { page: 0, scene: "Alexander and Kork explore the garden.", onStage: ["alex", "kork"], artifactVisible: false }, pages: [] },
      buildReference: async (subjects) => { expect(subjects.map((subject) => subject.displayName)).toEqual(["Alexander", "Kork"]); return { urls: [sheet], mode: "sprite", subjects: [] }; },
      provider: async (request) => { pictures.push(request); return { url: "https://example.test/scene.jpg" }; },
    });
    expect(pictures).toHaveLength(1);
    expect(pictures[0].prompt).toContain(MODERN_CHILDRENS_BOOK_STYLE);
    expect(pictures[0].prompt).toContain("Characters are engaged in the action.");
    expect(pictures[0].referenceImages).toEqual([sheet]);
  });

  test("a QA-triggered Flux 3 redraw keeps the modern style, full scene and a single identity sheet", async () => {
    const requests: ImageRequest[] = [];
    const withKork = { ...kork, referenceUrl: "https://example.test/kork.jpg" };
    const clean = { characterCounts: { Alexander: 1, Kork: 1 }, anatomyDefects: [], duplicates: [], unexpectedCharacters: [], identityMatch: .95, sceneMatch: .95 };
    const scene = `Alexander watches Kork. ${"Leaves frame the edge of the window. ".repeat(20)}Kork carefully raises his blue captain's hat.`;
    const result = await generateStorybookImages({ entities: [hero, withKork], seed: "story", imageStyle: MODERN_CHILDRENS_BOOK_STYLE, imagePromptProfile: "flux3-modern",
      illustrations: { cover: { page: 0, scene, onStage: ["alex", "kork"], artifactVisible: false }, pages: [] },
      buildReference: async () => ({ urls: ["https://example.test/sheet.jpg"], mode: "sprite", subjects: [] }),
      provider: async (request) => { requests.push(request); return { url: `https://example.test/${requests.length}.jpg` }; },
      visionModel: "test", llm: async (request) => ({ text: JSON.stringify(request.stage.endsWith("-1") ? { ...clean, duplicates: ["Alexander appears twice"] } : clean), modelUsed: request.model, usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 }, durationMs: 1 }),
    });
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.prompt.includes(MODERN_CHILDRENS_BOOK_STYLE))).toBe(true);
    expect(requests[0].prompt).toContain(scene);
    expect(requests.every((request) => request.referenceImages.length === 1)).toBe(true);
    expect(result.regenerated).toEqual([0]);
    expect(result.cover?.status).toBe("passed");
  });
});

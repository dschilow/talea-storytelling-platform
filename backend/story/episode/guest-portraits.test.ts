// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import type { VisualEntity } from "../storybook/illustration-stage";
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
});

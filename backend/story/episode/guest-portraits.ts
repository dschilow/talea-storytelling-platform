import { figurePortraitRequest, portraitLook } from "../storybook/book/illustrations";
import type { VisualEntity } from "../storybook/illustration-stage";
import type { ImageProvider } from "../storybook/images";

/** Create story-local identities for the explicitly planned new cast, never for pool figures or heroes. */
export async function prepareGuestPortraits(input: {
  entities: VisualEntity[];
  guestIds: string[];
  provider: ImageProvider;
  seed: string;
  readableReference: (url: string) => Promise<string | undefined>;
}): Promise<{
  entities: VisualEntity[];
  portraits: Array<{ id: string; name: string; url?: string; status: "ready" | "failed" | "missing-look" | "unreadable" }>;
  calls: number;
  costUSD: number;
}> {
  const guests = new Set(input.guestIds);
  const portraits: Array<{ id: string; name: string; url?: string; status: "ready" | "failed" | "missing-look" | "unreadable" }> = [];
  let calls = 0;
  let costUSD = 0;
  const entities = await Promise.all(input.entities.map(async (entity) => {
    if (!guests.has(entity.id) || entity.kind !== "character" || entity.role !== "cast" || entity.referenceUrl) return entity;
    if (portraitLook(entity).look.length < 10) {
      portraits.push({ id: entity.id, name: entity.name, status: "missing-look" });
      return entity;
    }
    calls++;
    try {
      const response = await input.provider(figurePortraitRequest(entity, input.seed));
      costUSD += Number.isFinite(response.costUSD) ? Number(response.costUSD) : 0;
      if (!response.url) {
        portraits.push({ id: entity.id, name: entity.name, status: "failed" });
        return entity;
      }
      const referenceUrl = response.viewUrl || await input.readableReference(response.url);
      if (!referenceUrl) {
        portraits.push({ id: entity.id, name: entity.name, url: response.url, status: "unreadable" });
        return entity;
      }
      portraits.push({ id: entity.id, name: entity.name, url: response.url, status: "ready" });
      return { ...entity, referenceUrl, referenceKey: response.url };
    } catch {
      portraits.push({ id: entity.id, name: entity.name, status: "failed" });
      return entity;
    }
  }));
  portraits.sort((a, b) => input.entities.findIndex((entity) => entity.id === a.id) - input.entities.findIndex((entity) => entity.id === b.id));
  return { entities, portraits, calls, costUSD: Number(costUSD.toFixed(6)) };
}

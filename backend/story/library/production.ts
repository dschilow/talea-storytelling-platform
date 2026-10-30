/**
 * Pictures for a written episode: guest portraits first (every later picture
 * uses them as reference), then cover and chapter pictures in parallel.
 * Encore-free; storage and Runware are ports.
 */

import { drawPortrait, drawScene, type ReferenceLoader, type RunwareCaller } from "./images";
import type { EpisodeContent, SeriesCharacter } from "./types";
import { chapterImages, slotOf, withSlotUrl, type SlotRef } from "./image-slots";
export { slotOf, type SlotRef } from "./image-slots";

export interface IllustrationPorts {
  call: RunwareCaller;
  load: ReferenceLoader;
  /** Keeps a provider URL for good (bucket upload) and returns the URL to store. */
  store: (imageUrl: string, key: string) => Promise<string>;
}

export interface IllustrationContext {
  style: string;
  characters: SeriesCharacter[];
  /** Storage prefix, e.g. "library/bruno-der-flunkerfisch/s1e2". */
  keyPrefix: string;
  ports: IllustrationPorts;
}

export interface IllustrationResult {
  content: EpisodeContent;
  costUSD: number;
  issues: string[];
}

async function drawSlot(content: EpisodeContent, slot: SlotRef, context: IllustrationContext): Promise<{ url: string; costUSD: number }> {
  const target = slotOf(content, slot);
  if (!target) throw new Error("No picture planned for this slot.");
  const drawn = await drawScene(target, { style: context.style, characters: context.characters, guests: content.guests, load: context.ports.load, call: context.ports.call });
  const key = slot === "cover" ? "cover" : typeof slot === "number" ? `ch${slot + 1}` : `ch${slot.chapter + 1}-${slot.image + 1}`;
  const url = await context.ports.store(drawn.imageUrl, `${context.keyPrefix}/${key}-${Date.now()}`);
  return { url, costUSD: drawn.costUSD };
}

/** The card shows the guest of the week (the monster, the pony-dog) or else the second chapter's picture. */
function collectiblePicture(content: EpisodeContent): string | undefined {
  return content.guests.find((guest) => guest.referenceUrl)?.referenceUrl || content.chapters[1]?.image?.url || content.cover.url;
}

export async function illustrateEpisode(content: EpisodeContent, context: IllustrationContext): Promise<IllustrationResult> {
  let next: EpisodeContent = { ...content, guests: [...content.guests] };
  let costUSD = 0;
  const issues: string[] = [];

  for (const [index, guest] of next.guests.entries()) {
    if (guest.referenceUrl) continue;
    try {
      const drawn = await drawPortrait({ id: guest.id, name: guest.name, visualProfileEn: guest.visualProfileEn }, context.style, context.ports.call);
      costUSD += drawn.costUSD;
      const url = await context.ports.store(drawn.imageUrl, `${context.keyPrefix}/guest-${guest.id}-${Date.now()}`);
      next.guests[index] = { ...guest, referenceUrl: url };
    } catch (error) {
      issues.push(`Porträt ${guest.name}: ${(error as Error)?.message || error}`);
    }
  }

  const slots: SlotRef[] = ["cover", ...next.chapters.flatMap((chapter, chapterIndex) => chapterImages(chapter).map((_, imageIndex) => imageIndex === 0 ? chapterIndex : { chapter: chapterIndex, image: imageIndex }))];
  const results = await Promise.allSettled(slots.map((slot) => drawSlot(next, slot, context)));
  results.forEach((result, index) => {
    const slot = slots[index];
    if (result.status === "fulfilled") {
      costUSD += result.value.costUSD;
      next = withSlotUrl(next, slot, result.value.url);
    } else {
      const label = slot === "cover" ? "Cover" : typeof slot === "number" ? `Kapitel ${slot + 1}` : `Kapitel ${slot.chapter + 1}, Bild ${slot.image + 1}`;
      issues.push(`${label}: ${(result.reason as Error)?.message || result.reason}`);
    }
  });

  next = { ...next, collectible: { ...next.collectible, imageUrl: collectiblePicture(next) } };
  return { content: next, costUSD, issues };
}

export async function redrawPicture(content: EpisodeContent, slot: SlotRef, context: IllustrationContext): Promise<IllustrationResult> {
  const { url, costUSD } = await drawSlot(content, slot, context);
  let next = withSlotUrl(content, slot, url);
  next = { ...next, collectible: { ...next.collectible, imageUrl: next.collectible.imageUrl || collectiblePicture(next) } };
  return { content: next, costUSD, issues: [] };
}

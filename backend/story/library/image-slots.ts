import type { EpisodeChapter, EpisodeContent, ImageSlot } from "./types";

/** Older episodes carry one image. New chapters keep every illustration in reading order. */
export function chapterImages(chapter: EpisodeChapter): ImageSlot[] {
  return chapter.images?.length ? chapter.images : chapter.image ? [chapter.image] : [];
}

export type SlotRef = "cover" | number | { chapter: number; image: number };

/** Public editor ids are one-based: '2' is the first image in chapter 2; '2:2' its second. */
export function parseImageSlot(value: string, content: EpisodeContent): SlotRef | null {
  if (value === "cover") return "cover";
  const match = /^(\d+)(?::(\d+))?$/.exec(value);
  if (!match) return null;
  const chapter = Number(match[1]) - 1;
  const image = Number(match[2] || 1) - 1;
  if (!content.chapters[chapter] || !chapterImages(content.chapters[chapter])[image]) return null;
  return image === 0 ? chapter : { chapter, image };
}

export function slotOf(content: EpisodeContent, slot: SlotRef): ImageSlot | undefined {
  if (slot === "cover") return content.cover;
  const { chapter, image } = typeof slot === "number" ? { chapter: slot, image: 0 } : slot;
  return content.chapters[chapter] && chapterImages(content.chapters[chapter])[image];
}

export function withSlotUrl(content: EpisodeContent, slot: SlotRef, url: string): EpisodeContent {
  if (slot === "cover") return { ...content, cover: { ...content.cover, url } };
  const { chapter, image } = typeof slot === "number" ? { chapter: slot, image: 0 } : slot;
  return {
    ...content,
    chapters: content.chapters.map((entry, index) => {
      if (index !== chapter) return entry;
      const images = chapterImages(entry).map((picture, pictureIndex) => pictureIndex === image ? { ...picture, url } : picture);
      return { ...entry, images, image: images[0] };
    }),
  };
}

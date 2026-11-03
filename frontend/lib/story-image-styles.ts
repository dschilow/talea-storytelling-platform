import type { StoryImageStyleId } from '../../backend/ai/image-style';

export type { StoryImageStyleId };
export const DEFAULT_STORY_IMAGE_STYLE: StoryImageStyleId = 'talea-originals';

export const STORY_IMAGE_STYLE_OPTIONS: ReadonlyArray<{ id: StoryImageStyleId; image: string }> = [
  { id: 'talea-originals', image: '/library/series/bruno-der-flunkerfisch/s1e3/cover.webp' },
  { id: 'colored-pencil', image: '/library/image-styles/colored-pencil.webp' },
  { id: 'painterly-adventure', image: '/library/image-styles/painterly-adventure-v2.webp' },
];

export function storyImageStyleOption(id?: StoryImageStyleId) {
  return STORY_IMAGE_STYLE_OPTIONS.find(option => option.id === id) || STORY_IMAGE_STYLE_OPTIONS[0];
}

import type { Story } from '../types/story';

const toId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const extractStoryParticipantIds = (story: Story | null | undefined): string[] => {
  if (!story) {
    return [];
  }

  const ids = new Set<string>();
  const config = story.config as (Story['config'] & { avatarIds?: unknown }) | undefined;

  const addFromList = (items: unknown) => {
    if (!Array.isArray(items)) {
      return;
    }

    for (const entry of items) {
      if (typeof entry === 'string') {
        const id = toId(entry);
        if (id) {
          ids.add(id);
        }
        continue;
      }

      if (entry && typeof entry === 'object') {
        const id = toId((entry as { id?: unknown }).id);
        if (id) {
          ids.add(id);
        }
      }
    }
  };

  addFromList(story.avatarParticipants);
  addFromList(config?.avatars);
  addFromList(config?.avatarIds);

  return Array.from(ids);
};

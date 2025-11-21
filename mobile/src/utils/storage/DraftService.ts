import { StorageUtil } from './AsyncStorageUtil';

/**
 * Service for managing story drafts
 */

export interface StoryDraft {
  id: string;
  title: string;
  genre?: string;
  setting?: string;
  theme?: string;
  ageGroup?: string;
  chapterCount?: number;
  selectedAvatars?: string[];
  lastModified: Date;
}

export class DraftService {
  private static readonly DRAFTS_KEY = 'storyDrafts';

  /**
   * Save a story draft
   */
  static async saveDraft(draft: Omit<StoryDraft, 'id' | 'lastModified'>): Promise<string> {
    try {
      const drafts = await this.getDrafts();

      // Generate ID if new draft
      const draftId = Date.now().toString();
      const newDraft: StoryDraft = {
        ...draft,
        id: draftId,
        lastModified: new Date(),
      };

      drafts.push(newDraft);
      await StorageUtil.saveSetting(this.DRAFTS_KEY, drafts);

      return draftId;
    } catch (error) {
      console.error('Error saving draft:', error);
      throw error;
    }
  }

  /**
   * Update existing draft
   */
  static async updateDraft(
    draftId: string,
    updates: Partial<Omit<StoryDraft, 'id'>>
  ): Promise<void> {
    try {
      const drafts = await this.getDrafts();
      const index = drafts.findIndex((d) => d.id === draftId);

      if (index === -1) {
        throw new Error('Draft not found');
      }

      drafts[index] = {
        ...drafts[index],
        ...updates,
        lastModified: new Date(),
      };

      await StorageUtil.saveSetting(this.DRAFTS_KEY, drafts);
    } catch (error) {
      console.error('Error updating draft:', error);
      throw error;
    }
  }

  /**
   * Get all drafts
   */
  static async getDrafts(): Promise<StoryDraft[]> {
    try {
      const drafts = await StorageUtil.loadSetting<StoryDraft[]>(this.DRAFTS_KEY, []);
      return drafts.sort(
        (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
    } catch (error) {
      console.error('Error loading drafts:', error);
      return [];
    }
  }

  /**
   * Get single draft by ID
   */
  static async getDraft(draftId: string): Promise<StoryDraft | null> {
    try {
      const drafts = await this.getDrafts();
      return drafts.find((d) => d.id === draftId) || null;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }

  /**
   * Delete a draft
   */
  static async deleteDraft(draftId: string): Promise<void> {
    try {
      const drafts = await this.getDrafts();
      const filtered = drafts.filter((d) => d.id !== draftId);
      await StorageUtil.saveSetting(this.DRAFTS_KEY, filtered);
    } catch (error) {
      console.error('Error deleting draft:', error);
      throw error;
    }
  }

  /**
   * Clear all drafts
   */
  static async clearAllDrafts(): Promise<void> {
    try {
      await StorageUtil.saveSetting(this.DRAFTS_KEY, []);
    } catch (error) {
      console.error('Error clearing drafts:', error);
      throw error;
    }
  }

  /**
   * Get draft count
   */
  static async getDraftCount(): Promise<number> {
    const drafts = await this.getDrafts();
    return drafts.length;
  }
}

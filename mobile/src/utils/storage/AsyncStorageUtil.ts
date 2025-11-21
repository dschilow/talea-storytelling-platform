import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage utility for offline data persistence
 */

export class StorageUtil {
  // Avatar cache
  static async saveAvatars(avatars: any[]) {
    try {
      await AsyncStorage.setItem('cached_avatars', JSON.stringify(avatars));
    } catch (error) {
      console.error('Failed to save avatars to cache:', error);
    }
  }

  static async loadAvatars(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem('cached_avatars');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load avatars from cache:', error);
      return [];
    }
  }

  // Story cache
  static async saveStories(stories: any[]) {
    try {
      await AsyncStorage.setItem('cached_stories', JSON.stringify(stories));
    } catch (error) {
      console.error('Failed to save stories to cache:', error);
    }
  }

  static async loadStories(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem('cached_stories');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load stories from cache:', error);
      return [];
    }
  }

  // Settings
  static async saveSetting(key: string, value: any) {
    try {
      await AsyncStorage.setItem(`setting_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
    }
  }

  static async loadSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const data = await AsyncStorage.getItem(`setting_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error(`Failed to load setting ${key}:`, error);
      return defaultValue;
    }
  }

  // Clear all cache
  static async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith('cached_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // Get cache size
  static async getCacheSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith('cached_'));
      const items = await AsyncStorage.multiGet(cacheKeys);

      let totalSize = 0;
      items.forEach(([, value]) => {
        if (value) {
          totalSize += new Blob([value]).size;
        }
      });

      return totalSize;
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  }
}

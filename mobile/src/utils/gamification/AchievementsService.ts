import { StorageUtil } from '@/utils/storage/AsyncStorageUtil';
import { NotificationService } from '@/utils/notifications/NotificationService';

/**
 * Achievement types and gamification service
 */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'creator' | 'explorer' | 'storyteller' | 'collector' | 'social';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  requirement: number;
  reward?: {
    type: 'xp' | 'badge' | 'unlock';
    value: number;
  };
  unlockedAt?: Date;
}

export interface UserStats {
  totalStories: number;
  totalAvatars: number;
  totalReads: number;
  storiesShared: number;
  fairyTalesCompleted: number;
  consecutiveDays: number;
  lastActiveDate?: string;
  totalXP: number;
  level: number;
  achievements: string[]; // Achievement IDs
}

export interface AvatarStats {
  avatarId: string;
  storiesParticipated: number;
  personalityPoints: number;
  level: number;
  xp: number;
  traits: Record<string, number>;
  memoriesCreated: number;
  favoriteGenre?: string;
}

export class AchievementsService {
  private static readonly ACHIEVEMENTS: Achievement[] = [
    // Creator Achievements
    {
      id: 'first_avatar',
      title: 'Charaktererschaffer',
      description: 'Erstelle deinen ersten Avatar',
      icon: '👤',
      category: 'creator',
      tier: 'bronze',
      requirement: 1,
      reward: { type: 'xp', value: 100 },
    },
    {
      id: 'avatar_collector',
      title: 'Charaktersammler',
      description: 'Erstelle 5 Avatare',
      icon: '👥',
      category: 'creator',
      tier: 'silver',
      requirement: 5,
      reward: { type: 'xp', value: 250 },
    },
    {
      id: 'avatar_master',
      title: 'Charaktermeister',
      description: 'Erstelle 10 Avatare',
      icon: '🎭',
      category: 'creator',
      tier: 'gold',
      requirement: 10,
      reward: { type: 'xp', value: 500 },
    },

    // Storyteller Achievements
    {
      id: 'first_story',
      title: 'Geschichtenerzähler',
      description: 'Erstelle deine erste Geschichte',
      icon: '📖',
      category: 'storyteller',
      tier: 'bronze',
      requirement: 1,
      reward: { type: 'xp', value: 100 },
    },
    {
      id: 'story_writer',
      title: 'Geschichtenschreiber',
      description: 'Erstelle 5 Geschichten',
      icon: '📚',
      category: 'storyteller',
      tier: 'silver',
      requirement: 5,
      reward: { type: 'xp', value: 250 },
    },
    {
      id: 'story_master',
      title: 'Literaturmeister',
      description: 'Erstelle 10 Geschichten',
      icon: '✍️',
      category: 'storyteller',
      tier: 'gold',
      requirement: 10,
      reward: { type: 'xp', value: 500 },
    },
    {
      id: 'epic_writer',
      title: 'Epischer Autor',
      description: 'Erstelle 25 Geschichten',
      icon: '🏆',
      category: 'storyteller',
      tier: 'platinum',
      requirement: 25,
      reward: { type: 'xp', value: 1000 },
    },

    // Explorer Achievements
    {
      id: 'fairy_tale_reader',
      title: 'Märchenleser',
      description: 'Lese ein Märchen',
      icon: '✨',
      category: 'explorer',
      tier: 'bronze',
      requirement: 1,
      reward: { type: 'xp', value: 50 },
    },
    {
      id: 'fairy_tale_explorer',
      title: 'Märchenforscher',
      description: 'Lese 5 Märchen',
      icon: '🌟',
      category: 'explorer',
      tier: 'silver',
      requirement: 5,
      reward: { type: 'xp', value: 150 },
    },
    {
      id: 'fairy_tale_master',
      title: 'Märchenmeister',
      description: 'Lese 10 Märchen',
      icon: '🎪',
      category: 'explorer',
      tier: 'gold',
      requirement: 10,
      reward: { type: 'xp', value: 300 },
    },

    // Social Achievements
    {
      id: 'first_share',
      title: 'Teiler',
      description: 'Teile deine erste Geschichte',
      icon: '📤',
      category: 'social',
      tier: 'bronze',
      requirement: 1,
      reward: { type: 'xp', value: 50 },
    },
    {
      id: 'social_butterfly',
      title: 'Sozialer Schmetterling',
      description: 'Teile 10 Geschichten',
      icon: '🦋',
      category: 'social',
      tier: 'silver',
      requirement: 10,
      reward: { type: 'xp', value: 200 },
    },

    // Collector Achievements
    {
      id: 'daily_streak_7',
      title: 'Wöchentlicher Besucher',
      description: '7 Tage in Folge aktiv',
      icon: '🔥',
      category: 'collector',
      tier: 'bronze',
      requirement: 7,
      reward: { type: 'xp', value: 100 },
    },
    {
      id: 'daily_streak_30',
      title: 'Monatlicher Champion',
      description: '30 Tage in Folge aktiv',
      icon: '🏅',
      category: 'collector',
      tier: 'gold',
      requirement: 30,
      reward: { type: 'xp', value: 500 },
    },
  ];

  /**
   * Get all achievements
   */
  static getAllAchievements(): Achievement[] {
    return this.ACHIEVEMENTS;
  }

  /**
   * Get achievements by category
   */
  static getAchievementsByCategory(category: Achievement['category']): Achievement[] {
    return this.ACHIEVEMENTS.filter((a) => a.category === category);
  }

  /**
   * Get user stats from storage
   */
  static async getUserStats(): Promise<UserStats> {
    const stats = await StorageUtil.loadSetting<UserStats>('userStats', {
      totalStories: 0,
      totalAvatars: 0,
      totalReads: 0,
      storiesShared: 0,
      fairyTalesCompleted: 0,
      consecutiveDays: 0,
      totalXP: 0,
      level: 1,
      achievements: [],
    });

    // Update consecutive days
    await this.updateConsecutiveDays(stats);

    return stats;
  }

  /**
   * Save user stats to storage
   */
  static async saveUserStats(stats: UserStats): Promise<void> {
    await StorageUtil.saveSetting('userStats', stats);
  }

  /**
   * Track story creation
   */
  static async trackStoryCreated(): Promise<void> {
    const stats = await this.getUserStats();
    stats.totalStories++;
    await this.checkAndUnlockAchievements(stats);
    await this.addXP(stats, 50);
    await this.saveUserStats(stats);
  }

  /**
   * Track avatar creation
   */
  static async trackAvatarCreated(): Promise<void> {
    const stats = await this.getUserStats();
    stats.totalAvatars++;
    await this.checkAndUnlockAchievements(stats);
    await this.addXP(stats, 25);
    await this.saveUserStats(stats);
  }

  /**
   * Track fairy tale read
   */
  static async trackFairyTaleRead(): Promise<void> {
    const stats = await this.getUserStats();
    stats.fairyTalesCompleted++;
    await this.checkAndUnlockAchievements(stats);
    await this.addXP(stats, 10);
    await this.saveUserStats(stats);
  }

  /**
   * Track story share
   */
  static async trackStoryShared(): Promise<void> {
    const stats = await this.getUserStats();
    stats.storiesShared++;
    await this.checkAndUnlockAchievements(stats);
    await this.addXP(stats, 15);
    await this.saveUserStats(stats);
  }

  /**
   * Add XP and check for level up
   */
  private static async addXP(stats: UserStats, amount: number): Promise<void> {
    const oldLevel = stats.level;
    stats.totalXP += amount;

    // Calculate level based on XP (every 1000 XP = 1 level)
    const newLevel = Math.floor(stats.totalXP / 1000) + 1;

    if (newLevel > oldLevel) {
      stats.level = newLevel;
      // Notify user of level up
      await NotificationService.notifyAvatarLevelUp('Du', newLevel);
    }
  }

  /**
   * Check and unlock achievements
   */
  private static async checkAndUnlockAchievements(stats: UserStats): Promise<void> {
    for (const achievement of this.ACHIEVEMENTS) {
      // Skip if already unlocked
      if (stats.achievements.includes(achievement.id)) {
        continue;
      }

      // Check if requirement is met
      let currentValue = 0;
      switch (achievement.id) {
        case 'first_avatar':
        case 'avatar_collector':
        case 'avatar_master':
          currentValue = stats.totalAvatars;
          break;
        case 'first_story':
        case 'story_writer':
        case 'story_master':
        case 'epic_writer':
          currentValue = stats.totalStories;
          break;
        case 'fairy_tale_reader':
        case 'fairy_tale_explorer':
        case 'fairy_tale_master':
          currentValue = stats.fairyTalesCompleted;
          break;
        case 'first_share':
        case 'social_butterfly':
          currentValue = stats.storiesShared;
          break;
        case 'daily_streak_7':
        case 'daily_streak_30':
          currentValue = stats.consecutiveDays;
          break;
      }

      if (currentValue >= achievement.requirement) {
        await this.unlockAchievement(stats, achievement);
      }
    }
  }

  /**
   * Unlock an achievement
   */
  private static async unlockAchievement(stats: UserStats, achievement: Achievement): Promise<void> {
    stats.achievements.push(achievement.id);

    // Award reward
    if (achievement.reward) {
      if (achievement.reward.type === 'xp') {
        await this.addXP(stats, achievement.reward.value);
      }
    }

    // Notify user
    await NotificationService.notifyNewAchievement(achievement.title);
  }

  /**
   * Get unlocked achievements
   */
  static async getUnlockedAchievements(): Promise<Achievement[]> {
    const stats = await this.getUserStats();
    return this.ACHIEVEMENTS.filter((a) => stats.achievements.includes(a.id)).map((a) => ({
      ...a,
      unlockedAt: new Date(), // Would be stored in real implementation
    }));
  }

  /**
   * Get locked achievements
   */
  static async getLockedAchievements(): Promise<Achievement[]> {
    const stats = await this.getUserStats();
    return this.ACHIEVEMENTS.filter((a) => !stats.achievements.includes(a.id));
  }

  /**
   * Get achievement progress
   */
  static async getAchievementProgress(achievementId: string): Promise<number> {
    const achievement = this.ACHIEVEMENTS.find((a) => a.id === achievementId);
    if (!achievement) return 0;

    const stats = await this.getUserStats();
    let currentValue = 0;

    // Determine current value based on achievement type
    if (achievementId.includes('avatar')) {
      currentValue = stats.totalAvatars;
    } else if (achievementId.includes('story')) {
      currentValue = stats.totalStories;
    } else if (achievementId.includes('fairy')) {
      currentValue = stats.fairyTalesCompleted;
    } else if (achievementId.includes('share')) {
      currentValue = stats.storiesShared;
    } else if (achievementId.includes('streak')) {
      currentValue = stats.consecutiveDays;
    }

    return Math.min(currentValue / achievement.requirement, 1);
  }

  /**
   * Update consecutive days streak
   */
  private static async updateConsecutiveDays(stats: UserStats): Promise<void> {
    const today = new Date().toDateString();
    const lastActive = stats.lastActiveDate;

    if (lastActive === today) {
      // Already counted today
      return;
    }

    if (!lastActive) {
      // First time
      stats.consecutiveDays = 1;
      stats.lastActiveDate = today;
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (lastActive === yesterdayStr) {
      // Consecutive day
      stats.consecutiveDays++;
    } else {
      // Streak broken
      stats.consecutiveDays = 1;
    }

    stats.lastActiveDate = today;
  }
}

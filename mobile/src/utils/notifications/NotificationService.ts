import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { StorageUtil } from '@/utils/storage/AsyncStorageUtil';

/**
 * Notification Service for handling push notifications
 */

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  /**
   * Request notification permissions from the user
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
      }

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Talea Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#8b5cf6', // Lavender color
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
        });
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled in settings
   */
  static async areNotificationsEnabled(): Promise<boolean> {
    const enabled = await StorageUtil.loadSetting('notifications', true);
    return enabled;
  }

  /**
   * Schedule a local notification
   */
  static async scheduleNotification(
    title: string,
    body: string,
    data?: any,
    delay: number = 0
  ): Promise<string | null> {
    try {
      // Check if notifications are enabled
      const enabled = await this.areNotificationsEnabled();
      if (!enabled) {
        console.log('Notifications disabled in settings');
        return null;
      }

      // Check permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('No notification permission');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          badge: 1,
        },
        trigger: delay > 0 ? { seconds: delay } : null,
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Send a notification for a completed story
   */
  static async notifyStoryComplete(storyTitle: string, storyId: string): Promise<void> {
    await this.scheduleNotification(
      '✨ Geschichte fertig!',
      `"${storyTitle}" ist bereit zum Lesen!`,
      { type: 'story_complete', storyId }
    );
  }

  /**
   * Send a notification for avatar level up
   */
  static async notifyAvatarLevelUp(avatarName: string, newLevel: number): Promise<void> {
    await this.scheduleNotification(
      '🎉 Avatar aufgestiegen!',
      `${avatarName} ist jetzt Level ${newLevel}!`,
      { type: 'avatar_level_up', avatarName, newLevel }
    );
  }

  /**
   * Send a notification for new achievement
   */
  static async notifyNewAchievement(achievementName: string): Promise<void> {
    await this.scheduleNotification(
      '🏆 Neuer Erfolg!',
      `Du hast "${achievementName}" freigeschaltet!`,
      { type: 'achievement', achievementName }
    );
  }

  /**
   * Cancel a scheduled notification
   */
  static async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  static async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  /**
   * Get badge count
   */
  static async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Set badge count
   */
  static async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  /**
   * Clear badge count
   */
  static async clearBadgeCount(): Promise<void> {
    await this.setBadgeCount(0);
  }

  /**
   * Add notification received listener
   */
  static addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Add notification response listener (when user taps notification)
   */
  static addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

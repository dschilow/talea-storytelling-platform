import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { NotificationService } from '@/utils/notifications/NotificationService';

/**
 * Hook for managing notifications in React components
 */
export const useNotifications = () => {
  const navigation = useNavigation();
  const [hasPermission, setHasPermission] = useState(false);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Request permissions on mount
    requestPermissions();

    // Setup notification listeners
    setupListeners();

    // Cleanup on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const requestPermissions = async () => {
    const granted = await NotificationService.requestPermissions();
    setHasPermission(granted);
  };

  const setupListeners = () => {
    // Handle notification received while app is in foreground
    notificationListener.current = NotificationService.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        // Clear badge when notification is received
        NotificationService.clearBadgeCount();
      }
    );

    // Handle notification tapped/opened
    responseListener.current = NotificationService.addNotificationResponseListener(
      (response) => {
        const data = response.notification.request.content.data;
        handleNotificationResponse(data);
      }
    );
  };

  const handleNotificationResponse = (data: any) => {
    // Navigate based on notification type
    if (data.type === 'story_complete' && data.storyId) {
      // Navigate to story reader
      navigation.navigate('StoryReader' as never, { storyId: data.storyId } as never);
    } else if (data.type === 'avatar_level_up' && data.avatarName) {
      // Navigate to avatars screen
      navigation.navigate('MainTabs' as never, { screen: 'Avatars' } as never);
    } else if (data.type === 'achievement') {
      // Navigate to profile/achievements screen
      navigation.navigate('MainTabs' as never, { screen: 'Profile' } as never);
    }
  };

  return {
    hasPermission,
    requestPermissions,
    scheduleNotification: NotificationService.scheduleNotification.bind(NotificationService),
    notifyStoryComplete: NotificationService.notifyStoryComplete.bind(NotificationService),
    notifyAvatarLevelUp: NotificationService.notifyAvatarLevelUp.bind(NotificationService),
    notifyNewAchievement: NotificationService.notifyNewAchievement.bind(NotificationService),
    cancelNotification: NotificationService.cancelNotification.bind(NotificationService),
    cancelAllNotifications: NotificationService.cancelAllNotifications.bind(NotificationService),
    setBadgeCount: NotificationService.setBadgeCount.bind(NotificationService),
    clearBadgeCount: NotificationService.clearBadgeCount.bind(NotificationService),
  };
};

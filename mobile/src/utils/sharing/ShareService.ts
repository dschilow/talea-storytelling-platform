import { Share, Alert, Platform } from 'react-native';

/**
 * Service for sharing stories and content
 */

export interface StoryShareOptions {
  storyId: string;
  title: string;
  excerpt?: string;
  url?: string;
}

export interface AvatarShareOptions {
  avatarId: string;
  name: string;
  imageUrl?: string;
}

export class ShareService {
  /**
   * Share a story with native share dialog
   */
  static async shareStory(options: StoryShareOptions): Promise<boolean> {
    try {
      const message = this.buildStoryShareMessage(options);
      const result = await Share.share(
        {
          message,
          title: options.title,
          url: options.url,
        },
        {
          dialogTitle: 'Geschichte teilen',
          subject: options.title, // For email sharing
        }
      );

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with specific activity type
          console.log('Shared via:', result.activityType);
        } else {
          // Shared successfully
          console.log('Story shared successfully');
        }
        return true;
      } else if (result.action === Share.dismissedAction) {
        // Share dialog was dismissed
        console.log('Share dismissed');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error sharing story:', error);
      Alert.alert('Fehler', 'Geschichte konnte nicht geteilt werden');
      return false;
    }
  }

  /**
   * Share an avatar
   */
  static async shareAvatar(options: AvatarShareOptions): Promise<boolean> {
    try {
      const message = this.buildAvatarShareMessage(options);
      const result = await Share.share(
        {
          message,
          title: `Avatar: ${options.name}`,
        },
        {
          dialogTitle: 'Avatar teilen',
        }
      );

      return result.action === Share.sharedAction;
    } catch (error) {
      console.error('Error sharing avatar:', error);
      Alert.alert('Fehler', 'Avatar konnte nicht geteilt werden');
      return false;
    }
  }

  /**
   * Share app with referral message
   */
  static async shareApp(): Promise<boolean> {
    try {
      const message = this.buildAppShareMessage();
      const result = await Share.share(
        {
          message,
          title: 'Talea - KI-gestützte Geschichten',
        },
        {
          dialogTitle: 'Talea App teilen',
        }
      );

      return result.action === Share.sharedAction;
    } catch (error) {
      console.error('Error sharing app:', error);
      Alert.alert('Fehler', 'App konnte nicht geteilt werden');
      return false;
    }
  }

  /**
   * Build share message for a story
   */
  private static buildStoryShareMessage(options: StoryShareOptions): string {
    let message = `📖 ${options.title}\n\n`;

    if (options.excerpt) {
      message += `${options.excerpt}\n\n`;
    }

    message += `Erstellt mit Talea - Der KI-gestützten Storytelling-App ✨\n`;

    if (options.url) {
      message += `\n${options.url}`;
    }

    return message;
  }

  /**
   * Build share message for an avatar
   */
  private static buildAvatarShareMessage(options: AvatarShareOptions): string {
    let message = `👤 Mein Avatar: ${options.name}\n\n`;
    message += `Erstellt mit Talea - Erschaffe deine eigenen Charaktere und Geschichten! ✨`;

    return message;
  }

  /**
   * Build share message for the app
   */
  private static buildAppShareMessage(): string {
    return `📖 Entdecke Talea! ✨\n\n` +
      `Erschaffe personalisierte Geschichten mit KI-gestützten Avataren.\n\n` +
      `🎭 Erstelle einzigartige Charaktere\n` +
      `📚 Generiere magische Geschichten\n` +
      `✨ Personalisierte Märchen für Kinder\n\n` +
      `Lade jetzt die Talea App herunter!`;
  }

  /**
   * Generate a shareable URL for a story (placeholder)
   * In production, this would generate a deep link or web URL
   */
  static getStoryUrl(storyId: string): string {
    // TODO: Implement actual URL generation with deep linking
    return `https://talea.website/story/${storyId}`;
  }

  /**
   * Copy text to clipboard (for manual sharing)
   */
  static async copyToClipboard(text: string): Promise<boolean> {
    try {
      // Note: For clipboard, you'd need @react-native-clipboard/clipboard
      // For now, we'll use Share as fallback
      await Share.share({ message: text });
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  }

  /**
   * Check if sharing is available on this platform
   */
  static isAvailable(): boolean {
    // Share API is available on both iOS and Android
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  /**
   * Share with specific options for different content types
   */
  static async shareWithOptions(
    title: string,
    message: string,
    url?: string
  ): Promise<boolean> {
    try {
      const result = await Share.share({
        title,
        message,
        url,
      });

      return result.action === Share.sharedAction;
    } catch (error) {
      console.error('Error sharing:', error);
      return false;
    }
  }
}

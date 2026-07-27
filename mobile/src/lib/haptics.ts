import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic vocabulary, ported from frontend/utils/haptics.ts.
 *
 * The web version drives the Vibration API from data-haptic attributes; on
 * native we get real Taptic/HapticFeedback classes, so each web intent maps to
 * the closest platform feedback. All calls are fire-and-forget and swallow
 * errors — a device without a vibrator must never break an interaction.
 */
export type HapticIntent =
  | 'selection'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'celebrate';

let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export function areHapticsEnabled(): boolean {
  return enabled;
}

export function haptic(intent: HapticIntent = 'selection'): void {
  if (!enabled || Platform.OS === 'web') return;

  try {
    switch (intent) {
      case 'selection':
        void Haptics.selectionAsync();
        break;
      case 'light':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'celebrate':
        // A short rising pattern for level-ups and artifact unlocks.
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 90);
        setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 200);
        break;
    }
  } catch {
    // Device without haptics support — ignore.
  }
}

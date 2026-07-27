import React, { type ReactNode } from 'react';
import { Pressable as RNPressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic, type HapticIntent } from '@/lib/haptics';
import { motion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

interface TouchableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale applied while pressed. 1 disables the effect. */
  pressScale?: number;
  /** Opacity applied while pressed. */
  pressOpacity?: number;
  /** Haptic fired on press-in. Pass null to stay silent. */
  hapticIntent?: HapticIntent | null;
}

/**
 * The app's single touch primitive.
 *
 * Every tappable surface animates on the UI thread via Reanimated rather than
 * through `Pressable`'s JS-driven `style` callback, so feedback stays at 60fps
 * even while a list is fetching. Press-in haptics are on by default because on
 * a children's app the tactile confirmation is a real affordance, not decoration.
 */
export function Touchable({
  children,
  style,
  pressScale = 0.97,
  pressOpacity = 0.9,
  hapticIntent = 'selection',
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: TouchableProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1 - (1 - pressScale) * pressed.value, motion.spring) }],
    opacity: withTiming(1 - (1 - pressOpacity) * pressed.value, { duration: motion.instant }),
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        pressed.value = 1;
        if (hapticIntent && !disabled) haptic(hapticIntent);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = 0;
        onPressOut?.(event);
      }}
      style={[style, animatedStyle, disabled && { opacity: 0.45 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

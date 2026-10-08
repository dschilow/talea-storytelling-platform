import { useContext, useEffect, useState } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * Whether decorative, looping motion (aurora drift, twinkling stars, floating
 * mascots) should run right now.
 *
 * Off when the system "reduce motion" setting is on, and paused while the host
 * screen is covered by another one in the stack — screens below the top stay
 * mounted, and a dozen invisible loops would cost battery for nothing. Works
 * outside a navigator too (splash, error screens), where it is simply on.
 */
export function useAmbientMotion(): boolean {
  const reduceMotion = useReducedMotion();
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);

  useEffect(() => {
    if (!navigation) return;
    setFocused(navigation.isFocused());
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  return !reduceMotion && focused;
}

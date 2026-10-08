import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';

import { useWizardAssets, wizardAssetCacheKey, type WizardAssetGroup } from '@/hooks/useWizardAssets';

interface TaleaArtProps {
  group: WizardAssetGroup;
  id: string;
  size: number;
  /** Shown until (or instead of, when unavailable) the illustration. */
  fallback?: ReactNode;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * One of the pre-generated Talea watercolour illustrations. Falls back to the
 * given node (usually an icon) when the manifest is unavailable — the art is
 * decoration and must never block an interaction.
 */
export function TaleaArt({ group, id, size, fallback, style, containerStyle }: TaleaArtProps) {
  const { assetUrl } = useWizardAssets();
  const url = assetUrl(group, id);

  return (
    <View style={[styles.box, { width: size, height: size }, containerStyle]}>
      {url ? (
        <Image
          source={{ uri: url, cacheKey: wizardAssetCacheKey(group, id) }}
          style={[{ width: size, height: size }, style]}
          contentFit="cover"
          transition={280}
          cachePolicy="disk"
          accessible={false}
        />
      ) : (
        fallback ?? null
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

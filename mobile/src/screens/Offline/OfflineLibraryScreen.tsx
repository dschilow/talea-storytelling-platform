import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CloudOff, Trash2, Wifi, WifiOff } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useOffline } from '@/providers/OfflineProvider';
import { useToast } from '@/providers/ToastProvider';
import { formatBytes, formatDate } from '@/lib/content';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CoverImage } from '@/components/ui/CoverImage';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Offline library.
 *
 * The one screen that must work with no connectivity at all: it reads only from
 * local storage and the mirrored image files, never from the network.
 */
export function OfflineLibraryScreen() {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const offline = useOffline();

  const [usage, setUsage] = useState<{ items: number; bytes: number } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const refreshUsage = useCallback(async () => {
    setUsage(await offline.storageUsage());
  }, [offline]);

  React.useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const handleClear = useCallback(async () => {
    setConfirmClear(false);
    await offline.clearAll();
    await refreshUsage();
    toast.success('Offline-Bibliothek geleert');
  }, [offline, refreshUsage, toast]);

  const isEmpty = offline.stories.length === 0 && offline.dokus.length === 0;

  return (
    <Screen playerClearance>
      <ScreenHeader
        title="Offline-Bibliothek"
        subtitle={usage ? `${usage.items} Titel · ${formatBytes(usage.bytes)}` : 'Wird geladen …'}
      />

      <View style={{ gap: spacing.base }}>
        <Card variant="inset">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {offline.isOnline ? <Wifi size={18} color={colors.success} /> : <WifiOff size={18} color={colors.warning} />}
            <View style={{ flex: 1 }}>
              <Text variant="label">{offline.isOnline ? 'Online' : 'Offline'}</Text>
              <Text variant="caption" tone="tertiary">
                {offline.isOnline
                  ? 'Alle Inhalte verfügbar. Gespeicherte Titel funktionieren auch ohne Verbindung.'
                  : 'Nur die hier gespeicherten Titel sind gerade lesbar.'}
              </Text>
            </View>
          </View>
        </Card>

        {isEmpty ? (
          <EmptyState
            icon={<CloudOff size={24} color={colors.text.tertiary} />}
            title="Noch nichts gespeichert"
            description="Öffne eine Geschichte oder ein Doku und tippe auf das Download-Symbol, um sie hier abzulegen."
            actionLabel="Zu den Geschichten"
            onAction={() => navigation.navigate('Tabs', { screen: 'Stories' })}
          />
        ) : (
          <>
            {offline.stories.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="overline" tone="tertiary">
                  Geschichten
                </Text>
                {offline.stories.map((story) => (
                  <Touchable
                    key={story.id}
                    onPress={() => navigation.navigate('StoryReader', { storyId: story.id })}
                    accessibilityLabel={story.title}
                  >
                    <Card padded={false}>
                      <View style={{ flexDirection: 'row', padding: spacing.sm, gap: spacing.md, alignItems: 'center' }}>
                        <CoverImage
                          uri={offline.resolveImage(story.coverImageUrl)}
                          style={{ width: 66, height: 66 }}
                          radius={radius.md}
                          fallbackGradient="sunset"
                        />
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text variant="title" numberOfLines={2}>
                            {story.title}
                          </Text>
                          <Text variant="caption" tone="tertiary">
                            {story.chapters.length} Kapitel · gespeichert {formatDate(story.savedAt)}
                          </Text>
                        </View>
                        <Touchable
                          onPress={() => void offline.removeStory(story.id).then(refreshUsage)}
                          style={{ padding: spacing.sm }}
                          accessibilityLabel={`${story.title} entfernen`}
                        >
                          <Trash2 size={16} color={colors.text.tertiary} />
                        </Touchable>
                      </View>
                    </Card>
                  </Touchable>
                ))}
              </View>
            ) : null}

            {offline.dokus.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="overline" tone="tertiary">
                  Dokus
                </Text>
                {offline.dokus.map((doku) => (
                  <Touchable
                    key={doku.id}
                    onPress={() => navigation.navigate('DokuReader', { dokuId: doku.id })}
                    accessibilityLabel={doku.title}
                  >
                    <Card padded={false}>
                      <View style={{ flexDirection: 'row', padding: spacing.sm, gap: spacing.md, alignItems: 'center' }}>
                        <CoverImage
                          uri={offline.resolveImage(doku.coverImageUrl)}
                          style={{ width: 66, height: 66 }}
                          radius={radius.md}
                          fallbackGradient="nature"
                        />
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text variant="title" numberOfLines={2}>
                            {doku.title}
                          </Text>
                          <Text variant="caption" tone="tertiary">
                            {doku.sections.length} Abschnitte · gespeichert {formatDate(doku.savedAt)}
                          </Text>
                        </View>
                        <Touchable
                          onPress={() => void offline.removeDoku(doku.id).then(refreshUsage)}
                          style={{ padding: spacing.sm }}
                          accessibilityLabel={`${doku.title} entfernen`}
                        >
                          <Trash2 size={16} color={colors.text.tertiary} />
                        </Touchable>
                      </View>
                    </Card>
                  </Touchable>
                ))}
              </View>
            ) : null}

            <Button
              label="Alles löschen"
              onPress={() => setConfirmClear(true)}
              variant="danger"
              icon={<Trash2 size={16} color={colors.danger} />}
              fullWidth
            />
          </>
        )}
      </View>

      <ConfirmSheet
        open={confirmClear}
        title="Offline-Bibliothek leeren?"
        message="Alle gespeicherten Geschichten, Dokus und Bilder werden von diesem Gerät entfernt. Online bleiben sie erhalten."
        confirmLabel="Alles löschen"
        destructive
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </Screen>
  );
}

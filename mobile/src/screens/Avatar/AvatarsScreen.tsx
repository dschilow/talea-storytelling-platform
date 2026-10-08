import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTranslation } from 'react-i18next';
import { ChevronRight, Eye, Pencil, Plus, Sparkles, Trash2, UserPlus, Wand2 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useAvatars, useDeleteAvatar } from '@/hooks/queries';
import { useToast } from '@/providers/ToastProvider';
import { Screen, TAB_BAR_CLEARANCE } from '@/components/ui/Screen';
import { Chip } from '@/components/ui/Chip';
import { Sheet, type SheetRef } from '@/components/ui/Sheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { AvatarCard } from '@/components/cards/AvatarCard';
import { FloatingAction } from '@/components/ui/FloatingAction';
import { Gradient } from '@/components/ui/Gradient';
import { TaleaArt } from '@/components/ui/TaleaArt';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { overallAvatarLevel } from '@/lib/personality';
import { SheetAction } from '@/screens/Story/StoriesScreen';
import type { Avatar } from '@/types/avatar';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RoleFilter = 'all' | 'child' | 'companion' | 'shared';

export function AvatarsScreen() {
  const { colors, spacing, radius, shadows } = useTheme();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const toast = useToast();

  const avatarsQuery = useAvatars();
  const deleteAvatar = useDeleteAvatar();

  const [filter, setFilter] = useState<RoleFilter>('all');
  const [selected, setSelected] = useState<Avatar | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Avatar | null>(null);
  const actionSheetRef = useRef<SheetRef>(null);

  const avatars = avatarsQuery.data ?? [];

  const filtered = useMemo(() => {
    if (filter === 'all') return avatars;
    if (filter === 'shared') return avatars.filter((avatar) => avatar.isShared);
    return avatars.filter((avatar) => (avatar.avatarRole ?? 'companion') === filter);
  }, [avatars, filter]);

  const openActions = useCallback((avatar: Avatar) => {
    setSelected(avatar);
    actionSheetRef.current?.expand();
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const avatar = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteAvatar.mutateAsync(avatar.id);
      toast.success('Avatar gelöscht');
    } catch (error) {
      toast.error('Löschen fehlgeschlagen', error instanceof Error ? error.message : undefined);
    }
  }, [deleteAvatar, pendingDelete, toast]);

  const summary = useMemo(() => {
    if (avatars.length === 0) return 'Erschaffe deinen ersten Helden';
    const average = Math.round(avatars.reduce((sum, avatar) => sum + overallAvatarLevel(avatar), 0) / avatars.length);
    return `${avatars.length} ${avatars.length === 1 ? 'Held' : 'Helden'} · Ø Level ${average}`;
  }, [avatars]);

  const filters: { id: RoleFilter; label: string }[] = [
    { id: 'all', label: 'Alle' },
    { id: 'child', label: 'Kind-Avatare' },
    { id: 'companion', label: 'Begleiter' },
    { id: 'shared', label: 'Geteilt' },
  ];

  return (
    <Screen scroll={false} padded={false} tabBarClearance playerClearance>
      <ScreenHeader eyebrow="Deine Helden" title={t('navigation.avatars', 'Avatare')} subtitle={summary} showBack={false} large />

      <FlashList
        data={filtered}
        keyExtractor={(avatar) => avatar.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: TAB_BAR_CLEARANCE + spacing.huge + spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshing={avatarsQuery.isRefetching}
        onRefresh={() => void avatarsQuery.refetch()}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
            <Touchable
              onPress={() => navigation.navigate('AvatarExchange')}
              pressScale={0.98}
              style={[styles.templates, shadows.soft, { borderRadius: radius.lg, borderColor: colors.border.light }]}
              accessibilityRole="button"
              accessibilityLabel="Avatar aus Vorlagen übernehmen"
            >
              <Gradient token={colors.gradient.primary} style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />
              <View style={styles.templateFaces}>
                {(['fox', 'unicorn', 'robot'] as const).map((id, index) => (
                  <View key={id} style={[styles.templateFace, { marginLeft: index === 0 ? 0 : -16, zIndex: 3 - index, borderColor: colors.surface.primary }]}>
                    <TaleaArt group="character" id={id} size={46} fallback={<Sparkles size={18} color={colors.primary} />} />
                  </View>
                ))}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title">Vorlagen entdecken</Text>
                <Text variant="caption" tone="secondary">
                  Fertige Helden übernehmen oder teilen
                </Text>
              </View>
              <ChevronRight size={18} color={colors.primary} />
            </Touchable>

            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {filters.map((entry) => (
                <Chip key={entry.id} label={entry.label} selected={filter === entry.id} onPress={() => setFilter(entry.id)} />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, padding: spacing.xs + 2 }}>
            <AvatarCard
              avatar={item}
              onPress={() => navigation.navigate('AvatarDetail', { avatarId: item.id })}
              onLongPress={() => openActions(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          avatarsQuery.isLoading ? (
            <View style={{ paddingHorizontal: spacing.sm, gap: spacing.lg, paddingTop: spacing.md }}>
              <SkeletonCard height={140} />
              <SkeletonCard height={140} />
            </View>
          ) : avatarsQuery.isError ? <EmptyState title="Avatare konnten nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void avatarsQuery.refetch()} /> : (
            <EmptyState
              illustration={filter === 'all' ? 'tavi' : undefined}
              icon={<UserPlus size={26} color={colors.primary} />}
              title={filter === 'all' ? 'Noch kein Avatar' : 'Keine Avatare in diesem Filter'}
              description={
                filter === 'all'
                  ? 'Ein Avatar ist der Held eurer Geschichten. Alle Eigenschaften starten bei 0 und wachsen mit jedem Abenteuer.'
                  : 'Wechsle den Filter, um andere Avatare zu sehen.'
              }
              actionLabel={filter === 'all' ? 'Avatar erstellen' : 'Alle anzeigen'}
              onAction={() => (filter === 'all' ? navigation.navigate('AvatarWizard') : setFilter('all'))}
            />
          )
        }
      />

      <FloatingAction
        label="Neuer Held"
        icon={<Plus size={20} color={colors.primaryForeground} strokeWidth={2.6} />}
        onPress={() => navigation.navigate('AvatarWizard')}
      />

      <Sheet ref={actionSheetRef} snapPoints={['52%']} title={selected?.name} scrollable={false}>
        <View style={{ gap: spacing.xs }}>
          <SheetAction
            icon={<Eye size={18} color={colors.text.secondary} />}
            label="Profil ansehen"
            onPress={() => {
              actionSheetRef.current?.close();
              if (selected) navigation.navigate('AvatarDetail', { avatarId: selected.id });
            }}
          />
          <SheetAction
            icon={<Pencil size={18} color={colors.text.secondary} />}
            label="Bearbeiten"
            onPress={() => {
              actionSheetRef.current?.close();
              if (selected) navigation.navigate('AvatarEdit', { avatarId: selected.id });
            }}
          />
          <SheetAction
            icon={<Wand2 size={18} color={colors.text.secondary} />}
            label="Geschichte mit diesem Avatar"
            onPress={() => {
              actionSheetRef.current?.close();
              if (selected) navigation.navigate('StoryWizard', { mapAvatarId: selected.id });
            }}
          />
          <SheetAction
            icon={<Sparkles size={18} color={colors.text.secondary} />}
            label="Schatzkammer"
            onPress={() => {
              actionSheetRef.current?.close();
              if (selected) navigation.navigate('Treasury', { avatarId: selected.id });
            }}
          />
          <SheetAction
            icon={<Trash2 size={18} color={colors.danger} />}
            label="Löschen"
            destructive
            onPress={() => {
              actionSheetRef.current?.close();
              setPendingDelete(selected);
            }}
          />
        </View>
      </Sheet>

      <ConfirmSheet
        open={Boolean(pendingDelete)}
        title="Avatar löschen?"
        message={`„${pendingDelete?.name ?? ''}“ und die gesamte Entwicklung dieses Avatars werden dauerhaft gelöscht. Geschichten bleiben erhalten.`}
        confirmLabel="Löschen"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  templates: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderWidth: 1, overflow: 'hidden' },
  templateFaces: { flexDirection: 'row' },
  templateFace: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

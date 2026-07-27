import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Eye, Pencil, Plus, Sparkles, Trash2, UserPlus, Wand2 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useAvatars, useDeleteAvatar } from '@/hooks/queries';
import { useToast } from '@/providers/ToastProvider';
import { Screen, TAB_BAR_CLEARANCE } from '@/components/ui/Screen';
import { Chip } from '@/components/ui/Chip';
import { Sheet } from '@/components/ui/Sheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { HeaderAction, ScreenHeader } from '@/components/ui/ScreenHeader';
import { AvatarCard } from '@/components/cards/AvatarCard';
import { SheetAction } from '@/screens/Story/StoriesScreen';
import type { Avatar } from '@/types/avatar';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RoleFilter = 'all' | 'child' | 'companion' | 'shared';

export function AvatarsScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const toast = useToast();

  const avatarsQuery = useAvatars();
  const deleteAvatar = useDeleteAvatar();

  const [filter, setFilter] = useState<RoleFilter>('all');
  const [selected, setSelected] = useState<Avatar | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Avatar | null>(null);
  const actionSheetRef = useRef<BottomSheet>(null);

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

  const filters: { id: RoleFilter; label: string }[] = [
    { id: 'all', label: 'Alle' },
    { id: 'child', label: 'Kind-Avatare' },
    { id: 'companion', label: 'Begleiter' },
    { id: 'shared', label: 'Geteilt' },
  ];

  return (
    <Screen scroll={false} padded={false} tabBarClearance playerClearance>
      <ScreenHeader
        title={t('navigation.avatars', 'Avatare')}
        subtitle={`${avatars.length} ${avatars.length === 1 ? 'Avatar' : 'Avatare'}`}
        showBack={false}
        large
        actions={
          <HeaderAction onPress={() => navigation.navigate('AvatarWizard')} accessibilityLabel="Avatar erstellen">
            <Plus size={19} color={colors.text.primary} />
          </HeaderAction>
        }
      />

      <FlashList
        data={filtered}
        keyExtractor={(avatar) => avatar.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: TAB_BAR_CLEARANCE + spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshing={avatarsQuery.isRefetching}
        onRefresh={() => void avatarsQuery.refetch()}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm }}>
            {filters.map((entry) => (
              <Chip key={entry.id} label={entry.label} selected={filter === entry.id} onPress={() => setFilter(entry.id)} />
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, padding: spacing.xs }}>
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
          ) : (
            <EmptyState
              icon={<UserPlus size={24} color={colors.accent.lavender} />}
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

      <Sheet ref={actionSheetRef} snapPoints={['40%']} title={selected?.name} scrollable={false}>
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

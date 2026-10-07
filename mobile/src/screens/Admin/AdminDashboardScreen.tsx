import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, ShieldCheck, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { collectCursorPages } from '@/lib/pagination';
import { RecordEditor } from './RecordEditor';
import type { SheetRef } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface AdminStats {
  totals?: { users: number; avatars: number; stories: number };
  subscriptions?: Record<string, number>;
  storiesByStatus?: Record<string, number>;
}

interface AdminUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  subscription?: string;
  createdAt?: string;
}

/**
 * Admin dashboard.
 *
 * Read-first by design: the mobile surface covers the operational checks an
 * admin does away from a desk (counts, finding a user, promoting one). Bulk
 * content editing stays in the web admin, where the screen real estate makes it
 * safe.
 */
export function AdminDashboardScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const backend = useBackend();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const editorRef = useRef<SheetRef>(null);

  const statsQuery = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => ((await (backend.admin as any).getStats({})) as AdminStats) ?? {},
  });

  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      return collectCursorPages<AdminUser>(async (cursor) => {
        const response = await backend.admin.listUsers({ q: search || undefined, limit: 100, cursor });
        return { items: response.users, nextCursor: response.nextCursor };
      });
    },
  });

  const promote = async (user: AdminUser) => {
    try {
      await backend.admin.updateUser({ id: user.id, role: 'admin' });
      toast.success(`${user.email ?? user.name ?? 'Nutzer'} ist jetzt Admin`);
      void usersQuery.refetch();
    } catch (error) {
      toast.error('Aktion fehlgeschlagen', error instanceof Error ? error.message : undefined);
    }
  };

  const stats = statsQuery.data ?? {};

  return (
    <Screen>
      <ScreenHeader title="Admin" subtitle="Übersicht und Nutzerverwaltung" />

      <View style={{ gap: spacing.base }}>
        {statsQuery.isLoading ? (
          <SkeletonCard height={90} />
        ) : statsQuery.isError ? <EmptyState title="Statistik konnte nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void statsQuery.refetch()} /> : (
          <View style={[styles.statRow, { gap: spacing.sm }]}>
            <StatTile value={stats.totals?.users ?? 0} label="Nutzer" />
            <StatTile value={stats.totals?.avatars ?? 0} label="Avatare" />
            <StatTile value={stats.totals?.stories ?? 0} label="Geschichten" />
          </View>
        )}
        {stats.subscriptions ? <Card><Text variant="bodySm">{Object.entries(stats.subscriptions).map(([key, value]) => `${key}: ${value}`).join(' · ')}</Text><Text variant="bodySm">{Object.entries(stats.storiesByStatus ?? {}).map(([key, value]) => `${key}: ${value}`).join(' · ')}</Text></Card> : null}

        <Card padded={false}>
          <AdminLink label="Logs" onPress={() => navigation.navigate('Logs')} />
          <AdminLink label="Alle Avatare" onPress={() => navigation.navigate('AdminAvatars')} />
          <AdminLink label="Hör-Dokus" onPress={() => navigation.navigate('AudioLibrary')} />
          <AdminLink label="Charakter-Pool" onPress={() => navigation.navigate('CharacterPool')} />
          <AdminLink label="Artefakt-Pool" onPress={() => navigation.navigate('ArtifactPool')} />
          <AdminLink label="Märchen" onPress={() => navigation.navigate('FairyTales')} last />
        </Card>

        <Text variant="overline" tone="tertiary">
          Nutzer
        </Text>

        <Input value={search} onChangeText={setSearch} placeholder="E-Mail oder Name suchen" autoCapitalize="none" />

        {usersQuery.isLoading ? (
          <SkeletonCard height={70} />
        ) : usersQuery.isError ? <EmptyState title="Nutzer konnten nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void usersQuery.refetch()} /> : (usersQuery.data ?? []).length === 0 ? (
          <EmptyState icon={<Users size={22} color={colors.text.tertiary} />} title="Keine Nutzer gefunden" compact />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {(usersQuery.data ?? []).map((user) => (
              <Card key={user.id}>
                <View style={{ gap: 6 }}>
                  <Text variant="label" numberOfLines={1}>
                    {user.email ?? user.name ?? user.id}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
                    <Chip label={user.role ?? 'user'} size="sm" tone={user.role === 'admin' ? 'warning' : 'neutral'} />
                    <Chip label={user.subscription ?? 'free'} size="sm" />
                    <View style={{ flex: 1 }} />
                    {user.role !== 'admin' ? (
                      <Touchable
                        onPress={() => void promote(user)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}
                        accessibilityLabel="Zum Admin machen"
                      >
                        <ShieldCheck size={14} color={colors.primary} />
                        <Text variant="caption" tone="accent">
                          Admin
                        </Text>
                      </Touchable>
                    ) : null}
                  </View>
                  <Button label="Nutzer bearbeiten" variant="secondary" onPress={() => { setEditing(user); editorRef.current?.expand(); }} />
                  <Button label="Nutzer löschen" variant="secondary" onPress={() => setPendingDelete(user)} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
      <RecordEditor sheetRef={editorRef} title="Nutzer bearbeiten" data={editing as unknown as Record<string, unknown> | null} onSave={async (data) => {
        if (!editing) return;
        if (!['user', 'admin'].includes(String(data.role)) || !['free', 'starter', 'familie', 'premium'].includes(String(data.subscription))) throw new Error('Rolle oder Tarif ist ungültig.');
        await backend.admin.updateUser({ id: editing.id, name: data.name, email: data.email, role: data.role, subscription: data.subscription });
        await Promise.all([usersQuery.refetch(), statsQuery.refetch()]);
      }} />
      <ConfirmSheet open={Boolean(pendingDelete)} title="Nutzer löschen?" message={`„${pendingDelete?.email ?? pendingDelete?.name ?? ''}“ und zugehörige Daten werden dauerhaft entfernt.`} destructive confirmLabel="Löschen" onCancel={() => setPendingDelete(null)} onConfirm={async () => {
        if (!pendingDelete) return;
        try { await backend.admin.deleteUser({ id: pendingDelete.id }); setPendingDelete(null); await Promise.all([usersQuery.refetch(), statsQuery.refetch()]); }
        catch (error) { toast.error('Löschen fehlgeschlagen', error instanceof Error ? error.message : undefined); }
      }} />
    </Screen>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={[
        styles.statTile,
        { borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surface.primary, borderColor: colors.border.light },
      ]}
    >
      <Text variant="headingSm">{value}</Text>
      <Text variant="caption" tone="tertiary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function AdminLink({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  const { colors, spacing } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      pressScale={0.99}
      style={[
        styles.link,
        {
          padding: spacing.md,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border.light,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text variant="label" style={{ flex: 1 }}>
        {label}
      </Text>
      <ChevronRight size={16} color={colors.text.tertiary} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row' },
  statTile: { flex: 1, alignItems: 'center', gap: 2, borderWidth: StyleSheet.hairlineWidth },
  link: { flexDirection: 'row', alignItems: 'center' },
});

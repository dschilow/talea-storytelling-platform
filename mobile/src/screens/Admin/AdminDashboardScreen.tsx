import React, { useState } from 'react';
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

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface AdminStats {
  userCount?: number;
  avatarCount?: number;
  storyCount?: number;
  dokuCount?: number;
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

  const statsQuery = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => ((await (backend.admin as any).getStats({})) as AdminStats) ?? {},
  });

  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      const response = (await (backend.admin as any).listUsers({ q: search || undefined, limit: 40 })) as {
        users?: AdminUser[];
      };
      return response?.users ?? [];
    },
  });

  const promote = async (user: AdminUser) => {
    try {
      await (backend.admin as any).promoteToAdmin({ userId: user.id });
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
        ) : (
          <View style={[styles.statRow, { gap: spacing.sm }]}>
            <StatTile value={stats.userCount ?? 0} label="Nutzer" />
            <StatTile value={stats.avatarCount ?? 0} label="Avatare" />
            <StatTile value={stats.storyCount ?? 0} label="Geschichten" />
            <StatTile value={stats.dokuCount ?? 0} label="Dokus" />
          </View>
        )}

        <Card padded={false}>
          <AdminLink label="Logs" onPress={() => navigation.navigate('Logs')} />
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
        ) : (usersQuery.data ?? []).length === 0 ? (
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
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
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

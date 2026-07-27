import React from 'react';
import { View } from 'react-native';
import { UserPlus } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { AvatarCard } from '@/components/cards/AvatarCard';
import type { Avatar } from '@/types/avatar';

interface StepAvatarsProps {
  avatars: Avatar[];
  loading: boolean;
  selected: string[];
  onToggle: (avatarId: string) => void;
  onCreateAvatar: () => void;
}

/**
 * Step 1 — who is in the story.
 *
 * Only the selected avatars receive personality updates from the finished
 * story, so the copy says so: this choice has consequences beyond casting.
 */
export function StepAvatars({ avatars, loading, selected, onToggle, onCreateAvatar }: StepAvatarsProps) {
  const { colors, spacing } = useTheme();

  if (loading) {
    return (
      <View style={{ gap: spacing.lg, paddingTop: spacing.md }}>
        <SkeletonCard height={120} />
        <SkeletonCard height={120} />
      </View>
    );
  }

  if (avatars.length === 0) {
    return (
      <EmptyState
        icon={<UserPlus size={24} color={colors.accent.lavender} />}
        title="Du brauchst zuerst einen Avatar"
        description="Avatare sind die Helden der Geschichte — und nur sie entwickeln sich weiter."
        actionLabel="Avatar erstellen"
        onAction={onCreateAvatar}
      />
    );
  }

  return (
    <View style={{ gap: spacing.base, paddingTop: spacing.sm }}>
      <View style={{ gap: 4 }}>
        <Text variant="headingSm">Wer erlebt das Abenteuer?</Text>
        <Text variant="bodySm" tone="secondary">
          Nur ausgewählte Avatare sammeln aus dieser Geschichte neue Eigenschaften.
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {avatars.map((avatar) => (
          <AvatarCard
            key={avatar.id}
            avatar={avatar}
            variant="row"
            selected={selected.includes(avatar.id)}
            onPress={() => onToggle(avatar.id)}
          />
        ))}
      </View>

      <Button
        label="Weiteren Avatar erstellen"
        onPress={onCreateAvatar}
        variant="ghost"
        icon={<UserPlus size={16} color={colors.primary} />}
        fullWidth
      />

      {selected.length > 0 ? (
        <Text variant="caption" tone="accent" center>
          {selected.length} {selected.length === 1 ? 'Avatar' : 'Avatare'} ausgewählt
        </Text>
      ) : null}
    </View>
  );
}

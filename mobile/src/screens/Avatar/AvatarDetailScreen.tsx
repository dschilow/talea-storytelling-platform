import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Edit, Trash2, User, Brain, Heart, Star } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/utils/api/client';
import { useAppDispatch } from '@/hooks/useRedux';
import { setCurrentAvatar, removeAvatar } from '@/store/slices/avatarSlice';

const AvatarDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useAppDispatch();

  const [avatar, setAvatar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const avatarId = (route.params as any)?.avatarId;

  useEffect(() => {
    loadAvatar();
  }, [avatarId]);

  const loadAvatar = async () => {
    try {
      setLoading(true);
      const data = await api.avatar.get(avatarId);
      setAvatar(data);
      dispatch(setCurrentAvatar(data));
    } catch (error) {
      console.error('Failed to load avatar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.avatar.delete(avatarId);
      dispatch(removeAvatar(avatarId));
      navigation.goBack();
    } catch (error) {
      console.error('Failed to delete avatar:', error);
      alert('Fehler beim Löschen des Avatars');
    }
  };

  if (loading || !avatar) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Lade Avatar...</Text>
      </View>
    );
  }

  // Extract personality traits
  const baseTraits = avatar.personalityTraits || {};
  const personalityKeys = ['knowledge', 'creativity', 'vocabulary', 'courage', 'curiosity', 'teamwork', 'empathy', 'persistence', 'logic'];
  const traitEmojis: Record<string, string> = {
    knowledge: '🧠',
    creativity: '🎨',
    vocabulary: '🔤',
    courage: '🦁',
    curiosity: '🔍',
    teamwork: '🤝',
    empathy: '💗',
    persistence: '🧗',
    logic: '🔢',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Avatar Details</Text>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Trash2 size={20} color={colors.coral[500]} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Avatar Card */}
        <Card variant="elevated" style={styles.avatarCard}>
          {avatar.imageUrl ? (
            <Image source={{ uri: avatar.imageUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={80} color={colors.lavender[500]} />
            </View>
          )}
          <Text style={styles.avatarName}>{avatar.name}</Text>
          {avatar.description && (
            <Text style={styles.avatarDescription}>{avatar.description}</Text>
          )}
          <Button
            title="Bearbeiten"
            onPress={() => navigation.navigate('AvatarEdit', { avatarId: avatar.id })}
            variant="outline"
            size="small"
            icon={<Edit size={16} color={colors.lavender[500]} />}
            style={styles.editButton}
          />
        </Card>

        {/* Physical Traits */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={24} color={colors.peach[500]} />
            <Text style={styles.sectionTitle}>Physische Merkmale</Text>
          </View>

          <View style={styles.traitGrid}>
            {avatar.physicalTraits?.type && (
              <View style={styles.traitItem}>
                <Text style={styles.traitLabel}>Typ</Text>
                <Text style={styles.traitValue}>{avatar.physicalTraits.type}</Text>
              </View>
            )}
            {avatar.physicalTraits?.age && (
              <View style={styles.traitItem}>
                <Text style={styles.traitLabel}>Alter</Text>
                <Text style={styles.traitValue}>{avatar.physicalTraits.age}</Text>
              </View>
            )}
            {avatar.physicalTraits?.gender && (
              <View style={styles.traitItem}>
                <Text style={styles.traitLabel}>Geschlecht</Text>
                <Text style={styles.traitValue}>{avatar.physicalTraits.gender}</Text>
              </View>
            )}
            {avatar.physicalTraits?.hairColor && (
              <View style={styles.traitItem}>
                <Text style={styles.traitLabel}>Haarfarbe</Text>
                <Text style={styles.traitValue}>{avatar.physicalTraits.hairColor}</Text>
              </View>
            )}
            {avatar.physicalTraits?.eyeColor && (
              <View style={styles.traitItem}>
                <Text style={styles.traitLabel}>Augenfarbe</Text>
                <Text style={styles.traitValue}>{avatar.physicalTraits.eyeColor}</Text>
              </View>
            )}
          </View>

          {avatar.physicalTraits?.specialFeatures && (
            <View style={styles.specialFeatures}>
              <Text style={styles.traitLabel}>Besondere Merkmale</Text>
              <Text style={styles.traitValue}>{avatar.physicalTraits.specialFeatures}</Text>
            </View>
          )}
        </Card>

        {/* Personality Traits */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Brain size={24} color={colors.lavender[500]} />
            <Text style={styles.sectionTitle}>Persönlichkeit</Text>
          </View>

          <View style={styles.personalityGrid}>
            {personalityKeys.map((key) => {
              const trait = baseTraits[key];
              const value = trait?.value || 0;
              const emoji = traitEmojis[key] || '✨';

              return (
                <View key={key} style={styles.personalityTrait}>
                  <View style={styles.personalityHeader}>
                    <Text style={styles.personalityEmoji}>{emoji}</Text>
                    <Text style={styles.personalityName}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(value, 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.personalityValue}>{value} / 100</Text>
                </View>
              );
            })}
          </View>

          {Object.keys(baseTraits).length === 0 && (
            <View style={styles.emptyState}>
              <Heart size={48} color={colors.text.light} />
              <Text style={styles.emptyText}>
                Noch keine Persönlichkeitsmerkmale. Erstelle Geschichten mit diesem Avatar,
                um seine Persönlichkeit zu entwickeln!
              </Text>
            </View>
          )}
        </Card>

        {/* Stats */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Star size={24} color={colors.mint[500]} />
            <Text style={styles.sectionTitle}>Statistiken</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Geschichten</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Abenteuer</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {new Date(avatar.createdAt).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: 'short',
                })}
              </Text>
              <Text style={styles.statLabel}>Erstellt</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  deleteButton: {
    padding: 8,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // Avatar Card
  avatarCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 20,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.lavender[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  avatarDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  editButton: {
    marginTop: 8,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },

  // Physical Traits
  traitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  traitItem: {
    width: '47%',
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 12,
  },
  traitLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  traitValue: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
  },
  specialFeatures: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
  },

  // Personality
  personalityGrid: {
    gap: 16,
  },
  personalityTrait: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
  },
  personalityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  personalityEmoji: {
    fontSize: 20,
  },
  personalityName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border.medium,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.lavender[500],
  },
  personalityValue: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.lavender[600],
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
});

export default AvatarDetailScreen;

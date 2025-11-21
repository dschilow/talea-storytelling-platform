import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Trophy, Lock } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { Card } from '@/components/ui/Card';
import { AchievementsService, Achievement } from '@/utils/gamification/AchievementsService';
import { useThemedColors } from '@/utils/theme/useThemedColors';

const AchievementsScreen = () => {
  const navigation = useNavigation();
  const themedColors = useThemedColors();

  const [unlocked, setUnlocked] = useState<Achievement[]>([]);
  const [locked, setLocked] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      setLoading(true);
      const unlockedAchievements = await AchievementsService.getUnlockedAchievements();
      const lockedAchievements = await AchievementsService.getLockedAchievements();
      setUnlocked(unlockedAchievements);
      setLocked(lockedAchievements);
    } catch (error) {
      console.error('Failed to load achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: Achievement['tier']) => {
    switch (tier) {
      case 'bronze':
        return colors.peach[500];
      case 'silver':
        return '#9ca3af';
      case 'gold':
        return '#fbbf24';
      case 'platinum':
        return '#8b5cf6';
    }
  };

  const renderAchievement = (achievement: Achievement, isLocked: boolean) => (
    <Card key={achievement.id} variant="elevated" style={styles.achievementCard}>
      <View style={styles.achievementHeader}>
        <View
          style={[
            styles.achievementIcon,
            {
              backgroundColor: isLocked
                ? themedColors.background.secondary
                : getTierColor(achievement.tier) + '20',
            },
          ]}
        >
          <Text style={styles.achievementEmoji}>
            {isLocked ? '🔒' : achievement.icon}
          </Text>
        </View>
        <View style={styles.achievementInfo}>
          <View style={styles.achievementTitleRow}>
            <Text
              style={[
                styles.achievementTitle,
                { color: themedColors.text.primary },
                isLocked && styles.lockedText,
              ]}
            >
              {achievement.title}
            </Text>
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: getTierColor(achievement.tier) },
              ]}
            >
              <Text style={styles.tierText}>{achievement.tier.toUpperCase()}</Text>
            </View>
          </View>
          <Text
            style={[
              styles.achievementDescription,
              { color: themedColors.text.secondary },
              isLocked && styles.lockedText,
            ]}
          >
            {achievement.description}
          </Text>
          {achievement.reward && (
            <Text style={[styles.rewardText, { color: themedColors.text.light }]}>
              Belohnung: +{achievement.reward.value} XP
            </Text>
          )}
        </View>
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: themedColors.background.secondary }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: themedColors.background.primary,
            borderBottomColor: themedColors.border.medium,
          },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={themedColors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: themedColors.text.primary }]}>
            Erfolge
          </Text>
          <Text style={[styles.headerSubtitle, { color: themedColors.text.secondary }]}>
            {unlocked.length} / {unlocked.length + locked.length} freigeschaltet
          </Text>
        </View>
        <Trophy size={28} color={colors.lavender[500]} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {loading ? (
          <Text style={[styles.loadingText, { color: themedColors.text.secondary }]}>
            Lade Erfolge...
          </Text>
        ) : (
          <>
            {/* Unlocked Achievements */}
            {unlocked.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themedColors.text.primary }]}>
                  Freigeschaltet ({unlocked.length})
                </Text>
                {unlocked.map((achievement) => renderAchievement(achievement, false))}
              </View>
            )}

            {/* Locked Achievements */}
            {locked.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themedColors.text.primary }]}>
                  Noch nicht freigeschaltet ({locked.length})
                </Text>
                {locked.map((achievement) => renderAchievement(achievement, true))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },

  // Achievement Card
  achievementCard: {
    marginBottom: 12,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  achievementIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  achievementEmoji: {
    fontSize: 28,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  achievementDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  lockedText: {
    opacity: 0.5,
  },
});

export default AchievementsScreen;

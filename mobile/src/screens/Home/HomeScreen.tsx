import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { User, BookOpen, Sparkles, Plus } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  // Initialize notifications
  useNotifications();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Willkommen zurück, {user?.firstName || 'Storyteller'}! 👋
        </Text>
        <Text style={styles.subtitle}>
          Bereit für dein nächstes Abenteuer?
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.lavender[100] }]}
          onPress={() => navigation.navigate('AvatarCreate')}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.lavender[500] }]}>
            <User size={24} color="white" />
          </View>
          <Text style={styles.actionTitle}>Neuer Avatar</Text>
          <Text style={styles.actionDesc}>Erstelle einen neuen Charakter</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.peach[100] }]}
          onPress={() => navigation.navigate('StoryCreate')}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.peach[500] }]}>
            <Plus size={24} color="white" />
          </View>
          <Text style={styles.actionTitle}>Geschichte erstellen</Text>
          <Text style={styles.actionDesc}>Starte eine neue Story</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.mint[100] }]}
          onPress={() => navigation.navigate('FairyTalesList')}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.mint[500] }]}>
            <Sparkles size={24} color="white" />
          </View>
          <Text style={styles.actionTitle}>Märchen</Text>
          <Text style={styles.actionDesc}>Entdecke klassische Märchen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.coral[100] }]}
          onPress={() => navigation.navigate('Stories')}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.coral[500] }]}>
            <BookOpen size={24} color="white" />
          </View>
          <Text style={styles.actionTitle}>Meine Geschichten</Text>
          <Text style={styles.actionDesc}>Deine Story-Sammlung</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity Placeholder */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Letzte Aktivitäten</Text>
        <View style={styles.emptyState}>
          <Sparkles size={48} color={colors.text.light} />
          <Text style={styles.emptyText}>
            Noch keine Aktivitäten. Starte deine erste Geschichte!
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  actionCard: {
    width: '47%',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  actionDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
  },
});

export default HomeScreen;

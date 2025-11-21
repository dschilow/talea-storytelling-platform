import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, BookOpen } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { api } from '@/utils/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { setStories, setLoading } from '@/store/slices/storySlice';

const StoriesScreen = () => {
  const dispatch = useAppDispatch();
  const { stories, loading } = useAppSelector((state) => state.story);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      dispatch(setLoading(true));
      const data = await api.story.list();
      dispatch(setStories(data));
    } catch (error) {
      console.error('Failed to load stories:', error);
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Meine Geschichten</Text>
        <TouchableOpacity style={styles.createButton}>
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Stories List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {loading ? (
          <Text style={styles.loadingText}>Lade Geschichten...</Text>
        ) : stories.length === 0 ? (
          <View style={styles.emptyState}>
            <BookOpen size={64} color={colors.text.light} />
            <Text style={styles.emptyTitle}>Noch keine Geschichten</Text>
            <Text style={styles.emptyDesc}>
              Erstelle deine erste Geschichte und erlebe magische Abenteuer!
            </Text>
            <TouchableOpacity style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Geschichte erstellen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          stories.map((story) => (
            <TouchableOpacity key={story.id} style={styles.storyCard}>
              <View style={styles.storyHeader}>
                <Text style={styles.storyTitle}>{story.title}</Text>
                <Text style={styles.storyDate}>
                  {new Date(story.createdAt).toLocaleDateString('de-DE')}
                </Text>
              </View>
              {story.description && (
                <Text style={styles.storyDesc} numberOfLines={2}>
                  {story.description}
                </Text>
              )}
              <View style={styles.storyFooter}>
                <Text style={styles.chapterCount}>
                  {story.chapters?.length || 0} Kapitel
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        story.status === 'complete'
                          ? colors.mint[100]
                          : story.status === 'generating'
                          ? colors.peach[100]
                          : colors.coral[100],
                    },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {story.status === 'complete'
                      ? '✓ Fertig'
                      : story.status === 'generating'
                      ? '⏳ Wird erstellt'
                      : '⚠ Fehler'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  createButton: {
    backgroundColor: colors.peach[500],
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  loadingText: {
    textAlign: 'center',
    color: colors.text.secondary,
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  emptyButton: {
    backgroundColor: colors.peach[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  storyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  storyDate: {
    fontSize: 12,
    color: colors.text.light,
  },
  storyDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  storyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chapterCount: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
});

export default StoriesScreen;

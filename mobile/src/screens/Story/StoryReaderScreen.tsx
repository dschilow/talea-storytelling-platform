import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Share2 } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/utils/api/client';
import { ShareService } from '@/utils/sharing/ShareService';

const { width } = Dimensions.get('window');

const StoryReaderScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const [story, setStory] = useState<any>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const storyId = (route.params as any)?.storyId;

  useEffect(() => {
    loadStory();
  }, [storyId]);

  const loadStory = async () => {
    try {
      setLoading(true);
      const data = await api.story.get(storyId);
      setStory(data);
    } catch (error) {
      console.error('Failed to load story:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToNextChapter = () => {
    if (story && currentChapterIndex < story.chapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  };

  const goToPreviousChapter = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  };

  const handleShareStory = async () => {
    if (!story) return;

    const excerpt = story.chapters?.[0]?.content?.substring(0, 150) + '...';
    const storyUrl = ShareService.getStoryUrl(story.id);

    const success = await ShareService.shareStory({
      storyId: story.id,
      title: story.title,
      excerpt,
      url: storyUrl,
    });

    if (success) {
      Alert.alert('Erfolg', 'Geschichte erfolgreich geteilt!');
    }
  };

  if (loading || !story) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Lade Geschichte...</Text>
      </View>
    );
  }

  const currentChapter = story.chapters?.[currentChapterIndex];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {story.title}
          </Text>
          <Text style={styles.headerSubtitle}>
            Kapitel {currentChapterIndex + 1} von {story.chapters.length}
          </Text>
        </View>
        <TouchableOpacity onPress={handleShareStory} style={styles.shareButton}>
          <Share2 size={24} color={colors.lavender[500]} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {currentChapter ? (
          <>
            {/* Chapter Image */}
            {currentChapter.imageUrl && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: currentChapter.imageUrl }}
                  style={styles.chapterImage}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Chapter Title */}
            <Card variant="elevated" style={styles.chapterCard}>
              <View style={styles.chapterHeader}>
                <BookOpen size={24} color={colors.lavender[500]} />
                <Text style={styles.chapterTitle}>{currentChapter.title}</Text>
              </View>

              {/* Chapter Content */}
              <Text style={styles.chapterContent}>{currentChapter.content}</Text>
            </Card>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Keine Kapitel gefunden</Text>
          </View>
        )}
      </ScrollView>

      {/* Navigation Footer */}
      <View style={styles.footer}>
        <Button
          title="Zurück"
          onPress={goToPreviousChapter}
          disabled={currentChapterIndex === 0}
          variant="outline"
          size="small"
          style={styles.navButton}
          icon={<ChevronLeft size={20} color={currentChapterIndex === 0 ? colors.text.light : colors.lavender[500]} />}
        />

        <View style={styles.progressIndicator}>
          {story.chapters.map((_: any, index: number) => (
            <TouchableOpacity
              key={index}
              onPress={() => setCurrentChapterIndex(index)}
              style={[
                styles.progressDot,
                index === currentChapterIndex && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        <Button
          title="Weiter"
          onPress={goToNextChapter}
          disabled={currentChapterIndex === story.chapters.length - 1}
          size="small"
          style={styles.navButton}
          icon={<ChevronRight size={20} color="white" />}
        />
      </View>
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
  shareButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },

  // Chapter
  imageContainer: {
    width: '100%',
    height: width * 0.75,
    backgroundColor: colors.background.secondary,
  },
  chapterImage: {
    width: '100%',
    height: '100%',
  },
  chapterCard: {
    margin: 20,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
  },
  chapterTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },
  chapterContent: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.text.primary,
  },

  // Empty State
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: colors.border.medium,
    gap: 12,
  },
  navButton: {
    flex: 1,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.medium,
  },
  progressDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.lavender[500],
  },
});

export default StoryReaderScreen;

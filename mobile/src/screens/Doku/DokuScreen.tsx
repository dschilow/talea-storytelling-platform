import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BookOpen, GraduationCap, Sparkles } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { Card } from '@/components/ui/Card';
import { api } from '@/utils/api/client';
import { useThemedColors } from '@/utils/theme/useThemedColors';

interface DokuArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  tags?: string[];
  createdAt: Date;
}

const DokuScreen = () => {
  const navigation = useNavigation();
  const themedColors = useThemedColors();

  const [articles, setArticles] = useState<DokuArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setLoading(true);
      // TODO: Implement actual API call when backend is ready
      // const data = await api.doku.list();
      // setArticles(data);

      // Mock data for now
      setArticles([
        {
          id: '1',
          title: 'Wie erstelle ich einen Avatar?',
          category: 'Tutorial',
          content:
            'Erfahre, wie du deinen ersten Avatar erstellst und seine Persönlichkeit gestaltest...',
          tags: ['Avatar', 'Anfänger'],
          createdAt: new Date(),
        },
        {
          id: '2',
          title: 'Persönlichkeitsentwicklung von Avataren',
          category: 'Konzepte',
          content:
            'Verstehe, wie sich Avatare durch Geschichten weiterentwickeln und neue Fähigkeiten erlernen...',
          tags: ['Persönlichkeit', 'Entwicklung'],
          createdAt: new Date(),
        },
        {
          id: '3',
          title: 'Geschichtengenerierung mit KI',
          category: 'KI',
          content:
            'Lerne, wie die KI einzigartige Geschichten basierend auf deinen Avataren erstellt...',
          tags: ['KI', 'Geschichten'],
          createdAt: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Failed to load articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(articles.map((a) => a.category)));
  const filteredArticles = selectedCategory
    ? articles.filter((a) => a.category === selectedCategory)
    : articles;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Tutorial':
        return <GraduationCap size={20} color={colors.lavender[500]} />;
      case 'Konzepte':
        return <Sparkles size={20} color={colors.peach[500]} />;
      case 'KI':
        return <BookOpen size={20} color={colors.mint[500]} />;
      default:
        return <BookOpen size={20} color={colors.text.secondary} />;
    }
  };

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
        <Text style={[styles.title, { color: themedColors.text.primary }]}>
          Wissensartikel
        </Text>
        <BookOpen size={28} color={colors.lavender[500]} />
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        <TouchableOpacity
          style={[
            styles.categoryChip,
            {
              backgroundColor:
                selectedCategory === null
                  ? colors.lavender[500]
                  : themedColors.background.primary,
            },
          ]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[
              styles.categoryChipText,
              {
                color:
                  selectedCategory === null ? 'white' : themedColors.text.primary,
              },
            ]}
          >
            Alle
          </Text>
        </TouchableOpacity>
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              {
                backgroundColor:
                  selectedCategory === category
                    ? colors.lavender[500]
                    : themedColors.background.primary,
              },
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryChipText,
                {
                  color:
                    selectedCategory === category ? 'white' : themedColors.text.primary,
                },
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {loading ? (
          <Text style={[styles.loadingText, { color: themedColors.text.secondary }]}>
            Lade Artikel...
          </Text>
        ) : filteredArticles.length === 0 ? (
          <View style={styles.emptyState}>
            <BookOpen size={64} color={themedColors.text.light} />
            <Text style={[styles.emptyTitle, { color: themedColors.text.primary }]}>
              Keine Artikel gefunden
            </Text>
          </View>
        ) : (
          filteredArticles.map((article) => (
            <TouchableOpacity
              key={article.id}
              onPress={() =>
                navigation.navigate('DokuReader' as never, { dokuId: article.id } as never)
              }
            >
              <Card variant="elevated" style={styles.articleCard}>
                <View style={styles.articleHeader}>
                  {getCategoryIcon(article.category)}
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{article.category}</Text>
                  </View>
                </View>
                <Text style={[styles.articleTitle, { color: themedColors.text.primary }]}>
                  {article.title}
                </Text>
                <Text
                  style={[styles.articleExcerpt, { color: themedColors.text.secondary }]}
                  numberOfLines={2}
                >
                  {article.content}
                </Text>
                {article.tags && article.tags.length > 0 && (
                  <View style={styles.tagContainer}>
                    {article.tags.map((tag) => (
                      <View
                        key={tag}
                        style={[
                          styles.tag,
                          { backgroundColor: themedColors.background.secondary },
                        ]}
                      >
                        <Text style={[styles.tagText, { color: themedColors.text.secondary }]}>
                          #{tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
  },

  // Category Filter
  categoryScroll: {
    maxHeight: 60,
  },
  categoryContent: {
    padding: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
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

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },

  // Article Card
  articleCard: {
    marginBottom: 16,
  },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: colors.lavender[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lavender[700],
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  articleExcerpt: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default DokuScreen;

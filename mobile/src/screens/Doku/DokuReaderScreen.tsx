import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, BookOpen } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { Card } from '@/components/ui/Card';
import { useThemedColors } from '@/utils/theme/useThemedColors';

const DokuReaderScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const themedColors = useThemedColors();

  const dokuId = (route.params as any)?.dokuId;

  // Mock article data (in production, fetch from API)
  const article = {
    id: dokuId,
    title: 'Wie erstelle ich einen Avatar?',
    category: 'Tutorial',
    content: `
# Einführung

Avatare sind das Herzstück von Talea. Sie sind einzigartige Charaktere mit eigenen Persönlichkeiten, die sich durch Geschichten weiterentwickeln.

## Schritt 1: Grundinformationen

Beginne mit den Basics:
- **Name**: Wähle einen passenden Namen für deinen Avatar
- **Alter**: Bestimme das Alter deines Charakters
- **Typ**: Wähle zwischen Kind, Erwachsener oder Fantasiewesen

## Schritt 2: Aussehen

Gestalte das Erscheinungsbild:
- Haarfarbe und Frisur
- Augenfarbe
- Besondere Merkmale

## Schritt 3: Persönlichkeit

Dein Avatar startet mit 9 Basis-Persönlichkeitsmerkmalen:
- 🧠 Wissen
- 🎨 Kreativität
- 🔤 Wortschatz
- 🦁 Mut
- 🔍 Neugier
- 🤝 Teamfähigkeit
- 💗 Empathie
- 🧗 Ausdauer
- 🔢 Logik

## Entwicklung

Durch Geschichten entwickeln sich die Persönlichkeitsmerkmale deines Avatars weiter. Je mehr Abenteuer er erlebt, desto stärker werden seine Eigenschaften!

## Tipps

- Erstelle mehrere Avatare für unterschiedliche Geschichten
- Lass deine Avatare gemeinsam Abenteuer erleben
- Beobachte, wie sich ihre Persönlichkeiten entwickeln
    `,
    tags: ['Avatar', 'Tutorial', 'Anfänger'],
    createdAt: new Date(),
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={themedColors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: themedColors.text.primary }]} numberOfLines={1}>
            Wissensartikel
          </Text>
        </View>
        <BookOpen size={24} color={colors.lavender[500]} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Card variant="elevated" style={styles.articleCard}>
          {/* Category Badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{article.category}</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: themedColors.text.primary }]}>
            {article.title}
          </Text>

          {/* Tags */}
          {article.tags && (
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

          {/* Content */}
          <Text style={[styles.articleContent, { color: themedColors.text.primary }]}>
            {article.content}
          </Text>
        </Card>
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
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Content
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // Article
  articleCard: {
    padding: 20,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.lavender[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lavender[700],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
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
  articleContent: {
    fontSize: 16,
    lineHeight: 26,
  },
});

export default DokuReaderScreen;

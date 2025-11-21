import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Sparkles, BookOpen, Clock, Star } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { Card } from '@/components/ui/Card';
import { api } from '@/utils/api/client';

const FairyTalesListScreen = () => {
  const navigation = useNavigation();
  const [fairyTales, setFairyTales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFairyTales();
  }, []);

  const loadFairyTales = async () => {
    try {
      setLoading(true);
      const data = await api.fairytales.list();
      setFairyTales(data);
    } catch (error) {
      console.error('Failed to load fairy tales:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Märchen</Text>
        <Sparkles size={28} color={colors.lavender[500]} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {loading ? (
          <Text style={styles.loadingText}>Lade Märchen...</Text>
        ) : fairyTales.length === 0 ? (
          <View style={styles.emptyState}>
            <BookOpen size={64} color={colors.text.light} />
            <Text style={styles.emptyTitle}>Noch keine Märchen</Text>
            <Text style={styles.emptyDesc}>
              Märchen werden bald verfügbar sein!
            </Text>
          </View>
        ) : (
          fairyTales.map((tale) => (
            <TouchableOpacity
              key={tale.id}
              onPress={() => {
                navigation.navigate('CharacterMapping', { taleId: tale.id });
              }}
            >
              <Card variant="elevated" style={styles.taleCard}>
                {tale.imageUrl && (
                  <Image source={{ uri: tale.imageUrl }} style={styles.taleImage} />
                )}
                <View style={styles.taleContent}>
                  <Text style={styles.taleTitle}>{tale.title}</Text>
                  {tale.author && (
                    <Text style={styles.taleAuthor}>von {tale.author}</Text>
                  )}
                  {tale.description && (
                    <Text style={styles.taleDescription} numberOfLines={3}>
                      {tale.description}
                    </Text>
                  )}

                  <View style={styles.taleFooter}>
                    {tale.readingTime && (
                      <View style={styles.taleInfo}>
                        <Clock size={14} color={colors.text.secondary} />
                        <Text style={styles.taleInfoText}>{tale.readingTime} Min.</Text>
                      </View>
                    )}
                    {tale.ageGroup && (
                      <View style={styles.taleInfo}>
                        <Star size={14} color={colors.text.secondary} />
                        <Text style={styles.taleInfoText}>{tale.ageGroup}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.badge}>
                    <Sparkles size={14} color={colors.lavender[600]} />
                    <Text style={styles.badgeText}>Mit deinen Avataren erleben</Text>
                  </View>
                </View>
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
    backgroundColor: colors.background.secondary,
  },
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingText: {
    textAlign: 'center',
    color: colors.text.secondary,
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

  // Tale Card
  taleCard: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  taleImage: {
    width: '100%',
    height: 180,
    backgroundColor: colors.lavender[100],
  },
  taleContent: {
    padding: 16,
  },
  taleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  taleAuthor: {
    fontSize: 14,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  taleDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  taleFooter: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  taleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taleInfoText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lavender[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lavender[700],
  },
});

export default FairyTalesListScreen;

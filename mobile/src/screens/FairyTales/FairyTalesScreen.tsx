import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';

const FairyTalesScreen = () => {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Märchen</Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <Sparkles size={64} color={colors.text.light} />
          <Text style={styles.emptyTitle}>Klassische Märchen</Text>
          <Text style={styles.emptyDesc}>
            Entdecke zeitlose Geschichten und erlebe sie mit deinen eigenen Avataren neu!
          </Text>
          <Text style={styles.comingSoon}>Wird bald verfügbar sein</Text>
        </View>
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
  comingSoon: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lavender[500],
    marginTop: 24,
  },
});

export default FairyTalesScreen;

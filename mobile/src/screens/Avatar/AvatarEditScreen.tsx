import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, CheckCircle, User, Sparkles } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { api } from '@/utils/api/client';
import { useAppDispatch } from '@/hooks/useRedux';
import { updateAvatar } from '@/store/slices/avatarSlice';

const AvatarEditScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useAppDispatch();

  const avatarId = (route.params as any)?.avatarId;

  const [loading, setLoading] = useState(false);
  const [loadingAvatar, setLoadingAvatar] = useState(true);
  const [avatarData, setAvatarData] = useState({
    name: '',
    description: '',
    type: 'Mensch',
    age: 'Kind',
    gender: 'neutral',
    hairColor: 'braun',
    eyeColor: 'braun',
    specialFeatures: '',
  });

  useEffect(() => {
    loadAvatar();
  }, [avatarId]);

  const loadAvatar = async () => {
    try {
      setLoadingAvatar(true);
      const data = await api.avatar.get(avatarId);

      // Pre-fill form with existing data
      setAvatarData({
        name: data.name || '',
        description: data.description || '',
        type: data.physicalTraits?.type || 'Mensch',
        age: data.physicalTraits?.age || 'Kind',
        gender: data.physicalTraits?.gender || 'neutral',
        hairColor: data.physicalTraits?.hairColor || 'braun',
        eyeColor: data.physicalTraits?.eyeColor || 'braun',
        specialFeatures: data.physicalTraits?.specialFeatures || '',
      });
    } catch (error) {
      console.error('Failed to load avatar:', error);
      Alert.alert('Fehler', 'Avatar konnte nicht geladen werden');
    } finally {
      setLoadingAvatar(false);
    }
  };

  const updateData = (updates: Partial<typeof avatarData>) => {
    setAvatarData({ ...avatarData, ...updates });
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const physicalTraits = {
        type: avatarData.type,
        age: avatarData.age,
        gender: avatarData.gender,
        hairColor: avatarData.hairColor,
        eyeColor: avatarData.eyeColor,
        specialFeatures: avatarData.specialFeatures,
      };

      const updatedAvatar = await api.avatar.update({
        id: avatarId,
        name: avatarData.name,
        description: avatarData.description,
        physicalTraits,
      });

      dispatch(updateAvatar(updatedAvatar));

      Alert.alert('Gespeichert!', 'Avatar wurde erfolgreich aktualisiert', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Failed to update avatar:', error);
      Alert.alert('Fehler', 'Avatar konnte nicht aktualisiert werden');
    } finally {
      setLoading(false);
    }
  };

  const canSave = () => {
    return avatarData.name.length >= 2 && avatarData.description.length >= 10;
  };

  if (loadingAvatar) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Lade Avatar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Avatar bearbeiten</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Basic Info */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={24} color={colors.lavender[500]} />
            <Text style={styles.sectionTitle}>Grundinformationen</Text>
          </View>

          <Input
            label="Name *"
            value={avatarData.name}
            onChangeText={(text) => updateData({ name: text })}
            placeholder="z.B. Luna, Max, Draco..."
          />

          <Input
            label="Beschreibung *"
            value={avatarData.description}
            onChangeText={(text) => updateData({ description: text })}
            placeholder="Beschreibe deinen Avatar..."
            multiline
            numberOfLines={4}
            style={styles.textarea}
          />

          <Select
            label="Typ"
            value={avatarData.type}
            options={[
              { label: '👤 Mensch', value: 'Mensch' },
              { label: '🐱 Tier', value: 'Tier' },
              { label: '🦄 Fantasie-Wesen', value: 'Fantasie-Wesen' },
              { label: '🤖 Roboter', value: 'Roboter' },
              { label: '✨ Anderes', value: 'Anderes' },
            ]}
            onSelect={(value) => updateData({ type: value })}
          />

          <Select
            label="Alter"
            value={avatarData.age}
            options={[
              { label: 'Kind (0-12)', value: 'Kind' },
              { label: 'Teenager (13-17)', value: 'Teenager' },
              { label: 'Erwachsen (18-60)', value: 'Erwachsen' },
              { label: 'Alt (60+)', value: 'Alt' },
            ]}
            onSelect={(value) => updateData({ age: value })}
          />
        </Card>

        {/* Appearance */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={24} color={colors.peach[500]} />
            <Text style={styles.sectionTitle}>Aussehen</Text>
          </View>

          <Select
            label="Geschlecht"
            value={avatarData.gender}
            options={[
              { label: 'Neutral', value: 'neutral' },
              { label: 'Männlich', value: 'männlich' },
              { label: 'Weiblich', value: 'weiblich' },
            ]}
            onSelect={(value) => updateData({ gender: value })}
          />

          <Select
            label="Haarfarbe"
            value={avatarData.hairColor}
            options={[
              { label: 'Braun', value: 'braun' },
              { label: 'Blond', value: 'blond' },
              { label: 'Schwarz', value: 'schwarz' },
              { label: 'Rot', value: 'rot' },
              { label: 'Grau/Weiß', value: 'grau' },
              { label: 'Bunt', value: 'bunt' },
              { label: 'Kein Haar', value: 'kein' },
            ]}
            onSelect={(value) => updateData({ hairColor: value })}
          />

          <Select
            label="Augenfarbe"
            value={avatarData.eyeColor}
            options={[
              { label: 'Braun', value: 'braun' },
              { label: 'Blau', value: 'blau' },
              { label: 'Grün', value: 'grün' },
              { label: 'Grau', value: 'grau' },
              { label: 'Bernstein', value: 'bernstein' },
              { label: 'Außergewöhnlich', value: 'besonders' },
            ]}
            onSelect={(value) => updateData({ eyeColor: value })}
          />

          <Input
            label="Besondere Merkmale (optional)"
            value={avatarData.specialFeatures}
            onChangeText={(text) => updateData({ specialFeatures: text })}
            placeholder="z.B. Brille, Narbe, Flügel..."
            multiline
            numberOfLines={2}
          />
        </Card>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Abbrechen"
          onPress={() => navigation.goBack()}
          variant="outline"
          style={styles.footerButton}
        />
        <Button
          title="Speichern"
          onPress={handleSave}
          disabled={!canSave()}
          loading={loading}
          style={[styles.footerButton, styles.footerButtonPrimary]}
          icon={<CheckCircle size={20} color="white" />}
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
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
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
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  textarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: colors.border.medium,
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
  footerButtonPrimary: {
    flex: 2,
  },
});

export default AvatarEditScreen;

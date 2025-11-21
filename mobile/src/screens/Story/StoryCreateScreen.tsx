import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Sparkles, User, BookOpen } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { api } from '@/utils/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { setAvatars } from '@/store/slices/avatarSlice';
import { addStory } from '@/store/slices/storySlice';

const StoryCreateScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { avatars } = useAppSelector((state) => state.avatar);

  const [loading, setLoading] = useState(false);
  const [storyData, setStoryData] = useState({
    title: '',
    genre: 'fantasy',
    setting: '',
    theme: '',
    ageGroup: 'children',
    learningMode: false,
    selectedAvatarIds: [] as string[],
    chapterCount: '3',
  });

  useEffect(() => {
    loadAvatars();
  }, []);

  const loadAvatars = async () => {
    try {
      const data = await api.avatar.list();
      dispatch(setAvatars(data));
    } catch (error) {
      console.error('Failed to load avatars:', error);
    }
  };

  const updateData = (updates: Partial<typeof storyData>) => {
    setStoryData({ ...storyData, ...updates });
  };

  const toggleAvatar = (avatarId: string) => {
    const selected = storyData.selectedAvatarIds;
    if (selected.includes(avatarId)) {
      updateData({ selectedAvatarIds: selected.filter((id) => id !== avatarId) });
    } else {
      if (selected.length >= 3) {
        Alert.alert('Limit erreicht', 'Du kannst maximal 3 Avatare für eine Geschichte auswählen.');
        return;
      }
      updateData({ selectedAvatarIds: [...selected, avatarId] });
    }
  };

  const canCreate = () => {
    return (
      storyData.title.length >= 3 &&
      storyData.selectedAvatarIds.length > 0 &&
      storyData.setting.length >= 5
    );
  };

  const handleCreate = async () => {
    if (!canCreate()) return;

    try {
      setLoading(true);

      const config = {
        genre: storyData.genre,
        setting: storyData.setting,
        theme: storyData.theme,
        ageGroup: storyData.ageGroup,
        learningMode: storyData.learningMode,
        chapterCount: parseInt(storyData.chapterCount),
      };

      const newStory = await api.story.generate({
        title: storyData.title,
        avatarIds: storyData.selectedAvatarIds,
        config,
      });

      dispatch(addStory(newStory));

      Alert.alert(
        'Geschichte erstellt!',
        'Deine Geschichte wird jetzt generiert. Das kann einige Minuten dauern.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Stories'),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to create story:', error);
      Alert.alert('Fehler', 'Die Geschichte konnte nicht erstellt werden. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Neue Geschichte</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Story Info */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.sectionHeader}>
            <BookOpen size={24} color={colors.lavender[500]} />
            <Text style={styles.sectionTitle}>Story-Details</Text>
          </View>

          <Input
            label="Titel *"
            value={storyData.title}
            onChangeText={(text) => updateData({ title: text })}
            placeholder="z.B. Das Abenteuer im Zauberwald"
          />

          <Select
            label="Genre"
            value={storyData.genre}
            options={[
              { label: '✨ Fantasy', value: 'fantasy' },
              { label: '🔬 Science Fiction', value: 'sci-fi' },
              { label: '🏰 Abenteuer', value: 'adventure' },
              { label: '🧙 Märchen', value: 'fairy-tale' },
              { label: '🔍 Mystery', value: 'mystery' },
              { label: '🎭 Drama', value: 'drama' },
            ]}
            onSelect={(value) => updateData({ genre: value })}
          />

          <Input
            label="Setting *"
            value={storyData.setting}
            onChangeText={(text) => updateData({ setting: text })}
            placeholder="z.B. Ein magischer Wald voller sprechender Tiere"
            multiline
            numberOfLines={3}
            style={styles.textarea}
          />

          <Input
            label="Thema (optional)"
            value={storyData.theme}
            onChangeText={(text) => updateData({ theme: text })}
            placeholder="z.B. Freundschaft, Mut, Zusammenhalt"
          />

          <Select
            label="Altersgruppe"
            value={storyData.ageGroup}
            options={[
              { label: 'Kinder (4-8 Jahre)', value: 'children' },
              { label: 'Jugendliche (9-12 Jahre)', value: 'pre-teen' },
              { label: 'Teenager (13+ Jahre)', value: 'teen' },
            ]}
            onSelect={(value) => updateData({ ageGroup: value })}
          />

          <Select
            label="Kapitel-Anzahl"
            value={storyData.chapterCount}
            options={[
              { label: '3 Kapitel (kurz)', value: '3' },
              { label: '5 Kapitel (mittel)', value: '5' },
              { label: '7 Kapitel (lang)', value: '7' },
            ]}
            onSelect={(value) => updateData({ chapterCount: value })}
          />
        </Card>

        {/* Avatar Selection */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={24} color={colors.peach[500]} />
            <Text style={styles.sectionTitle}>Charaktere auswählen *</Text>
          </View>

          <Text style={styles.subtitle}>
            Wähle 1-3 Avatare, die in der Geschichte mitspielen sollen.
          </Text>

          {avatars.length === 0 ? (
            <View style={styles.emptyState}>
              <User size={48} color={colors.text.light} />
              <Text style={styles.emptyText}>Noch keine Avatare vorhanden</Text>
              <Button
                title="Avatar erstellen"
                onPress={() => navigation.navigate('AvatarCreate')}
                size="small"
                style={styles.emptyButton}
              />
            </View>
          ) : (
            <View style={styles.avatarGrid}>
              {avatars.map((avatar) => {
                const isSelected = storyData.selectedAvatarIds.includes(avatar.id);
                return (
                  <TouchableOpacity
                    key={avatar.id}
                    style={[styles.avatarItem, isSelected && styles.avatarItemSelected]}
                    onPress={() => toggleAvatar(avatar.id)}
                  >
                    <View
                      style={[styles.avatarCircle, isSelected && styles.avatarCircleSelected]}
                    >
                      {isSelected && (
                        <View style={styles.checkmark}>
                          <Text style={styles.checkmarkText}>✓</Text>
                        </View>
                      )}
                      <User size={32} color={isSelected ? 'white' : colors.lavender[500]} />
                    </View>
                    <Text style={[styles.avatarName, isSelected && styles.avatarNameSelected]}>
                      {avatar.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {storyData.selectedAvatarIds.length > 0 && (
            <View style={styles.selectionInfo}>
              <Text style={styles.selectionText}>
                {storyData.selectedAvatarIds.length} von 3 Charakteren ausgewählt
              </Text>
            </View>
          )}
        </Card>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Sparkles size={20} color={colors.lavender[600]} />
          <Text style={styles.infoText}>
            Die Geschichte wird mit AI generiert. Deine Avatare entwickeln dabei ihre
            Persönlichkeit weiter!
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Geschichte erstellen"
          onPress={handleCreate}
          disabled={!canCreate()}
          loading={loading}
          icon={<Sparkles size={20} color="white" />}
          style={styles.createButton}
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
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },

  // Avatar Selection
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  avatarItem: {
    width: '30%',
    alignItems: 'center',
  },
  avatarItemSelected: {},
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.lavender[100],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    marginBottom: 8,
    position: 'relative',
  },
  avatarCircleSelected: {
    backgroundColor: colors.lavender[500],
    borderColor: colors.lavender[700],
  },
  checkmark: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.mint[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  avatarName: {
    fontSize: 12,
    color: colors.text.primary,
    textAlign: 'center',
  },
  avatarNameSelected: {
    fontWeight: '600',
    color: colors.lavender[700],
  },
  selectionInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.lavender[50],
    borderRadius: 8,
  },
  selectionText: {
    fontSize: 14,
    color: colors.lavender[700],
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
    marginBottom: 16,
  },
  emptyButton: {
    marginTop: 8,
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.lavender[50],
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.lavender[700],
    lineHeight: 18,
  },

  // Footer
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: colors.border.medium,
  },
  createButton: {
    width: '100%',
  },
});

export default StoryCreateScreen;

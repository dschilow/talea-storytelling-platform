import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, User, Sparkles, ArrowRight } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { api } from '@/utils/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { setAvatars } from '@/store/slices/avatarSlice';
import { addStory } from '@/store/slices/storySlice';

const CharacterMappingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useAppDispatch();
  const { avatars } = useAppSelector((state) => state.avatar);

  const taleId = (route.params as any)?.taleId;

  const [fairyTale, setFairyTale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [characterMapping, setCharacterMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [taleId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [taleData, avatarData] = await Promise.all([
        api.fairytales.get(taleId),
        api.avatar.list(),
      ]);
      setFairyTale(taleData);
      dispatch(setAvatars(avatarData));
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Fehler', 'Daten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const handleMapCharacter = (fairyTaleCharacter: string, avatarId: string) => {
    setCharacterMapping({
      ...characterMapping,
      [fairyTaleCharacter]: avatarId,
    });
  };

  const canCreate = () => {
    if (!fairyTale?.characters) return false;
    return fairyTale.characters.every(
      (char: any) => characterMapping[char.name] !== undefined
    );
  };

  const handleCreateStory = async () => {
    if (!canCreate()) {
      Alert.alert('Achtung', 'Bitte weise allen Charakteren einen Avatar zu');
      return;
    }

    try {
      setCreating(true);

      const config = {
        genre: 'fairy-tale',
        fairyTaleId: taleId,
        characterMapping,
        ageGroup: fairyTale.ageGroup || 'children',
        chapterCount: 5,
      };

      const newStory = await api.story.generate({
        title: `${fairyTale.title} - Deine Version`,
        config,
      });

      dispatch(addStory(newStory));

      Alert.alert(
        'Geschichte erstellt!',
        'Dein personalisiertes Märchen wird jetzt generiert.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Stories'),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to create story:', error);
      Alert.alert('Fehler', 'Geschichte konnte nicht erstellt werden');
    } finally {
      setCreating(false);
    }
  };

  if (loading || !fairyTale) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Lade Märchen...</Text>
      </View>
    );
  }

  const fairyTaleCharacters = fairyTale.characters || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Charaktere zuweisen
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Tale Info */}
        <Card variant="elevated" style={styles.taleCard}>
          <Text style={styles.taleTitle}>{fairyTale.title}</Text>
          {fairyTale.description && (
            <Text style={styles.taleDescription}>{fairyTale.description}</Text>
          )}
        </Card>

        {/* Instructions */}
        <Card variant="outlined" style={styles.instructionsCard}>
          <Sparkles size={24} color={colors.lavender[500]} />
          <Text style={styles.instructionsText}>
            Weise den Märchen-Charakteren deine eigenen Avatare zu. Deine Avatare spielen
            dann diese Rollen in der Geschichte!
          </Text>
        </Card>

        {/* Character Mapping */}
        {fairyTaleCharacters.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Dieses Märchen hat keine definierten Charaktere
            </Text>
          </View>
        ) : (
          fairyTaleCharacters.map((character: any, index: number) => (
            <Card key={character.name || index} variant="elevated" style={styles.mappingCard}>
              <View style={styles.mappingHeader}>
                <Text style={styles.characterName}>{character.name}</Text>
                {character.description && (
                  <Text style={styles.characterDesc}>{character.description}</Text>
                )}
              </View>

              <View style={styles.arrowContainer}>
                <ArrowRight size={24} color={colors.text.secondary} />
              </View>

              <View style={styles.avatarSelection}>
                {avatars.length === 0 ? (
                  <View style={styles.noAvatarsContainer}>
                    <Text style={styles.noAvatarsText}>Keine Avatare verfügbar</Text>
                    <Button
                      title="Avatar erstellen"
                      onPress={() => navigation.navigate('AvatarCreate')}
                      size="small"
                    />
                  </View>
                ) : (
                  <View style={styles.avatarGrid}>
                    {avatars.map((avatar) => {
                      const isSelected = characterMapping[character.name] === avatar.id;
                      return (
                        <TouchableOpacity
                          key={avatar.id}
                          style={[
                            styles.avatarOption,
                            isSelected && styles.avatarOptionSelected,
                          ]}
                          onPress={() => handleMapCharacter(character.name, avatar.id)}
                        >
                          <View
                            style={[
                              styles.avatarCircle,
                              isSelected && styles.avatarCircleSelected,
                            ]}
                          >
                            <User
                              size={24}
                              color={isSelected ? 'white' : colors.lavender[500]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.avatarOptionName,
                              isSelected && styles.avatarOptionNameSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {avatar.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Geschichte erstellen"
          onPress={handleCreateStory}
          disabled={!canCreate()}
          loading={creating}
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
    flex: 1,
    marginLeft: 12,
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

  // Tale Card
  taleCard: {
    marginBottom: 16,
  },
  taleTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  taleDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  // Instructions
  instructionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    padding: 16,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: colors.lavender[700],
    lineHeight: 20,
  },

  // Character Mapping
  mappingCard: {
    marginBottom: 16,
  },
  mappingHeader: {
    marginBottom: 12,
  },
  characterName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  characterDesc: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  arrowContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  avatarSelection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.medium,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatarOption: {
    width: '30%',
    alignItems: 'center',
  },
  avatarOptionSelected: {},
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.lavender[100],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  avatarCircleSelected: {
    backgroundColor: colors.lavender[500],
    borderColor: colors.lavender[700],
  },
  avatarOptionName: {
    fontSize: 12,
    color: colors.text.primary,
    textAlign: 'center',
  },
  avatarOptionNameSelected: {
    fontWeight: '600',
    color: colors.lavender[700],
  },
  noAvatarsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noAvatarsText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 12,
  },

  // Empty State
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
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

export default CharacterMappingScreen;

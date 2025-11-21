import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, ArrowRight, CheckCircle, User, Sparkles } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { api } from '@/utils/api/client';
import { useAppDispatch } from '@/hooks/useRedux';
import { addAvatar } from '@/store/slices/avatarSlice';

interface AvatarData {
  name: string;
  description: string;
  type: string;
  age: string;
  gender: string;
  hairColor: string;
  eyeColor: string;
  specialFeatures: string;
}

const AvatarCreateScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [avatarData, setAvatarData] = useState<AvatarData>({
    name: '',
    description: '',
    type: 'Mensch',
    age: 'Kind',
    gender: 'neutral',
    hairColor: 'braun',
    eyeColor: 'braun',
    specialFeatures: '',
  });

  const updateData = (updates: Partial<AvatarData>) => {
    setAvatarData({ ...avatarData, ...updates });
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleCreate();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleCreate = async () => {
    try {
      setLoading(true);

      // Build physical traits from selections
      const physicalTraits = {
        type: avatarData.type,
        age: avatarData.age,
        gender: avatarData.gender,
        hairColor: avatarData.hairColor,
        eyeColor: avatarData.eyeColor,
        specialFeatures: avatarData.specialFeatures,
      };

      // Create avatar via API
      const newAvatar = await api.avatar.create({
        name: avatarData.name,
        description: avatarData.description,
        physicalTraits,
        personalityTraits: {}, // Empty initially
        creationType: 'ai-generated',
        isShared: false,
      });

      // Add to Redux store
      dispatch(addAvatar(newAvatar));

      // Navigate back to avatars list
      navigation.goBack();
    } catch (error) {
      console.error('Failed to create avatar:', error);
      alert('Fehler beim Erstellen des Avatars. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) {
      return avatarData.name.length >= 2 && avatarData.description.length >= 10;
    }
    return true;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Neuer Avatar</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {[1, 2, 3].map((num) => (
          <View key={num} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                num <= step && styles.progressDotActive,
                num < step && styles.progressDotCompleted,
              ]}
            >
              {num < step ? (
                <CheckCircle size={16} color="white" />
              ) : (
                <Text style={[styles.progressNumber, num === step && styles.progressNumberActive]}>
                  {num}
                </Text>
              )}
            </View>
            {num < 3 && (
              <View style={[styles.progressLine, num < step && styles.progressLineActive]} />
            )}
          </View>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {step === 1 && (
          <Card variant="elevated" style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Sparkles size={32} color={colors.lavender[500]} />
              <Text style={styles.stepTitle}>Grundinformationen</Text>
              <Text style={styles.stepSubtitle}>Erzähle uns von deinem Avatar</Text>
            </View>

            <Input
              label="Name *"
              value={avatarData.name}
              onChangeText={(text) => updateData({ name: text })}
              placeholder="z.B. Luna, Max, Draco..."
              icon={<User size={20} color={colors.text.secondary} />}
            />

            <Input
              label="Beschreibung *"
              value={avatarData.description}
              onChangeText={(text) => updateData({ description: text })}
              placeholder="Beschreibe deinen Avatar in ein paar Sätzen..."
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
        )}

        {step === 2 && (
          <Card variant="elevated" style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Sparkles size={32} color={colors.peach[500]} />
              <Text style={styles.stepTitle}>Aussehen</Text>
              <Text style={styles.stepSubtitle}>Wie sieht dein Avatar aus?</Text>
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
        )}

        {step === 3 && (
          <Card variant="elevated" style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <CheckCircle size={32} color={colors.mint[500]} />
              <Text style={styles.stepTitle}>Überprüfung</Text>
              <Text style={styles.stepSubtitle}>Ist alles korrekt?</Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Name:</Text>
              <Text style={styles.reviewValue}>{avatarData.name}</Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Beschreibung:</Text>
              <Text style={styles.reviewValue}>{avatarData.description}</Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Typ:</Text>
              <Text style={styles.reviewValue}>{avatarData.type}</Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Alter:</Text>
              <Text style={styles.reviewValue}>{avatarData.age}</Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Aussehen:</Text>
              <Text style={styles.reviewValue}>
                {avatarData.gender}, {avatarData.hairColor} Haare, {avatarData.eyeColor}e Augen
              </Text>
            </View>

            {avatarData.specialFeatures && (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Besonderheiten:</Text>
                <Text style={styles.reviewValue}>{avatarData.specialFeatures}</Text>
              </View>
            )}

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ✨ Dein Avatar wird jetzt mit AI generiert und erhält einzigartige
                Persönlichkeitsmerkmale!
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        {step > 1 && (
          <Button
            title="Zurück"
            onPress={handleBack}
            variant="outline"
            style={styles.footerButton}
          />
        )}
        <Button
          title={step === 3 ? 'Avatar erstellen' : 'Weiter'}
          onPress={handleNext}
          disabled={!canProceed()}
          loading={loading}
          style={[styles.footerButton, styles.footerButtonPrimary]}
          icon={step === 3 ? <CheckCircle size={20} color="white" /> : <ArrowRight size={20} color="white" />}
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

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'white',
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.border.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    borderColor: colors.lavender[500],
    backgroundColor: colors.lavender[100],
  },
  progressDotCompleted: {
    backgroundColor: colors.lavender[500],
    borderColor: colors.lavender[500],
  },
  progressNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.light,
  },
  progressNumberActive: {
    color: colors.lavender[600],
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border.medium,
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: colors.lavender[500],
  },

  // Content
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  stepCard: {
    marginBottom: 20,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 12,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  textarea: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Review
  reviewSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  reviewValue: {
    fontSize: 16,
    color: colors.text.primary,
  },
  infoBox: {
    backgroundColor: colors.lavender[50],
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  infoText: {
    fontSize: 14,
    color: colors.lavender[700],
    lineHeight: 20,
  },

  // Footer
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

export default AvatarCreateScreen;

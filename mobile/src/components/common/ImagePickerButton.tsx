import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';

interface ImagePickerButtonProps {
  imageUri?: string;
  onImageSelected: (uri: string) => void;
  onImageRemoved?: () => void;
}

export const ImagePickerButton: React.FC<ImagePickerButtonProps> = ({
  imageUri,
  onImageSelected,
  onImageRemoved,
}) => {
  const [loading, setLoading] = useState(false);

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Berechtigung erforderlich',
        'Bitte erlaube den Zugriff auf deine Fotos in den Einstellungen.'
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) return;

      setLoading(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Fehler', 'Bild konnte nicht ausgewählt werden');
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Berechtigung erforderlich',
          'Bitte erlaube den Zugriff auf die Kamera in den Einstellungen.'
        );
        return;
      }

      setLoading(true);

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Fehler', 'Foto konnte nicht aufgenommen werden');
    } finally {
      setLoading(false);
    }
  };

  const showOptions = () => {
    Alert.alert('Foto auswählen', 'Woher möchtest du das Foto nehmen?', [
      {
        text: 'Kamera',
        onPress: takePhoto,
      },
      {
        text: 'Galerie',
        onPress: pickImage,
      },
      {
        text: 'Abbrechen',
        style: 'cancel',
      },
    ]);
  };

  const handleRemove = () => {
    if (onImageRemoved) {
      Alert.alert('Bild entfernen', 'Möchtest du das Bild wirklich entfernen?', [
        {
          text: 'Ja, entfernen',
          onPress: onImageRemoved,
          style: 'destructive',
        },
        {
          text: 'Abbrechen',
          style: 'cancel',
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {imageUri ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.image} />
          <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
            <X size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.changeButton} onPress={showOptions}>
            <Text style={styles.changeButtonText}>Ändern</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={showOptions}
          disabled={loading}
        >
          <View style={styles.uploadContent}>
            <View style={styles.iconCircle}>
              <ImageIcon size={32} color={colors.lavender[500]} />
            </View>
            <Text style={styles.uploadTitle}>Foto hinzufügen</Text>
            <Text style={styles.uploadSubtitle}>Kamera oder Galerie</Text>
            <View style={styles.iconRow}>
              <Camera size={20} color={colors.text.secondary} />
              <Text style={styles.iconSeparator}>oder</Text>
              <ImageIcon size={20} color={colors.text.secondary} />
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: colors.lavender[300],
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    backgroundColor: colors.lavender[50],
  },
  uploadContent: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconSeparator: {
    fontSize: 12,
    color: colors.text.light,
  },

  // Image display
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.lavender[100],
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 'auto',
    left: 'auto',
    transform: [{ translateX: 70 }],
    backgroundColor: colors.coral[500],
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  changeButton: {
    marginTop: 12,
    backgroundColor: colors.lavender[500],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  changeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

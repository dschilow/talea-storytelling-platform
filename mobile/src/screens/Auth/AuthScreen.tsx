import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useOAuth } from '@clerk/clerk-expo';
import { Sparkles } from 'lucide-react-native';
import { colors } from '@/utils/constants/colors';

const AuthScreen = () => {
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: 'oauth_google' });

  const handleGoogleSignIn = async () => {
    try {
      const { createdSessionId, setActive } = await startGoogleOAuth();

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      console.error('OAuth error:', err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Branding */}
        <View style={styles.logoContainer}>
          <Sparkles size={64} color={colors.lavender[500]} />
          <Text style={styles.title}>Talea</Text>
          <Text style={styles.subtitle}>
            Deine magische Storytelling-Welt
          </Text>
        </View>

        {/* Auth Buttons */}
        <View style={styles.authContainer}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
          >
            <Text style={styles.googleButtonText}>
              Mit Google anmelden
            </Text>
          </TouchableOpacity>

          <Text style={styles.infoText}>
            Erstelle Avatare, generiere Geschichten und tauche ein in die Welt von Talea
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lavender[50],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.lavender[700],
    marginTop: 16,
  },
  subtitle: {
    fontSize: 18,
    color: colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  authContainer: {
    width: '100%',
    maxWidth: 400,
  },
  googleButton: {
    backgroundColor: colors.lavender[500],
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: colors.lavender[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  googleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    textAlign: 'center',
    color: colors.text.secondary,
    fontSize: 14,
    marginTop: 24,
    lineHeight: 20,
  },
});

export default AuthScreen;

import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSignIn, useSignUp, useSSO } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Lock, Mail, User as UserIcon } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { PageBackground } from '@/components/ui/PageBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import type { RootStackParamList } from '@/navigation/types';

// Required for the OAuth redirect to hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

type AuthRoute = RouteProp<RootStackParamList, 'Auth'>;
type Mode = 'sign-in' | 'sign-up';

/**
 * Native authentication.
 *
 * Clerk's React components are web-only, so this is a hand-built form on top of
 * `useSignIn`/`useSignUp`, plus SSO through the system browser. Sign-up goes
 * through Clerk's email-code verification, which is why it has a second step.
 */
export function AuthScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<AuthRoute>();
  const toast = useToast();
  const { t } = useTranslation();

  const [mode, setMode] = useState<Mode>(route.params?.mode ?? 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();

  /** Clerk errors arrive as a structured array; surface the first useful message. */
  const describeError = (error: unknown): string => {
    const clerkErrors = (error as { errors?: Array<{ longMessage?: string; message?: string }> })?.errors;
    if (clerkErrors?.length) {
      return clerkErrors[0].longMessage ?? clerkErrors[0].message ?? 'Anmeldung fehlgeschlagen';
    }
    if (error instanceof Error) return error.message;
    return 'Anmeldung fehlgeschlagen';
  };

  const handleSignIn = useCallback(async () => {
    if (!signInLoaded) return;
    setFieldError(null);
    setSubmitting(true);
    try {
      const attempt = await signIn.create({ identifier: email.trim(), password });
      if (attempt.status === 'complete') {
        await setSignInActive({ session: attempt.createdSessionId });
      } else {
        setFieldError('Zusätzliche Bestätigung nötig. Bitte melde dich im Browser an.');
      }
    } catch (error) {
      const message = describeError(error);
      setFieldError(message);
      toast.error('Anmeldung fehlgeschlagen', message);
    } finally {
      setSubmitting(false);
    }
  }, [email, password, setSignInActive, signIn, signInLoaded, toast]);

  const handleSignUp = useCallback(async () => {
    if (!signUpLoaded) return;
    setFieldError(null);
    setSubmitting(true);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
      toast.info('Code gesendet', `Wir haben einen Bestätigungscode an ${email.trim()} geschickt.`);
    } catch (error) {
      const message = describeError(error);
      setFieldError(message);
      toast.error('Registrierung fehlgeschlagen', message);
    } finally {
      setSubmitting(false);
    }
  }, [email, firstName, password, signUp, signUpLoaded, toast]);

  const handleVerify = useCallback(async () => {
    if (!signUpLoaded) return;
    setFieldError(null);
    setSubmitting(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: verificationCode.trim() });
      if (attempt.status === 'complete') {
        await setSignUpActive({ session: attempt.createdSessionId });
      } else {
        setFieldError('Der Code stimmt nicht. Bitte prüfe deine E-Mails.');
      }
    } catch (error) {
      const message = describeError(error);
      setFieldError(message);
      toast.error('Bestätigung fehlgeschlagen', message);
    } finally {
      setSubmitting(false);
    }
  }, [setSignUpActive, signUp, signUpLoaded, toast, verificationCode]);

  const handleSSO = useCallback(
    async (strategy: 'oauth_google' | 'oauth_apple') => {
      setSubmitting(true);
      try {
        const { createdSessionId, setActive } = await startSSOFlow({ strategy });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
        }
      } catch (error) {
        toast.error('Anmeldung fehlgeschlagen', describeError(error));
      } finally {
        setSubmitting(false);
      }
    },
    [startSSOFlow, toast]
  );

  const canSubmit = pendingVerification
    ? verificationCode.trim().length >= 4
    : email.trim().length > 3 && password.length >= 8;

  return (
    <View style={[styles.container, { backgroundColor: colors.pageSolid }]}>
      <PageBackground />

      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingTop: insets.top }}>
          <ScreenHeader
            title={
              pendingVerification
                ? 'E-Mail bestätigen'
                : mode === 'sign-in'
                  ? t('auth.signIn', 'Willkommen zurück')
                  : t('auth.signUp', 'Konto erstellen')
            }
            subtitle={
              pendingVerification
                ? `Gib den Code ein, den wir an ${email.trim()} geschickt haben.`
                : mode === 'sign-in'
                  ? 'Melde dich an, um deine Geschichten weiterzulesen.'
                  : 'Ein Konto für die ganze Familie — pro Kind ein eigenes Profil.'
            }
            onBack={() => navigation.goBack()}
            showBack
          />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.base }}
          keyboardShouldPersistTaps="handled"
        >
          {pendingVerification ? (
            <>
              <Input
                label="Bestätigungscode"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                placeholder="123456"
                maxLength={8}
                error={fieldError ?? undefined}
                icon={<Lock size={17} color={colors.text.tertiary} />}
              />
              <Button label="Bestätigen" onPress={handleVerify} loading={submitting} disabled={!canSubmit} fullWidth size="lg" />
              <Button
                label="Zurück zur Registrierung"
                onPress={() => {
                  setPendingVerification(false);
                  setFieldError(null);
                }}
                variant="ghost"
                fullWidth
              />
            </>
          ) : (
            <>
              {mode === 'sign-up' ? (
                <Input
                  label="Vorname (optional)"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  autoComplete="given-name"
                  placeholder="Wie sollen wir dich nennen?"
                  icon={<UserIcon size={17} color={colors.text.tertiary} />}
                />
              ) : null}

              <Input
                label="E-Mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                placeholder="name@beispiel.de"
                icon={<Mail size={17} color={colors.text.tertiary} />}
              />

              <Input
                label="Passwort"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                placeholder="Mindestens 8 Zeichen"
                hint={mode === 'sign-up' ? 'Mindestens 8 Zeichen.' : undefined}
                error={fieldError ?? undefined}
                icon={<Lock size={17} color={colors.text.tertiary} />}
              />

              <Button
                label={mode === 'sign-in' ? 'Anmelden' : 'Konto erstellen'}
                onPress={mode === 'sign-in' ? handleSignIn : handleSignUp}
                loading={submitting}
                disabled={!canSubmit}
                fullWidth
                size="lg"
              />

              <View style={[styles.divider, { gap: spacing.md }]}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border.soft }]} />
                <Text variant="caption" tone="tertiary">
                  oder
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border.soft }]} />
              </View>

              <Button
                label="Mit Google fortfahren"
                onPress={() => handleSSO('oauth_google')}
                variant="secondary"
                fullWidth
                disabled={submitting}
              />
              {Platform.OS === 'ios' ? (
                <Button
                  label="Mit Apple fortfahren"
                  onPress={() => handleSSO('oauth_apple')}
                  variant="secondary"
                  fullWidth
                  disabled={submitting}
                />
              ) : null}

              <Touchable
                onPress={() => {
                  setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                  setFieldError(null);
                }}
                style={{ alignSelf: 'center', paddingVertical: spacing.md, borderRadius: radius.pill }}
                hapticIntent="light"
              >
                <Text variant="labelSm" tone="accent">
                  {mode === 'sign-in' ? 'Noch kein Konto? Jetzt registrieren' : 'Schon ein Konto? Anmelden'}
                </Text>
              </Touchable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  divider: { flexDirection: 'row', alignItems: 'center' },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
});

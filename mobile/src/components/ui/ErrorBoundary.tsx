import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { lightPalette } from '@/theme/tokens';
import { IS_DEV } from '@/config';

interface Props {
  children: ReactNode;
  /** Rendered instead of the default screen. Receives a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level crash guard.
 *
 * On a release build a thrown render error would otherwise take down the whole
 * app with a blank screen. This keeps the user in a recoverable state and shows
 * the stack only in development.
 *
 * Deliberately styled with raw tokens rather than `useTheme()` — the boundary
 * has to render even if a provider above it is what failed.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled render error', error, errorInfo.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Da ist etwas schiefgelaufen</Text>
          <Text style={styles.body}>
            Talea konnte diesen Bereich nicht anzeigen. Tippe auf „Nochmal versuchen“ — deine Geschichten und Avatare sind
            sicher gespeichert.
          </Text>

          {IS_DEV ? (
            <ScrollView style={styles.stack} contentContainerStyle={{ padding: 12 }}>
              <Text style={styles.stackText}>{error.stack ?? error.message}</Text>
            </ScrollView>
          ) : null}

          <Pressable style={styles.button} onPress={this.reset} accessibilityRole="button">
            <Text style={styles.buttonLabel}>Nochmal versuchen</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: lightPalette.pageSolid,
  },
  card: { width: '100%', maxWidth: 420, gap: 14 },
  title: { fontSize: 22, fontWeight: '700', color: lightPalette.text.primary, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: lightPalette.text.secondary, textAlign: 'center' },
  stack: {
    maxHeight: 220,
    borderRadius: 12,
    backgroundColor: '#f2ece5',
  },
  stackText: { fontSize: 11, fontFamily: 'monospace', color: '#7a4a4a' },
  button: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: lightPalette.primary,
  },
  buttonLabel: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});

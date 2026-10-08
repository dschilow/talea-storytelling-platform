import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, NativeModules, StyleSheet, Vibration, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useBackend } from '@/api/backend';
import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import type { RootStackParamList } from '@/navigation/types';
import { ALIBI_KEYS, parseAlibiRequest } from './alibi/protocol';
import { loadAlibiPool } from './alibi/characters';

const ENTRY = 'file:///android_asset/alibi/index.html';
const speech = NativeModules.AlibiSpeech as {
  speak(text: string, pitch: number, rate: number, volume: number, priv: boolean): Promise<void>;
  play(clip: string, volume: number, priv: boolean): Promise<void>;
  privacy(on: boolean): Promise<void>;
  stop(): void;
  release(): void;
};

/** The complete original game runs locally. Only portrait retrieval uses Clerk. */
export function AlibiScreen() {
  const webview = useRef<WebView>(null);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const backend = useBackend();
  const { pause } = useAudioPlayer();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [generation, setGeneration] = useState(0);
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const activeRef = useRef(active);
  activeRef.current = active;
  const readyRef = useRef(false);
  const writes = useRef(Promise.resolve());
  const poolRequest = useRef<ReturnType<typeof loadAlibiPool> | null>(null);
  const alive = useRef(true);
  useKeepAwake('talea-alibi');
  const leave = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Tabs', { screen: 'Spiel', params: { tab: 'alibi' } });
  }, [navigation]);

  const receive = useCallback((message: object) => {
    if (alive.current) webview.current?.injectJavaScript(`window.__alibiReceive?.(${JSON.stringify(message)}); true;`);
  }, []);

  useEffect(() => {
    alive.current = true;
    pause();
    return () => { alive.current = false; speech?.release(); Vibration.cancel(); };
  }, [pause]);

  useEffect(() => {
    if (ready) return;
    const timeout = setTimeout(() => setError('Das Spiel konnte nicht geöffnet werden. Bitte erneut versuchen.'), 40_000);
    return () => clearTimeout(timeout);
  }, [ready, generation]);

  useEffect(() => {
    const foreground = (value: boolean) => {
      activeRef.current = value;
      setActive(value);
      if (!value) { speech?.release(); Vibration.cancel(); }
      receive({ event: 'lifecycle', active: value });
    };
    const subscription = AppState.addEventListener('change', state => {
      foreground(state === 'active');
    });
    const blur = AppState.addEventListener('blur', () => foreground(false));
    const focus = AppState.addEventListener('focus', () => foreground(AppState.currentState === 'active'));
    return () => { subscription.remove(); blur.remove(); focus.remove(); };
  }, [receive]);

  useFocusEffect(useCallback(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!readyRef.current || error) leave();
      else webview.current?.injectJavaScript('window.__alibiBack?.(); true;');
      return true;
    });
    return () => back.remove();
  }, [leave, error]));

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    const m = parseAlibiRequest(event.nativeEvent.data);
    if (!m) return;
    // A reply from a crashed/retried WebView must not resolve a new request
    // that reused its numeric id after the bridge restarted.
    const deliver = (message: object) => { if (generation === generationRef.current) receive(message); };
    const reply = (value?: unknown) => { if ('id' in m) deliver({ id: m.id, value }); };
    try {
      switch (m.type) {
        case 'bootstrap': {
          await writes.current;
          reply(Object.fromEntries(await AsyncStorage.multiGet([...ALIBI_KEYS])));
          break;
        }
        case 'characters': {
          poolRequest.current ??= loadAlibiPool(() => backend.story.listCharacters());
          try { reply(await poolRequest.current); } finally { poolRequest.current = null; }
          break;
        }
        case 'save': {
          // Serial writes preserve collection updates and the final snapshot.
          writes.current = writes.current.catch(() => undefined).then(() => AsyncStorage.setItem(m.key, m.value));
          await writes.current;
          reply();
          break;
        }
        case 'ready': readyRef.current = true; setReady(true); receive({ event: 'lifecycle', active: AppState.currentState === 'active' }); break;
        case 'exit': await writes.current; speech?.release(); leave(); break;
        case 'speak':
          if (!activeRef.current) { reply(); break; }
          if (!speech) throw new Error('Sprachausgabe fehlt im Android-Build.');
          await speech.speak(m.text, Math.max(0.2, Math.min(2, m.pitch)), Math.max(0.2, Math.min(2, m.rate)), Math.max(0, Math.min(1, m.volume)), m.priv);
          reply(); break;
        case 'audioPlay':
          if (!activeRef.current) { reply(); break; }
          if (!speech) throw new Error('Audioausgabe fehlt im Android-Build.');
          await speech.play(m.clip, Math.max(0, Math.min(1, m.volume)), m.priv);
          reply(); break;
        case 'audioPrivacy':
          if (!activeRef.current && m.on) throw new Error('Spiel pausiert.');
          if (!speech) throw new Error('Hörmuschel fehlt im Android-Build.');
          await speech.privacy(m.on);
          reply(); break;
        case 'speechStop': speech?.stop(); break;
        case 'vibrate':
          if (activeRef.current) Vibration.vibrate(Array.isArray(m.pattern) ? [0, ...m.pattern] : Math.max(0, Math.min(1000, m.pattern)));
          break;
        case 'error': setError(m.message); speech?.release(); break;
        case 'stage': if (m.open) pause(); else speech?.release(); break;
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if ((m.type === 'audioPrivacy' && m.on) || ((m.type === 'audioPlay' || m.type === 'speak') && m.priv && code === 'PRIVATE_ROUTE')) deliver({ event: 'audioRouteFailed' });
      if ('id' in m) deliver({ id: m.id, error: e instanceof Error ? e.message : 'Aktion fehlgeschlagen', code });
    }
  }, [backend, generation, leave, pause, receive]);

  const retry = () => { speech?.release(); readyRef.current = false; setReady(false); setError(null); setGeneration(n => n + 1); };
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <WebView
        key={generation} ref={webview} source={{ uri: ENTRY }}
        originWhitelist={['file://*', 'about:blank']}
        onShouldStartLoadWithRequest={r => r.url.startsWith(ENTRY) || r.url === 'about:blank'}
        onMessage={onMessage} onError={() => { speech?.release(); setError('Die Spiel-Dateien konnten nicht geladen werden. Bitte die App neu bauen oder aktualisieren.'); }}
        onRenderProcessGone={() => { speech?.release(); readyRef.current = false; setError('Android hat das Spiel angehalten. Dein gespeicherter Spielstand kann erneut geöffnet werden.'); }}
        javaScriptEnabled domStorageEnabled allowFileAccess allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs={false} mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false}
        geolocationEnabled={false} mediaCapturePermissionGrantType="deny"
        webviewDebuggingEnabled={true} overScrollMode="never" style={styles.webview}
      />
      {(!ready || !active || error) ? (
        <View style={styles.cover}>
          <Text variant="headingSm" style={styles.title}>Mitternachts-Alibi</Text>
          {error ? <>
            <Text variant="body" style={styles.message}>{error}</Text>
            <Button onPress={retry} label="Erneut versuchen" />
            <Button variant="ghost" onPress={leave} label="Zurück zu Talea" />
          </> : <>
            <ActivityIndicator color="#f8dc8e" size="large" />
            <Text variant="body" style={styles.message}>{active ? 'Kicherwald wird vorbereitet …' : 'Spiel pausiert'}</Text>
          </>}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0d1c' },
  webview: { flex: 1, backgroundColor: '#0b0d1c' },
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0b0d1c', justifyContent: 'center', alignItems: 'center', padding: 28, gap: 20 },
  title: { color: '#f8dc8e', textAlign: 'center' },
  message: { color: '#f6efe0', textAlign: 'center' },
});

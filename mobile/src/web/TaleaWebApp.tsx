import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Image, Linking, NativeModules, Pressable, StyleSheet, Text, useColorScheme, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { WEB_ORIGIN, LEGACY_PREFERENCES, appUrlForLink, isWebOrigin, parseNativeRequest } from './protocol';
import { NativePlayer } from './NativePlayer';

void SplashScreen.preventAutoHideAsync().catch(() => {});
const speech = NativeModules.AlibiSpeech as {
  speak(text: string, pitch: number, rate: number, volume: number, priv: boolean): Promise<void>;
  play(clip: string, volume: number, priv: boolean): Promise<void>;
  privacy(on: boolean): Promise<void>;
  stop(): void;
  release(): void;
} | undefined;
const clamp = (n: unknown, min: number, max: number) => Math.max(min, Math.min(max, Number(n)));

export function TaleaWebApp() {
  const systemScheme = useColorScheme();
  const [appearance, setAppearance] = useState<'light' | 'dark'>(systemScheme === 'dark' ? 'dark' : 'light');
  const [source, setSource] = useState(`${WEB_ORIGIN}/`);
  const [generation, setGeneration] = useState(0);
  const [bridgeNonce] = useState(() => Crypto.randomUUID());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webview = useRef<WebView>(null);
  const mounted = useRef(true);
  const foreground = useRef(AppState.currentState === 'active');
  const pageEpoch = useRef(0);
  const background = appearance === 'dark' ? '#211710' : '#FFF7EC';
  const ink = appearance === 'dark' ? '#FFF7EC' : '#3E281F';
  const bridgeBootstrap = `if (window === window.top && location.origin === ${JSON.stringify(WEB_ORIGIN)} && !window.__TALEA_ANDROID_NONCE__) { Object.defineProperty(window, '__TALEA_ANDROID_NONCE__', { value: ${JSON.stringify(bridgeNonce)}, writable: false, configurable: false }); } true;`;
  const receive = useCallback((message: object) => {
    if (mounted.current) webview.current?.injectJavaScript(`window.__TALEA_ANDROID_RECEIVE__?.(${JSON.stringify(message).replace(/</g, '\\u003c')}); true;`);
  }, []);
  const player = useRef<NativePlayer | null>(null);

  useEffect(() => {
    mounted.current = true;
    player.current = new NativePlayer(receive);
    return () => { mounted.current = false; player.current?.dispose(); player.current = null; speech?.release(); Vibration.cancel(); };
  }, [receive]);

  useEffect(() => {
    if (ready || error) return;
    const timeout = setTimeout(() => {
      setError('Talea konnte nicht gestartet werden. Bitte versuche es erneut.');
      void SplashScreen.hideAsync();
    }, 35_000);
    return () => clearTimeout(timeout);
  }, [ready, error, generation]);

  useEffect(() => {
    const change = (active: boolean) => {
      foreground.current = active;
      if (!active) { speech?.release(); Vibration.cancel(); }
      receive({ event: 'lifecycle', active });
    };
    const state = AppState.addEventListener('change', value => change(value === 'active'));
    const blur = AppState.addEventListener('blur', () => change(false));
    const focus = AppState.addEventListener('focus', () => change(AppState.currentState === 'active'));
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (error) { setSource(`${WEB_ORIGIN}/`); setError(null); setGeneration(n => n + 1); }
      else receive({ event: 'back' });
      return true;
    });
    return () => { state.remove(); blur.remove(); focus.remove(); back.remove(); };
  }, [receive, error]);

  useEffect(() => {
    const open = (url: string) => {
      // The auth browser resolves this callback to its pending bridge request.
      if (url.startsWith('talea://sso-callback')) return;
      const target = appUrlForLink(url); if (target) setSource(target);
    };
    let cancelled = false;
    void Linking.getInitialURL().then(url => { if (url && !cancelled) open(url); });
    const subscription = Linking.addEventListener('url', event => open(event.url));
    return () => { cancelled = true; subscription.remove(); };
  }, []);

  const fail = useCallback((message: string) => {
    speech?.release(); player.current?.pause(); setError(message); void SplashScreen.hideAsync();
  }, []);

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    const message = parseNativeRequest(event.nativeEvent.data, event.nativeEvent.url, bridgeNonce);
    if (!message) return;
    const epoch = pageEpoch.current;
    const reply = (result: object) => { if (pageEpoch.current === epoch) receive({ id: message.id, ...result }); };
    const p = message.payload;
    let value: unknown = null;
    try {
      switch (message.action) {
        case 'bootstrap': value = Object.fromEntries(await AsyncStorage.multiGet([...LEGACY_PREFERENCES])); break;
        case 'oauth': value = await WebBrowser.openAuthSessionAsync(p.url as string, 'talea://sso-callback'); break;
        case 'ready': setReady(true); setError(null); void SplashScreen.hideAsync(); receive({ event: 'lifecycle', active: foreground.current }); break;
        case 'appearance': setAppearance(p.theme as 'light' | 'dark'); break;
        case 'exit': Alert.alert('Talea schließen?', 'Du kannst jederzeit wiederkommen.', [{ text: 'Hierbleiben', style: 'cancel' }, { text: 'Schließen', onPress: () => BackHandler.exitApp() }]); break;
        case 'haptic': if (foreground.current) Vibration.vibrate([0, ...(p.pattern as number[])]); break;
        case 'file': {
          if (!await Sharing.isAvailableAsync()) throw new Error('Das Teilen von Dateien ist auf diesem Gerät nicht verfügbar.');
          const name = (p.name as string).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/^\.+/, '') || 'Talea';
          const root = `${FileSystem.cacheDirectory}talea-exports/`;
          await FileSystem.makeDirectoryAsync(root, { intermediates: true });
          for (const entry of await FileSystem.readDirectoryAsync(root)) {
            const info = await FileSystem.getInfoAsync(`${root}${entry}`);
            if (info.exists && (info.modificationTime ?? Date.now() / 1000) < Date.now() / 1000 - 24 * 60 * 60) {
              await FileSystem.deleteAsync(`${root}${entry}`, { idempotent: true });
            }
          }
          const directory = `${root}${Date.now()}-${message.id}/`;
          await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
          const uri = `${directory}${name}`;
          await FileSystem.writeAsStringAsync(uri, p.base64 as string, { encoding: FileSystem.EncodingType.Base64 });
          // Receiving apps may still be reading after the chooser returns.
          // Expire old exports on a later share instead of deleting them here.
          await Sharing.shareAsync(uri, { mimeType: p.mime as string, dialogTitle: name });
          break;
        }
        case 'speech': case 'gameAudio': case 'gamePrivacy': {
          if (!foreground.current) throw new Error('Das Spiel ist pausiert.');
          if (!speech) throw new Error('Die Android-Sprachausgabe fehlt. Bitte die App aktualisieren.');
          if (message.action === 'speech') await speech.speak(p.text as string, clamp(p.pitch, 0.2, 2), clamp(p.rate, 0.2, 2), clamp(p.volume, 0, 1), p.private as boolean);
          else if (message.action === 'gameAudio') await speech.play(p.clip as string, clamp(p.volume, 0, 1), p.private as boolean);
          else { if (p.on) player.current?.pause(); await speech.privacy(p.on as boolean); }
          break;
        }
        case 'speechStop': speech?.stop(); break;
        case 'audioLoad': await player.current?.load(p); break;
        case 'audioPlay': player.current?.play(p.generation as number); break;
        case 'audioPause': player.current?.pause(p.generation as number); break;
        case 'audioSeek': await player.current?.seek(p.generation as number, p.seconds as number); break;
        case 'audioClear': player.current?.clear(p.generation as number); break;
      }
      reply({ value });
    } catch (cause) {
      const code = (cause as { code?: string })?.code;
      if (code === 'PRIVATE_ROUTE') receive({ event: 'audioRouteFailed' });
      reply({ error: cause instanceof Error ? cause.message : 'Die Aktion konnte nicht abgeschlossen werden.', code });
    }
  }, [receive, bridgeNonce]);

  const openExternal = (url: string) => {
    if (/^https?:\/\//i.test(url)) void WebBrowser.openBrowserAsync(url).catch(() => fail('Der Link konnte nicht geöffnet werden.'));
    else if (/^(mailto:|tel:)/i.test(url)) void Linking.openURL(url).catch(() => fail('Der Link konnte nicht geöffnet werden.'));
  };
  const retry = () => { pageEpoch.current++; player.current?.clear(-1); speech?.release(); setReady(false); setError(null); setGeneration(n => n + 1); };
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: background }]} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style={appearance === 'dark' ? 'light' : 'dark'} />
      <WebView
        key={generation} ref={webview} source={{ uri: source }}
        applicationNameForUserAgent="TaleaAndroid/1.0"
        injectedJavaScriptBeforeContentLoaded={bridgeBootstrap}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        injectedJavaScript={bridgeBootstrap}
        injectedJavaScriptForMainFrameOnly
        originWhitelist={['https://*', 'http://*', 'talea://*', 'mailto:*', 'tel:*']}
        onShouldStartLoadWithRequest={request => {
          if (isWebOrigin(request.url) || request.url === 'about:blank') return true;
          if (request.isTopFrame === false) return true;
          const target = appUrlForLink(request.url);
          if (target) setSource(target); else openExternal(request.url);
          return false;
        }}
        onOpenWindow={event => openExternal(event.nativeEvent.targetUrl)}
        onLoadStart={() => { pageEpoch.current++; }}
        onMessage={onMessage}
        onError={() => fail('Talea konnte nicht geladen werden. Bitte versuche es erneut.')}
        onHttpError={event => { if (event.nativeEvent.url === source && event.nativeEvent.statusCode >= 400) fail('Talea konnte nicht geladen werden.'); }}
        onRenderProcessGone={() => fail('Android hat Talea angehalten. Öffne die App erneut, um weiterzumachen.')}
        javaScriptEnabled domStorageEnabled thirdPartyCookiesEnabled sharedCookiesEnabled
        allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never" mediaPlaybackRequiresUserAction={false} allowsFullscreenVideo
        setSupportMultipleWindows javaScriptCanOpenWindowsAutomatically
        setBuiltInZoomControls={false} setDisplayZoomControls={false}
        webviewDebuggingEnabled={__DEV__ || process.env.EXPO_PUBLIC_WEBVIEW_DEBUG === 'true'} overScrollMode="never"
        style={[styles.screen, { backgroundColor: background }]}
      />
      {(!ready || error) && <View style={[styles.cover, { backgroundColor: background }]}>
        <Image source={require('../../assets/talea-logo.png')} style={styles.logo} resizeMode="contain" accessible accessibilityLabel="Talea" />
        {error ? <>
          <Text style={[styles.message, { color: ink }]} accessibilityRole="alert">{error}</Text>
          <Pressable onPress={retry} accessibilityRole="button" style={styles.retry}><Text style={styles.retryText}>Erneut versuchen</Text></Pressable>
        </> : <ActivityIndicator size="large" color="#B95134" accessibilityLabel="Talea wird geladen" />}
      </View>}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  cover: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 24 },
  logo: { width: 200, height: 90 },
  message: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  retry: { minHeight: 48, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, backgroundColor: '#B95134' },
  retryText: { color: '#FFF7EC', fontSize: 16, fontWeight: '600' },
});

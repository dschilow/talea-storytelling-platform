import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowRight, Send, X } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useToast } from '@/providers/ToastProvider';
import { haptic } from '@/lib/haptics';
import { PageBackground } from '@/components/ui/PageBackground';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { TaviChatAction, TaviChatResponse } from '@/types/tavi';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Message {
  id: string;
  sender: 'user' | 'tavi';
  text: string;
  actions?: TaviChatAction[];
}

const SUGGESTIONS = [
  'Erzähl mir eine Gute-Nacht-Geschichte',
  'Was kann ich heute lernen?',
  'Erfinde einen neuen Avatar',
  'Zeig mir meine letzte Geschichte',
];

/**
 * Tavi — the in-app assistant.
 *
 * Tavi answers, but it also *acts*: the backend returns typed actions
 * (open a story, prefill a wizard, list content) which render as tappable cards.
 * Mapping those onto native navigation is what makes the assistant useful rather
 * than a chat box that tells you where to tap.
 */
export function TaviScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const backend = useBackend();
  const toast = useToast();
  const { i18n } = useTranslation();
  const activeProfile = useOptionalChildProfiles()?.activeProfile ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const userMessage: Message = { id: `${Date.now()}-user`, sender: 'user', text: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setSending(true);
      haptic('light');

      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

      try {
        const history = messages.slice(-8).map((message) => ({
          role: message.sender === 'user' ? 'user' : 'assistant',
          content: message.text,
        }));

        const response = (await (backend.tavi as any).taviChat({
          message: trimmed,
          history,
          context: { language: i18n.language, profileId: activeProfile?.id },
        })) as TaviChatResponse;

        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-tavi`,
            sender: 'tavi',
            text: response.response,
            actions: response.actions,
          },
        ]);
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      } catch (error) {
        console.error('[Tavi] Chat failed', error);
        toast.error('Tavi antwortet gerade nicht', 'Bitte versuche es in einem Moment erneut.');
      } finally {
        setSending(false);
      }
    },
    [activeProfile?.id, backend.tavi, i18n.language, messages, sending, toast]
  );

  /** Maps a Tavi action onto native navigation. */
  const runAction = useCallback(
    (action: TaviChatAction) => {
      haptic('medium');

      switch (action.type) {
        case 'story':
          if (action.id) navigation.navigate('StoryReader', { storyId: action.id });
          break;
        case 'doku':
          if (action.id) navigation.navigate('DokuReader', { dokuId: action.id });
          break;
        case 'avatar':
          if (action.id) navigation.navigate('AvatarDetail', { avatarId: action.id });
          break;
        case 'wizard_prefill':
          if (action.wizardType === 'avatar') navigation.navigate('AvatarWizard');
          else if (action.wizardType === 'doku') navigation.navigate('DokuWizard');
          else {
            const data = action.wizardData ?? {};
            navigation.navigate('StoryWizard', {
              tags: typeof data.tags === 'string' ? data.tags : undefined,
              mapAvatarId: typeof data.avatarId === 'string' ? data.avatarId : undefined,
            });
          }
          break;
        case 'navigate':
          // Routes arrive as web paths; translate the ones that map cleanly.
          if (action.route?.startsWith('/story-reader/')) {
            navigation.navigate('StoryReader', { storyId: action.route.split('/').pop()! });
          } else if (action.route?.startsWith('/doku-reader/')) {
            navigation.navigate('DokuReader', { dokuId: action.route.split('/').pop()! });
          } else if (action.route?.startsWith('/avatar/')) {
            navigation.navigate('AvatarDetail', { avatarId: action.route.split('/').pop()! });
          } else if (action.route === '/map') {
            navigation.navigate('Journey');
          } else if (action.route === '/cosmos') {
            navigation.navigate('Cosmos');
          } else if (action.route === '/quiz') {
            navigation.navigate('Tabs', { screen: 'Quiz' });
          } else {
            toast.info('Nicht verfügbar', 'Diesen Bereich gibt es nur in der Web-App.');
          }
          break;
        case 'choice':
          // Choices are answered by sending the chosen value back as a message.
          break;
        default:
          break;
      }
    },
    [navigation, toast]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.pageSolid }]}>
      <PageBackground />

      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title="Tavi"
          subtitle="Dein Begleiter in Talea"
          onBack={() => navigation.goBack()}
          showBack
          actions={
            messages.length > 0 ? (
              <Touchable onPress={() => setMessages([])} style={{ padding: 8 }} accessibilityLabel="Unterhaltung leeren">
                <X size={18} color={colors.text.secondary} />
              </Touchable>
            ) : null
          }
        />
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={{ padding: spacing.base, gap: spacing.md, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <Animated.View entering={FadeInUp.duration(420)} style={{ alignItems: 'center', gap: spacing.base, paddingTop: spacing.xl }}>
              <Image source={require('../../../assets/tavi.png')} style={styles.taviAvatar} resizeMode="contain" />
              <Text variant="headingSm" center>
                Hallo! Was möchtest du erleben?
              </Text>
              <Text variant="bodySm" tone="secondary" center style={{ maxWidth: 280 }}>
                Ich kann Geschichten vorschlagen, Avatare erfinden oder dir zeigen, was du schon gelernt hast.
              </Text>

              <View style={{ gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.md }}>
                {SUGGESTIONS.map((suggestion) => (
                  <Touchable
                    key={suggestion}
                    onPress={() => void send(suggestion)}
                    style={[
                      styles.suggestion,
                      {
                        borderRadius: radius.md,
                        padding: spacing.md,
                        backgroundColor: colors.surface.primary,
                        borderColor: colors.border.light,
                      },
                    ]}
                  >
                    <Text variant="bodySm" style={{ flex: 1 }}>
                      {suggestion}
                    </Text>
                    <ArrowRight size={15} color={colors.text.tertiary} />
                  </Touchable>
                ))}
              </View>
            </Animated.View>
          ) : (
            messages.map((message) => (
              <Animated.View key={message.id} entering={FadeInDown.duration(280)}>
                <View
                  style={[
                    styles.bubble,
                    {
                      alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                      backgroundColor: message.sender === 'user' ? colors.primary : colors.surface.primary,
                      borderColor: message.sender === 'user' ? 'transparent' : colors.border.light,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Text variant="body" tone={message.sender === 'user' ? 'inverse' : 'primary'}>
                    {message.text}
                  </Text>
                </View>

                {message.actions?.length ? (
                  <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    {message.actions.map((action, index) => (
                      <TaviActionCard key={index} action={action} onRun={runAction} onChoose={(value) => void send(value)} />
                    ))}
                  </View>
                ) : null}
              </Animated.View>
            ))
          )}

          {sending ? (
            <View style={[styles.typing, { backgroundColor: colors.surface.primary, borderRadius: radius.lg, padding: spacing.md }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text variant="caption" tone="tertiary">
                Tavi denkt nach …
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={{
            paddingHorizontal: spacing.base,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border.light,
            backgroundColor: colors.surface.panel,
          }}
        >
          <Input
            value={input}
            onChangeText={setInput}
            placeholder="Frag Tavi etwas …"
            returnKeyType="send"
            onSubmitEditing={() => void send(input)}
            trailing={
              <Touchable
                onPress={() => void send(input)}
                disabled={!input.trim() || sending}
                style={[
                  styles.sendButton,
                  { borderRadius: radius.pill, backgroundColor: input.trim() ? colors.primary : colors.surface.inset },
                ]}
                accessibilityLabel="Senden"
              >
                <Send size={16} color={input.trim() ? colors.primaryForeground : colors.text.muted} />
              </Touchable>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function TaviActionCard({
  action,
  onRun,
  onChoose,
}: {
  action: TaviChatAction;
  onRun: (action: TaviChatAction) => void;
  onChoose: (value: string) => void;
}) {
  const { colors, spacing, radius } = useTheme();

  if (action.type === 'choice' && action.options?.length) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {action.options.map((option) => (
          <Chip key={option.id} label={option.label} onPress={() => onChoose(option.value)} />
        ))}
      </View>
    );
  }

  if (action.type === 'list' && action.items?.length) {
    return (
      <View style={{ gap: spacing.xs }}>
        {action.items.map((item) => (
          <Touchable
            key={item.id}
            onPress={() => onRun({ type: 'navigate', route: item.route, id: item.id })}
            style={[
              styles.listItem,
              { borderRadius: radius.md, padding: spacing.sm, gap: spacing.md, backgroundColor: colors.surface.inset },
            ]}
          >
            <CoverImage uri={item.imageUrl} style={{ width: 40, height: 40 }} radius={radius.xs} />
            <View style={{ flex: 1 }}>
              <Text variant="labelSm" numberOfLines={1}>
                {item.name}
              </Text>
              {item.description ? (
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <ArrowRight size={14} color={colors.text.tertiary} />
          </Touchable>
        ))}
      </View>
    );
  }

  if (action.type === 'image' && action.imageUrl) {
    return <CoverImage uri={action.imageUrl} style={{ height: 180 }} radius={radius.lg} />;
  }

  return (
    <Touchable onPress={() => onRun(action)}>
      <Card variant="inset">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Text variant="label" style={{ flex: 1 }}>
            {action.title ?? 'Öffnen'}
          </Text>
          <ArrowRight size={15} color={colors.primary} />
        </View>
      </Card>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  taviAvatar: { width: 120, height: 120 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth },
  bubble: { maxWidth: '86%', borderWidth: StyleSheet.hairlineWidth },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  sendButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center' },
});

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Send,
  Sparkles,
  Palette,
  ArrowRight,
  Image as ImageIcon,
  BookOpen,
  Users,
  FileText,
  Wand2,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';
import type {
  TaviChatAction,
  TaviChatResponse,
  TaviHistoryMessage,
  TaviListItem,
} from '../../types/tavi';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import { useOptionalUserAccess } from '../../contexts/UserAccessContext';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { NavIcon } from '../navigation/NavIcon';
import './TaviChat.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  sender: 'tavi' | 'user';
  text: string;
  timestamp: Date;
  actions?: TaviChatAction[];
}

interface TaviChatProps {
  isOpen: boolean;
  onClose: () => void;
}

type TranslateWithFallback = (key: string, fallback?: string) => string;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Tavi's own face next to his messages (the same genie as in the header and the tab bar). */
const TaviFace: React.FC = () => (
  <div
    aria-hidden
    className="h-8 w-8 flex-shrink-0 rounded-full bg-[var(--talea-accent-terracotta-soft)] bg-cover bg-center ring-2 ring-[var(--talea-surface-primary)] shadow-[var(--talea-shadow-soft)]"
    style={{ backgroundImage: 'url(/tavi.png)' }}
  />
);

const TypingDots: React.FC<{ isDark: boolean }> = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="flex max-w-[80%] items-end gap-2 self-start"
  >
    <TaviFace />
    <div className="rounded-2xl rounded-bl-sm border border-border bg-card/90 px-4 py-3 shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full bg-[var(--primary)]"
            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  </motion.div>
);

// Image display in chat
const ChatImage: React.FC<{ imageUrl: string; prompt?: string }> = ({ imageUrl, prompt }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.15 }}
    className="mt-2 overflow-hidden rounded-xl border border-border shadow-md"
  >
    <img
      src={imageUrl}
      alt={prompt || 'Generated image'}
      className="h-auto max-h-[300px] w-full object-cover"
      loading="lazy"
    />
    {prompt && (
      <div className="flex items-center gap-1.5 border-t border-border bg-card/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        <ImageIcon size={10} />
        <span className="line-clamp-1">{prompt}</span>
      </div>
    )}
  </motion.div>
);

// Content list display in chat
const ChatList: React.FC<{
  items: TaviListItem[];
  onNavigate: (route: string) => void;
}> = ({ items, onNavigate }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.15 }}
    className="mt-2 flex flex-col gap-1.5"
  >
    {items.map((item, i) => (
      <motion.button
        key={item.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 + i * 0.05 }}
        onClick={() => onNavigate(item.route)}
        className="flex items-center gap-2.5 rounded-xl border border-border bg-card/80 px-3 py-2 text-left transition-colors hover:bg-accent/80"
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent">
            {item.route.includes('avatar') ? (
              <Users size={14} className="text-muted-foreground" />
            ) : item.route.includes('story') ? (
              <BookOpen size={14} className="text-muted-foreground" />
            ) : (
              <FileText size={14} className="text-muted-foreground" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-foreground">{item.name}</div>
          {item.description && (
            <div className="truncate text-[10px] text-muted-foreground">{item.description}</div>
          )}
        </div>
        <ArrowRight size={12} className="flex-shrink-0 text-muted-foreground" />
      </motion.button>
    ))}
  </motion.div>
);

const ChoiceButtons: React.FC<{
  options: NonNullable<TaviChatAction['options']>;
  onSelect: (value: string) => void;
  disabled: boolean;
}> = ({ options, onSelect, disabled }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.18 }}
    className="mt-2 flex flex-wrap gap-2"
    role="group"
    aria-label="Antwortmöglichkeiten"
  >
    {options.map((option) => (
      <motion.button
        key={option.id}
        type="button"
        whileHover={disabled ? undefined : { scale: 1.02, y: -1 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        disabled={disabled}
        onClick={() => onSelect(option.value)}
        className="rounded-xl border border-[var(--talea-text-tertiary)]/25 bg-[var(--talea-text-tertiary)]/10 px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-[var(--talea-text-tertiary)]/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {option.label}
      </motion.button>
    ))}
  </motion.div>
);

// Action button for created content or navigation
const ActionButton: React.FC<{
  action: TaviChatAction;
  onAction: (route: string, action: TaviChatAction) => void;
  t: TranslateWithFallback;
}> = ({ action, onAction, t }) => {
  const getLabel = () => {
    switch (action.type) {
      case 'story':
        return action.title
          ? `${t('chat.openStory', 'Story öffnen')}: ${action.title}`
          : t('chat.openStory', 'Story öffnen');
      case 'doku':
        return action.title
          ? `${t('chat.openDoku', 'Doku öffnen')}: ${action.title}`
          : t('chat.openDoku', 'Doku öffnen');
      case 'avatar':
        return action.title
          ? `${t('chat.openAvatar', 'Avatar ansehen')}: ${action.title}`
          : t('chat.openAvatar', 'Avatar ansehen');
      case 'wizard_prefill':
        return action.wizardType === 'story'
          ? t('chat.openWizard', 'Wizard öffnen')
          : action.wizardType === 'avatar'
            ? t('chat.openAvatarWizard', 'Avatar-Wizard öffnen')
            : t('chat.openDokuWizard', 'Doku-Wizard öffnen');
      case 'navigate':
        return action.title || t('chat.navigate', 'Seite öffnen');
      default:
        return t('chat.open', 'Öffnen');
    }
  };

  const getIcon = () => {
    switch (action.type) {
      case 'wizard_prefill':
        return <Wand2 size={13} />;
      case 'navigate':
        return <ExternalLink size={13} />;
      default:
        return <ArrowRight size={13} />;
    }
  };

  if (action.type === 'image' || action.type === 'list') return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.25 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onAction(action.route || '/', action)}
      className="mt-1 inline-flex items-center gap-2 self-start rounded-xl border border-border bg-accent/80 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
    >
      {getLabel()}
      {getIcon()}
    </motion.button>
  );
};

// Message bubble with all action types
const MessageBubble: React.FC<{
  message: Message;
  onAction: (route: string, action: TaviChatAction) => void;
  onChoice: (value: string) => void;
  choicesDisabled: boolean;
  t: TranslateWithFallback;
}> = ({ message, onAction, onChoice, choicesDisabled, t }) => {
  const isTavi = message.sender === 'tavi';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, x: isTavi ? -20 : 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className={`flex max-w-[85%] items-end gap-2 ${isTavi ? 'self-start' : 'self-end flex-row-reverse'}`}
    >
      {isTavi && (
        <TaviFace />
      )}

      <div className="flex flex-col gap-1">
        <div
          className={`whitespace-pre-wrap break-words px-4 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] ${
            isTavi
              ? 'rounded-2xl rounded-bl-sm border border-border bg-card/90 text-foreground shadow-sm backdrop-blur-md'
              : 'rounded-2xl rounded-br-sm bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_6px_16px_-8px_color-mix(in_srgb,var(--primary)_70%,transparent)]'
          }`}
        >
          {message.text}
        </div>

        {/* Render actions */}
        {message.actions?.map((action, idx) => {
          // Image action - show inline image
          if (action.type === 'image' && action.imageUrl) {
            return (
              <ChatImage
                key={`img-${idx}`}
                imageUrl={action.imageUrl}
                prompt={action.imagePrompt}
              />
            );
          }

          // List action - show content list
          if (action.type === 'list' && action.items && action.items.length > 0) {
            return (
              <ChatList
                key={`list-${idx}`}
                items={action.items}
                onNavigate={(route) => onAction(route, action)}
              />
            );
          }

          if (action.type === 'choice' && action.options && action.options.length > 0) {
            return (
              <ChoiceButtons
                key={`choice-${idx}`}
                options={action.options}
                onSelect={onChoice}
                disabled={choicesDisabled}
              />
            );
          }

          // Clickable action buttons for story/doku/avatar/wizard/navigate
          return (
            <ActionButton key={`action-${idx}`} action={action} onAction={onAction} t={t} />
          );
        })}
      </div>
    </motion.div>
  );
};

const QuickSuggestions: React.FC<{
  onSelect: (text: string) => void;
  t: TranslateWithFallback;
}> = ({ onSelect, t }) => {
  // The app's own pictures instead of emoji: the same glyph a child knows from the tab bar.
  const suggestions: Array<{ text: string; icon: React.ReactNode }> = [
    { text: t('chat.suggestion_story', 'Erzähl mir eine Geschichte'), icon: <NavIcon name="stories" active className="h-[18px] w-[18px]" /> },
    { text: t('chat.suggestion_doku', 'Erstelle eine Doku'), icon: <NavIcon name="dokus" active className="h-[18px] w-[18px]" /> },
    { text: t('chat.suggestion_avatar', 'Neuen Avatar erstellen'), icon: <NavIcon name="avatars" active className="h-[18px] w-[18px]" /> },
    { text: t('chat.suggestion_image', 'Male mir ein Bild'), icon: <Palette className="h-[17px] w-[17px]" strokeWidth={2} /> },
    { text: t('chat.suggestion_list', 'Zeig mir meine Avatare'), icon: <NavIcon name="figures" active className="h-[18px] w-[18px]" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="mt-2 flex flex-wrap gap-2 px-1"
    >
      {suggestions.map((suggestion, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 + i * 0.1 }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onSelect(suggestion.text)}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] py-1.5 pl-2.5 pr-3.5 text-[13.5px] font-medium text-[var(--talea-text-primary)] shadow-[var(--talea-shadow-soft)] transition-colors hover:border-[var(--talea-border-accent)] hover:bg-[var(--talea-accent-terracotta-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          <span aria-hidden className="flex text-[var(--primary)]">{suggestion.icon}</span>
          {suggestion.text}
        </motion.button>
      ))}
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TaviChat: React.FC<TaviChatProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const backend = useBackend();
  const { resolvedTheme } = useTheme();
  const activeProfile = useOptionalChildProfiles()?.activeProfile ?? null;
  const { billing, refresh: refreshUserAccess } = useOptionalUserAccess();
  const translate = (key: string, fallback?: string): string => {
    const translator = t as unknown as (
      query: string,
      options?: { defaultValue?: string }
    ) => string;
    const result = translator(key, { defaultValue: fallback ?? key });
    return typeof result === 'string' ? result : fallback ?? key;
  };

  const welcomeText = useMemo(() => {
    if (!activeProfile) {
      return translate('chat.welcome', 'Hi, ich bin Tavi.');
    }
    return `Hi ${activeProfile.name}, ich bin Tavi! Ich kann Geschichten, Dokus, Avatare und Bilder f\u00fcr dich erstellen. Was m\u00f6chtest du machen?`;
  }, [activeProfile, translate]);

  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'tavi', text: welcomeText, timestamp: new Date() },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [mobileViewport, setMobileViewport] = useState<{ height: number; top: number } | null>(null);
  const isDark = resolvedTheme === 'dark';
  const tWithFallback: TranslateWithFallback = (key, fallback) => translate(key, fallback);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const container = messagesRef.current;
      if (!container) return;
      // Keep the introduction at the top. Scroll only the chat's own history.
      container.scrollTo({ top: messages.length === 1 ? 0 : container.scrollHeight, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, messages, isLoading]);

  useEffect(() => {
    if (!isOpen) { setMobileViewport(null); return; }
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateViewport = () => {
      // Pinch zoom keeps its normal browser behavior; only keyboard / browser
      // chrome resizing on phones changes the dialog's dimensions.
      setMobileViewport(window.innerWidth < 768 && viewport.scale === 1
        ? { height: viewport.height, top: viewport.offsetTop }
        : null);
    };
    updateViewport();
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, [isOpen]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length > 1) return prev;
      return [{ id: prev[0]?.id || '1', sender: 'tavi', text: welcomeText, timestamp: new Date() }];
    });
  }, [welcomeText]);

  useEffect(() => {
    if (isOpen) void refreshUserAccess();
  }, [isOpen, refreshUserAccess]);

  // Build history for API from current messages
  const buildHistory = (): TaviHistoryMessage[] => {
    return messages
      .filter((m) => m.id !== '1') // skip initial welcome
      .slice(-10) // last 10 messages
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputMessage(text);
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
    setWordCount(words.length);
  };

  const sendMessage = async (text: string) => {
    const messageText = text.trim();
    const sentWordCount = messageText.split(/\s+/).filter(Boolean).length;
    if (!messageText || isLoading || isOutOfChatCredits || sentWordCount > 100) return;
    setShowSuggestions(false);

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setWordCount(0);
    setIsLoading(true);

    try {
      const history = buildHistory();
      const data = await backend.tavi.taviChat({
        message: userMessage.text,
        history,
        context: {
          language: i18n.language,
          profileId: activeProfile?.id,
        },
      }) as TaviChatResponse;

      const taviMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'tavi',
        text: data.response,
        timestamp: new Date(),
        actions: data.actions,
      };

      setMessages((prev) => [...prev, taviMessage]);
      void refreshUserAccess();
    } catch (error) {
      console.error('Tavi chat error:', error);

      let errorText = translate('chat.error', 'Etwas ist schiefgelaufen.');
      if (error instanceof Error && process.env.NODE_ENV === 'development') {
        errorText = `Debug: ${error.message}`;
      }

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'tavi', text: errorText, timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => sendMessage(inputMessage);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAction = (route: string, action: TaviChatAction) => {
    onClose();

    // For wizard_prefill, pass wizard data via navigation state
    if (action.type === 'wizard_prefill' && action.wizardData) {
      navigate(route, { state: { taviPrefill: action.wizardData } });
    } else {
      navigate(route);
    }
  };

  const handleSuggestion = (text: string) => {
    setInputMessage(text);
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
    setWordCount(words.length);
    sendMessage(text);
  };

  const isOverLimit = wordCount > 100;
  const remainingChatCredits = billing?.chatCredits.remaining;
  const chatQuotaLabel = remainingChatCredits === undefined
    ? '-'
    : remainingChatCredits === null ? '\u221e' : remainingChatCredits;
  const isOutOfChatCredits = remainingChatCredits !== undefined && remainingChatCredits !== null && remainingChatCredits <= 0;
  const canSend = !isLoading && !isOutOfChatCredits && inputMessage.trim().length > 0 && !isOverLimit;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="tavi-chat-dialog flex w-[500px] max-w-[calc(100%_-_2rem)] flex-col gap-0 overflow-hidden rounded-3xl border p-0 shadow-2xl backdrop-blur-2xl motion-reduce:animate-none [&>button]:hidden"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          titleRef.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus({ preventScroll: true });
        }}
        style={{
          '--tavi-viewport-height': mobileViewport ? `${mobileViewport.height}px` : undefined,
          '--tavi-viewport-top': mobileViewport ? `${mobileViewport.top}px` : undefined,
          background: 'color-mix(in srgb, var(--talea-page-solid) 97%, transparent)',
          borderColor: 'var(--talea-border-light)',
          boxShadow: isDark
            ? '0 28px 60px -12px rgba(0,0,0,0.65)'
            : '0 28px 60px -12px rgba(62,40,31,0.28)',
        } as React.CSSProperties}
      >
        {/* Header */}
        <div className="relative flex shrink-0 items-center justify-between border-b border-border px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              <div
                className="h-11 w-11 rounded-full bg-[var(--talea-accent-terracotta-soft)] bg-cover bg-center ring-2 ring-[var(--talea-surface-primary)] shadow-[var(--talea-shadow-medium)]"
                style={{ backgroundImage: 'url(/tavi.png)' }}
              />
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--talea-surface-primary)] bg-[var(--talea-success)]" />
            </div>

            <div className="min-w-0">
              <DialogTitle asChild><h3 ref={titleRef} tabIndex={-1} className="font-[Fredoka] text-base font-bold text-foreground outline-none">
                {t('chat.title')}
              </h3></DialogTitle>
              <DialogDescription asChild><p className="text-[11px] font-medium text-muted-foreground">
                {t('chat.subtitle')}
              </p></DialogDescription>
              <p className="mt-1 inline-flex max-w-full truncate rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                {chatQuotaLabel} Anfragen &uuml;brig
              </p>
            </div>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.08, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            aria-label="Tavi-Chat schließen"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            <X size={16} />
          </motion.button>
        </div>

        {/* Messages */}
        <div ref={messagesRef} className="tavi-chat-messages flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4" role="log" aria-label="Unterhaltung mit Tavi" aria-relevant="additions">
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onAction={handleAction}
                onChoice={sendMessage}
                choicesDisabled={isLoading || isOutOfChatCredits}
                t={tWithFallback}
              />
            ))}
            {isLoading && <TypingDots isDark={isDark} key="typing" />}
          </AnimatePresence>

          {showSuggestions && messages.length === 1 && (
            <QuickSuggestions onSelect={handleSuggestion} t={tWithFallback} />
          )}

        </div>

        {/* Input */}
        <div className="tavi-chat-composer shrink-0 border-t border-border bg-card/40 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
          {/* The counter only appears near the limit; an empty chat starts without "0/100". */}
          {wordCount >= 80 ? (
            <div
              className={`mb-1.5 text-right text-[11px] font-semibold tabular-nums ${isOverLimit ? 'text-[var(--talea-danger)]' : 'text-muted-foreground'}`}
            >
              {wordCount}/100 {t('chat.words')}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                value={inputMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder={isOutOfChatCredits ? 'Chat-Kontingent aufgebraucht' : t('chat.placeholder')}
                aria-label={translate('chat.placeholder', 'Frag Tavi etwas')}
                disabled={isLoading || isOutOfChatCredits}
                maxLength={600}
                className="w-full rounded-full border border-transparent bg-[var(--talea-surface-inset)] px-5 py-3 text-base text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-[var(--talea-border-accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--primary)_14%,transparent)] md:text-sm"
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Sparkles
                    size={14}
                    className="animate-pulse text-[var(--primary)]"
                  />
                </div>
              )}
            </div>

            <motion.button
              type="button"
              aria-label="Nachricht an Tavi senden"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleSendMessage}
              disabled={!canSend}
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                canSend
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_8px_18px_-8px_color-mix(in_srgb,var(--primary)_75%,transparent)]'
                  : 'cursor-not-allowed bg-[var(--talea-surface-inset)] text-muted-foreground'
              }`}
            >
              <Send size={16} />
            </motion.button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default TaviChat;

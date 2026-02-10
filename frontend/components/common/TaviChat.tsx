import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Sparkles, Bot, ArrowRight } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';
import type { TaviChatAction, TaviChatResponse } from '../../types/tavi';

interface Message {
  id: string;
  sender: 'tavi' | 'user';
  text: string;
  timestamp: Date;
  action?: TaviChatAction;
}

interface TaviChatProps {
  isOpen: boolean;
  onClose: () => void;
}

type TranslateWithFallback = (key: string, fallback?: string) => string;

const TypingDots: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="flex max-w-[80%] items-end gap-2 self-start"
  >
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6f8fbf] to-[#4f8f7c] shadow-md">
      <Bot size={14} className="text-white" />
    </div>
    <div className="rounded-2xl rounded-bl-sm border border-border bg-card/90 px-4 py-3 shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full"
            style={{ background: isDark ? '#9eb3d9' : '#7e96c7' }}
            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  </motion.div>
);

const MessageBubble: React.FC<{
  message: Message;
  onAction: (route: string) => void;
  t: TranslateWithFallback;
}> = ({ message, onAction, t }) => {
  const isTavi = message.sender === 'tavi';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, x: isTavi ? -20 : 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className={`flex max-w-[85%] items-end gap-2 ${isTavi ? 'self-start' : 'self-end flex-row-reverse'}`}
    >
      {isTavi && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6f8fbf] to-[#4f8f7c] shadow-md">
          <Bot size={14} className="text-white" />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div
          className={`whitespace-pre-wrap px-4 py-2.5 text-sm leading-relaxed ${
            isTavi
              ? 'rounded-2xl rounded-bl-sm border border-border bg-card/90 text-foreground shadow-sm backdrop-blur-md'
              : 'rounded-2xl rounded-br-sm bg-gradient-to-br from-[#6f8fbf] to-[#4f8f7c] text-white shadow-lg shadow-slate-500/20'
          }`}
        >
          {message.text}
        </div>

        {message.action && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onAction(message.action?.route || '/')}
            className="mt-1 inline-flex items-center gap-2 self-start rounded-xl border border-border bg-accent/80 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
          >
            {message.action.type === 'story'
              ? t('chat.openStory', 'Story oeffnen')
              : t('chat.openDoku', 'Doku oeffnen')}
            <ArrowRight size={13} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

const QuickSuggestions: React.FC<{
  onSelect: (text: string) => void;
  t: TranslateWithFallback;
}> = ({ onSelect, t }) => {
  const suggestions = [
    { text: t('chat.suggestion_story', 'Erzaehl mir eine Geschichte'), emoji: '📖' },
    { text: t('chat.suggestion_doku', 'Erstelle eine Doku'), emoji: '📚' },
    { text: t('chat.suggestion_avatar', 'Neuen Avatar erstellen'), emoji: '✨' },
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
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(suggestion.text)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/85 px-3 py-1.5 text-xs font-medium text-foreground/80 shadow-sm transition-colors hover:border-[#6f8fbf]/45 hover:text-[#4f8f7c] dark:hover:text-[#6f8fbf]"
        >
          <span>{suggestion.emoji}</span>
          {suggestion.text}
        </motion.button>
      ))}
    </motion.div>
  );
};

const TaviChat: React.FC<TaviChatProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const backend = useBackend();
  const { getToken } = useAuth();
  const { resolvedTheme } = useTheme();
  const translate = (key: string, fallback?: string): string => {
    const translator = t as unknown as (
      query: string,
      options?: { defaultValue?: string }
    ) => string;
    const result = translator(key, { defaultValue: fallback ?? key });
    return typeof result === 'string' ? result : fallback ?? key;
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'tavi',
      text: translate('chat.welcome', 'Hi, ich bin Tavi.'),
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [pendingIntent, setPendingIntent] = useState<'story' | 'doku' | null>(null);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = resolvedTheme === 'dark';

  const tWithFallback: TranslateWithFallback = (key, fallback) => translate(key, fallback);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 260);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputMessage(text);
    const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
    setWordCount(words.length);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || wordCount > 50) return;

    setShowSuggestions(false);

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setWordCount(0);
    setIsLoading(true);

    try {
      const backendClient = backend as any;
      const baseUrl = backendClient.target || 'http://localhost:4005';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const token = await getToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const intentHint = pendingIntent ?? undefined;
      const pendingRequestText = pendingRequest ?? undefined;

      const response = await fetch(`${baseUrl}/tavi/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage.text,
          context: {
            language: i18n.language,
            intentHint,
            pendingRequest: pendingRequestText,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: TaviChatResponse = await response.json();

      const taviMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'tavi',
        text: data.response,
        timestamp: new Date(),
        action: data.action,
      };

      setMessages((prev) => [...prev, taviMessage]);

      if (data.action) {
        setPendingIntent(null);
        setPendingRequest(null);
      } else if (data.intentHint) {
        setPendingIntent(data.intentHint);
        setPendingRequest(data.awaitingConfirmation ? userMessage.text : null);
      } else if (intentHint) {
        setPendingIntent(null);
        setPendingRequest(null);
      }
    } catch (error) {
      console.error('Tavi chat error:', error);

      let errorText = translate('chat.error', 'Etwas ist schiefgelaufen.');
      if (error instanceof Error && process.env.NODE_ENV === 'development') {
        errorText = `Debug: ${error.message}`;
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'tavi',
        text: errorText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
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

  const handleAction = (route: string) => {
    onClose();
    navigate(route);
  };

  const handleSuggestion = (text: string) => {
    setInputMessage(text);
    const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
    setWordCount(words.length);
    sendMessage(text);
  };

  const isOverLimit = wordCount > 50;
  const canSend = !isLoading && inputMessage.trim().length > 0 && !isOverLimit;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm dark:bg-black/50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 34 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[680px] max-h-[88vh] w-[460px] max-w-[92vw] flex-col overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-2xl"
            style={{
              background: isDark ? 'rgba(23,31,44,0.95)' : 'rgba(255,251,245,0.96)',
              borderColor: isDark ? '#33465f' : '#e3d7c8',
              boxShadow: isDark
                ? '0 24px 52px rgba(7,13,23,0.5)'
                : '0 24px 52px rgba(52,61,78,0.2)',
            }}
          >
            <div className="relative flex items-center justify-between border-b border-border px-5 py-4">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#6f8fbf] via-[#c68c95] to-[#4f8f7c]" />

              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className="h-11 w-11 rounded-full border-[2.5px] border-[#6f8fbf]/60 bg-cover bg-center shadow-lg shadow-slate-500/20"
                    style={{ backgroundImage: 'url(/tavi.png)' }}
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400 dark:border-[#13102B]" />
                </div>

                <div>
                  <h3 className="font-[Fredoka] text-base font-bold text-foreground">{t('chat.title')}</h3>
                  <p className="text-[11px] font-medium text-muted-foreground">{t('chat.subtitle')}</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.08, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={16} />
              </motion.button>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              <AnimatePresence mode="popLayout">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} onAction={handleAction} t={tWithFallback} />
                ))}
                {isLoading && <TypingDots isDark={isDark} key="typing" />}
              </AnimatePresence>

              {showSuggestions && messages.length === 1 && (
                <QuickSuggestions onSelect={handleSuggestion} t={tWithFallback} />
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border bg-card/40 px-4 pb-4 pt-3">
              <div className={`mb-1.5 text-right text-[10px] font-semibold ${isOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
                {wordCount}/50 {t('chat.words')}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    value={inputMessage}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder={t('chat.placeholder')}
                    disabled={isLoading}
                    maxLength={300}
                    className="w-full rounded-2xl border border-border bg-card/80 px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-[#6f8fbf]/50 focus:ring-2 focus:ring-[#6f8fbf]/20"
                  />
                  {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Sparkles size={14} className="animate-pulse text-[#6f8fbf]" />
                    </div>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleSendMessage}
                  disabled={!canSend}
                  className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl transition-all ${
                    canSend
                      ? 'bg-gradient-to-br from-[#6f8fbf] to-[#4f8f7c] text-white shadow-lg shadow-slate-500/25 hover:shadow-slate-500/40'
                      : 'cursor-not-allowed border border-border bg-card/70 text-muted-foreground'
                  }`}
                >
                  <Send size={16} />
                </motion.button>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#6f8fbf]/10 to-transparent" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TaviChat;

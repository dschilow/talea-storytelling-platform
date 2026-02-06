import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Bot, ArrowRight } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackend } from '../../hooks/useBackend';
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

/* ─── Typing indicator dots ─── */
const TypingDots: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="flex items-center gap-2 self-start max-w-[80%]"
  >
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#A989F2] to-[#7C5CE0] flex items-center justify-center shadow-md flex-shrink-0">
      <Bot size={14} className="text-white" />
    </div>
    <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white/[0.06] backdrop-blur-md border border-white/[0.08] shadow-sm">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-[#A989F2]"
            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  </motion.div>
);

/* ─── Message bubble ─── */
const MessageBubble: React.FC<{
  message: Message;
  onAction: (route: string) => void;
  t: any;
}> = ({ message, onAction, t }) => {
  const isTavi = message.sender === 'tavi';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, x: isTavi ? -20 : 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex items-end gap-2 ${isTavi ? 'self-start' : 'self-end flex-row-reverse'} max-w-[85%]`}
    >
      {/* Avatar */}
      {isTavi && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#A989F2] to-[#7C5CE0] flex items-center justify-center shadow-md flex-shrink-0 mb-1">
          <Bot size={14} className="text-white" />
        </div>
      )}

      <div className="flex flex-col gap-1">
        {/* Bubble */}
        <div
          className={`px-4 py-2.5 leading-relaxed text-sm whitespace-pre-wrap ${
            isTavi
              ? 'rounded-2xl rounded-bl-sm bg-white/[0.06] backdrop-blur-md border border-white/[0.08] text-white/90 shadow-sm'
              : 'rounded-2xl rounded-br-sm bg-gradient-to-br from-[#A989F2] to-[#7C5CE0] text-white shadow-lg shadow-purple-500/20'
          }`}
        >
          {message.text}
        </div>

        {/* Action button */}
        {message.action && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onAction(message.action?.route || '/')}
            className="mt-1 self-start flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#A989F2]/15 to-[#FF6B9D]/15 dark:from-[#A989F2]/25 dark:to-[#FF6B9D]/25 border border-[#A989F2]/30 text-[#7C5CE0] dark:text-[#A989F2] text-xs font-semibold hover:from-[#A989F2]/25 hover:to-[#FF6B9D]/25 transition-colors"
          >
            {message.action.type === 'story'
              ? t('chat.openStory', 'Story öffnen')
              : t('chat.openDoku', 'Doku öffnen')}
            <ArrowRight size={13} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

/* ─── Quick suggestion pills ─── */
const QuickSuggestions: React.FC<{
  onSelect: (text: string) => void;
  t: any;
}> = ({ onSelect, t }) => {
  const suggestions = [
    { text: t('chat.suggestion_story', 'Erzähl mir eine Geschichte'), emoji: '📖' },
    { text: t('chat.suggestion_doku', 'Erstelle eine Doku'), emoji: '📚' },
    { text: t('chat.suggestion_avatar', 'Neuen Avatar erstellen'), emoji: '✨' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="flex flex-wrap gap-2 px-1 mt-2"
    >
      {suggestions.map((s, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 + i * 0.1 }}
          whileHover={{ scale: 1.05, y: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(s.text)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] text-white/70 hover:border-[#A989F2]/40 hover:text-[#A989F2] transition-colors shadow-sm"
        >
          <span>{s.emoji}</span>
          {s.text}
        </motion.button>
      ))}
    </motion.div>
  );
};

/* ─── Main Chat Component ─── */
const TaviChat: React.FC<TaviChatProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const backend = useBackend();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'tavi',
      text: t('chat.welcome'),
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputMessage(text);
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
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
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const intentHint = pendingIntent ?? undefined;
      const pendingRequestText = pendingRequest ?? undefined;
      const response = await fetch(`${baseUrl}/tavi/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage.text,
          context: { language: i18n.language, intentHint, pendingRequest: pendingRequestText },
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
        if (data.awaitingConfirmation) {
          setPendingRequest(userMessage.text);
        } else {
          setPendingRequest(null);
        }
      } else if (intentHint) {
        setPendingIntent(null);
        setPendingRequest(null);
      }
    } catch (error) {
      console.error('Tavi chat error:', error);

      let errorText = t('chat.error');
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
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm"
          />

          {/* Chat card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-[460px] max-w-[92vw] h-[680px] max-h-[88vh] flex flex-col overflow-hidden rounded-3xl bg-[#13102B]/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-purple-500/10"
          >
            {/* ── Header ── */}
            <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              {/* Gradient stripe */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#A989F2] via-[#FF6B9D] to-[#FF9B5C]" />

              <div className="flex items-center gap-3">
                {/* Tavi avatar */}
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative"
                >
                  <div className="w-11 h-11 rounded-full bg-cover bg-center border-[2.5px] border-[#A989F2]/60 shadow-lg shadow-purple-500/20" style={{ backgroundImage: 'url(/tavi.png)' }} />
                  {/* Online dot */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#13102B]" />
                </motion.div>

                <div>
                  <h3 className="text-base font-bold text-white font-[Fredoka]">
                    {t('chat.title')}
                  </h3>
                  <p className="text-[11px] text-white/50 font-medium">
                    {t('chat.subtitle')}
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.12] transition-colors shadow-sm"
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 scroll-smooth">
              <AnimatePresence mode="popLayout">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} onAction={handleAction} t={t} />
                ))}

                {isLoading && <TypingDots key="typing" />}
              </AnimatePresence>

              {/* Quick suggestions after welcome */}
              {showSuggestions && messages.length === 1 && (
                <QuickSuggestions onSelect={handleSuggestion} t={t} />
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input area ── */}
            <div className="px-4 pt-3 pb-4 border-t border-white/[0.08] bg-white/[0.03]">
              {/* Word count */}
              <div className={`text-[10px] font-semibold mb-1.5 text-right ${isOverLimit ? 'text-red-500' : 'text-white/40'}`}>
                {wordCount}/50 {t('chat.words')}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    value={inputMessage}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder={t('chat.placeholder')}
                    disabled={isLoading}
                    maxLength={300}
                    className="w-full px-4 py-3 rounded-2xl text-sm bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] text-white placeholder-white/30 outline-none focus:border-[#A989F2]/50 focus:ring-2 focus:ring-[#A989F2]/20 transition-all"
                  />
                  {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Sparkles size={14} className="text-[#A989F2] animate-pulse" />
                    </div>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleSendMessage}
                  disabled={!canSend}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${
                    canSend
                      ? 'bg-gradient-to-br from-[#A989F2] to-[#7C5CE0] text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40'
                      : 'bg-white/[0.06] text-white/30 cursor-not-allowed'
                  }`}
                >
                  <Send size={16} className={canSend ? '' : ''} />
                </motion.button>
              </div>
            </div>

            {/* ── Decorative bottom glow ── */}
            <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-[#A989F2]/5 to-transparent pointer-events-none" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TaviChat;

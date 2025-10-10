import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows, animations } from '../../utils/constants/spacing';
import Button from './Button';
import { useBackend } from '../../hooks/useBackend';
import type { TaviChatRequest, TaviChatResponse } from '../../types/tavi';

interface Message {
  id: string;
  sender: 'tavi' | 'user';
  text: string;
  timestamp: Date;
}

interface TaviChatProps {
  isOpen: boolean;
  onClose: () => void;
}

const TaviChat: React.FC<TaviChatProps> = ({ isOpen, onClose }) => {
  const backend = useBackend();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'tavi',
      text: '✨ Hallo! Ich bin Tavi, dein magisches Geschichten-Genie! Wie kann ich dir heute helfen? 🧞‍♂️',
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
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
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputMessage(text);
    
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || wordCount > 50) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
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

      const response = await fetch(`${baseUrl}/tavi/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: userMessage.text }),
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
      };

      setMessages(prev => [...prev, taviMessage]);
    } catch (error) {
      console.error('Tavi chat error:', error);
      
      let errorText = 'Entschuldige, meine magischen Kräfte sind momentan gestört! ⚡ Versuche es gleich nochmal.';
      
      if (error instanceof Error && process.env.NODE_ENV === 'development') {
        errorText = `Debug: ${error.message}`;
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'tavi',
        text: errorText,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(169, 137, 242, 0.2)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing.lg}px`,
  };

  const chatCardStyle: React.CSSProperties = {
    width: '450px',
    maxWidth: '90vw',
    height: '650px',
    maxHeight: '85vh',
    background: colors.glass.backgroundAlt,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: `2px solid ${colors.border.light}`,
    borderRadius: `${radii.xxl}px`,
    boxShadow: shadows.xl,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  };

  const headerStyle: React.CSSProperties = {
    padding: `${spacing.xl}px`,
    borderBottom: `2px solid ${colors.border.light}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: colors.lavender[50] + '40',
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.text.primary,
    display: 'flex',
    alignItems: 'center',
    gap: `${spacing.sm}px`,
  };

  const taviIconStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundImage: 'url(/tavi.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: `3px solid ${colors.lavender[400]}`,
    boxShadow: shadows.glow.lavender,
  };

  const closeButtonStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: `2px solid ${colors.border.light}`,
    background: colors.background.card,
    color: colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `all ${animations.duration.fast} ${animations.easing.smooth}`,
  };

  const messagesContainerStyle: React.CSSProperties = {
    flex: 1,
    padding: `${spacing.xl}px`,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing.md}px`,
  };

  const messageBaseStyle: React.CSSProperties = {
    maxWidth: '80%',
    padding: `${spacing.md}px ${spacing.lg}px`,
    borderRadius: `${radii.lg}px`,
    ...typography.textStyles.body,
    lineHeight: '1.6',
    wordWrap: 'break-word',
  };

  const taviMessageStyle: React.CSSProperties = {
    ...messageBaseStyle,
    alignSelf: 'flex-start',
    background: colors.glass.background,
    color: colors.text.primary,
    border: `2px solid ${colors.border.light}`,
    boxShadow: shadows.soft,
  };

  const userMessageStyle: React.CSSProperties = {
    ...messageBaseStyle,
    alignSelf: 'flex-end',
    background: colors.gradients.primary,
    color: colors.text.inverse,
    boxShadow: shadows.colored.lavender,
  };

  const inputContainerStyle: React.CSSProperties = {
    padding: `${spacing.xl}px`,
    borderTop: `2px solid ${colors.border.light}`,
    background: colors.lavender[50] + '40',
  };

  const inputWrapperStyle: React.CSSProperties = {
    display: 'flex',
    gap: `${spacing.sm}px`,
    alignItems: 'flex-end',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: `${spacing.md}px ${spacing.lg}px`,
    borderRadius: `${radii.lg}px`,
    border: `2px solid ${colors.border.light}`,
    background: colors.background.card,
    color: colors.text.primary,
    ...typography.textStyles.body,
    outline: 'none',
    resize: 'none',
    minHeight: '48px',
    maxHeight: '120px',
    transition: `all ${animations.duration.fast} ${animations.easing.smooth}`,
  };

  const wordCountStyle: React.CSSProperties = {
    ...typography.textStyles.caption,
    color: wordCount > 50 ? colors.semantic.error : colors.text.tertiary,
    fontWeight: '600',
    marginBottom: `${spacing.xs}px`,
    textAlign: 'right',
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: `${spacing.sm}px`,
    padding: `${spacing.md}px ${spacing.lg}px`,
    background: colors.glass.background,
    border: `2px solid ${colors.border.light}`,
    borderRadius: `${radii.lg}px`,
    alignSelf: 'flex-start',
    maxWidth: '80%',
    boxShadow: shadows.soft,
  };

  return (
    <div style={containerStyle} onClick={onClose}>
      <div style={chatCardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={titleStyle}>
            <div style={taviIconStyle} />
            <div>
              <div>Tavi - Dein Genie</div>
              <div style={{ ...typography.textStyles.caption, color: colors.text.tertiary, fontWeight: '500' }}>
                ✨ Immer bereit zu helfen
              </div>
            </div>
          </div>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.borderColor = colors.lavender[400];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = colors.border.light;
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={messagesContainerStyle}>
          {messages.map((message) => (
            <div
              key={message.id}
              style={message.sender === 'tavi' ? taviMessageStyle : userMessageStyle}
            >
              {message.text}
            </div>
          ))}
          
          {isLoading && (
            <div style={loadingStyle}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: colors.lavender[600] }} />
              <span style={{ color: colors.text.secondary, ...typography.textStyles.bodySm }}>
                Tavi denkt nach... ✨
              </span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div style={inputContainerStyle}>
          <div style={wordCountStyle}>
            {wordCount}/50 Wörter
          </div>
          <div style={inputWrapperStyle}>
            <input
              ref={inputRef}
              style={inputStyle}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Frage Tavi etwas... 🌟"
              disabled={isLoading}
              maxLength={300}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.lavender[400];
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border.light;
              }}
            />
            <Button
              title=""
              onPress={handleSendMessage}
              variant={wordCount > 50 || !inputMessage.trim() ? 'ghost' : 'primary'}
              size="md"
              disabled={isLoading || !inputMessage.trim() || wordCount > 50}
              icon={<Send size={18} />}
            />
          </div>
        </div>

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default TaviChat;

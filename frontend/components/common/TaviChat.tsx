import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
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
    
    // Count words
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
      // Temporary manual API call until Encore client includes tavi service
      const backendClient = backend as any;
      const baseUrl = backendClient.target || 'http://localhost:4005';
      
      // Get auth headers from Clerk
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Get Clerk auth token
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
      
      // More detailed error handling for debugging
      let errorText = 'Entschuldige, meine magischen Kräfte sind momentan gestört! ⚡ Versuche es gleich nochmal.';
      
      if (error instanceof Error) {
        console.error('Detailed error:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
        // Show more specific error in development
        if (process.env.NODE_ENV === 'development') {
          errorText = `Debug: ${error.message}`;
        }
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
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing.lg}px`,
  };

  const chatCardStyle: React.CSSProperties = {
    width: '400px',
    maxWidth: '90vw',
    height: '600px',
    maxHeight: '80vh',
    background: colors.glass.heroBackground,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `1px solid ${colors.glass.border}`,
    borderRadius: `${radii.xl}px`,
    boxShadow: colors.glass.shadowStrong,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  };

  const headerStyle: React.CSSProperties = {
    padding: `${spacing.lg}px`,
    borderBottom: `1px solid ${colors.glass.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.05)',
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: `${spacing.sm}px`,
  };

  const taviIconStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundImage: 'url(/tavi.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: `2px solid ${colors.primary}`,
    boxShadow: `0 0 12px ${colors.primary}50`,
  };

  const closeButtonStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    background: colors.glass.buttonBackground,
    color: colors.textPrimary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  };

  const messagesContainerStyle: React.CSSProperties = {
    flex: 1,
    padding: `${spacing.lg}px`,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing.md}px`,
  };

  const messageBaseStyle: React.CSSProperties = {
    maxWidth: '85%',
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: `${radii.lg}px`,
    fontSize: typography.textStyles.body.fontSize,
    lineHeight: '1.4',
    wordWrap: 'break-word',
    boxShadow: shadows.sm,
  };

  const taviMessageStyle: React.CSSProperties = {
    ...messageBaseStyle,
    alignSelf: 'flex-start',
    background: colors.glass.cardBackground,
    color: colors.textPrimary,
    border: `1px solid ${colors.glass.border}`,
  };

  const userMessageStyle: React.CSSProperties = {
    ...messageBaseStyle,
    alignSelf: 'flex-end',
    background: colors.primary,
    color: colors.textInverse,
  };

  const inputContainerStyle: React.CSSProperties = {
    padding: `${spacing.lg}px`,
    borderTop: `1px solid ${colors.glass.border}`,
    background: 'rgba(255, 255, 255, 0.05)',
  };

  const inputWrapperStyle: React.CSSProperties = {
    display: 'flex',
    gap: `${spacing.sm}px`,
    alignItems: 'flex-end',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: `${radii.lg}px`,
    border: `1px solid ${colors.glass.border}`,
    background: colors.glass.buttonBackground,
    color: colors.textPrimary,
    fontSize: typography.textStyles.body.fontSize,
    outline: 'none',
    resize: 'none',
    minHeight: '44px',
    maxHeight: '120px',
  };

  const wordCountStyle: React.CSSProperties = {
    ...typography.textStyles.caption,
    color: wordCount > 50 ? colors.error || '#ef4444' : colors.textSecondary,
    fontSize: '12px',
    marginBottom: `${spacing.xs}px`,
    textAlign: 'right',
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: `${spacing.xs}px`,
    padding: `${spacing.sm}px ${spacing.md}px`,
    background: colors.glass.cardBackground,
    border: `1px solid ${colors.glass.border}`,
    borderRadius: `${radii.lg}px`,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  };

  const sparkleAnimation = {
    animation: 'sparkle 2s infinite',
  };

  return (
    <div style={containerStyle} onClick={onClose}>
      <div style={chatCardStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={titleStyle}>
            <div style={taviIconStyle} />
            Tavi - Dein Geschichten-Genie
          </div>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = colors.glass.buttonBackground;
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div style={messagesContainerStyle}>
          {messages.map((message) => (
            <div
              key={message.id}
              style={message.sender === 'tavi' ? taviMessageStyle : userMessageStyle}
            >
              {message.text}
            </div>
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div style={loadingStyle}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ color: colors.textSecondary, fontSize: '14px' }}>
                Tavi denkt nach... ✨
              </span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
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
              placeholder="Frage Tavi etwas... (max. 50 Wörter)"
              disabled={isLoading}
              maxLength={300}
            />
            <Button
              title=""
              onPress={handleSendMessage}
              variant={wordCount > 50 || !inputMessage.trim() ? 'ghost' : 'primary'}
              size="sm"
              disabled={isLoading || !inputMessage.trim() || wordCount > 50}
              icon={<Send size={16} />}
            />
          </div>
        </div>

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes sparkle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default TaviChat;
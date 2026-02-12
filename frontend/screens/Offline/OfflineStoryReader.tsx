import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, WifiOff } from 'lucide-react';
import type { Story } from '../../types/story';
import { getOfflineStory } from '../../utils/offlineDb';
import { useTheme } from '../../contexts/ThemeContext';

const headingFont = '"Cormorant Garamond", "Merriweather", serif';

const OfflineStoryReader: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDark = resolvedTheme === 'dark';

  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 34,
    restDelta: 0.001,
  });

  useEffect(() => {
    if (storyId) loadStory();
  }, [storyId]);

  const loadStory = async () => {
    if (!storyId) return;
    try {
      setLoading(true);
      const data = await getOfflineStory(storyId);
      if (!data) {
        setError('Geschichte nicht in der Offline-Bibliothek gefunden.');
        return;
      }
      setStory(data);
    } catch (err) {
      console.error('[OfflineStoryReader] Error:', err);
      setError('Fehler beim Laden der Geschichte.');
    } finally {
      setLoading(false);
    }
  };

  const bgColor = isDark ? '#121b2a' : '#f8f1e8';
  const cardBg = isDark ? 'rgba(24,35,51,0.9)' : 'rgba(255,250,243,0.92)';
  const titleColor = isDark ? '#e9f0fc' : '#253448';
  const bodyColor = isDark ? '#c4d2e5' : '#51657f';
  const subColor = isDark ? '#9aacbf' : '#6d7f95';
  const accentColor = isDark ? '#8ba3ce' : '#8e7bb7';
  const borderColor = isDark ? '#354960' : '#dfd2c2';

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: bgColor,
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            border: `3px solid ${isDark ? 'rgba(139,163,206,0.3)' : 'rgba(142,123,183,0.3)'}`,
            borderTopColor: accentColor,
          }}
        />
      </div>
    );
  }

  if (error || !story) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: bgColor, padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
        <p style={{ color: bodyColor, fontSize: 16, marginBottom: 24 }}>
          {error || 'Geschichte nicht gefunden.'}
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '10px 24px', borderRadius: 12, border: `1px solid ${borderColor}`,
            background: cardBg, color: titleColor, cursor: 'pointer', fontSize: 14,
          }}
        >
          Zur Offline-Bibliothek
        </button>
      </div>
    );
  }

  const chapters = story.chapters || story.pages || [];

  return (
    <div style={{ height: '100vh', background: bgColor, display: 'flex', flexDirection: 'column' }}>
      {/* Progress bar */}
      <motion.div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 3,
          background: accentColor, transformOrigin: '0%', scaleX, zIndex: 50,
        }}
      />

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        background: isDark ? 'rgba(20,29,43,0.78)' : 'rgba(255,250,243,0.82)',
        borderBottom: `1px solid ${borderColor}`,
        backdropFilter: 'blur(12px)',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10,
            background: 'transparent', border: `1px solid ${borderColor}`,
            color: subColor, cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: titleColor,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {story.title}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 8,
          background: 'rgba(255,107,157,0.12)', color: '#ff6b9d',
          fontSize: 11, fontWeight: 600,
        }}>
          <WifiOff size={12} />
          Offline
        </div>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
      >
        {/* Hero / Cover */}
        {story.coverImageUrl && (
          <div style={{ position: 'relative', width: '100%', height: 280 }}>
            <img
              src={story.coverImageUrl}
              alt={story.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(180deg, transparent 40%, ${bgColor} 100%)`,
            }} />
            <div style={{
              position: 'absolute', bottom: 24, left: 24, right: 24,
            }}>
              <h1 style={{
                fontSize: 28, fontWeight: 700, color: isDark ? '#fff' : '#fff',
                fontFamily: headingFont, margin: 0, textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              }}>
                {story.title}
              </h1>
            </div>
          </div>
        )}

        {/* Chapters */}
        <div style={{ padding: '24px 20px 80px', maxWidth: 700, margin: '0 auto' }}>
          {chapters.map((chapter, index) => (
            <div key={index} style={{ marginBottom: 48 }}>
              {chapter.title && (
                <h2 style={{
                  fontSize: 22, fontWeight: 700, color: titleColor,
                  fontFamily: headingFont, marginBottom: 16,
                }}>
                  {chapter.title}
                </h2>
              )}
              {chapter.imageUrl && (
                <div style={{
                  borderRadius: 16, overflow: 'hidden', marginBottom: 16,
                  border: `1px solid ${borderColor}`,
                }}>
                  <img
                    src={chapter.imageUrl}
                    alt={chapter.title || `Kapitel ${index + 1}`}
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>
              )}
              <div style={{
                fontSize: 16, lineHeight: 1.8, color: bodyColor,
                fontFamily: '"Merriweather", serif',
              }}>
                {(chapter.content || chapter.text || '').split('\n').map((paragraph: string, pIdx: number) => (
                  paragraph.trim() ? (
                    <p key={pIdx} style={{ marginBottom: 16 }}>{paragraph}</p>
                  ) : null
                ))}
              </div>
            </div>
          ))}

          {/* Ende */}
          <div style={{
            textAlign: 'center', padding: '32px 0',
            borderTop: `1px solid ${borderColor}`,
            marginTop: 32,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
            <p style={{ color: subColor, fontSize: 14, fontStyle: 'italic' }}>
              Ende der Geschichte
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineStoryReader;

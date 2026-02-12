import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, WifiOff } from 'lucide-react';
import type { Doku } from '../../types/doku';
import type { AudioDoku } from '../../types/audio-doku';
import { getOfflineDoku, getOfflineAudioDoku } from '../../utils/offlineDb';
import { useTheme } from '../../contexts/ThemeContext';

const headingFont = '"Cormorant Garamond", "Merriweather", serif';

const OfflineDokuReader: React.FC = () => {
  const { dokuId } = useParams<{ dokuId: string }>();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const [doku, setDoku] = useState<Doku | null>(null);
  const [audioDoku, setAudioDoku] = useState<AudioDoku | null>(null);
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
    if (dokuId) loadDoku();
  }, [dokuId]);

  const loadDoku = async () => {
    if (!dokuId) return;
    try {
      setLoading(true);

      // Try regular doku first, then audio doku
      const dokuData = await getOfflineDoku(dokuId);
      if (dokuData) {
        setDoku(dokuData);
        return;
      }

      const audioDokuData = await getOfflineAudioDoku(dokuId);
      if (audioDokuData) {
        setAudioDoku(audioDokuData);
        return;
      }

      setError('Doku nicht in der Offline-Bibliothek gefunden.');
    } catch (err) {
      console.error('[OfflineDokuReader] Error:', err);
      setError('Fehler beim Laden der Doku.');
    } finally {
      setLoading(false);
    }
  };

  const bgColor = isDark ? '#111b27' : '#f8f2ea';
  const cardBg = isDark ? 'rgba(22,34,50,0.9)' : 'rgba(255,250,243,0.92)';
  const titleColor = isDark ? '#e7f0fd' : '#253448';
  const bodyColor = isDark ? '#c8d7eb' : '#51657f';
  const subColor = isDark ? '#9fb2cc' : '#6d7f95';
  const accentColor = isDark ? '#78a9bb' : '#5d8f98';
  const borderColor = isDark ? '#2f435f' : '#dfd2c2';

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
            border: `3px solid ${isDark ? 'rgba(120,169,187,0.3)' : 'rgba(93,143,152,0.3)'}`,
            borderTopColor: accentColor,
          }}
        />
      </div>
    );
  }

  if (error || (!doku && !audioDoku)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: bgColor, padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
        <p style={{ color: bodyColor, fontSize: 16, marginBottom: 24 }}>
          {error || 'Doku nicht gefunden.'}
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

  // Render audio doku
  if (audioDoku) {
    return (
      <div style={{ height: '100vh', background: bgColor, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          background: isDark ? 'rgba(18,27,40,0.78)' : 'rgba(255,250,243,0.82)',
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
          <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: titleColor }}>
            {audioDoku.title}
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

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          {audioDoku.coverImageUrl && (
            <img
              src={audioDoku.coverImageUrl}
              alt={audioDoku.title}
              style={{
                width: 200, height: 200, borderRadius: 20,
                objectFit: 'cover', marginBottom: 24,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            />
          )}
          <h1 style={{
            fontSize: 24, fontWeight: 700, color: titleColor,
            fontFamily: headingFont, marginBottom: 8, textAlign: 'center',
          }}>
            {audioDoku.title}
          </h1>
          {audioDoku.topic && (
            <p style={{ color: subColor, fontSize: 14, marginBottom: 24 }}>
              {audioDoku.topic}
            </p>
          )}
          {audioDoku.audioUrl && (
            <audio
              controls
              src={audioDoku.audioUrl}
              style={{ width: '100%', maxWidth: 400 }}
            />
          )}
        </div>
      </div>
    );
  }

  // Render regular doku
  const sections = doku!.content?.sections || [];

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
        background: isDark ? 'rgba(18,27,40,0.78)' : 'rgba(255,250,243,0.82)',
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
            {doku!.title}
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
        {doku!.coverImageUrl && (
          <div style={{ position: 'relative', width: '100%', height: 280 }}>
            <img
              src={doku!.coverImageUrl}
              alt={doku!.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(180deg, transparent 40%, ${bgColor} 100%)`,
            }} />
            <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24 }}>
              <h1 style={{
                fontSize: 28, fontWeight: 700, color: '#fff',
                fontFamily: headingFont, margin: 0, textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              }}>
                {doku!.title}
              </h1>
            </div>
          </div>
        )}

        {/* Sections */}
        <div style={{ padding: '24px 20px 80px', maxWidth: 700, margin: '0 auto' }}>
          {sections.map((section, index) => (
            <div key={index} style={{ marginBottom: 48 }}>
              {section.title && (
                <h2 style={{
                  fontSize: 22, fontWeight: 700, color: titleColor,
                  fontFamily: headingFont, marginBottom: 16,
                }}>
                  {section.title}
                </h2>
              )}
              {section.imageUrl && (
                <div style={{
                  borderRadius: 16, overflow: 'hidden', marginBottom: 16,
                  border: `1px solid ${borderColor}`,
                }}>
                  <img
                    src={section.imageUrl}
                    alt={section.title || `Abschnitt ${index + 1}`}
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>
              )}
              <div style={{
                fontSize: 16, lineHeight: 1.8, color: bodyColor,
                fontFamily: '"Merriweather", serif',
              }}>
                {(section.content || '').split('\n').map((paragraph: string, pIdx: number) => (
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
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎓</div>
            <p style={{ color: subColor, fontSize: 14, fontStyle: 'italic' }}>
              Ende der Doku
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineDokuReader;

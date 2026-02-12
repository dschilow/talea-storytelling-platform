import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, BookOpen, FileText, Headphones, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Story } from '../../types/story';
import type { Doku } from '../../types/doku';
import type { AudioDoku } from '../../types/audio-doku';
import {
  getAllOfflineStories,
  getAllOfflineDokus,
  getAllOfflineAudioDokus,
  getBlobUrl,
} from '../../utils/offlineDb';

const OfflineContentScreen: React.FC = () => {
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [dokus, setDokus] = useState<Doku[]>([]);
  const [audioDokus, setAudioDokus] = useState<AudioDoku[]>([]);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const [s, d, a] = await Promise.all([
        getAllOfflineStories(),
        getAllOfflineDokus(),
        getAllOfflineAudioDokus(),
      ]);
      setStories(s);
      setDokus(d);
      setAudioDokus(a);

      // Load cover images from blobs
      const urls: Record<string, string> = {};
      for (const story of s) {
        if (story.coverImageUrl) {
          const blobUrl = await getBlobUrl(story.coverImageUrl);
          if (blobUrl) urls[story.id] = blobUrl;
        }
      }
      for (const doku of d) {
        if (doku.coverImageUrl) {
          const blobUrl = await getBlobUrl(doku.coverImageUrl);
          if (blobUrl) urls[doku.id] = blobUrl;
        }
      }
      for (const ad of a) {
        if (ad.coverImageUrl) {
          const blobUrl = await getBlobUrl(ad.coverImageUrl);
          if (blobUrl) urls[ad.id] = blobUrl;
        }
      }
      setCoverUrls(urls);
    } catch (err) {
      console.error('[OfflineContentScreen] Error loading content:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalItems = stories.length + dokus.length + audioDokus.length;

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'linear-gradient(135deg, #1a0a2e 0%, #0d1b2a 100%)',
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(169,137,242,0.3)', borderTopColor: '#a989f2' }}
        />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a0a2e 0%, #0d1b2a 100%)',
      color: '#e2d9f3',
      fontFamily: '"Nunito", system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '2rem 1.5rem 1.5rem',
        textAlign: 'center',
        borderBottom: '1px solid rgba(169,137,242,0.15)',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 16px', borderRadius: 20,
          background: 'rgba(255,107,157,0.15)', color: '#ff6b9d',
          fontSize: 13, fontWeight: 600, marginBottom: 16,
        }}>
          <WifiOff size={14} />
          Offline-Modus
        </div>
        <h1 style={{
          fontSize: 26, fontWeight: 700, margin: '0 0 8px',
          fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
          background: 'linear-gradient(135deg, #a989f2, #ff6b9d)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Talea Offline
        </h1>
        <p style={{ color: '#9a8bbf', fontSize: 14, margin: 0 }}>
          {totalItems === 0
            ? 'Keine gespeicherten Inhalte vorhanden'
            : `${totalItems} gespeicherte${totalItems === 1 ? 'r Inhalt' : ' Inhalte'}`
          }
        </p>
      </div>

      <div style={{ padding: '1.5rem', maxWidth: 600, margin: '0 auto' }}>
        {totalItems === 0 ? (
          <div style={{
            textAlign: 'center', padding: '3rem 1rem',
            background: 'rgba(169,137,242,0.08)', borderRadius: 20,
            border: '1px solid rgba(169,137,242,0.15)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <p style={{ color: '#9a8bbf', fontSize: 15, margin: '0 0 8px', lineHeight: 1.6 }}>
              Speichere Stories und Dokus, wenn du online bist,
              <br />um sie hier offline lesen zu können.
            </p>
          </div>
        ) : (
          <>
            {/* Stories */}
            {stories.length > 0 && (
              <Section
                title="Geschichten"
                icon={<BookOpen size={18} />}
                count={stories.length}
              >
                {stories.map(story => (
                  <ContentCard
                    key={story.id}
                    title={story.title}
                    subtitle={story.config?.genre || 'Geschichte'}
                    coverUrl={coverUrls[story.id]}
                    onClick={() => navigate(`/story-reader/${story.id}`)}
                  />
                ))}
              </Section>
            )}

            {/* Dokus */}
            {dokus.length > 0 && (
              <Section
                title="Dokus"
                icon={<FileText size={18} />}
                count={dokus.length}
              >
                {dokus.map(doku => (
                  <ContentCard
                    key={doku.id}
                    title={doku.title}
                    subtitle={doku.topic || 'Doku'}
                    coverUrl={coverUrls[doku.id]}
                    onClick={() => navigate(`/doku-reader/${doku.id}`)}
                  />
                ))}
              </Section>
            )}

            {/* Audio Dokus */}
            {audioDokus.length > 0 && (
              <Section
                title="Audio-Dokus"
                icon={<Headphones size={18} />}
                count={audioDokus.length}
              >
                {audioDokus.map(ad => (
                  <ContentCard
                    key={ad.id}
                    title={ad.title}
                    subtitle={ad.topic || 'Audio-Doku'}
                    coverUrl={coverUrls[ad.id]}
                    onClick={() => navigate(`/doku-reader/${ad.id}`)}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}> = ({ title, icon, count, children }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 12, color: '#bda3f5', fontSize: 15, fontWeight: 600,
    }}>
      {icon}
      {title}
      <span style={{
        fontSize: 12, color: '#9a8bbf',
        background: 'rgba(169,137,242,0.15)',
        padding: '2px 8px', borderRadius: 10,
      }}>
        {count}
      </span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {children}
    </div>
  </div>
);

const ContentCard: React.FC<{
  title: string;
  subtitle: string;
  coverUrl?: string;
  onClick: () => void;
}> = ({ title, subtitle, coverUrl, onClick }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.98 }}
    style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: 12, borderRadius: 16,
      background: 'rgba(169,137,242,0.08)',
      border: '1px solid rgba(169,137,242,0.15)',
      cursor: 'pointer', width: '100%',
      textAlign: 'left', color: '#e2d9f3',
      transition: 'background 0.2s',
    }}
  >
    {coverUrl ? (
      <img
        src={coverUrl}
        alt=""
        style={{
          width: 56, height: 56, borderRadius: 12,
          objectFit: 'cover', flexShrink: 0,
        }}
      />
    ) : (
      <div style={{
        width: 56, height: 56, borderRadius: 12,
        background: 'rgba(169,137,242,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, flexShrink: 0,
      }}>
        📖
      </div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 15, fontWeight: 600, marginBottom: 2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: '#9a8bbf' }}>
        {subtitle}
      </div>
    </div>
    <ArrowRight size={18} style={{ color: '#9a8bbf', flexShrink: 0 }} />
  </motion.button>
);

export default OfflineContentScreen;

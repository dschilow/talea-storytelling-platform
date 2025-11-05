import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Sparkles, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';

interface FairyTale {
  id: string;
  title: string;
  source: string;
  cultureRegion: string;
  ageRecommendation: number;
  durationMinutes: number;
  genreTags: string[];
  moralLesson?: string;
  summary?: string;
  createdAt: string;
}

const FairyTaleSelectionScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  
  const [tales, setTales] = useState<FairyTale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFairyTales();
  }, []);

  const loadFairyTales = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Direct API call until Encore client is regenerated on Railway
      const response = await fetch('/story/fairytales', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to load fairy tales');
      }
      
      const data = await response.json();
      setTales(data.tales || []);
    } catch (err) {
      console.error('[FairyTaleSelection] Error loading tales:', err);
      setError('Fehler beim Laden der Märchen. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTale = (tale: FairyTale) => {
    navigate(`/story/fairytale/${tale.id}/map-characters`, { state: { tale } });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', padding: spacing.xl }}>
        <div className="spinner" style={{ marginBottom: spacing.md }} />
        <p style={{ ...typography.textStyles.body, color: colors.text.secondary }}>Märchen werden geladen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', padding: spacing.xl }}>
        <AlertCircle size={48} color={colors.semantic.error} style={{ marginBottom: spacing.md }} />
        <p style={{ ...typography.textStyles.body, color: colors.semantic.error, textAlign: 'center', marginBottom: spacing.lg }}>{error}</p>
        <Button title="Erneut versuchen" variant="primary" onPress={loadFairyTales} />
      </div>
    );
  }

  return (
    <div style={{ padding: spacing.xl, maxWidth: '1200px', margin: '0 auto' }}>
      <FadeInView>
        <div style={{ marginBottom: spacing.xl }}>
          <h1 style={{ ...typography.textStyles.displayMd, marginBottom: spacing.sm }}>
            Wähle ein Märchen
          </h1>
          <p style={{ ...typography.textStyles.body, color: colors.text.secondary }}>
            Personalisiere klassische Geschichten mit deinen Avataren
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: spacing.lg }}>
          {tales.map((tale) => (
            <motion.div
              key={tale.id}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Card 
                onPress={() => handleSelectTale(tale)}
                style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ marginBottom: spacing.md }}>
                  <h3 style={{ ...typography.textStyles.headingMd, marginBottom: spacing.xs }}>{tale.title}</h3>
                  <p style={{ ...typography.textStyles.caption, color: colors.primary[500], fontWeight: 600 }}>
                    {tale.source}
                  </p>
                </div>

                {tale.summary && (
                  <p style={{ 
                    ...typography.textStyles.body, 
                    color: colors.text.secondary, 
                    marginBottom: spacing.md,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {tale.summary}
                  </p>
                )}

                <div style={{ display: 'flex', gap: spacing.lg, marginBottom: spacing.md }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                    <Users size={16} color={colors.text.secondary} />
                    <span style={{ ...typography.textStyles.caption, color: colors.text.secondary }}>
                      {tale.ageRecommendation}+ Jahre
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                    <Clock size={16} color={colors.text.secondary} />
                    <span style={{ ...typography.textStyles.caption, color: colors.text.secondary }}>
                      ~{tale.durationMinutes} Min
                    </span>
                  </div>
                </div>

                {tale.genreTags && tale.genreTags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, marginTop: 'auto' }}>
                    {tale.genreTags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        style={{
                          ...typography.textStyles.caption,
                          backgroundColor: colors.background.secondary,
                          color: colors.text.secondary,
                          padding: `${spacing.xs}px ${spacing.sm}px`,
                          borderRadius: radii.pill,
                          fontWeight: 500,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ 
                  marginTop: spacing.md, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'flex-end',
                  color: colors.primary[500]
                }}>
                  <Sparkles size={18} />
                  <span style={{ ...typography.textStyles.caption, marginLeft: spacing.xs, fontWeight: 600 }}>
                    Auswählen
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </FadeInView>
    </div>
  );
};

export default FairyTaleSelectionScreen;

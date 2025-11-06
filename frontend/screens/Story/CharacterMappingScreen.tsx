import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, User, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';
import type { Avatar } from '../../../backend/avatar/avatar';

// Helper interface for role matching
interface SimpleAvatarInfo {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  age?: number;
  gender?: string;
  archetype?: string;
  profession?: string;
}

interface FairyTaleRole {
  id: string;
  roleType: string;
  name: string;
  description?: string;
  requirements: {
    minAge?: number;
    maxAge?: number;
    gender?: string;
    archetype?: string;
    profession?: string;
    requiredTraits?: string[];
  };
  isRequired: boolean;
}

interface FairyTaleDetail {
  id: string;
  title: string;
  source: string;
  summary?: string;
  roles: FairyTaleRole[];
}

const CharacterMappingScreen: React.FC = () => {
  const { taleId } = useParams<{ taleId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();

  const [tale, setTale] = useState<FairyTaleDetail | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [taleId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load tale details with roles - Direct API call until Encore client regenerates on Railway
      const taleResponse = await fetch(`/story/fairytale/${taleId}/details`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!taleResponse.ok) {
        throw new Error('Failed to load fairy tale details');
      }
      
      const taleData = await taleResponse.json();
      setTale(taleData);

      // Load user's avatars
      const avatarListResponse = await backend.avatar.list();
      setAvatars(avatarListResponse.avatars || []);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Fehler beim Laden der Daten. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAvatar = (roleType: string, avatarId: string) => {
    setMappings(prev => ({
      ...prev,
      [roleType]: avatarId,
    }));
  };

  const validateMappings = (): string | null => {
    if (!tale) return 'Märchen nicht geladen';

    const requiredRoles = tale.roles.filter(r => r.isRequired);
    const missingRoles = requiredRoles.filter(r => !mappings[r.roleType]);

    if (missingRoles.length > 0) {
      return `Bitte weise Avatare für alle erforderlichen Rollen zu: ${missingRoles.map(r => r.name).join(', ')}`;
    }

    return null;
  };

  const handleGenerate = async () => {
    const validationError = validateMappings();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      // Direct API call until Encore client regenerates on Railway
      const generateResponse = await fetch('/story/generate-from-fairytale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: '', // Will be filled by auth middleware
          taleId,
          characterMappings: mappings,
          length: 'medium',
          style: 'classic',
        }),
      });
      
      if (!generateResponse.ok) {
        throw new Error('Failed to generate story');
      }
      
      const story = await generateResponse.json();
      
      // Navigate to the generated story
      navigate(`/story-reader/${story.id}`);
    } catch (err: any) {
      console.error('Error generating story:', err);
      setError('Fehler beim Generieren der Geschichte. Bitte versuche es erneut.');
    } finally {
      setGenerating(false);
    }
  };

  const getAvatarMatches = (role: FairyTaleRole): Avatar[] => {
    return avatars.filter(avatar => {
      const req = role.requirements;
      
      // Extract age and gender from visualProfile if available
      const age = avatar.visualProfile?.ageApprox ? parseInt(avatar.visualProfile.ageApprox) : undefined;
      const gender = avatar.visualProfile?.gender?.toLowerCase();
      
      // Age check
      if (req.minAge && age && age < req.minAge) return false;
      if (req.maxAge && age && age > req.maxAge) return false;
      
      // Gender check
      if (req.gender && gender && gender !== req.gender.toLowerCase()) return false;
      
      // For archetype and profession, we'd need to parse the description
      // For now, just match all if these are required (simplified)
      // TODO: Implement proper trait matching once we have structured data

      return true;
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', padding: spacing.xl }}>
        <div className="spinner" style={{ marginBottom: spacing.md }} />
        <p style={{ ...typography.textStyles.body, color: colors.text.secondary }}>Wird geladen...</p>
      </div>
    );
  }

  if (error && !tale) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', padding: spacing.xl }}>
        <AlertCircle size={48} color={colors.semantic.error} style={{ marginBottom: spacing.md }} />
        <p style={{ ...typography.textStyles.body, color: colors.semantic.error, textAlign: 'center', marginBottom: spacing.lg }}>{error}</p>
        <Button title="Zurück" variant="outline" onPress={() => navigate('/story/fairytale-selection')} />
      </div>
    );
  }

  if (!tale) {
    return null;
  }

  const requiredRolesFilled = tale.roles.filter(r => r.isRequired).every(r => mappings[r.roleType]);
  const canGenerate = requiredRolesFilled && !generating;

  return (
    <div style={{ padding: spacing.xl, maxWidth: '1200px', margin: '0 auto' }}>
      <FadeInView>
        {/* Header */}
        <div style={{ marginBottom: spacing.xl }}>
          <button
            onClick={() => navigate('/story/fairytale-selection')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              marginBottom: spacing.lg,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.text.secondary,
              ...typography.textStyles.body,
            }}
          >
            <ArrowLeft size={20} />
            Zurück zur Auswahl
          </button>

          <h1 style={{ ...typography.textStyles.displayMd, marginBottom: spacing.sm }}>
            {tale.title}
          </h1>
          <p style={{ ...typography.textStyles.body, color: colors.text.secondary }}>
            Weise deine Avatare den Rollen zu
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: spacing.md,
              marginBottom: spacing.lg,
              backgroundColor: colors.semantic.error + '15',
              border: `1px solid ${colors.semantic.error}`,
              borderRadius: radii.lg,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <AlertCircle size={20} color={colors.semantic.error} />
            <p style={{ ...typography.textStyles.bodySm, color: colors.semantic.error, margin: 0 }}>
              {error}
            </p>
          </motion.div>
        )}

        {/* Roles List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, marginBottom: spacing.xl }}>
          {tale.roles.map((role) => {
            const matches = getAvatarMatches(role);
            const selectedAvatarId = mappings[role.roleType];
            const selectedAvatar = avatars.find(a => a.id === selectedAvatarId);

            return (
              <Card key={role.id} padding="lg" variant="elevated">
                <div style={{ marginBottom: spacing.md }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                    <h3 style={{ ...typography.textStyles.headingMd, margin: 0 }}>
                      {role.name}
                    </h3>
                    {role.isRequired && (
                      <span style={{
                        ...typography.textStyles.caption,
                        color: colors.primary[500],
                        backgroundColor: colors.primary[50],
                        padding: `${spacing.xs}px ${spacing.sm}px`,
                        borderRadius: radii.pill,
                        fontWeight: 600,
                      }}>
                        Erforderlich
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <p style={{ ...typography.textStyles.bodySm, color: colors.text.secondary, margin: 0 }}>
                      {role.description}
                    </p>
                  )}
                </div>

                {/* Requirements */}
                {(role.requirements.minAge || role.requirements.gender || role.requirements.archetype) && (
                  <div style={{ 
                    padding: spacing.sm, 
                    backgroundColor: colors.background.tertiary,
                    borderRadius: radii.md,
                    marginBottom: spacing.md 
                  }}>
                    <p style={{ ...typography.textStyles.caption, color: colors.text.tertiary, margin: 0, marginBottom: spacing.xs }}>
                      Anforderungen:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                      {role.requirements.minAge && role.requirements.maxAge && (
                        <span style={{ ...typography.textStyles.bodySm, color: colors.text.secondary }}>
                          • Alter: {role.requirements.minAge}-{role.requirements.maxAge} Jahre
                        </span>
                      )}
                      {role.requirements.gender && (
                        <span style={{ ...typography.textStyles.bodySm, color: colors.text.secondary }}>
                          • Geschlecht: {role.requirements.gender}
                        </span>
                      )}
                      {role.requirements.archetype && (
                        <span style={{ ...typography.textStyles.bodySm, color: colors.text.secondary }}>
                          • Typ: {role.requirements.archetype}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Selected Avatar */}
                {selectedAvatar && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.md,
                    backgroundColor: colors.primary[50],
                    borderRadius: radii.lg,
                    marginBottom: spacing.md,
                  }}>
                    <CheckCircle2 size={24} color={colors.primary[500]} />
                    {selectedAvatar.imageUrl && (
                      <img
                        src={selectedAvatar.imageUrl}
                        alt={selectedAvatar.name}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: radii.md,
                          objectFit: 'cover',
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ ...typography.textStyles.label, margin: 0 }}>
                        {selectedAvatar.name}
                      </p>
                      {selectedAvatar.description && (
                        <p style={{ ...typography.textStyles.caption, color: colors.text.secondary, margin: 0 }}>
                          {selectedAvatar.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Avatar Selection Grid */}
                <div>
                  <p style={{ ...typography.textStyles.label, marginBottom: spacing.sm }}>
                    {matches.length > 0 ? 'Passende Avatare:' : 'Alle Avatare:'}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: spacing.sm }}>
                    {(matches.length > 0 ? matches : avatars).map((avatar) => {
                      const isSelected = mappings[role.roleType] === avatar.id;
                      const isMatch = matches.includes(avatar);

                      return (
                        <motion.button
                          key={avatar.id}
                          onClick={() => handleSelectAvatar(role.roleType, avatar.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          style={{
                            padding: spacing.sm,
                            borderRadius: radii.md,
                            border: `2px solid ${isSelected ? colors.primary[500] : isMatch ? colors.primary[200] : colors.border.light}`,
                            backgroundColor: isSelected ? colors.primary[50] : colors.background.card,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: spacing.xs,
                            position: 'relative',
                          }}
                        >
                          {avatar.imageUrl ? (
                            <img
                              src={avatar.imageUrl}
                              alt={avatar.name}
                              style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: radii.md,
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '60px',
                              height: '60px',
                              borderRadius: radii.md,
                              backgroundColor: colors.background.secondary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <User size={32} color={colors.text.tertiary} />
                            </div>
                          )}
                          <span style={{
                            ...typography.textStyles.caption,
                            color: isSelected ? colors.primary[700] : colors.text.primary,
                            fontWeight: isSelected ? 600 : 400,
                            textAlign: 'center',
                          }}>
                            {avatar.name}
                          </span>
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              top: spacing.xs,
                              right: spacing.xs,
                              backgroundColor: colors.primary[500],
                              borderRadius: '50%',
                              padding: '2px',
                            }}>
                              <CheckCircle2 size={16} color="white" />
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Generate Button */}
        <div style={{ 
          position: 'sticky', 
          bottom: spacing.lg, 
          display: 'flex', 
          justifyContent: 'center',
          paddingTop: spacing.lg,
        }}>
          <Card 
            padding="md" 
            variant="glass"
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <Button
              title={generating ? 'Geschichte wird erstellt...' : 'Geschichte generieren'}
              variant="primary"
              size="lg"
              onPress={handleGenerate}
              disabled={!canGenerate}
              icon={generating ? undefined : <Sparkles size={20} />}
            />
            {!canGenerate && !generating && (
              <p style={{ ...typography.textStyles.caption, color: colors.text.secondary, margin: 0 }}>
                Bitte weise alle erforderlichen Rollen zu
              </p>
            )}
          </Card>
        </div>
      </FadeInView>
    </div>
  );
};

export default CharacterMappingScreen;

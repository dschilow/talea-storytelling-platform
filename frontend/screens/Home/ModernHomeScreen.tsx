import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react';
import {
  Sparkles,
  User,
  BookOpen,
  FlaskConical,
  Plus,
  TrendingUp,
  Heart,
  Star,
  Zap,
  LogIn,
  ArrowRight,
  Clock,
  Award,
  Settings,
} from 'lucide-react';

import { ModernCard, ModernCardHeader, ModernCardTitle, ModernCardDescription, ModernCardContent } from '../../components/ui/modern-card';
import { ModernButton } from '../../components/ui/modern-button';
import { ModernBadge } from '../../components/ui/modern-badge';
import { colors } from '../../utils/constants/colors';
import { useBackend } from '../../hooks/useBackend';

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  creationType: 'ai-generated' | 'photo-upload';
}

interface Story {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  status: 'generating' | 'complete' | 'error';
  createdAt: string;
}

interface Doku {
  id: string;
  title: string;
  topic: string;
  coverImageUrl?: string;
  status: 'generating' | 'complete' | 'error';
  createdAt: string;
}

// 🎨 Landing Page für nicht eingeloggte Benutzer
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div style={{
      minHeight: '100vh',
      background: colors.gradients.background,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Dekorative Blobs */}
      <motion.div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          background: colors.sage[200],
          borderRadius: '50%',
          filter: 'blur(100px)',
          opacity: 0.3,
          top: '-10%',
          right: '-5%',
        }}
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 30, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          background: colors.blush[200],
          borderRadius: '50%',
          filter: 'blur(100px)',
          opacity: 0.3,
          bottom: '-5%',
          left: '-5%',
        }}
        animate={{
          scale: [1, 1.3, 1],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div style={{ maxWidth: '1200px', width: '100%', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '60px' }}
        >
          <motion.div
            animate={{
              rotate: [0, 5, -5, 5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
            }}
            style={{ fontSize: '120px', marginBottom: '24px' }}
          >
            🌿
          </motion.div>
          
          <h1 style={{
            fontSize: '64px',
            fontWeight: '800',
            fontFamily: '"Fredoka", sans-serif',
            background: colors.gradients.nature,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '24px',
            lineHeight: '1.2',
          }}>
            Willkommen bei Talea
          </h1>
          
          <p style={{
            fontSize: '24px',
            color: colors.text.secondary,
            maxWidth: '700px',
            margin: '0 auto 48px',
            lineHeight: '1.6',
          }}>
            Erschaffe magische Geschichten und lehrreiche Dokus mit deinen eigenen, einzigartigen Avataren
          </p>

          <ModernButton
            variant="sage"
            size="lg"
            icon={<LogIn size={24} />}
            onClick={() => navigate('/auth')}
          >
            Jetzt starten
          </ModernButton>
        </motion.div>

        {/* Feature Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          marginTop: '60px',
        }}>
          {[
            { icon: User, title: 'Avatare erstellen', desc: 'Kreiere einzigartige Charaktere', color: colors.sage[400] },
            { icon: BookOpen, title: 'Geschichten erzählen', desc: 'Magische Abenteuer erleben', color: colors.blush[400] },
            { icon: FlaskConical, title: 'Lernen & Entdecken', desc: 'Spannende Dokus erkunden', color: colors.ocean[400] },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
            >
              <ModernCard hover>
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    background: feature.color,
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    boxShadow: `0 8px 24px ${feature.color}40`,
                  }}>
                    <feature.icon size={40} color={colors.text.inverse} />
                  </div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: colors.text.primary,
                    marginBottom: '8px',
                  }}>
                    {feature.title}
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: colors.text.secondary,
                  }}>
                    {feature.desc}
                  </p>
                </div>
              </ModernCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 📊 Statistik-Karte
const StatCard: React.FC<{ icon: any; label: string; value: number; color: string; trend?: string }> = ({
  icon: Icon,
  label,
  value,
  color,
  trend,
}) => (
  <ModernCard hover={false}>
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          background: `${color}20`,
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={24} color={color} />
        </div>
        {trend && (
          <ModernBadge variant="sage">
            <TrendingUp size={12} />
            <span style={{ marginLeft: '4px' }}>{trend}</span>
          </ModernBadge>
        )}
      </div>
      <div style={{
        fontSize: '32px',
        fontWeight: '800',
        color: colors.text.primary,
        fontFamily: '"Fredoka", sans-serif',
        marginBottom: '4px',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '14px',
        color: colors.text.secondary,
      }}>
        {label}
      </div>
    </div>
  </ModernCard>
);

// 🏠 Haupt-Dashboard
const ModernHomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { user, isSignedIn, isLoaded } = useUser();

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [dokus, setDokus] = useState<Doku[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      loadData();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [avatarsResponse, storiesResponse, dokusResponse] = await Promise.all([
        backend.avatar.list(),
        backend.story.list({ limit: 10, offset: 0 }),
        backend.doku.listDokus({ limit: 10, offset: 0 })
      ]);

      setAvatars(avatarsResponse.avatars as any[]);
      setStories(storiesResponse.stories as any[]);
      setDokus(dokusResponse.dokus as any[]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !isLoaded) {
    return (
      <div style={{
        minHeight: '100vh',
        background: colors.gradients.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ textAlign: 'center' }}
        >
          <motion.div
            animate={{
              rotate: 360,
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ fontSize: '80px', marginBottom: '20px' }}
          >
            🌿
          </motion.div>
          <p style={{
            fontSize: '20px',
            fontWeight: '600',
            color: colors.text.secondary,
          }}>
            Lade deine magische Welt...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.gradients.background,
      paddingBottom: '120px',
    }}>
      <SignedOut>
        <LandingPage />
      </SignedOut>

      <SignedIn>
        {/* 🎨 Header mit Greeting */}
        <div style={{
          padding: '32px 40px',
          borderBottom: `1px solid ${colors.border.light}`,
          background: colors.glass.background,
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  fontSize: '40px',
                  fontWeight: '800',
                  fontFamily: '"Fredoka", sans-serif',
                  color: colors.text.primary,
                  marginBottom: '8px',
                }}
              >
                Hallo! 👋
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                style={{
                  fontSize: '18px',
                  color: colors.text.secondary,
                }}
              >
                Bereit für neue Abenteuer?
              </motion.p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <ModernButton
                variant="outline"
                size="sm"
                icon={<Settings size={18} />}
                onClick={() => navigate('/settings')}
              >
                Einstellungen
              </ModernButton>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <UserButton afterSignOutUrl="/" />
              </motion.div>
            </div>
          </div>
        </div>

        {/* 📊 Statistiken */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 40px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
            marginBottom: '40px',
          }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <StatCard
                icon={User}
                label="Avatare"
                value={avatars.length}
                color={colors.sage[500]}
                trend="+2"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <StatCard
                icon={BookOpen}
                label="Geschichten"
                value={stories.length}
                color={colors.blush[500]}
                trend="+5"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <StatCard
                icon={FlaskConical}
                label="Dokus"
                value={dokus.length}
                color={colors.ocean[500]}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <StatCard
                icon={Award}
                label="Abzeichen"
                value={12}
                color={colors.honey[500]}
              />
            </motion.div>
          </div>

          {/* 🚀 Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <ModernCard>
              <ModernCardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Zap size={24} color={colors.sage[500]} />
                  <ModernCardTitle>Schnellaktionen</ModernCardTitle>
                </div>
                <ModernCardDescription>
                  Starte dein nächstes Abenteuer
                </ModernCardDescription>
              </ModernCardHeader>
              <ModernCardContent>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                }}>
                  <ModernButton
                    variant="sage"
                    icon={<Plus size={20} />}
                    onClick={() => navigate('/avatar/create')}
                  >
                    Avatar erstellen
                  </ModernButton>
                  <ModernButton
                    variant="blush"
                    icon={<BookOpen size={20} />}
                    onClick={() => navigate('/story')}
                  >
                    Geschichte schreiben
                  </ModernButton>
                  <ModernButton
                    variant="ocean"
                    icon={<FlaskConical size={20} />}
                    onClick={() => navigate('/doku/create')}
                  >
                    Doku erstellen
                  </ModernButton>
                </div>
              </ModernCardContent>
            </ModernCard>
          </motion.div>

          {/* 👥 Deine Avatare */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            style={{ marginTop: '32px' }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: colors.text.primary,
                  fontFamily: '"Fredoka", sans-serif',
                }}>
                  Deine Avatare
                </h2>
                <ModernBadge variant="sage">{avatars.length}</ModernBadge>
              </div>
              <ModernButton
                variant="outline"
                size="sm"
                icon={<ArrowRight size={16} />}
                onClick={() => navigate('/avatar')}
              >
                Alle anzeigen
              </ModernButton>
            </div>

            {avatars.length === 0 ? (
              <ModernCard>
                <div style={{
                  padding: '60px 40px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '80px', marginBottom: '20px' }}>👤</div>
                  <h3 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: colors.text.primary,
                    marginBottom: '12px',
                  }}>
                    Noch keine Avatare
                  </h3>
                  <p style={{
                    fontSize: '16px',
                    color: colors.text.secondary,
                    marginBottom: '24px',
                  }}>
                    Erstelle deinen ersten Avatar und starte dein Abenteuer!
                  </p>
                  <ModernButton
                    variant="sage"
                    icon={<Plus size={20} />}
                    onClick={() => navigate('/avatar/create')}
                  >
                    Avatar erstellen
                  </ModernButton>
                </div>
              </ModernCard>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
              }}>
                {avatars.slice(0, 6).map((avatar, index) => (
                  <motion.div
                    key={avatar.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <ModernCard onClick={() => navigate(`/avatar/${avatar.id}`)}>
                      <div style={{ position: 'relative' }}>
                        <div style={{
                          height: '200px',
                          background: avatar.imageUrl
                            ? `url(${avatar.imageUrl}) center/cover`
                            : colors.gradients.nature,
                          borderRadius: '22px 22px 0 0',
                          position: 'relative',
                        }}>
                          {!avatar.imageUrl && (
                            <div style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <User size={64} color={colors.text.inverse} opacity={0.8} />
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '20px' }}>
                          <h3 style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: colors.text.primary,
                            marginBottom: '8px',
                          }}>
                            {avatar.name}
                          </h3>
                          <ModernBadge variant={avatar.creationType === 'ai-generated' ? 'lilac' : 'ocean'}>
                            {avatar.creationType === 'ai-generated' ? '🤖 KI' : '📷 Foto'}
                          </ModernBadge>
                        </div>
                      </div>
                    </ModernCard>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </SignedIn>
    </div>
  );
};

export default ModernHomeScreen;


import React, { useEffect, useState } from 'react';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, GraduationCap, Clock, DollarSign, Zap, Sparkles } from 'lucide-react';
import Card from '../../components/common/Card';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';
import { useBackend } from '../../hooks/useBackend';

interface DokuInteractive {
  quiz?: {
    enabled: boolean;
    questions: {
      question: string;
      options: string[];
      answerIndex: number;
      explanation?: string;
    }[];
  };
  activities?: {
    enabled: boolean;
    items: {
      title: string;
      description: string;
      materials?: string[];
      durationMinutes?: number;
    }[];
  };
}

interface DokuSection {
  title: string;
  content: string;
  keyFacts: string[];
  imageIdea?: string;
  interactive?: DokuInteractive;
}

interface Doku {
  id: string;
  userId: string;
  title: string;
  topic: string;
  summary: string;
  content: { sections: DokuSection[] };
  coverImageUrl?: string;
  isPublic: boolean;
  status: 'generating' | 'complete' | 'error';
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

const DokuReaderScreen: React.FC = () => {
  const { dokuId } = useParams<{ dokuId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const { isSignedIn } = useUser();

  const [doku, setDoku] = useState<Doku | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    void load();
  }, [dokuId, isSignedIn]);

  const load = async () => {
    if (!dokuId) return;
    try {
      setLoading(true);
      const data = await backend.doku.getDoku({ id: dokuId });
      setDoku(data as any);
    } catch (e) {
      console.error('Failed to load doku', e);
      alert('Doku konnte nicht geladen werden. Bitte melde dich an und versuche es erneut.');
      navigate('/doku');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(amount);
  };

  const formatDuration = (ms: number): string => {
    if (!ms && ms !== 0) return '';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.appBackground,
    paddingBottom: '120px',
  };

  const headerStyle: React.CSSProperties = {
    background: colors.glass.navBackground,
    border: `1px solid ${colors.glass.border}`,
    padding: `${spacing.lg}px`,
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: colors.glass.shadow,
    backdropFilter: 'blur(14px) saturate(160%)',
    WebkitBackdropFilter: 'blur(14px) saturate(160%)',
  };

  const headerContentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    maxWidth: '980px',
    margin: '0 auto',
  };

  const backButtonStyle: React.CSSProperties = {
    padding: `${spacing.sm}px`,
    borderRadius: `${radii.pill}px`,
    background: colors.glass.buttonBackground,
    border: `1px solid ${colors.glass.border}`,
    color: colors.textPrimary,
    cursor: 'pointer',
    marginRight: `${spacing.md}px`,
    transition: 'all 0.2s ease',
  };

  const titleStyle: React.CSSProperties = {
    ...typography.textStyles.headingMd,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center' as const,
  };

  const readerStyle: React.CSSProperties = {
    maxWidth: '980px',
    margin: '0 auto',
    padding: spacing.xl,
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: `4px solid rgba(255,255,255,0.6)`,
            borderTop: `4px solid ${colors.primary}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: `0 auto ${spacing.lg}px auto`
          }} />
          <p style={{ ...typography.textStyles.body, color: colors.textSecondary }}>
            Lade Doku...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerContentStyle}>
          <button
            style={backButtonStyle}
            onClick={() => navigate('/doku')}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0px)')}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={titleStyle}>{doku?.title || 'Doku'}</div>
          <div style={{ padding: spacing.sm, opacity: 0.8 }}>
            <GraduationCap size={20} />
          </div>
        </div>
      </div>

      <div style={readerStyle}>
        <SignedOut>
          <Card variant="glass" style={{ textAlign: 'center', padding: spacing.xl }}>
            <BookOpen size={48} style={{ color: colors.textSecondary, marginBottom: spacing.lg }} />
            <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: spacing.sm }}>
              Anmeldung erforderlich
            </div>
            <div style={{ ...typography.textStyles.body, color: colors.textSecondary }}>
              Bitte melde dich an, um Inhalte zu sehen.
            </div>
          </Card>
        </SignedOut>

        <SignedIn>
          {!doku ? (
            <Card variant="glass" style={{ textAlign: 'center', padding: spacing.xl }}>
              <BookOpen size={48} style={{ color: colors.textSecondary, marginBottom: spacing.lg }} />
              <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: spacing.sm }}>
                Doku nicht gefunden
              </div>
              <div style={{ ...typography.textStyles.body, color: colors.textSecondary }}>
                Diese Doku konnte nicht geladen werden.
              </div>
            </Card>
          ) : (
            <>
              {doku.coverImageUrl && (
                <Card variant="glass" style={{ padding: spacing.md, marginBottom: spacing.lg }}>
                  <img
                    src={doku.coverImageUrl}
                    alt={doku.title}
                    style={{
                      width: '100%',
                      height: 360,
                      objectFit: 'cover',
                      borderRadius: radii.lg,
                      border: `1px solid ${colors.glass.border}`,
                    }}
                  />
                </Card>
              )}

              {/* Intro */}
              <FadeInView delay={50}>
                <Card variant="glass" style={{ padding: spacing.xl, marginBottom: spacing.xl }}>
                  <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: spacing.sm }}>
                    {doku.title}
                  </div>
                  <div style={{ ...typography.textStyles.body, color: colors.textSecondary }}>
                    Thema: {doku.topic}
                  </div>
                </Card>
              </FadeInView>

              {/* Metadata like stories */}
              {doku.metadata && (
                <FadeInView delay={90}>
                  <Card variant="glass" style={{ padding: spacing.lg, marginBottom: spacing.lg }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: spacing.md }}>
                      {typeof doku.metadata.tokensUsed?.total === 'number' && (
                        <div style={{
                          padding: spacing.sm,
                          border: `1px solid ${colors.glass.border}`,
                          borderRadius: radii.lg,
                          background: colors.glass.badgeBackground,
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm
                        }}>
                          <Zap size={16} />
                          <div>
                            <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>Tokens</div>
                            <div style={{ ...typography.textStyles.label }}>{doku.metadata.tokensUsed.total.toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                      {typeof doku.metadata.totalCost?.total === 'number' && (
                        <div style={{
                          padding: spacing.sm,
                          border: `1px solid ${colors.glass.border}`,
                          borderRadius: radii.lg,
                          background: colors.glass.badgeBackground,
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm
                        }}>
                          <DollarSign size={16} />
                          <div>
                            <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>Kosten gesamt</div>
                            <div style={{ ...typography.textStyles.label }}>{formatCurrency(doku.metadata.totalCost.total)}</div>
                          </div>
                        </div>
                      )}
                      {typeof doku.metadata.processingTime === 'number' && (
                        <div style={{
                          padding: spacing.sm,
                          border: `1px solid ${colors.glass.border}`,
                          borderRadius: radii.lg,
                          background: colors.glass.badgeBackground,
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm
                        }}>
                          <Clock size={16} />
                          <div>
                            <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>Dauer</div>
                            <div style={{ ...typography.textStyles.label }}>{formatDuration(doku.metadata.processingTime!)}</div>
                          </div>
                        </div>
                      )}
                      {typeof doku.metadata.imagesGenerated === 'number' && (
                        <div style={{
                          padding: spacing.sm,
                          border: `1px solid ${colors.glass.border}`,
                          borderRadius: radii.lg,
                          background: colors.glass.badgeBackground,
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm
                        }}>
                          <Sparkles size={16} />
                          <div>
                            <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>Bilder</div>
                            <div style={{ ...typography.textStyles.label }}>{doku.metadata.imagesGenerated}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </FadeInView>
              )}

              {/* Sections */}
              {doku.content.sections.map((sec, i) => (
                <FadeInView key={i} delay={100 + i * 50}>
                  <Card variant="glass" style={{ padding: spacing.xl, marginBottom: spacing.lg }}>
                    <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: spacing.sm }}>
                      {sec.title}
                    </div>
                    <div style={{
                      ...typography.textStyles.body,
                      color: colors.textPrimary,
                      lineHeight: '1.85',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {sec.content}
                    </div>

                    {sec.keyFacts?.length > 0 && (
                      <div style={{
                        marginTop: spacing.md,
                        padding: spacing.md,
                        background: colors.glass.badgeBackground,
                        border: `1px solid ${colors.glass.border}`,
                        borderRadius: radii.lg
                      }}>
                        <div style={{ ...typography.textStyles.label, marginBottom: spacing.sm }}>Wichtige Fakten</div>
                        <ul style={{ paddingLeft: spacing.lg, margin: 0 }}>
                          {sec.keyFacts.map((f, idx) => (
                            <li key={idx} style={{ marginBottom: spacing.xs }}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Interactive */}
                    {sec.interactive?.quiz?.enabled && sec.interactive.quiz.questions?.length > 0 && (
                      <div style={{ marginTop: spacing.lg }}>
                        <div style={{ ...typography.textStyles.label, marginBottom: spacing.sm }}>Quiz</div>
                        {sec.interactive.quiz.questions.map((q, qi) => (
                          <div key={qi} style={{
                            padding: spacing.md,
                            borderRadius: radii.lg,
                            border: `1px solid ${colors.glass.border}`,
                            background: colors.glass.cardBackground,
                            marginBottom: spacing.sm
                          }}>
                            <div style={{ marginBottom: spacing.sm, fontWeight: 600 }}>{q.question}</div>
                            <ol style={{ paddingLeft: spacing.lg }}>
                              {q.options.map((opt, oi) => (
                                <li key={oi} style={{ marginBottom: spacing.xs }}>
                                  {String.fromCharCode(65 + oi)}. {opt}
                                  {oi === q.answerIndex && (
                                    <span style={{ color: colors.success, marginLeft: spacing.sm }}>(richtig)</span>
                                  )}
                                </li>
                              ))}
                            </ol>
                            {q.explanation && (
                              <div style={{ marginTop: spacing.xs, color: colors.textSecondary, fontStyle: 'italic' }}>
                                Erklärung: {q.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {sec.interactive?.activities?.enabled && sec.interactive.activities.items?.length > 0 && (
                      <div style={{ marginTop: spacing.lg }}>
                        <div style={{ ...typography.textStyles.label, marginBottom: spacing.sm }}>Aktivitäten</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: spacing.md }}>
                          {sec.interactive.activities.items.map((a, ai) => (
                            <div key={ai} style={{
                              padding: spacing.md,
                              borderRadius: radii.lg,
                              border: `1px solid ${colors.glass.border}`,
                              background: colors.glass.cardBackground,
                            }}>
                              <div style={{ fontWeight: 600, marginBottom: spacing.xs }}>{a.title}</div>
                              <div style={{ color: colors.textSecondary, marginBottom: spacing.xs }}>{a.description}</div>
                              {(a.materials?.length || a.durationMinutes) && (
                                <div style={{ fontSize: 12, color: colors.textSecondary }}>
                                  {a.materials?.length ? `Materialien: ${a.materials.join(', ')}` : ''}
                                  {a.materials?.length && a.durationMinutes ? ' • ' : ''}
                                  {a.durationMinutes ? `Dauer: ${a.durationMinutes} Min.` : ''}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                </FadeInView>
              ))}
            </>
          )}
        </SignedIn>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DokuReaderScreen;

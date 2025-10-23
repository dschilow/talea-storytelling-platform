import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Calendar, Code, Clock, Zap, Activity, Filter, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import backend from '~backend/client';

interface LogEntry {
  id: string;
  source: 'openai-story-generation' | 'runware-single-image' | 'runware-batch-image' | 'openai-avatar-analysis' | 'openai-avatar-analysis-stable' | 'openai-doku-generation' | 'openai-tavi-chat';
  timestamp: string;
  request: any;
  response: any;
  metadata?: any;
}

interface LogSource {
  name: string;
  count: number;
  lastActivity: string | null;
}

const LogViewerScreen: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sources, setSources] = useState<LogSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedSource, selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Use the same backend URL as other API calls
      const { getBackendUrl } = await import('../../config');
      const baseUrl = getBackendUrl();
      
      const [logsResponse, sourcesResponse] = await Promise.all([
        fetch(`${baseUrl}/log/list?${new URLSearchParams({
          ...(selectedSource && { source: selectedSource }),
          ...(selectedDate && { date: selectedDate }),
          limit: '50'
        }).toString()}`).then(r => r.json()),
        fetch(`${baseUrl}/log/getSources`).then(r => r.json())
      ]);

      setLogs(logsResponse.logs as any);
      setSources(sourcesResponse.sources as any);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'openai-story-generation':
        return '📖';
      case 'runware-single-image':
        return '🖼️';
      case 'runware-batch-image':
        return '🎨';
      case 'openai-avatar-analysis':
      case 'openai-avatar-analysis-stable':
        return '🔬';
      case 'openai-doku-generation':
        return '📘';
      case 'openai-tavi-chat':
        return '🧞‍♂️';
      default:
        return '📋';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'openai-story-generation':
        return 'Geschichte Generierung';
      case 'runware-single-image':
        return 'Einzelbild Generierung';
      case 'runware-batch-image':
        return 'Batch Bild Generierung';
      case 'openai-avatar-analysis':
      case 'openai-avatar-analysis-stable':
        return 'Avatar Analyse';
      case 'openai-doku-generation':
        return 'Doku Generierung';
      case 'openai-tavi-chat':
        return 'Tavi Chat';
      default:
        return source;
    }
  };

  const formatJson = (obj: any, _maxDepth: number = 3) => {
    return JSON.stringify(obj, null, 2);
  };

  const downloadLog = (log: LogEntry) => {
    const dataStr = JSON.stringify(log, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `log-${log.source}-${log.id}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
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
    boxShadow: colors.glass.shadow,
    backdropFilter: 'blur(14px) saturate(160%)',
    WebkitBackdropFilter: 'blur(14px) saturate(160%)',
  };

  const headerContentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    maxWidth: '1200px',
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

  const contentStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: `${spacing.xl}px`,
  };

  const filtersStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: `${spacing.md}px`,
    marginBottom: `${spacing.xl}px`,
  };

  const sourceStatsStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: `${spacing.md}px`,
    marginBottom: `${spacing.xl}px`,
  };

  const logListStyle: React.CSSProperties = {
    display: 'grid',
    gap: `${spacing.md}px`,
  };

  const logItemStyle: React.CSSProperties = {
    padding: `${spacing.lg}px`,
    cursor: 'pointer',
    position: 'relative' as const,
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${spacing.lg}px`,
  };

  const modalContentStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: `${radii.xl}px`,
    padding: `${spacing.xl}px`,
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'auto' as const,
    boxShadow: shadows.lg,
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
            Lade Logs...
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
            onClick={() => navigate('/')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={titleStyle}>AI Logs Viewer</div>
        </div>
      </div>

      <div style={contentStyle}>
        <SignedOut>
          <Card variant="glass" style={{ textAlign: 'center', padding: `${spacing.xl}px` }}>
            <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: spacing.sm }}>
              Anmeldung erforderlich
            </div>
            <div style={{ ...typography.textStyles.body, color: colors.textSecondary }}>
              Bitte melde dich an, um Logs zu sehen.
            </div>
          </Card>
        </SignedOut>

        <SignedIn>
          {/* Source Statistics */}
          <FadeInView delay={100}>
            <Card variant="glass" style={{ marginBottom: `${spacing.xl}px`, padding: `${spacing.xl}px` }}>
              <h2 style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: `${spacing.sm}px` }}>
                <Activity size={24} style={{ color: colors.primary }} />
                Log Quellen Übersicht
              </h2>
              <div style={sourceStatsStyle}>
                {sources.map((source, index) => (
                  <FadeInView key={source.name} delay={150 + index * 50}>
                    <div style={{
                      padding: `${spacing.lg}px`,
                      background: colors.glass.cardBackground,
                      border: `1px solid ${colors.glass.border}`,
                      borderRadius: `${radii.lg}px`,
                      textAlign: 'center' as const,
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: `${spacing.sm}px` }}>
                        {getSourceIcon(source.name)}
                      </div>
                      <div style={{ ...typography.textStyles.label, color: colors.textPrimary, marginBottom: `${spacing.xs}px` }}>
                        {getSourceLabel(source.name)}
                      </div>
                      <div style={{ ...typography.textStyles.headingMd, color: colors.primary, marginBottom: `${spacing.xs}px` }}>
                        {source.count}
                      </div>
                      <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>
                        {source.lastActivity ? `Zuletzt: ${formatTimestamp(source.lastActivity)}` : 'Keine Aktivität'}
                      </div>
                    </div>
                  </FadeInView>
                ))}
              </div>
            </Card>
          </FadeInView>

          {/* Filters */}
          <FadeInView delay={200}>
            <Card variant="glass" style={{ marginBottom: `${spacing.xl}px`, padding: `${spacing.xl}px` }}>
              <h2 style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: `${spacing.sm}px` }}>
                <Filter size={24} style={{ color: colors.primary }} />
                Filter
              </h2>
              <div style={filtersStyle}>
                <div>
                  <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px` }}>
                    Quelle
                  </label>
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    style={{
                      width: '100%',
                      padding: `${spacing.md}px`,
                      border: `1px solid ${colors.border}`,
                      borderRadius: `${radii.lg}px`,
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                      fontSize: typography.textStyles.body.fontSize,
                    }}
                  >
                    <option value="">Alle Quellen</option>
                    {sources.map(source => (
                      <option key={source.name} value={source.name}>
                        {getSourceLabel(source.name)} ({source.count})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ ...typography.textStyles.label, color: colors.textPrimary, display: 'block', marginBottom: `${spacing.sm}px` }}>
                    Datum
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: `${spacing.md}px`,
                      border: `1px solid ${colors.border}`,
                      borderRadius: `${radii.lg}px`,
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                      fontSize: typography.textStyles.body.fontSize,
                    }}
                  />
                </div>
              </div>
              
              <div style={{ textAlign: 'center', marginTop: `${spacing.lg}px` }}>
                <Button
                  title="Filter zurücksetzen"
                  onPress={() => {
                    setSelectedSource('');
                    setSelectedDate('');
                  }}
                  variant="outline"
                />
              </div>
            </Card>
          </FadeInView>

          {/* Logs */}
          <FadeInView delay={300}>
            <Card variant="glass" style={{ padding: `${spacing.xl}px` }}>
              <h2 style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: `${spacing.sm}px` }}>
                <Code size={24} style={{ color: colors.primary }} />
                Log Einträge ({logs.length})
              </h2>
              
              {logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: `${spacing.xl}px` }}>
                  <div style={{ fontSize: '64px', marginBottom: `${spacing.lg}px` }}>📋</div>
                  <div style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
                    Keine Logs gefunden
                  </div>
                  <div style={{ ...typography.textStyles.body, color: colors.textSecondary }}>
                    Keine Log-Einträge für die ausgewählten Filter gefunden.
                  </div>
                </div>
              ) : (
                <div style={logListStyle}>
                  {logs.map((log, index) => (
                    <FadeInView key={log.id} delay={350 + index * 50}>
                      <Card 
                        variant="elevated" 
                        style={logItemStyle}
                        onPress={() => {
                          setSelectedLog(log);
                          setShowDetails(true);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: `${spacing.md}px`, marginBottom: `${spacing.sm}px` }}>
                          <span style={{ fontSize: '24px' }}>{getSourceIcon(log.source)}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ ...typography.textStyles.label, color: colors.textPrimary }}>
                              {getSourceLabel(log.source)}
                            </div>
                            <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>
                              ID: {log.id}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ ...typography.textStyles.caption, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: `${spacing.xs}px` }}>
                              <Clock size={12} />
                              {formatTimestamp(log.timestamp)}
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${spacing.sm}px`, fontSize: '11px' }}>
                          <div style={{ 
                            padding: `${spacing.xs}px ${spacing.sm}px`,
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: `${radii.sm}px`,
                            color: colors.textSecondary,
                          }}>
                            📤 Request: {JSON.stringify(log.request).length} chars
                          </div>
                          <div style={{ 
                            padding: `${spacing.xs}px ${spacing.sm}px`,
                            background: 'rgba(34, 197, 94, 0.1)',
                            borderRadius: `${radii.sm}px`,
                            color: colors.textSecondary,
                          }}>
                            📥 Response: {JSON.stringify(log.response).length} chars
                          </div>
                        </div>
                      </Card>
                    </FadeInView>
                  ))}
                </div>
              )}
            </Card>
          </FadeInView>
        </SignedIn>
      </div>

      {/* Log Details Modal */}
      {showDetails && selectedLog && (
        <div style={modalOverlayStyle} onClick={() => setShowDetails(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: `${spacing.lg}px` }}>
              <h2 style={{ ...typography.textStyles.headingMd, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: `${spacing.sm}px` }}>
                {getSourceIcon(selectedLog.source)} {getSourceLabel(selectedLog.source)}
              </h2>
              <div style={{ display: 'flex', gap: `${spacing.sm}px` }}>
                <button
                  onClick={() => downloadLog(selectedLog)}
                  style={{
                    padding: `${spacing.sm}px`,
                    borderRadius: `${radii.lg}px`,
                    background: colors.primary,
                    color: colors.textInverse,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: `${spacing.xs}px`,
                  }}
                >
                  <Download size={16} />
                  Download
                </button>
                <button
                  onClick={() => setShowDetails(false)}
                  style={{
                    padding: `${spacing.sm}px`,
                    borderRadius: `${radii.lg}px`,
                    background: colors.border,
                    color: colors.textPrimary,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div style={{ marginBottom: `${spacing.lg}px` }}>
              <div style={{ ...typography.textStyles.body, color: colors.textSecondary, marginBottom: `${spacing.sm}px` }}>
                <Clock size={16} style={{ display: 'inline', marginRight: `${spacing.xs}px` }} />
                {formatTimestamp(selectedLog.timestamp)}
              </div>
              <div style={{ ...typography.textStyles.caption, color: colors.textSecondary }}>
                ID: {selectedLog.id}
              </div>
            </div>

            <div style={{ display: 'grid', gap: `${spacing.lg}px` }}>
              <div>
                <h3 style={{ ...typography.textStyles.label, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
                  📤 Request:
                </h3>
                <pre style={{
                  background: colors.muted,
                  padding: `${spacing.md}px`,
                  borderRadius: `${radii.md}px`,
                  fontSize: '12px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  color: colors.textPrimary,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {formatJson(selectedLog.request)}
                </pre>
              </div>

              <div>
                <h3 style={{ ...typography.textStyles.label, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
                  📥 Response:
                </h3>
                <pre style={{
                  background: colors.muted,
                  padding: `${spacing.md}px`,
                  borderRadius: `${radii.md}px`,
                  fontSize: '12px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  color: colors.textPrimary,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {formatJson(selectedLog.response)}
                </pre>
              </div>

              {selectedLog.metadata && (
                <div>
                  <h3 style={{ ...typography.textStyles.label, color: colors.textPrimary, marginBottom: `${spacing.sm}px` }}>
                    🏷️ Metadata:
                  </h3>
                  <pre style={{
                    background: colors.muted,
                    padding: `${spacing.md}px`,
                    borderRadius: `${radii.md}px`,
                    fontSize: '12px',
                    maxHeight: '200px',
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    color: colors.textPrimary,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {formatJson(selectedLog.metadata)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LogViewerScreen;

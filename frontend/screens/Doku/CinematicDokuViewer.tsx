import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';

import { useBackend } from '../../hooks/useBackend';
import type { Doku } from '../../types/doku';
import { useTheme } from '../../contexts/ThemeContext';
import { getOfflineDoku } from '../../utils/offlineDb';
import { useOfflineScope } from '../../contexts/OfflineScopeContext';
import { emitMapProgress } from '../Journey/TaleaLearningPathProgressStore';
import { DokuReaderView } from './reader/DokuReaderView';
import '../Story/reader/StoryReader.css';

/**
 * Route component of the doku reader: loads the doku and owns the completion
 * flow. The reading view (shared chrome with the story reader) lives in
 * ./reader/DokuReaderView and is only mounted once the doku exists.
 */
const CinematicDokuViewer: React.FC = () => {
  const { dokuId } = useParams<{ dokuId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { getToken } = useAuth();
  const childProfileContext = useOptionalChildProfiles();
  const activeProfileId = childProfileContext?.activeProfileId;
  const offlineScope = useOfflineScope();
  const { resolvedTheme } = useTheme();

  const [doku, setDoku] = useState<Doku | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dokuCompleted, setDokuCompleted] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const loadRequestRef = useRef(0);
  const completionAttemptRef = useRef(0);
  const completionInFlightRef = useRef(false);

  const isDark = resolvedTheme === 'dark';
  const mapAvatarId = useMemo(
    () => new URLSearchParams(location.search).get('mapAvatarId'),
    [location.search],
  );
  const targetAvatarId =
    mapAvatarId ??
    childProfileContext?.activeProfile?.childAvatarId ??
    childProfileContext?.activeProfile?.preferredAvatarIds?.[0] ?? null;
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const openMode = query.get('open');

  const domainHint = useMemo(() => {
    const queryDomain = String(query.get("domain") || "")
      .trim()
      .toLowerCase();
    const metadataDomain = String(doku?.metadata?.configSnapshot?.domainId || "")
      .trim()
      .toLowerCase();
    const raw = queryDomain || metadataDomain;
    if (!raw) return undefined;
    return raw === "art" ? "arts" : raw;
  }, [doku?.metadata?.configSnapshot?.domainId, query]);

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    completionAttemptRef.current += 1;
    completionInFlightRef.current = false;
    setDokuCompleted(false);
    setCompletionPending(false);

    setCompletionError(null);
    setDoku(null);

    if (dokuId) void loadDoku(requestId);

    return () => {
      if (loadRequestRef.current === requestId) loadRequestRef.current += 1;
      completionAttemptRef.current += 1;
      completionInFlightRef.current = false;
    };
  }, [dokuId, activeProfileId, offlineScope]);

  // `?open=quiz` jumps straight to the first section with a quiz.
  const initialSectionIndex = useMemo(() => {
    if (!doku || openMode !== 'quiz') return null;
    const sections = doku.content?.sections || [];
    const firstQuizIndex = sections.findIndex(
      (section) => section?.interactive?.quiz?.enabled && (section.interactive.quiz.questions?.length || 0) > 0,
    );
    return firstQuizIndex >= 0 ? firstQuizIndex : 0;
  }, [doku, openMode]);

  const loadDoku = async (requestId: number) => {
    if (!dokuId) return;
    try {
      setLoading(true);
      setError(null);
      let dokuData: any = offlineScope ? await getOfflineDoku(offlineScope, dokuId) : null;
      if (!dokuData) {
        dokuData = await backend.doku.getDoku({
          id: dokuId,
          profileId: activeProfileId || undefined,
        });
      }
      if (loadRequestRef.current !== requestId) return;
      setDoku(dokuData as unknown as Doku);
    } catch (err) {
      if (loadRequestRef.current !== requestId) return;
      console.error('Error loading doku:', err);
      setError('Doku konnte nicht geladen werden.');
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false);
    }
  };

  const handleDokuCompletion = async () => {
    if (!doku || !dokuId || dokuCompleted || completionInFlightRef.current) return;
    const attemptId = ++completionAttemptRef.current;
    completionInFlightRef.current = true;
    setCompletionPending(true);
    setCompletionError(null);

    try {
      const token = await getToken();
      const { getBackendUrl } = await import('../../config');
      const target = getBackendUrl();
      const response = await fetch(`${target}/doku/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          dokuId,
          dokuTitle: doku.title,
          topic: doku.topic,
          perspective: doku.metadata?.configSnapshot?.perspective,
          profileId: activeProfileId || undefined,
          domainId: domainHint,
          avatarId: targetAvatarId ?? undefined,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Doku completion failed with status ${response.status}`);
      }
      if (result?.success !== true) {
        throw new Error('Doku completion was not confirmed by the server.');
      }
      if (completionAttemptRef.current !== attemptId) return;

      setDokuCompleted(true);
      const { showSuccessToast } = await import('../../utils/toastUtils');
      showSuccessToast('Doku abgeschlossen. Wissen erweitert.');
      window.dispatchEvent(
        new CustomEvent('personalityUpdated', {
          detail: {
            avatarId: targetAvatarId ?? undefined,
            refreshProgression: true,
            source: 'doku',
            updatedAt: new Date().toISOString(),
          },
        }),
      );
      emitMapProgress({ avatarId: targetAvatarId, source: 'doku' });
    } catch (error) {
      console.error('Error completing doku:', error);
      if (completionAttemptRef.current !== attemptId) return;
      const message = 'Dein Lernfortschritt konnte noch nicht gespeichert werden. Bitte versuche es erneut.';
      setCompletionError(message);
      const { showErrorToast } = await import('../../utils/toastUtils');
      showErrorToast(message);
    } finally {
      if (completionAttemptRef.current === attemptId) {
        completionInFlightRef.current = false;
        setCompletionPending(false);
      }
    }
  };

  const theme = isDark ? 'dark' : 'light';

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="rd-loading rd-scope rd-knowledge" data-theme={theme} role="status">
        <div className="rd-spinner" aria-hidden="true" />
        <p className="rd-loading-text">Doku wird geladen …</p>
      </div>
    );
  }

  /* ── Error / Not Found ── */
  if (!doku) {
    return (
      <div className="rd-loading rd-scope rd-knowledge" data-theme={theme}>
        <p className="rd-error-title">{error || 'Doku wurde nicht gefunden.'}</p>
        <button type="button" onClick={() => navigate('/doku')} className="rd-secondary-btn">
          Zurück zu Dokus
        </button>
      </div>
    );
  }

  return (
    <DokuReaderView
      key={doku.id}
      doku={doku}
      dokuId={dokuId || ''}
      avatarId={targetAvatarId ?? undefined}
      isDark={isDark}
      initialSectionIndex={initialSectionIndex}
      onNavigate={navigate}
      completion={{
        isCompleted: dokuCompleted,
        isCompleting: completionPending,
        error: completionError,
        onComplete: handleDokuCompletion,
      }}
    />
  );
};

export default CinematicDokuViewer;

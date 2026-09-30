import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

import { useBackend } from '../../hooks/useBackend';
import StoryFinaleSheet, { type StoryCompletionResult } from '../../components/story/StoryFinaleSheet';
import type { Avatar, Story } from '../../types/story';
import { useTheme } from '../../contexts/ThemeContext';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import { useOptionalUserAccess } from '../../contexts/UserAccessContext';
import { extractStoryParticipantIds } from '../../utils/storyParticipants';
import { getOfflineStory } from '../../utils/offlineDb';
import { useOfflineScope } from '../../contexts/OfflineScopeContext';
import { emitMapProgress } from '../Journey/TaleaLearningPathProgressStore';
import { StoryReaderView } from './reader/StoryReaderView';
import './reader/StoryReader.css';

/**
 * Route component of the story reader: loads the story and owns the completion
 * flow (progress + rewards). Everything visual lives in ./reader/ — the reading
 * view is only mounted once a story exists, so its scroll container is always
 * present when scroll tracking starts.
 */
const CinematicStoryViewer: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isCharacterLifeRoute = location.pathname.startsWith('/character-life-story/');
  const backend = useBackend();
  const { getToken } = useAuth();
  const childProfileContext = useOptionalChildProfiles();
  const activeProfileId = childProfileContext?.activeProfileId;
  const offlineScope = useOfflineScope();
  const { isAdmin } = useOptionalUserAccess();
  const { resolvedTheme } = useTheme();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storyCompleted, setStoryCompleted] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Partial<Avatar>[]>([]);
  const loadRequestRef = useRef(0);
  const completionAttemptRef = useRef(0);
  const completionInFlightRef = useRef(false);

  // Everything the completion produced is presented by ONE sheet — see
  // StoryFinaleSheet for why this replaced the previous overlay stack.
  const [completionResult, setCompletionResult] = useState<StoryCompletionResult | null>(null);
  const [isRepeatRead, setIsRepeatRead] = useState(false);
  const isCharacterLifeStory = isCharacterLifeRoute || story?.config.contentType === 'character_life';
  const returnPath = isCharacterLifeStory && isAdmin ? '/characters' : '/stories';
  const returnLabel = returnPath === '/characters' ? 'Zurück zu den Charakteren' : 'Zurück zu Geschichten';

  const isDark = resolvedTheme === 'dark';
  const theme = isDark ? 'dark' : 'light';
  const mapAvatarId = useMemo(
    () => new URLSearchParams(location.search).get('mapAvatarId'),
    [location.search],
  );

  const progressAvatarId =
    mapAvatarId ??
    childProfileContext?.activeProfile?.childAvatarId ??
    childProfileContext?.activeProfile?.preferredAvatarIds?.[0] ??
    null;

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    completionAttemptRef.current += 1;
    completionInFlightRef.current = false;
    setStory(null);
    setCompletionResult(null);
    setIsRepeatRead(false);

    setStoryCompleted(false);
    setCompletionPending(false);
    setCompletionError(null);
    setParticipants([]);
    if (storyId) void loadStory(requestId);

    return () => {
      if (loadRequestRef.current === requestId) {
        loadRequestRef.current += 1;
      }
      completionAttemptRef.current += 1;
      completionInFlightRef.current = false;
    };
  }, [storyId, activeProfileId, isAdmin, offlineScope]);

  const loadStory = async (requestId: number) => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);
      let rawStory: any =
        isAdmin || isCharacterLifeRoute || !offlineScope
          ? null
          : await getOfflineStory(offlineScope, storyId);
      if (!rawStory) {
        const storyData = await backend.story.get({ id: storyId, profileId: activeProfileId || undefined });
        if (loadRequestRef.current !== requestId) return;
        rawStory = storyData as any;
      }
      if (loadRequestRef.current !== requestId) return;
      setStory(rawStory as Story);
      if (rawStory?.avatarParticipants?.length) {
        setParticipants(rawStory.avatarParticipants);
      } else if (Array.isArray(rawStory?.config?.avatars) && rawStory.config.avatars.length > 0) {
        setParticipants(rawStory.config.avatars);
      } else if (Array.isArray(rawStory?.config?.avatarIds) && rawStory.config.avatarIds.length > 0) {
        try {
          const avatars = await Promise.all(
            rawStory.config.avatarIds.map((id: string) => backend.avatar.get({
              id,
              profileId: activeProfileId || undefined,
            }))
          );
          if (loadRequestRef.current !== requestId) return;
          setParticipants(avatars.filter(Boolean));
        } catch (e) {
          console.error('Error loading participants:', e);
        }
      } else {
        setParticipants([]);
      }
    } catch (err) {
      if (loadRequestRef.current !== requestId) return;
      console.error('Error loading story:', err);
      setError('Geschichte konnte nicht geladen werden.');
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false);
    }
  };

  const handleStoryCompletion = async () => {
    if (!story || !storyId || storyCompleted || completionInFlightRef.current) return;
    if (isCharacterLifeStory) {
      setCompletionError(null);
      setStoryCompleted(true);
      return;
    }

    const attemptId = ++completionAttemptRef.current;
    completionInFlightRef.current = true;
    setCompletionPending(true);
    setCompletionError(null);

    try {
      const token = await getToken();
      const { getBackendUrl } = await import('../../config');
      const target = getBackendUrl();
      const response = await fetch(`${target}/story/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify((() => {
          const participantAvatarIds = extractStoryParticipantIds(story);
          return {
            storyId,
            storyTitle: story.title,
            genre: story.config.genre,
            profileId: activeProfileId || undefined,
            ...(participantAvatarIds.length > 0 ? { avatarIds: participantAvatarIds } : {}),
          };
        })()),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Story completion failed with status ${response.status}`);
      }
      if (result?.success !== true) {
        throw new Error('Story completion was not confirmed by the server.');
      }
      if (completionAttemptRef.current !== attemptId) return;
      setStoryCompleted(true);
      window.dispatchEvent(
        new CustomEvent('personalityUpdated', {
          detail: {
            avatarId: progressAvatarId ?? undefined,
            refreshProgression: true,
            source: 'story',
            updatedAt: new Date().toISOString(),
          },
        }),
      );

      // Every reward is granted exactly once per avatar and story. On a re-read
      // the server reports `alreadyCompleted` and we stay quiet instead of
      // replaying a celebration the child has not earned again.
      const completion = result as StoryCompletionResult;
      if (completion?.alreadyCompleted) {
        setIsRepeatRead(true);
      } else {
        setCompletionResult(completion);
      }

      emitMapProgress({ avatarId: progressAvatarId, source: 'story' });
    } catch (error) {
      console.error('Error completing story:', error);
      if (completionAttemptRef.current !== attemptId) return;
      const message = 'Dein Fortschritt konnte noch nicht gespeichert werden. Bitte versuche es erneut.';
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

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="rd-loading rd-scope" data-theme={theme} role="status">
        <div className="rd-spinner" aria-hidden="true" />
        <p className="rd-loading-text">Geschichte wird geladen …</p>
      </div>
    );
  }

  /* ── Error / Not Found ── */
  if (!story) {
    return (
      <div className="rd-loading rd-scope" data-theme={theme}>
        <p className="rd-error-title">{error || 'Geschichte wurde nicht gefunden.'}</p>
        <button type="button" onClick={() => navigate(returnPath)} className="rd-secondary-btn">
          {returnLabel}
        </button>
      </div>
    );
  }

  const chapters = story.chapters?.length ? story.chapters : story.pages || [];
  const castMembers = participants.length > 0 ? participants : story.avatarParticipants || story.config.avatars || [];

  return (
    <>
      <StoryReaderView
        key={story.id}
        story={story}
        chapters={chapters}
        castMembers={castMembers}
        isDark={isDark}
        isAdmin={isAdmin}
        isCharacterLifeStory={isCharacterLifeStory}
        returnPath={returnPath}
        returnLabel={returnLabel}
        onNavigate={navigate}
        completion={{
          isCompleted: storyCompleted,
          isCompleting: completionPending,
          error: completionError,
          isRepeatRead,
          onComplete: handleStoryCompletion,
        }}
      />

      {/* One calm completion moment instead of a stack of competing overlays. */}
      <StoryFinaleSheet
        result={isCharacterLifeStory ? null : completionResult}
        storyTitle={story.title}
        isDark={isDark}
        onClose={() => setCompletionResult(null)}
        onOpenTreasury={(avatarId) => {
          setCompletionResult(null);
          const target = avatarId || progressAvatarId;
          navigate(target ? `/avatar/${target}?tab=treasure` : '/avatar');
        }}
        onNextStory={() => {
          setCompletionResult(null);
          navigate('/story');
        }}
      />
    </>
  );
};

export default CinematicStoryViewer;

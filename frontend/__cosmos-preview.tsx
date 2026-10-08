// TEMPORARY preview harness for the Lernkosmos (delete after use).
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { OfflineClerkProvider } from './contexts/OfflineClerkProvider';
import { CosmosSceneRoot } from './screens/Cosmos/CosmosSceneRoot';
import type { CameraMode, CosmosState, DomainProgress } from './screens/Cosmos/CosmosTypes';
import { buildSeenKey, saveSeenSnapshot } from './screens/Cosmos/CosmosSeenState';

const d = (
  domainId: string,
  planetLevel: number,
  evolutionIndex: number,
  stage: DomainProgress['stage'],
  mastery: number,
  confidence: number,
  topicsExplored: number
): DomainProgress => ({
  domainId,
  planetLevel,
  evolutionIndex,
  stage,
  mastery,
  confidence,
  topicsExplored,
  lastActivityAt: topicsExplored > 0 ? new Date().toISOString() : null,
  recentHighlight: topicsExplored > 0 ? 'Quiz zu Bienen mit 4 von 5 richtig gelöst.' : undefined,
});

const FIXTURES: Record<string, CosmosState> = {
  kid: {
    childName: 'Mia',
    domains: [
      d('nature', 2, 31, 'understood', 34, 22, 3),
      d('space', 3, 58, 'apply', 58, 44, 4),
      d('history', 1, 6, 'discovered', 8, 4, 1),
      d('tech', 1, 0, 'discovered', 0, 0, 0),
      d('body', 1, 14, 'understood', 26, 16, 1),
      d('earth', 1, 0, 'discovered', 0, 0, 0),
      d('arts', 1, 0, 'discovered', 0, 0, 0),
      d('logic', 1, 2, 'discovered', 3, 1, 1),
    ],
    totalStoriesRead: 7,
    totalDokusRead: 9,
  },
  pro: {
    childName: 'Leo',
    domains: [
      d('nature', 12, 290, 'retained', 82, 74, 9),
      d('space', 9, 210, 'apply', 70, 55, 7),
      d('history', 6, 130, 'apply', 61, 46, 5),
      d('tech', 4, 85, 'understood', 44, 30, 4),
      d('body', 3, 52, 'understood', 36, 24, 3),
      d('earth', 2, 27, 'understood', 28, 18, 2),
      d('arts', 1, 10, 'discovered', 12, 6, 1),
      d('logic', 1, 0, 'discovered', 0, 0, 0),
    ],
    totalStoriesRead: 31,
    totalDokusRead: 42,
  },
  kidBefore: {
    childName: 'Mia',
    domains: [
      d('nature', 1, 12, 'discovered', 20, 10, 2),
      d('space', 2, 41, 'understood', 46, 30, 4),
      d('history', 1, 6, 'discovered', 8, 4, 1),
      d('tech', 1, 0, 'discovered', 0, 0, 0),
      d('body', 1, 14, 'understood', 26, 16, 1),
      d('earth', 1, 0, 'discovered', 0, 0, 0),
      d('arts', 1, 0, 'discovered', 0, 0, 0),
      d('logic', 1, 0, 'discovered', 0, 0, 0),
    ],
    totalStoriesRead: 5,
    totalDokusRead: 6,
  },
  empty: {
    childName: 'Ben',
    domains: ['nature', 'space', 'history', 'tech', 'body', 'earth', 'arts', 'logic'].map((id) =>
      d(id, 1, 0, 'discovered', 0, 0, 0)
    ),
    totalStoriesRead: 0,
    totalDokusRead: 0,
  },
};

const params = new URLSearchParams(window.location.search);
const fixtureKey = params.get('fixture') || 'kid';
const fixture = FIXTURES[fixtureKey] || FIXTURES.kid;

// Seen-state control: ?fresh=1 -> first visit (intro), ?seen=<fixture> -> celebrate the
// difference to that fixture, default -> nothing new.
{
  const key = buildSeenKey('child-1', 'avatar-1');
  if (params.get('fresh') === '1') {
    window.localStorage.removeItem(key);
  } else {
    const seenFixture = FIXTURES[params.get('seen') || ''] || fixture;
    saveSeenSnapshot(key, seenFixture);
  }
}

const Preview: React.FC = () => {
  const [cameraMode, setCameraMode] = useState<CameraMode>('system');
  const [, setHasFocus] = useState(false);
  return (
    <div
      className="relative flex flex-col w-full"
      style={{ height: '100dvh', minHeight: '100vh', background: 'linear-gradient(135deg, #050510 0%, #0c0820 50%, #10082a 100%)' }}
    >
      <div className="relative flex-1 min-h-0">
        <CosmosSceneRoot
          cosmosState={fixture}
          activeAvatarId="avatar-1"
          activeChildId="child-1"
          height="100%"
          qualityPreference={(params.get('quality') as any) || 'auto'}
          cameraModeOverride={cameraMode}
          onCameraModeChange={setCameraMode}
          onFocusAvailabilityChange={setHasFocus}
          showInternalModeTabs={false}
          onSceneReady={() => {
            (window as any).__cosmosReady = true;
          }}
          initialFocusDomainId={params.get('planet')}
        />
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <OfflineClerkProvider>
    <BrowserRouter>
      <Preview />
    </BrowserRouter>
  </OfflineClerkProvider>
);

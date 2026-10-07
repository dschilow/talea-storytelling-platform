import type { RootStackParamList } from './types';
import { normalizeGamePath } from './gameRoutes';
type NativeDestination = { [K in keyof RootStackParamList]: { name: K; params?: RootStackParamList[K] } }[keyof RootStackParamList];

/** Translate assistant and learning-map links without mistaking "create" for an avatar id. */
export function resolveWebRoute(route?: string): NativeDestination | undefined {
  if (!route) return;
  const [rawPath, query = ''] = normalizeGamePath(route).split('?');
  const path = rawPath.replace(/\/$/, '') || '/';
  const params = new URLSearchParams(query);
  if (path === '/spiel') return { name: 'Tabs', params: { screen: 'Spiel', params: { tab: params.get('tab') === 'quiz' ? 'quiz' : 'alibi' } } };
  if (path === '/game') return { name: 'Alibi' };
  const tabs: Record<string, 'Home' | 'Stories' | 'Avatars' | 'Dokus'> = { '/': 'Home', '/stories': 'Stories', '/avatar': 'Avatars', '/doku': 'Dokus' };
  if (tabs[path]) return { name: 'Tabs', params: { screen: tabs[path] } };
  if (path === '/avatar/create') return { name: 'AvatarWizard', params: { childMode: params.get('childMode') === 'true' } };
  if (path === '/story' || path === '/story/wizard-old') return { name: 'StoryWizard', params: { tags: params.get('tags') ?? undefined, mapAvatarId: params.get('mapAvatarId') ?? params.get('avatarId') ?? undefined, bringAvatar: params.get('bringAvatar') ?? undefined, bringArtifact: params.get('bringArtifact') ?? undefined } };
  if (path === '/doku/create') return { name: 'DokuWizard', params: { topic: params.get('topic') ?? undefined, domainId: params.get('domainId') ?? undefined } };
  const staticRoutes: Record<string, keyof RootStackParamList> = { '/story/fairytale-selection': 'FairyTaleSelection', '/cosmos': 'Cosmos', '/cosmos/parent': 'CosmosParent', '/map': 'Journey', '/settings': 'Settings', '/profiles': 'Profiles', '/community': 'Community', '/audio-dokus': 'AudioLibrary', '/createaudiodoku': 'AudioDokuCreate', '/characters': 'CharacterPool', '/artifacts': 'ArtifactPool', '/fairytales': 'FairyTales', '/logs': 'Logs', '/_admin': 'AdminDashboard', '/offline': 'OfflineLibrary', '/parental-onboarding': 'ParentalOnboarding' };
  if (staticRoutes[path]) return { name: staticRoutes[path] } as NativeDestination;
  const match = path.match(/^\/(story-reader(?:-old|-scroll)?|character-life-story|doku-reader(?:-old|-scroll)?|avatar\/edit|avatar)\/([^/]+)$/);
  if (match) {
    let id: string; try { id = decodeURIComponent(match[2]); } catch { return; }
    if (match[1].startsWith('story-reader')) return { name: 'StoryReader', params: { storyId: id } };
    if (match[1] === 'character-life-story') return { name: 'CharacterLifeStory', params: { storyId: id } };
    if (match[1].startsWith('doku-reader')) return { name: 'DokuReader', params: { dokuId: id } };
    return { name: match[1] === 'avatar/edit' ? 'AvatarEdit' : 'AvatarDetail', params: { avatarId: id } };
  }
  const tale = path.match(/^\/story\/fairytale\/([^/]+)\/map-characters$/);
  if (tale) return { name: 'CharacterMapping', params: { taleId: tale[1] } };
}

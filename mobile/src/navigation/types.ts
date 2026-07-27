import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Route map, mirroring the web app's router (frontend/App.tsx).
 *
 * Web routes that only exist as legacy fallbacks (`/story/wizard-old`,
 * `/story-reader-old/:id`, `/doku-reader-old/:id`, `/story-reader-scroll/:id`)
 * are intentionally not ported: the mobile reader is a single native
 * implementation, so there is no "old vs. cinematic vs. scroll" split to carry.
 */

export type TabParamList = {
  Home: undefined;
  Stories: undefined;
  Avatars: undefined;
  Dokus: undefined;
  Quiz: undefined;
};

export type RootStackParamList = {
  // Auth / onboarding
  Landing: undefined;
  Auth: { mode?: 'sign-in' | 'sign-up' } | undefined;
  ParentalOnboarding: undefined;

  // Tab shell
  Tabs: NavigatorScreenParams<TabParamList>;

  // Avatar
  AvatarWizard: { childMode?: boolean } | undefined;
  AvatarDetail: { avatarId: string };
  AvatarEdit: { avatarId: string };

  // Story
  StoryWizard: { tags?: string; mapAvatarId?: string; bringArtifact?: string; bringAvatar?: string } | undefined;
  FairyTaleSelection: undefined;
  CharacterMapping: { taleId: string };
  StoryReader: { storyId: string; startChapter?: number };
  CharacterLifeStory: { storyId: string };

  // Doku
  DokuWizard: undefined;
  DokuReader: { dokuId: string };
  AudioDokuCreate: undefined;

  // Learning / gamification
  Journey: undefined;
  Cosmos: undefined;
  CosmosParent: undefined;
  Treasury: { avatarId?: string } | undefined;

  // Utility
  Settings: undefined;
  Profiles: undefined;
  OfflineLibrary: undefined;
  Tavi: undefined;
  Community: undefined;

  // Admin-only
  AdminDashboard: undefined;
  Logs: undefined;
  CharacterPool: undefined;
  ArtifactPool: undefined;
  FairyTales: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

import type { RootStackParamList } from './types';

/**
 * Deep links.
 *
 * Paths deliberately match the web routes so a link shared from talea.website
 * opens the equivalent native screen (and so the `talea://` scheme registered in
 * AndroidManifest.xml resolves to something meaningful).
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'talea://', 'https://talea.website', 'https://www.talea.website'],
  config: {
    screens: {
      Tabs: {
        screens: {
          Home: '',
          Stories: 'stories',
          Avatars: 'avatar',
          Dokus: 'doku',
          Quiz: 'quiz',
        },
      },
      Auth: 'auth',
      ParentalOnboarding: 'parental-onboarding',

      AvatarWizard: 'avatar/create',
      AvatarDetail: 'avatar/:avatarId',
      AvatarEdit: 'avatar/edit/:avatarId',

      StoryWizard: 'story',
      FairyTaleSelection: 'story/fairytale-selection',
      CharacterMapping: 'story/fairytale/:taleId/map-characters',
      StoryReader: 'story-reader/:storyId',
      CharacterLifeStory: 'character-life-story/:storyId',

      DokuWizard: 'doku/create',
      DokuReader: 'doku-reader/:dokuId',
      AudioDokuCreate: 'createaudiodoku',

      Journey: 'map',
      Cosmos: 'cosmos',
      CosmosParent: 'cosmos/parent',

      Settings: 'settings',
      OfflineLibrary: 'offline',
      Community: 'community',

      AdminDashboard: '_admin',
      Logs: 'logs',
      CharacterPool: 'characters',
      ArtifactPool: 'artifacts',
      FairyTales: 'fairytales',
    },
  },
};

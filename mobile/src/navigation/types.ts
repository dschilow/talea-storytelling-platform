/**
 * Navigation types for type-safe navigation
 */

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  AvatarDetail: { avatarId: string };
  AvatarCreate: undefined;
  AvatarEdit: { avatarId: string };
  StoryCreate: undefined;
  StoryReader: { storyId: string };
  FairyTaleSelection: undefined;
  CharacterMapping: { taleId: string };
  DokuCreate: undefined;
  DokuReader: { dokuId: string };
};

export type MainTabsParamList = {
  Home: undefined;
  Avatars: undefined;
  Stories: undefined;
  FairyTales: undefined;
  Profile: undefined;
};

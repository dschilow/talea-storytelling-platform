import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/clerk-expo';

import { useOptionalUserAccess } from '@/providers/UserAccessProvider';
import { SplashScreen } from '@/screens/Auth/SplashScreen';
import { LandingScreen } from '@/screens/Auth/LandingScreen';
import { AuthScreen } from '@/screens/Auth/AuthScreen';
import { ParentalOnboardingScreen } from '@/screens/Settings/ParentalOnboardingScreen';

import { AvatarWizardScreen } from '@/screens/Avatar/AvatarWizardScreen';
import { AvatarDetailScreen } from '@/screens/Avatar/AvatarDetailScreen';
import { AvatarEditScreen } from '@/screens/Avatar/AvatarEditScreen';

import { StoryWizardScreen } from '@/screens/Story/StoryWizardScreen';
import { FairyTaleSelectionScreen } from '@/screens/Story/FairyTaleSelectionScreen';
import { CharacterMappingScreen } from '@/screens/Story/CharacterMappingScreen';
import { StoryReaderScreen } from '@/screens/Story/StoryReaderScreen';

import { DokuWizardScreen } from '@/screens/Doku/DokuWizardScreen';
import { DokuReaderScreen } from '@/screens/Doku/DokuReaderScreen';
import { AudioLibraryScreen } from '@/screens/Doku/AudioLibraryScreen';
import { AudioDokuCreateScreen } from '@/screens/Doku/AudioDokuCreateScreen';
import { QuizScreen } from '@/screens/Quiz/QuizScreen';

import { JourneyScreen } from '@/screens/Journey/JourneyScreen';
import { CosmosScreen } from '@/screens/Cosmos/CosmosScreen';
import { CosmosParentScreen } from '@/screens/Cosmos/CosmosParentScreen';
import { TreasuryScreen } from '@/screens/Treasury/TreasuryScreen';

import { SettingsScreen } from '@/screens/Settings/SettingsScreen';
import { ProfilesScreen } from '@/screens/Settings/ProfilesScreen';
import { OfflineLibraryScreen } from '@/screens/Offline/OfflineLibraryScreen';
import { TaviScreen } from '@/screens/Tavi/TaviScreen';
import { CommunityScreen } from '@/screens/Home/CommunityScreen';
import { AlibiScreen } from '@/screens/Game/AlibiScreen';

import { AdminDashboardScreen } from '@/screens/Admin/AdminDashboardScreen';
import { LogsScreen } from '@/screens/Admin/LogsScreen';
import { AdminAvatarsScreen } from '@/screens/Admin/AdminAvatarsScreen';
import { FairyTaleEditorScreen } from '@/screens/Admin/FairyTaleEditorScreen';
import { CharacterLifeEditorScreen } from '@/screens/Admin/CharacterLifeEditorScreen';
import { AvatarExchangeScreen } from '@/screens/Avatar/AvatarExchangeScreen';
import { withParentalGate } from '@/components/ParentalGate';
import { ConnectionRecoveryScreen } from '@/screens/Offline/ConnectionRecoveryScreen';
import { CharacterPoolScreen } from '@/screens/Admin/CharacterPoolScreen';
import { ArtifactPoolScreen } from '@/screens/Admin/ArtifactPoolScreen';
import { FairyTalesAdminScreen } from '@/screens/Admin/FairyTalesAdminScreen';

import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root navigation.
 *
 * The signed-in and signed-out route sets are mutually exclusive (as in the web
 * router) so there is no window where a protected screen is mounted without a
 * session. Admin-only routes are registered only for admins, which makes them
 * unreachable rather than merely guarded.
 */
const ProtectedProfiles = withParentalGate(ProfilesScreen);
const ProtectedSettings = withParentalGate(SettingsScreen);
const ProtectedCosmosParent = withParentalGate(CosmosParentScreen);
const ProtectedAvatarExchange = withParentalGate(AvatarExchangeScreen);

export function RootNavigator() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { isAdmin, role, refresh, parentalOnboardingCompleted, isLoading } = useOptionalUserAccess();

  if (!isLoaded || (isSignedIn && isLoading)) {
    return <SplashScreen />;
  }
  if (isSignedIn && !role) return <ConnectionRecoveryScreen userId={userId} retry={() => void refresh()} />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        // Android predictive-back support.
        animationTypeForReplace: 'push',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      {!isSignedIn ? (
        <Stack.Group>
          <Stack.Screen name="Landing" component={LandingScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="Auth" component={AuthScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack.Group>
      ) : parentalOnboardingCompleted === false ? (
        <Stack.Group navigationKey="onboarding">
          <Stack.Screen name="ParentalOnboarding" component={ParentalOnboardingScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Tabs" component={TabNavigator} options={{ animation: 'fade' }} />
          <Stack.Screen name="ParentalOnboarding" component={ParentalOnboardingScreen} />

          <Stack.Screen name="AvatarWizard" component={AvatarWizardScreen} />
          <Stack.Screen name="AvatarDetail" component={AvatarDetailScreen} />
          <Stack.Screen name="AvatarEdit" component={AvatarEditScreen} />
          <Stack.Screen name="AvatarExchange" component={ProtectedAvatarExchange} />

          <Stack.Screen name="StoryWizard" component={StoryWizardScreen} />
          <Stack.Screen name="FairyTaleSelection" component={FairyTaleSelectionScreen} />
          <Stack.Screen name="CharacterMapping" component={CharacterMappingScreen} />
          <Stack.Screen
            name="StoryReader"
            component={StoryReaderScreen}
            options={{ animation: 'fade_from_bottom', gestureEnabled: false }}
          />
          <Stack.Screen name="CharacterLifeStory" component={StoryReaderScreen} options={{ animation: 'fade_from_bottom' }} />

          <Stack.Screen name="DokuWizard" component={DokuWizardScreen} />
          <Stack.Screen name="DokuReader" component={DokuReaderScreen} options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="DokuQuiz" component={QuizScreen} />
          <Stack.Screen name="AudioLibrary" component={AudioLibraryScreen} />

          <Stack.Screen name="Journey" component={JourneyScreen} />
          <Stack.Screen name="Cosmos" component={CosmosScreen} />
          <Stack.Screen name="CosmosParent" component={ProtectedCosmosParent} />
          <Stack.Screen name="Treasury" component={TreasuryScreen} />

          <Stack.Screen name="Settings" component={ProtectedSettings} />
          <Stack.Screen name="Profiles" component={ProtectedProfiles} />
          <Stack.Screen name="OfflineLibrary" component={OfflineLibraryScreen} />
          <Stack.Screen name="Community" component={CommunityScreen} />
          <Stack.Screen name="Alibi" component={AlibiScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen
            name="Tavi"
            component={TaviScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />

          {isAdmin ? (
            <Stack.Group>
              <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
              <Stack.Screen name="Logs" component={LogsScreen} />
              <Stack.Screen name="AdminAvatars" component={AdminAvatarsScreen} />
              <Stack.Screen name="FairyTaleEditor" component={FairyTaleEditorScreen} />
              <Stack.Screen name="CharacterLifeEditor" component={CharacterLifeEditorScreen} />
              <Stack.Screen name="CharacterPool" component={CharacterPoolScreen} />
              <Stack.Screen name="ArtifactPool" component={ArtifactPoolScreen} />
              <Stack.Screen name="FairyTales" component={FairyTalesAdminScreen} />
              <Stack.Screen name="AudioDokuCreate" component={AudioDokuCreateScreen} />
            </Stack.Group>
          ) : null}
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

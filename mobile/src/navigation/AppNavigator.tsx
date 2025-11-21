import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, User, BookOpen, Sparkles, Library } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useThemedColors } from '@/utils/theme/useThemedColors';

// Import screens
import HomeScreen from '@/screens/Home/HomeScreen';
import AvatarsScreen from '@/screens/Avatar/AvatarsScreen';
import AvatarCreateScreen from '@/screens/Avatar/AvatarCreateScreen';
import AvatarEditScreen from '@/screens/Avatar/AvatarEditScreen';
import AvatarDetailScreen from '@/screens/Avatar/AvatarDetailScreen';
import StoriesScreen from '@/screens/Story/StoriesScreen';
import StoryCreateScreen from '@/screens/Story/StoryCreateScreen';
import StoryReaderScreen from '@/screens/Story/StoryReaderScreen';
import FairyTalesScreen from '@/screens/FairyTales/FairyTalesScreen';
import FairyTalesListScreen from '@/screens/FairyTales/FairyTalesListScreen';
import CharacterMappingScreen from '@/screens/FairyTales/CharacterMappingScreen';
import ProfileScreen from '@/screens/Profile/ProfileScreen';
import AchievementsScreen from '@/screens/Profile/AchievementsScreen';
import DokuScreen from '@/screens/Doku/DokuScreen';
import DokuReaderScreen from '@/screens/Doku/DokuReaderScreen';
import SettingsScreen from '@/screens/Settings/SettingsScreen';
import AuthScreen from '@/screens/Auth/AuthScreen';

import type { RootStackParamList, MainTabsParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

// Main Tabs Navigator (after authentication)
const MainTabsNavigator = () => {
  const colors = useThemedColors();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background.primary,
          borderTopColor: colors.border.medium,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarActiveTintColor: colors.lavender[500],
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Avatars"
        component={AvatarsScreen}
        options={{
          title: 'Avatare',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Stories"
        component={StoriesScreen}
        options={{
          title: 'Geschichten',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="FairyTales"
        component={FairyTalesScreen}
        options={{
          title: 'Märchen',
          tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Library color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
};

// Root Stack Navigator
export const AppNavigator = () => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    // TODO: Add loading screen
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!isSignedIn ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabsNavigator} />
            <Stack.Screen name="AvatarCreate" component={AvatarCreateScreen} />
            <Stack.Screen name="AvatarEdit" component={AvatarEditScreen} />
            <Stack.Screen name="AvatarDetail" component={AvatarDetailScreen} />
            <Stack.Screen name="StoryCreate" component={StoryCreateScreen} />
            <Stack.Screen name="StoryReader" component={StoryReaderScreen} />
            <Stack.Screen name="FairyTalesList" component={FairyTalesListScreen} />
            <Stack.Screen name="CharacterMapping" component={CharacterMappingScreen} />
            <Stack.Screen name="Doku" component={DokuScreen} />
            <Stack.Screen name="DokuReader" component={DokuReaderScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

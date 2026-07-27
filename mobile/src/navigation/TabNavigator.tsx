import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import { HomeScreen } from '@/screens/Home/HomeScreen';
import { StoriesScreen } from '@/screens/Story/StoriesScreen';
import { AvatarsScreen } from '@/screens/Avatar/AvatarsScreen';
import { DokusScreen } from '@/screens/Doku/DokusScreen';
import { QuizScreen } from '@/screens/Quiz/QuizScreen';
import { TabBar } from './TabBar';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Blurred tabs stay mounted but stop re-rendering, so scroll position
        // and query state survive a tab switch without the background screens
        // costing frames while another tab animates.
        freezeOnBlur: true,
      }}
      backBehavior="history"
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('navigation.home', 'Start') }} />
      <Tab.Screen name="Stories" component={StoriesScreen} options={{ tabBarLabel: t('navigation.stories', 'Geschichten') }} />
      <Tab.Screen name="Avatars" component={AvatarsScreen} options={{ tabBarLabel: t('navigation.avatars', 'Avatare') }} />
      <Tab.Screen name="Dokus" component={DokusScreen} options={{ tabBarLabel: 'Dokus' }} />
      <Tab.Screen name="Quiz" component={QuizScreen} options={{ tabBarLabel: 'Quiz' }} />
    </Tab.Navigator>
  );
}

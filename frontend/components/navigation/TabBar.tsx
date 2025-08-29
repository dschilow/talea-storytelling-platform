import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../utils/constants/colors';
import { spacing, borderRadius } from '../../utils/constants/spacing';
import { typography } from '../../utils/constants/typography';

const { width: screenWidth } = Dimensions.get('window');

interface TabBarProps extends BottomTabBarProps {}

const TabBar: React.FC<TabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const activeIndex = useSharedValue(state.index);

  React.useEffect(() => {
    activeIndex.value = withSpring(state.index, {
      damping: 15,
      stiffness: 150,
    });
  }, [state.index]);

  const indicatorStyle = useAnimatedStyle(() => {
    const tabWidth = screenWidth / state.routes.length;
    const translateX = interpolate(
      activeIndex.value,
      [0, state.routes.length - 1],
      [0, tabWidth * (state.routes.length - 1)],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateX }],
      width: tabWidth,
    };
  });

  const getTabIcon = (routeName: string) => {
    switch (routeName) {
      case 'Home':
        return '🏠';
      case 'Avatar':
        return '👤';
      case 'Story':
        return '📚';
      default:
        return '•';
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title || route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            style={styles.tab}
            activeOpacity={0.7}
          >
            <View style={styles.tabContent}>
              <Text style={[
                styles.icon,
                { opacity: isFocused ? 1 : 0.6 }
              ]}>
                {getTabIcon(route.name)}
              </Text>
              <Text style={[
                styles.label,
                { 
                  color: isFocused ? colors.primary[600] : colors.neutral[600],
                  opacity: isFocused ? 1 : 0.6
                }
              ]}>
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: spacing.sm,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    height: 3,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
});

export default TabBar;

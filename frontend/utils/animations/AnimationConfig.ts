import { Easing } from 'react-native-reanimated';

export const animationConfig = {
  timing: {
    fast: 200,
    medium: 300,
    slow: 500,
    extraSlow: 800
  },
  easing: {
    easeOut: Easing.out(Easing.exp),
    easeIn: Easing.in(Easing.exp),
    easeInOut: Easing.inOut(Easing.quad),
    spring: Easing.elastic(1.2),
    bounce: Easing.bounce
  },
  springs: {
    gentle: {
      damping: 15,
      mass: 1,
      stiffness: 120
    },
    bouncy: {
      damping: 8,
      mass: 1,
      stiffness: 150
    },
    snappy: {
      damping: 20,
      mass: 1,
      stiffness: 200
    }
  }
};

export const fadeInConfig = {
  duration: animationConfig.timing.medium,
  easing: animationConfig.easing.easeOut,
};

export const slideInConfig = {
  duration: animationConfig.timing.medium,
  easing: animationConfig.easing.easeOut,
};

export const scaleConfig = {
  duration: animationConfig.timing.fast,
  easing: animationConfig.easing.spring,
};

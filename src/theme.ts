import { Animated } from 'react-native';
import { useRef, useEffect } from 'react';

export const theme = {
  colors: {
    bg: '#0a0e1a',
    surface: '#111827',
    surfaceElevated: '#1a2332',
    surfaceHighlight: '#1e293b',

    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',

    primary: '#22c55e',
    primaryLight: '#4ade80',
    primaryDark: '#16a34a',
    primaryGlow: 'rgba(34,197,94,0.12)',

    accent: '#f59e0b',
    accentGlow: 'rgba(245,158,11,0.12)',

    info: '#3b82f6',
    infoGlow: 'rgba(59,130,246,0.12)',

    danger: '#ef4444',
    warning: '#f97316',
    purple: '#a855f7',

    border: '#1e293b',
    borderLight: '#334155',

    overlay: 'rgba(0,0,0,0.7)',
    overlayLight: 'rgba(0,0,0,0.5)',

    green: '#22c55e',
    red: '#ef4444',
    amber: '#f59e0b',
    blue: '#3b82f6',
    orange: '#f97316',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
  },

  borderRadius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 15,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 22,
    '4xl': 32,
  },

  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 8,
    },
  },
} as const;

export function useFadeIn(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  return { opacity, translateY };
}

export function useSlideIn(direction: 'left' | 'right' | 'up' | 'down' = 'up', delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      delay,
      useNativeDriver: true,
    }).start();
  }, [delay]);

  const from = direction === 'left' ? -20 : direction === 'right' ? 20 : direction === 'up' ? 16 : -16;
  const translateX = direction === 'left' || direction === 'right' ? from : 0;
  const translateY = direction === 'up' || direction === 'down' ? from : 0;

  return {
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [
      { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [translateX, 0] }) },
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [translateY, 0] }) },
    ],
  };
}

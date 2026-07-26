import { Animated, Platform } from 'react-native';
import { useRef, useEffect } from 'react';

export const theme = {
  colors: {
    bg: '#0c0f14',
    surface: '#14181f',
    surfaceElevated: '#1b2129',
    surfaceHighlight: '#252c36',

    text: '#e6edf3',
    textSecondary: '#8b949e',
    textMuted: '#6e7681',

    primary: '#238636',
    primaryLight: '#2ea043',
    primaryDark: '#19672b',
    primaryGlow: 'rgba(35,134,54,0.15)',

    accent: '#d29922',
    accentGlow: 'rgba(210,153,34,0.15)',

    info: '#58a6ff',
    infoGlow: 'rgba(88,166,255,0.15)',

    danger: '#f85149',
    warning: '#d29922',
    purple: '#bc8cff',

    border: '#21262d',
    borderLight: '#30363d',

    overlay: 'rgba(0,0,0,0.7)',
    overlayLight: 'rgba(0,0,0,0.5)',

    green: '#238636',
    red: '#f85149',
    amber: '#d29922',
    blue: '#58a6ff',
    orange: '#d29922',
  },

  fonts: {
    heading: Platform.select({
      ios: 'DM Serif Display',
      android: 'DM_Serif_Display',
      default: 'DM Serif Display',
    }),
    body: Platform.select({
      ios: 'DM Sans',
      android: 'DM_Sans',
      default: 'DM Sans',
    }),
    mono: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
  },

  borderRadius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  },

  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 36,
  },

  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  letterSpacing: {
    tight: -0.3,
    normal: 0,
    wide: 0.8,
    wider: 1.5,
  },

  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 14,
      elevation: 10,
    },
    glow: (color: string) => ({
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    }),
  },
} as const;

export function useFadeIn(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return { opacity, translateY };
}

export function useSlideIn(direction: 'left' | 'right' | 'up' | 'down' = 'up', delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const from = direction === 'left' ? -24 : direction === 'right' ? 24 : direction === 'up' ? 20 : -20;
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

export function usePulse() {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return { opacity: anim };
}

import { Animated, StyleSheet, View, ViewProps } from 'react-native';
import { theme, useFadeIn } from '../theme';

interface CardProps extends ViewProps {
  delay?: number;
  elevated?: boolean;
  highlight?: boolean;
}

export default function Card({ delay = 0, elevated, highlight, style, children, ...props }: CardProps) {
  const { opacity, translateY } = useFadeIn(delay);

  return (
    <Animated.View
      style={[
        styles.card,
        elevated && styles.elevated,
        highlight && styles.highlight,
        { opacity, transform: [{ translateY }] },
        style,
      ]}
      {...props}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  elevated: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderColor: theme.colors.borderLight,
    ...theme.shadow.md,
  },
  highlight: {
    borderColor: theme.colors.primary,
    borderWidth: 1,
  },
});

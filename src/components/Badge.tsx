import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'accent' | 'info' | 'danger' | 'warning' | 'neutral';
  size?: 'sm' | 'md';
}

export default function Badge({ label, variant = 'neutral', size = 'sm' }: BadgeProps) {
  const bgKey = `${variant}Bg` as keyof typeof badgeStyles;
  const textKey = `${variant}Text` as keyof typeof badgeStyles;

  return (
    <View style={[styles.base, styles[size], badgeStyles[bgKey] || badgeStyles.neutralBg]}>
      <Text style={[styles.text, styles[`${size}Text`], badgeStyles[textKey] || badgeStyles.neutralText]}>
        {label}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  primaryBg: { backgroundColor: theme.colors.primaryGlow },
  primaryText: { color: theme.colors.primary },
  accentBg: { backgroundColor: theme.colors.accentGlow },
  accentText: { color: theme.colors.accent },
  infoBg: { backgroundColor: theme.colors.infoGlow },
  infoText: { color: theme.colors.info },
  dangerBg: { backgroundColor: 'rgba(239,68,68,0.12)' },
  dangerText: { color: theme.colors.danger },
  warningBg: { backgroundColor: 'rgba(249,115,22,0.12)' },
  warningText: { color: theme.colors.warning },
  neutralBg: { backgroundColor: theme.colors.surfaceHighlight },
  neutralText: { color: theme.colors.textSecondary },
});

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  sm: {},
  md: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontWeight: theme.fontWeight.semibold,
  },
  smText: {
    fontSize: theme.fontSize.xs,
  },
  mdText: {
    fontSize: theme.fontSize.sm,
  },
});

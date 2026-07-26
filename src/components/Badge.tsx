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
  primaryBg: { backgroundColor: theme.colors.primaryGlow, borderColor: 'rgba(35,134,54,0.3)' },
  primaryText: { color: theme.colors.primaryLight },
  accentBg: { backgroundColor: theme.colors.accentGlow, borderColor: 'rgba(210,153,34,0.3)' },
  accentText: { color: theme.colors.accent },
  infoBg: { backgroundColor: theme.colors.infoGlow, borderColor: 'rgba(88,166,255,0.3)' },
  infoText: { color: theme.colors.info },
  dangerBg: { backgroundColor: 'rgba(248,81,73,0.12)', borderColor: 'rgba(248,81,73,0.3)' },
  dangerText: { color: theme.colors.danger },
  warningBg: { backgroundColor: 'rgba(210,153,34,0.12)', borderColor: 'rgba(210,153,34,0.3)' },
  warningText: { color: theme.colors.warning },
  neutralBg: { backgroundColor: theme.colors.surfaceHighlight, borderColor: theme.colors.border },
  neutralText: { color: theme.colors.textSecondary },
});

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  sm: {},
  md: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontFamily: theme.fonts.body,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: theme.letterSpacing.wide,
  },
  smText: {
    fontSize: theme.fontSize.xs,
  },
  mdText: {
    fontSize: theme.fontSize.sm,
  },
});

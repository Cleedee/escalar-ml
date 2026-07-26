import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { theme } from '../theme';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label: string;
}

export default function Button({ variant = 'primary', size = 'md', label, style, ...props }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        props.disabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.8}
      {...props}
    >
      <Text style={[styles.text, styles[`text_${variant}`], props.disabled && styles.textDisabled]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  outline: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  danger: {
    borderWidth: 1,
    borderColor: theme.colors.danger,
    backgroundColor: 'rgba(248,81,73,0.08)',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.4,
  },
  size_sm: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.lg,
  },
  size_md: {
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.xl,
  },
  size_lg: {
    paddingVertical: 16,
    paddingHorizontal: theme.spacing['2xl'],
  },
  text: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: theme.letterSpacing.wide,
  },
  text_primary: {
    color: '#fff',
  },
  text_outline: {
    color: theme.colors.textSecondary,
  },
  text_danger: {
    color: theme.colors.danger,
  },
  text_ghost: {
    color: theme.colors.primary,
  },
  textDisabled: {
    opacity: 0.5,
  },
});

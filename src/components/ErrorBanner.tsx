import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';

/**
 * Banner não-intrusivo de erro de API.
 * Some automaticamente após `duration` ms ou ao toque.
 */
export default function ErrorBanner({
  message,
  onRetry,
  duration = 8000,
}: {
  message: string | null;
  onRetry?: () => void;
  duration?: number;
}) {
  const [visible, setVisible] = useState(message != null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      setFading(false);
      if (duration > 0) {
        const timer = setTimeout(() => setFading(true), duration);
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [message, duration]);

  const handleDismiss = () => setFading(true);

  if (!visible || !message) return null;

  return (
    <View
      style={[
        styles.banner,
        fading && styles.bannerFading,
      ]}
      onPress={fading ? undefined : handleDismiss}
      activeOpacity={0.9}
    >
      <View style={styles.bannerRow}>
        <Text style={styles.bannerIcon}>⚠️</Text>
        <Text style={styles.bannerText}>{message}</Text>
      </View>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Tentar novamente</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn}>
        <Text style={styles.dismissBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248,81,73,0.08)',
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  bannerFading: {
    opacity: 0,
    height: 0,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    overflow: 'hidden',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  bannerIcon: {
    fontSize: theme.fontSize.base,
  },
  bannerText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
    flex: 1,
    lineHeight: 18,
  },
  retryBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryGlow,
  },
  retryBtnText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  dismissBtn: {
    padding: theme.spacing.xs,
  },
  dismissBtnText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.bold,
  },
});
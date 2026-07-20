import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { MarketStatus, STATUS_MAP } from '../types';
import { API_BASE, BUILD_DATE } from '../config';
import { fetchStatus } from '../services/api';
import { version as APP_VERSION } from '../../package.json';
import { theme } from '../theme';
import Badge from '../components/Badge';
import usePageTitle from '../usePageTitle';

const BADGE_VARIANT: Record<number, 'primary' | 'warning' | 'info' | 'danger' | 'neutral'> = {
  1: 'primary',
  2: 'warning',
  3: 'info',
  4: 'info',
  5: 'danger',
};

export default function StatusScreen({ navigation }: any) {
  usePageTitle('Status do Mercado');
  const [status, setStatus] = useState<MarketStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStatus();
      setStatus(data);
    } catch (e: any) {
      setError(e.message || 'Erro ao buscar status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusCode = status?.status_mercado ?? null;
  const statusInfo = statusCode != null ? STATUS_MAP[statusCode] : null;
  const rodada = status?.rodada_atual ?? null;
  const badgeVariant = statusCode != null ? BADGE_VARIANT[statusCode] ?? 'neutral' : 'neutral';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>Status do Mercado</Text>
        <Text style={styles.versionText}>EscalarML v{APP_VERSION}</Text>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Consultando status...</Text>
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text onPress={load} style={styles.retry}>
            Tentar novamente
          </Text>
        </View>
      )}

      {status && !loading && (
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusCard,
              { borderColor: statusInfo?.color ?? '#333' },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: statusInfo?.color ?? '#666' },
              ]}
            />
            <Badge label={statusInfo?.label ?? 'Desconhecido'} variant={badgeVariant} size="md" />
            {rodada != null && (
              <Text style={styles.statusRound}>Rodada {rodada}</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.detailButton}
            onPress={() => navigation.navigate('StatusDetail', { status })}
            activeOpacity={0.7}
          >
            <Text style={styles.detailButtonText}>Ver detalhes</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{API_BASE}</Text>
        <Text style={styles.footerSub}>Versão {APP_VERSION} · {BUILD_DATE}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    alignItems: 'center',
  },
  logoImage: {
    width: 200,
    height: 80,
  },
  subtitle: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  versionText: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing['2xl'],
  },
  loadingText: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
  },
  errorIcon: {
    fontSize: 48,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.danger,
    width: 64,
    height: 64,
    lineHeight: 64,
    textAlign: 'center',
    borderRadius: 32,
    borderWidth: 3,
    borderColor: theme.colors.danger,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.lg,
    textAlign: 'center',
  },
  retry: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  statusContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing['2xl'],
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing['2xl'],
    gap: 14,
    backgroundColor: theme.colors.surface,
  },
  statusDot: {
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  statusRound: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginLeft: 'auto',
  },
  detailButton: {
    paddingVertical: 14,
    paddingHorizontal: theme.spacing['2xl'],
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  detailButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  footer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  footerSub: {
    fontSize: theme.fontSize.xs,
    color: '#475569',
    marginTop: 2,
  },
});

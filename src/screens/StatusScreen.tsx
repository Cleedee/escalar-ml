import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MarketStatus, STATUS_MAP } from '../types';
import { API_BASE } from '../config';
import { fetchStatus } from '../services/api';
import { version as APP_VERSION } from '../../package.json';
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import Badge from '../components/Badge';

const BADGE_VARIANT: Record<number, 'primary' | 'warning' | 'info' | 'danger' | 'neutral'> = {
  1: 'primary',
  2: 'warning',
  3: 'info',
  4: 'info',
  5: 'danger',
};

export default function StatusScreen() {
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
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
        >
          <Card
            style={{
              borderColor: statusInfo?.color ?? '#333',
              borderWidth: 1.5,
              marginBottom: theme.spacing['2xl'],
            }}
          >
            <View style={styles.statusCardRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusInfo?.color ?? '#666' },
                ]}
              />
              <View style={styles.statusText}>
                <Badge label={statusInfo?.label ?? 'Desconhecido'} variant={badgeVariant} size="md" />
                {rodada != null && (
                  <Text style={styles.statusRound}>Rodada {rodada}</Text>
                )}
              </View>
            </View>
          </Card>

          <SectionHeader label="Resposta da API" />
          <View style={styles.jsonCard}>
            <Text style={styles.jsonText}>
              {JSON.stringify(status, null, 2)}
            </Text>
          </View>

          <SectionHeader label="Legenda" />
          {Object.entries(STATUS_MAP).map(([code, info]) => (
            <View key={code} style={styles.legendRow}>
              <View
                style={[styles.legendDot, { backgroundColor: info.color }]}
              />
              <Text style={styles.legendCode}>{code}</Text>
              <Text style={styles.legendLabel}>{info.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{API_BASE}</Text>
        <Text style={styles.footerSub}>Última atualização: agora</Text>
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
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  statusCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginRight: 14,
  },
  statusText: {
    flex: 1,
  },
  statusRound: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  jsonCard: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: theme.fontSize.sm,
    color: '#e2e8f0',
    lineHeight: 18,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: theme.borderRadius.sm,
    marginRight: 10,
  },
  legendCode: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    width: 20,
  },
  legendLabel: {
    fontSize: theme.fontSize.base,
    color: '#cbd5e1',
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

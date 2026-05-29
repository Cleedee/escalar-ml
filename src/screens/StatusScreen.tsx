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
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#22c55e" />
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
            <View style={styles.statusText}>
              <Text style={styles.statusLabel}>
                {statusInfo?.label ?? 'Desconhecido'}
              </Text>
              {rodada != null && (
                <Text style={styles.statusRound}>Rodada {rodada}</Text>
              )}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Resposta da API</Text>
          <View style={styles.jsonCard}>
            <Text style={styles.jsonText}>
              {JSON.stringify(status, null, 2)}
            </Text>
          </View>

          <Text style={styles.legendTitle}>Legenda</Text>
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
    backgroundColor: '#0f172a',
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  logoImage: {
    width: 200,
    height: 80,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 15,
  },
  errorIcon: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ef4444',
    width: 64,
    height: 64,
    lineHeight: 64,
    textAlign: 'center',
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#ef4444',
    marginBottom: 16,
    overflow: 'hidden',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
  },
  retry: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 8,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 24,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 14,
  },
  statusText: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
  },
  statusRound: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  jsonCard: {
    backgroundColor: '#0d1117',
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 18,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendCode: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    width: 20,
  },
  legendLabel: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
  },
  footerSub: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
});

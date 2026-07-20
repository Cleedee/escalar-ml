import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MarketStatus, ModeloInfo, STATUS_MAP } from '../types';
import { theme } from '../theme';
import { fetchModeloInfo } from '../services/api';
import SectionHeader from '../components/SectionHeader';
import usePageTitle from '../usePageTitle';

export default function StatusDetailScreen({ route, navigation }: any) {
  usePageTitle('Status');
  const status: MarketStatus = route.params?.status;
  const [modelo, setModelo] = useState<ModeloInfo | null>(null);
  const [loadingModelo, setLoadingModelo] = useState(true);
  const [modeloError, setModeloError] = useState<string | null>(null);

  const loadModelo = useCallback(async () => {
    setLoadingModelo(true);
    setModeloError(null);
    try {
      const data = await fetchModeloInfo();
      setModelo(data);
    } catch (e: any) {
      setModeloError(e.message || 'Erro ao buscar info do modelo');
    } finally {
      setLoadingModelo(false);
    }
  }, []);

  useEffect(() => {
    loadModelo();
  }, [loadModelo]);

  if (!status) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Nenhum dado disponível</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Voltar</Text>
        </TouchableOpacity>

        <SectionHeader label="Modelo" />
        {loadingModelo && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Carregando info do modelo...</Text>
          </View>
        )}
        {modeloError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{modeloError}</Text>
            <TouchableOpacity onPress={loadModelo}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}
        {modelo && !loadingModelo && (
          <View style={styles.modeloCard}>
            <Text style={styles.modeloLabel}>Último treino do modelo</Text>
            <Text style={styles.modeloValue}>{modelo.treinado_em}</Text>
          </View>
        )}

        <SectionHeader label="Resposta da API" />
        <View style={styles.jsonCard}>
          <Text style={styles.jsonText}>
            {JSON.stringify(status, null, 2)}
          </Text>
        </View>

        <SectionHeader label="Legenda" />
        {Object.entries(STATUS_MAP).map(([code, info]) => (
          <View key={code} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: info.color }]} />
            <Text style={styles.legendCode}>{code}</Text>
            <Text style={styles.legendLabel}>{info.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing['2xl'],
    backgroundColor: theme.colors.bg,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.lg,
    marginBottom: theme.spacing.lg,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
  },
  backBtn: {
    paddingVertical: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  backBtnText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing['2xl'],
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  errorBoxText: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
  },
  retryText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  modeloCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  modeloLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: theme.spacing.sm,
  },
  modeloValue: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    marginTop: 2,
    marginBottom: theme.spacing.sm,
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
});

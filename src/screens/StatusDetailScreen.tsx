import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MarketStatus, STATUS_MAP } from '../types';
import { theme } from '../theme';
import SectionHeader from '../components/SectionHeader';

export default function StatusDetailScreen({ route, navigation }: any) {
  const status: MarketStatus = route.params?.status;

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

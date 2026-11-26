import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import Button from '../components/Button';
import { exportAllData, importAllData } from '../services/storage';
import { APP_VERSION, BUILD_DATE } from '../config';
import usePageTitle from '../usePageTitle';

export default function SettingsScreen({ navigation }: any) {
  usePageTitle('Configurações');

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importMerge, setImportMerge] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const info = `${data.lineups.length} escalações e ${data.leagues.length} ligas`;

      if (Platform.OS === 'web') {
        // Web: download as blob
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `escalarml_backup_${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert('Exportado!', `${info} exportados.`);
      } else {
        // Mobile: copy to clipboard (file system APIs unreliable)
        await Clipboard.setStringAsync(json);
        Alert.alert('Exportado!', `${info} copiados para a área de transferência.`);
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível exportar os dados.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importJson.trim()) {
      Alert.alert('Vazio', 'Cole o JSON do backup primeiro.');
      return;
    }
    setImporting(true);
    try {
      const data = JSON.parse(importJson);
      if (!data.version || (!data.lineups && !data.leagues)) {
        Alert.alert('Inválido', 'O JSON não parece ser um backup válido do EscalarML.');
        return;
      }
      const result = await importAllData(data, importMerge);
      Alert.alert(
        'Importado!',
        `${result.lineups} escalações e ${result.leagues} ligas${importMerge ? ' adicionadas' : ' substituídas'} com sucesso.${importMerge ? '\n\nItens com IDs já existentes foram preservados.' : ''}`,
      );
      setShowImportModal(false);
      setImportJson('');
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'JSON inválido. Verifique o formato.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>Configurações</Text>

      <Card>
        <SectionHeader label="Backup de dados" />
        <Text style={styles.body}>
          Exporte todas as suas ligas e escalações como JSON. Útil para migrar de dispositivo
          ou fazer backup antes de reinstalar o app.
        </Text>
        <Button
          variant="primary"
          label={exporting ? 'Exportando...' : '📤 Exportar tudo'}
          onPress={handleExport}
          disabled={exporting}
        />
        <View style={styles.spacer} />
        <Button
          variant="outline"
          label="📥 Importar backup"
          onPress={() => setShowImportModal(true)}
        />
      </Card>

      <Card>
        <SectionHeader label="Sobre" />
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Versão</Text>
          <Text style={styles.aboutValue}>{APP_VERSION}</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Build</Text>
          <Text style={styles.aboutValue}>{BUILD_DATE}</Text>
        </View>
      </Card>

      <Button variant="outline" label="Voltar" onPress={() => navigation.goBack()} />

      {/* ── Import modal ── */}
      <Modal visible={showImportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Importar backup</Text>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              Cole abaixo o JSON do backup exportado anteriormente.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={importJson}
              onChangeText={setImportJson}
              placeholder='{"version":"1","exported_at":"...","lineups":[],"leagues":[]}'
              placeholderTextColor={theme.colors.textMuted}
              multiline
              autoFocus
            />
            <View style={styles.mergeRow}>
              <Text style={styles.mergeLabel}>Mesclar com dados existentes</Text>
              <TouchableOpacity
                style={[styles.mergeToggle, importMerge && styles.mergeToggleActive]}
                onPress={() => setImportMerge((v) => !v)}
              >
                <Text style={[styles.mergeToggleText, importMerge && styles.mergeToggleTextActive]}>
                  {importMerge ? 'SIM' : 'NÃO'}
                </Text>
              </TouchableOpacity>
            </View>
            <Button
              variant="primary"
              label={importing ? 'Importando...' : 'Importar'}
              onPress={handleImport}
              disabled={importing || !importJson.trim()}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  inner: { padding: theme.spacing.xl, paddingBottom: 40 },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize['3xl'],
    color: theme.colors.text,
    marginBottom: theme.spacing['2xl'],
    letterSpacing: theme.letterSpacing.tight,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  spacer: { height: theme.spacing.sm },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  aboutLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    fontWeight: theme.fontWeight.semibold,
  },
  aboutValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '85%',
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    letterSpacing: theme.letterSpacing.tight,
  },
  modalClose: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.textSecondary,
    padding: theme.spacing.xs,
  },
  modalHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  modalInput: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    minHeight: 120,
    marginBottom: theme.spacing.md,
  },
  mergeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  mergeLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  mergeToggle: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  mergeToggleActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryGlow,
  },
  mergeToggleText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
  },
  mergeToggleTextActive: {
    color: theme.colors.primary,
  },
});
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';
import { setLastPromptedVersion } from '../services/versionCheck';

const GITHUB_RELEASES = 'https://github.com/Cleedee/escalar-ml/releases';

interface Props {
  visible: boolean;
  currentVersion: string;
  latestVersion: string;
  onClose: () => void;
}

export default function UpdateModal({ visible, currentVersion, latestVersion, onClose }: Props) {
  const handleUpdate = () => {
    Linking.openURL(GITHUB_RELEASES).catch(() => {});
    setLastPromptedVersion(latestVersion);
    onClose();
  };

  const handleDismiss = () => {
    setLastPromptedVersion(latestVersion);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.icon}>📦</Text>
          <Text style={styles.title}>Nova versão disponível</Text>
          <Text style={styles.subtitle}>
            Versão {latestVersion} disponível{'\n'}(você está na {currentVersion})
          </Text>
          <Text style={styles.body}>
            Uma nova versão do EscalarML foi publicada. Atualize para ter acesso às
            últimas funcionalidades e correções.
          </Text>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate} activeOpacity={0.8}>
              <Text style={styles.updateBtnText}>Atualizar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} activeOpacity={0.8}>
              <Text style={styles.dismissBtnText}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['3xl'],
  },
  modal: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  icon: {
    fontSize: 40,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.xl,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.spacing.xl,
    marginBottom: theme.spacing['2xl'],
  },
  buttons: {
    width: '100%',
    gap: theme.spacing.sm,
  },
  updateBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  updateBtnText: {
    color: '#fff',
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: theme.letterSpacing.wide,
  },
  dismissBtn: {
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  dismissBtnText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
});

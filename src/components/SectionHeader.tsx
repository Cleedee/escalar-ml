import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface SectionHeaderProps {
  label: string;
  action?: React.ReactNode;
}

export default function SectionHeader({ label, action }: SectionHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing['2xl'],
    marginBottom: theme.spacing.md,
  },
  line: {
    width: 3,
    height: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    marginRight: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    flex: 1,
  },
  action: {
    marginLeft: theme.spacing.sm,
  },
});

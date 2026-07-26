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
    marginBottom: theme.spacing.sm,
  },
  line: {
    width: 3,
    height: 18,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    marginRight: theme.spacing.sm,
  },
  label: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: theme.letterSpacing.wider,
    flex: 1,
  },
  action: {
    marginLeft: theme.spacing.sm,
  },
});

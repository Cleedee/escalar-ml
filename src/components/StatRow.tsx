import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface StatItemProps {
  label: string;
  value: string;
  color?: string;
}

interface StatRowProps {
  items: StatItemProps[];
  columns?: number;
}

export default function StatRow({ items, columns = 3 }: StatRowProps) {
  return (
    <View style={[styles.row, { justifyContent: columns === 1 ? 'flex-start' : 'space-around' }]}>
      {items.map((item, i) => (
        <View key={i} style={[styles.item, columns === 1 && { marginRight: 24 }]}>
          <Text style={[styles.value, item.color ? { color: item.color } : undefined]}>
            {item.value}
          </Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function StatValue({ label, value, color }: StatItemProps) {
  return (
    <View style={styles.item}>
      <Text style={[styles.value, color ? { color } : undefined]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  item: {
    alignItems: 'center',
  },
  value: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
  },
  label: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});

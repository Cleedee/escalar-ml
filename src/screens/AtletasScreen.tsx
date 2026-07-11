import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Atleta } from '../types';
import { fetchAtletas } from '../services/api';
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import Badge from '../components/Badge';

type SortKey = 'preco_desc' | 'preco_asc' | 'media_desc' | 'media_asc';

const POSICOES = [
  { key: '', label: 'Todas' },
  { key: 'GOL', label: 'Goleiro' },
  { key: 'LAT', label: 'Lateral' },
  { key: 'ZAG', label: 'Zagueiro' },
  { key: 'MEI', label: 'Meia' },
  { key: 'ATA', label: 'Atacante' },
  { key: 'TEC', label: 'Técnico' },
];

const STATUS_LIST = [
  { key: '', label: 'Todos' },
  { key: 'Provável', label: 'Provável' },
  { key: 'Duvidoso', label: 'Duvidoso' },
  { key: 'Suspenso', label: 'Suspenso' },
  { key: 'Lesionado', label: 'Lesionado' },
  { key: 'Nulo', label: 'Nulo' },
];

function statusBadgeVariant(status: string): 'primary' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'Provável': return 'primary';
    case 'Duvidoso': return 'warning';
    case 'Suspenso':
    case 'Lesionado':
    case 'Nulo': return 'danger';
    default: return 'neutral';
  }
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'preco_desc', label: 'Preço ↓' },
  { key: 'preco_asc', label: 'Preço ↑' },
  { key: 'media_desc', label: 'Média ↓' },
  { key: 'media_asc', label: 'Média ↑' },
];

export default function AtletasScreen() {
  const [query, setQuery] = useState('');
  const [posicao, setPosicao] = useState('');
  const [status, setStatus] = useState('');
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('preco_desc');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = (q: string, p: string, s: string) => {
    setLoading(true);
    fetchAtletas({ q: q || undefined, posicao: p || undefined, status: s || undefined })
      .then((data) => {
        setAtletas(data.atletas);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    doFetch(query, posicao, status);
  }, [posicao, status]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      doFetch(text, posicao, status);
    }, 350);
  };

  const filtered = useMemo(() => {
    let list = [...atletas];

    list.sort((a, b) => {
      switch (sortBy) {
        case 'preco_desc': return b.preco - a.preco;
        case 'preco_asc': return a.preco - b.preco;
        case 'media_desc': return b.media - a.media;
        case 'media_asc': return a.media - b.media;
      }
    });

    return list;
  }, [atletas, sortBy]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Atletas</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por nome..."
        placeholderTextColor={theme.colors.textMuted}
        value={query}
        onChangeText={handleQueryChange}
      />

      <SectionHeader label="Posição" />
      <FlatList
        horizontal
        data={POSICOES}
        keyExtractor={(item) => item.key}
        style={styles.filterList}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, posicao === item.key && styles.filterChipActive]}
            onPress={() => setPosicao(item.key)}
          >
            <Text style={[styles.filterChipText, posicao === item.key && styles.filterChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      <SectionHeader label="Status" />
      <FlatList
        horizontal
        data={STATUS_LIST}
        keyExtractor={(item) => item.key}
        style={styles.filterList}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, status === item.key && styles.filterChipActive]}
            onPress={() => setStatus(item.key)}
          >
            <Text style={[styles.filterChipText, status === item.key && styles.filterChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      <SectionHeader label="Ordenar" />
      <FlatList
        horizontal
        data={SORT_OPTIONS}
        keyExtractor={(item) => item.key}
        style={styles.filterList}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, sortBy === item.key && styles.filterChipActive]}
            onPress={() => setSortBy(item.key)}
          >
            <Text style={[styles.filterChipText, sortBy === item.key && styles.filterChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.resultCount}>
        {filtered.length} atleta{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.atleta_id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.cardNome}>{item.apelido}</Text>
                  <Text style={styles.cardSub}>
                    {item.posicao_nome} · {item.clube}
                  </Text>
                </View>
                <Badge label={item.status} variant={statusBadgeVariant(item.status)} />
              </View>
              <View style={styles.cardStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>C$ {item.preco.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>Preço</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{item.media.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Média</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{item.jogos}</Text>
                  <Text style={styles.statLabel}>Jogos</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>C$ {item.preco_projetado.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>Projetado</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.footerVariacao}>
                  Variação: {item.variacao_num >= 0 ? '+' : ''}{item.variacao_num.toFixed(2)}
                </Text>
                <Text style={styles.footerValorizacao}>
                  Val.: {(item.potential_valorizacao * 100).toFixed(1)}%
                </Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingTop: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize['3xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  filterList: {
    maxHeight: 46,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surfaceElevated,
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
  },
  filterChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryGlow,
  },
  filterChipText: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  filterChipTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
  },
  resultCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing['3xl'],
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  cardNome: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  cardSub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: theme.spacing.sm,
  },
  footerVariacao: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
  },
  footerValorizacao: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.info,
    fontWeight: theme.fontWeight.semibold,
  },
});

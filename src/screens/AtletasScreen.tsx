import { useEffect, useRef, useState } from 'react';
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

export default function AtletasScreen() {
  const [query, setQuery] = useState('');
  const [posicao, setPosicao] = useState('');
  const [status, setStatus] = useState('');
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Atletas</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por nome..."
        placeholderTextColor="#64748b"
        value={query}
        onChangeText={handleQueryChange}
      />

      <Text style={styles.filterLabel}>Posição</Text>
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

      <Text style={styles.filterLabel}>Status</Text>
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

      <Text style={styles.resultCount}>
        {total} atleta{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      ) : (
        <FlatList
          data={atletas}
          keyExtractor={(item) => String(item.atleta_id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.cardNome}>{item.apelido}</Text>
                  <Text style={styles.cardSub}>
                    {item.posicao_nome} · {item.clube}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
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
            </View>
          )}
        />
      )}
    </View>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'Provável': return '#22c55e';
    case 'Duvidoso': return '#f97316';
    case 'Suspenso':
    case 'Lesionado':
    case 'Nulo': return '#ef4444';
    default: return '#64748b';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#f8fafc',
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  filterList: {
    maxHeight: 38,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    marginRight: 6,
  },
  filterChipActive: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  filterChipText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  filterChipTextActive: {
    color: '#22c55e',
    fontWeight: '600',
  },
  resultCount: {
    fontSize: 12,
    color: '#64748b',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  cardSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  footerVariacao: {
    fontSize: 12,
    color: '#f97316',
  },
  footerValorizacao: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
});

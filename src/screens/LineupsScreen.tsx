import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { League, Lineup } from '../types';
import { API_BASE } from '../config';
import { fetchStatus } from '../services/api';
import { getLeagues, getLineupsByRodada } from '../services/storage';

export default function LineupsScreen({ navigation }: any) {
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [rodada, setRodada] = useState<number>(17);
  const [rodadaAtual, setRodadaAtual] = useState<number>(17);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [leagues, setLeagues] = useState<League[]>([]);

  const teamLookup: Record<string, { team: string; league: string }> = {};
  for (const liga of leagues) {
    for (const time of liga.times) {
      teamLookup[time.id] = { team: time.nome, league: liga.nome };
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchStatus()
        .then((s) => {
          setRodadaAtual(s.rodada_atual);
          setRodada(s.rodada_atual);
        })
        .catch(() => {});
      setRefreshKey((k) => k + 1);
    }, [])
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getLineupsByRodada(rodada), getLeagues()])
      .then(([items, ligas]) => {
        if (!cancelled) {
          setLineups(items);
          setLeagues(ligas);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rodada, refreshKey]);

  const changeRodada = (delta: number) => {
    const nova = rodada + delta;
    if (nova >= 1 && nova <= rodadaAtual + 5) setRodada(nova);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.rodadaRow}>
          <TouchableOpacity onPress={() => changeRodada(-1)} style={styles.arrow}>
            <Text style={styles.arrowText}>{'<'}</Text>
          </TouchableOpacity>
          <View style={styles.rodadaInfo}>
            <Text style={styles.rodadaLabel}>Rodada</Text>
            <Text style={styles.rodadaValue}>{rodada}</Text>
          </View>
          <TouchableOpacity onPress={() => changeRodada(1)} style={styles.arrow}>
            <Text style={styles.arrowText}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setRodada(rodadaAtual)}
            style={styles.atualBtn}
          >
            <Text style={styles.atualBtnText}>Atual</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.novaBtn}
          onPress={() => navigation.navigate('NewLineup', { rodada })}
        >
          <Text style={styles.novaBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      ) : lineups.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>!</Text>
          <Text style={styles.emptyText}>
            Nenhuma escalação para a rodada {rodada}
          </Text>
        </View>
      ) : (
        <View style={styles.wrapper}>
        <FlatList
          data={lineups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('LineupDetail', { lineup: item })
              }
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardNome}>{item.nome}</Text>
                <Text style={styles.cardRodada}>R{item.rodada}</Text>
              </View>
              {item.atribuido_a_team_id && teamLookup[item.atribuido_a_team_id] && (
                <Text style={styles.cardTeam}>
                  {teamLookup[item.atribuido_a_team_id].team} · {teamLookup[item.atribuido_a_team_id].league}
                </Text>
              )}
              <Text style={styles.cardFormacao}>
                {item.response.formacao} · {item.response.pontos_previstos.toFixed(1)} pts
              </Text>
              <View style={styles.cardPlayers}>
                {item.response.players.slice(0, 5).map((p) => (
                  <Text key={p.atleta_id} style={styles.cardPlayer}>
                    {p.apelido} · {p.clube}
                    {p.role === 'capitao' ? ' (C)' : ''}
                  </Text>
                ))}
                {item.response.players.length > 5 && (
                  <Text style={styles.cardMore}>
                    +{item.response.players.length - 5} jogadores
                  </Text>
                )}
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardDate}>
                  {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </Text>
                <Text style={styles.cardOrcamento}>
                  C$ {item.response.orcamento_usado.toFixed(2)} usados
                  {item.params?.orcamento != null ? ` (patrimônio C$ ${item.params.orcamento.toFixed(2)})` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
        <View style={styles.listFooter}>
          <Text style={styles.listFooterText}>{API_BASE}</Text>
        </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  wrapper: {
    flex: 1,
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  rodadaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  arrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 22,
    color: '#94a3b8',
    fontWeight: '600',
  },
  rodadaInfo: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  rodadaLabel: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rodadaValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f8fafc',
  },
  atualBtn: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  atualBtnText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
  },
  novaBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  novaBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 36,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  cardRodada: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
  },
  cardTeam: {
    fontSize: 12,
    color: '#f97316',
    marginBottom: 4,
  },
  cardFormacao: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  cardPlayers: {
    gap: 2,
    marginBottom: 8,
  },
  cardPlayer: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  cardMore: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  cardDate: {
    fontSize: 11,
    color: '#64748b',
  },
  listFooter: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  listFooterText: {
    fontSize: 11,
    color: '#22c55e',
  },
  cardOrcamento: {
    fontSize: 11,
    color: '#64748b',
  },
});

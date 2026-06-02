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
import { theme } from '../theme';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';

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
        <Button variant="primary" label="+ Nova" onPress={() => navigation.navigate('NewLineup', { rodada })} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
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
              onPress={() =>
                navigation.navigate('LineupDetail', { lineup: item })
              }
              activeOpacity={0.7}
            >
              <Card>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardNome}>{item.nome}</Text>
                  <Badge label={`R${item.rodada}`} variant="primary" />
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
              </Card>
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
    backgroundColor: theme.colors.bg,
  },
  wrapper: {
    flex: 1,
  },
  header: {
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  rodadaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  arrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: theme.fontSize['3xl'],
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
  },
  rodadaInfo: {
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
  },
  rodadaLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rodadaValue: {
    fontSize: theme.fontSize['4xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  atualBtn: {
    marginLeft: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  atualBtnText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 36,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.borderLight,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
  },
  list: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing['3xl'],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  cardNome: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  cardTeam: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
    marginBottom: theme.spacing.xs,
  },
  cardFormacao: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  cardPlayers: {
    gap: 2,
    marginBottom: theme.spacing.sm,
  },
  cardPlayer: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  cardMore: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: theme.spacing.sm,
  },
  cardDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  listFooter: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  listFooterText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
  },
  cardOrcamento: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
});

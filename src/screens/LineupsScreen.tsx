import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_BASE } from '../config';
import { fetchStatus, fetchTeams } from '../services/api';
import { getLeagues, getLineupsByRodada, saveLineup } from '../services/storage';
import { importCartolaLineup } from '../services/cartola';
import { League, Lineup, STATUS_MAP, TeamSearchResult } from '../types';
import { theme } from '../theme';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import usePageTitle from '../usePageTitle';

export default function LineupsScreen({ navigation }: any) {
  usePageTitle('Escalações');
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [rodada, setRodada] = useState<number>(17);
  const [rodadaAtual, setRodadaAtual] = useState<number>(17);
  const [statusMercado, setStatusMercado] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [leagues, setLeagues] = useState<League[]>([]);

  const [showImport, setShowImport] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');
  const [teamResults, setTeamResults] = useState<TeamSearchResult[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const teamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          setStatusMercado(s.status_mercado);
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

  const handleTeamQuery = (text: string) => {
    setTeamQuery(text);
    if (teamTimer.current) clearTimeout(teamTimer.current);
    if (!text.trim()) {
      setTeamResults([]);
      return;
    }
    teamTimer.current = setTimeout(() => {
      setTeamLoading(true);
      fetchTeams(text.trim())
        .then(setTeamResults)
        .catch(() => setTeamResults([]))
        .finally(() => setTeamLoading(false));
    }, 400);
  };

  const handleSelectTeam = async (team: TeamSearchResult) => {
    setShowImport(false);
    setTeamQuery('');
    setTeamResults([]);
    setImporting(true);
    try {
      const lineup = await importCartolaLineup(team.time_id, rodada);
      await saveLineup(lineup);
      setRefreshKey((k) => k + 1);
      navigation.navigate('LineupDetail', { lineup });
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível importar a escalação do time.');
    } finally {
      setImporting(false);
    }
  };

  const marketBadgeVariant = (() => {
    if (statusMercado === 1) return 'primary' as const;
    if (statusMercado === 2) return 'warning' as const;
    if (statusMercado === 3) return 'info' as const;
    return 'neutral' as const;
  })();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.marketRow}>
          <Badge
            variant={marketBadgeVariant}
            size="md"
            label={STATUS_MAP[statusMercado]?.label ?? 'Mercado —'}
          />
        </View>
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
        <View style={styles.actionsRow}>
          <Button
            variant="outline"
            label="📥 Importar do Cartola"
            onPress={() => setShowImport(true)}
          />
          <Button variant="primary" label="+ Nova" onPress={() => navigation.navigate('NewLineup', { rodada })} />
          <Button variant="outline" label="✏ Montar na mão" onPress={() => navigation.navigate('Draft', { rodada })} />
          <Button variant="outline" label="📊 Histórico" onPress={() => navigation.navigate('PlayerHistory')} />
        </View>
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
              activeOpacity={0.8}
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

      <Modal visible={showImport} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Importar do Cartola</Text>
              <TouchableOpacity onPress={() => setShowImport(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              Busque seu time do Cartola (o mesmo escalado no app oficial) e importe a escalação
              atual para a rodada {rodada}. Funciona mesmo com o mercado fechado.
            </Text>
            <TextInput
              style={styles.modalSearch}
              value={teamQuery}
              onChangeText={handleTeamQuery}
              placeholder="Nome do time..."
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
            />
            {teamLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 16 }} />
            ) : teamResults.length > 0 ? (
              <ScrollView style={styles.modalList}>
                {teamResults.map((item) => (
                  <TouchableOpacity
                    key={item.time_id}
                    style={styles.modalItem}
                    onPress={() => handleSelectTeam(item)}
                  >
                    <View style={styles.modalItemLeft}>
                      <Text style={styles.modalItemName}>{item.nome_cartola}</Text>
                      <Text style={styles.modalItemDetail}>
                        {item.nome} · ID {item.time_id}
                      </Text>
                    </View>
                    <Text style={styles.modalItemArrow}>→</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : teamQuery.trim() ? (
              <Text style={styles.modalEmpty}>Nenhum time encontrado</Text>
            ) : null}
            {importing && (
              <View style={styles.importingRow}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.importingText}>Importando e projetando...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  marketRow: {
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'center',
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
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize['3xl'],
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
  },
  rodadaInfo: {
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
  },
  rodadaLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: theme.letterSpacing.wider,
  },
  rodadaValue: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize['4xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    letterSpacing: theme.letterSpacing.tight,
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
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    letterSpacing: theme.letterSpacing.tight,
  },
  cardTeam: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
    marginBottom: theme.spacing.xs,
  },
  cardFormacao: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  cardPlayers: {
    gap: 2,
    marginBottom: theme.spacing.sm,
  },
  cardPlayer: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  cardMore: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  cardDate: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  listFooter: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  listFooterText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
  },
  cardOrcamento: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
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
    maxHeight: '80%',
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
  modalSearch: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: theme.spacing.md,
  },
  modalList: {
    maxHeight: 400,
  },
  modalEmpty: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing['2xl'],
    fontSize: theme.fontSize.base,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalItemLeft: {
    flex: 1,
  },
  modalItemName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  modalItemDetail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalItemArrow: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.lg,
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
  },
  importingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  importingText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
});

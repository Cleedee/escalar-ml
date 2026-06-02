import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Player, PontuadoAthlete, Reserva, SubstituicaoResult, PartidasResponse } from '../types';
import { deleteLineup, getLeagues, saveLeague, saveLineup } from '../services/storage';
import { fetchPontuados, fetchPartidas } from '../services/api';
import { calcularSubstituicoes } from '../services/substituicaoEngine';
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import Button from '../components/Button';
import Badge from '../components/Badge';

const posicoes: Record<string, string> = {
  GOL: 'Goleiro',
  LAT: 'Lateral',
  ZAG: 'Zagueiro',
  MEI: 'Meia',
  ATA: 'Atacante',
  TEC: 'Técnico',
};

export default function LineupDetailScreen({ route, navigation }: any) {
  const { lineup } = route.params;
  const { response } = lineup;
  const [pontuadosAtletas, setPontuadosAtletas] = useState<Record<string, PontuadoAthlete> | null>(null);
  const [partidasData, setPartidasData] = useState<PartidasResponse | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [substituicaoResult, setSubstituicaoResult] = useState<SubstituicaoResult | null>(response.substituicao ?? null);
  const [salvandoSubstituicao, setSalvandoSubstituicao] = useState(false);

  const handleDelete = async () => {
    setShowDeleteModal(false);
    await deleteLineup(lineup.id);
    navigation.goBack();
  };

  const handleExportJson = async () => {
    const payload = {
      ...response,
      params: lineup.params,
      nome: lineup.nome,
      rodada: lineup.rodada,
    };
    try {
      await Clipboard.setStringAsync(JSON.stringify(payload, null, 2));
      Alert.alert('Exportado', 'JSON copiado para a área de transferência');
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar o JSON');
    }
  };

  const handleSimularSubstituicao = () => {
    if (!pontuadosAtletas || !partidasData) {
      Alert.alert('Aguardando', 'Carregando dados de pontuação...');
      return;
    }

    const result = calcularSubstituicoes(
      lineup,
      pontuadosAtletas,
      partidasData.partidas,
      partidasData.clubes,
    );

    if (!result) {
      Alert.alert('Sem substituições', 'Nenhum titular precisa ser substituído.');
      return;
    }

    setSubstituicaoResult(result);
  };

  const handleSalvarSubstituicao = async () => {
    if (!substituicaoResult) return;
    setSalvandoSubstituicao(true);

    try {
      const novosPlayers = [...response.players];
      const novasReservas = { ...response.reservas };

      for (const sub of substituicaoResult.substituicoes) {
        const idx = novosPlayers.findIndex((p) => p.atleta_id === sub.substituido_id);
        if (idx === -1) continue;

        const substituto = novasReservas[sub.posicao];
        if (!substituto) continue;
        const substituido = novosPlayers[idx];

        novosPlayers[idx] = {
          atleta_id: substituto.atleta_id,
          apelido: substituto.apelido,
          posicao: substituto.posicao,
          preco: substituto.preco,
          previsto: substituto.previsto,
          clube: substituto.clube,
        };

        novasReservas[sub.posicao] = {
          atleta_id: substituido.atleta_id,
          apelido: substituido.apelido,
          clube: substituido.clube,
          posicao: substituido.posicao,
          preco: substituido.preco,
          previsto: 0,
          media_num: 0,
          jogos_num: 0,
          variacao_num: 0,
          potential_valorizacao: 0,
          preco_projetado: 0,
          tendencia: '',
          eficiencia: 0,
          luxo: sub.motivo === 'reserva_luxo',
        };
      }

      const novoOrcamento = response.orcamento_usado + substituicaoResult.patrimonio_ajuste;

      const updatedResponse = {
        ...response,
        players: novosPlayers,
        reservas: novasReservas,
        pontos_previstos: substituicaoResult.pontos_finais,
        orcamento_usado: novoOrcamento,
        substituicao: substituicaoResult,
      };

      const updatedLineup = {
        ...lineup,
        params: lineup.params ? { ...lineup.params, orcamento: novoOrcamento } : undefined,
        response: updatedResponse,
      };

      await saveLineup(updatedLineup);

      // Update team in league if linked
      if (lineup.atribuido_a_team_id) {
        const leagues = await getLeagues();
        for (const league of leagues) {
          const teamIdx = league.times.findIndex((t) => t.id === lineup.atribuido_a_team_id);
          if (teamIdx === -1) continue;

          const team = { ...league.times[teamIdx] };
          const ganhoPontos = substituicaoResult.pontos_finais - substituicaoResult.pontos_originais;

          team.patrimonio += substituicaoResult.patrimonio_ajuste;

          if (league.modalidade === 'pontuacao') {
            team.ranking = Math.max(0, team.ranking + ganhoPontos);
          }

          team.total_acumulado = league.modalidade === 'patrimonio'
            ? team.patrimonio
            : team.ranking;

          const updatedTimes = [...league.times];
          updatedTimes[teamIdx] = team;
          await saveLeague({ ...league, times: updatedTimes });
          break;
        }
      }

      Alert.alert('Salvo', 'Substituições aplicadas e salvas com sucesso!');
      navigation.replace('LineupDetail', { lineup: updatedLineup });
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as substituições.');
    } finally {
      setSalvandoSubstituicao(false);
    }
  };

  useEffect(() => {
    fetchPontuados(lineup.rodada)
      .then((data) => setPontuadosAtletas(data.atletas))
      .catch(() => {});
    fetchPartidas(lineup.rodada)
      .then(setPartidasData)
      .catch(() => {});
  }, [lineup.rodada]);

  const getPontuacao = (atleta_id: number): number | null => {
    const p = pontuadosAtletas?.[String(atleta_id)];
    return p ? p.pontuacao : null;
  };

  const entrouEmCampo = (atleta_id: number): boolean | null => {
    const p = pontuadosAtletas?.[String(atleta_id)];
    return p ? p.entrou_em_campo : null;
  };

  const hasPontuados = pontuadosAtletas !== null;

  const clubOpponents = useMemo(() => {
    if (!partidasData) return {};
    const map: Record<string, string> = {};
    for (const partida of partidasData.partidas) {
      const casa = partidasData.clubes[String(partida.clube_casa_id)];
      const visit = partidasData.clubes[String(partida.clube_visitante_id)];
      if (casa && visit) {
        const duelo = `${casa.nome} x ${visit.nome}`;
        map[casa.nome] = duelo;
        map[visit.nome] = duelo;
      }
    }
    return map;
  }, [partidasData]);

  const getDuelo = (clube: string): string | null => {
    return clubOpponents[clube] ?? null;
  };

  const getEntrouEmCampoColor = (atleta_id: number, isSubstituto?: boolean): string | undefined => {
    if (isSubstituto) return theme.colors.primary;
    if (entrouEmCampo(atleta_id) === false) return theme.colors.danger;
    return undefined;
  };

  const allPlayers = [
    ...response.players,
    ...(response.tecnico ? [response.tecnico] : []),
  ];
  const totalReal = hasPontuados
    ? allPlayers.reduce((sum, p) => sum + (getPontuacao(p.atleta_id) ?? 0), 0)
    : null;

  const substituidoIds = new Set(substituicaoResult?.substituicoes.map((s) => s.substituido_id) ?? []);
  const substitutoIds = new Set(substituicaoResult?.substituicoes.map((s) => s.substituto_id) ?? []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Card style={styles.resultHeader}>
        <Text style={styles.resultTitle}>{lineup.nome}</Text>
        <Text style={styles.resultRodada}>Rodada {lineup.rodada}</Text>
        <Text style={styles.resultEsquema}>
          Esquema tático: {response.formacao}
        </Text>
        <Text style={styles.resultFormacao}>
          Proj: {response.pontos_previstos.toFixed(1)} pts
          {totalReal !== null ? ` · Real: ${totalReal.toFixed(1)} pts` : ''}
        </Text>
        <Text style={styles.resultOrcamento}>
          C$ {response.orcamento_usado.toFixed(2)} usados
          {lineup.params?.orcamento != null ? ` (patrimônio C$ ${lineup.params.orcamento.toFixed(2)})` : ''}
          {response.valorizacao_total != null ? ` · Val: ${response.valorizacao_total >= 0 ? '+' : ''}C$ ${response.valorizacao_total.toFixed(2)}` : ''}
        </Text>
      </Card>

      {lineup.params?.foco != null && (
        <Card elevated style={styles.paramsBox}>
          <Text style={styles.paramsTitle}>Parâmetros da otimização</Text>
          <View style={styles.paramsRow}>
            <Text style={styles.paramsLabel}>Foco</Text>
            <Text style={styles.paramsValue}>
              {lineup.params.foco === 1.0 ? 'Só Pontuação' : lineup.params.foco >= 0.8 ? '↑ Pontuação' : lineup.params.foco === 0.7 ? 'Valoriz. Leve' : lineup.params.foco === 0.5 ? 'Equilibrado' : lineup.params.foco === 0.3 ? '↑ Valorização' : lineup.params.foco === 0.0 ? 'Só Valorização' : lineup.params.foco.toFixed(1)}
            </Text>
          </View>
          {lineup.params.perfil && (
            <View style={styles.paramsRow}>
              <Text style={styles.paramsLabel}>Perfil</Text>
              <Text style={styles.paramsValue}>
                {lineup.params.perfil.charAt(0).toUpperCase() + lineup.params.perfil.slice(1)}
              </Text>
            </View>
          )}
          {lineup.estrategia && (
            <View style={styles.paramsRow}>
              <Text style={styles.paramsLabel}>Estratégia</Text>
              <Text style={[styles.paramsValue, { flex: 1, textAlign: 'right' }]}>{lineup.estrategia}</Text>
            </View>
          )}
          {response.valorizacao_total != null && (
            <View style={styles.paramsRow}>
              <Text style={styles.paramsLabel}>Valorização proj.</Text>
              <Text style={[styles.paramsValue, { color: theme.colors.info }]}>
                {response.valorizacao_total >= 0 ? '+' : ''}C$ {response.valorizacao_total.toFixed(2)}
              </Text>
            </View>
          )}
        </Card>
      )}

      <SectionHeader label="Titulares" />
      {response.players.map((p: Player) => {
        const pts = getPontuacao(p.atleta_id);
        const foiSubstituido = substituidoIds.has(p.atleta_id);
        const isSubstituto = substitutoIds.has(p.atleta_id);
        const borderColor = foiSubstituido
          ? theme.colors.danger
          : isSubstituto
            ? theme.colors.primary
            : undefined;
        return (
          <Card
            key={p.atleta_id}
            style={[
              styles.playerCard,
              borderColor ? { borderColor, borderWidth: 1.5 } : undefined,
            ]}
          >
            <View style={styles.playerTop}>
              <View style={{ flex: 1 }}>
                <View style={styles.playerPosRow}>
                  <Text style={styles.playerPos}>
                    {posicoes[p.posicao] || p.posicao}
                  </Text>
                  {entrouEmCampo(p.atleta_id) === false && hasPontuados && (
                    <Badge variant="danger" label="NÃO JOGOU" size="sm" />
                  )}
                  {foiSubstituido && (
                    <Badge variant="danger" label="SUBSTITUÍDO" size="sm" />
                  )}
                  {isSubstituto && (
                    <Badge variant="primary" label="ENTROU" size="sm" />
                  )}
                </View>
                <Text
                  style={[
                    styles.playerName,
                    foiSubstituido ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined,
                  ]}
                >
                  {p.apelido} · {p.clube}{p.role === 'capitao' ? ' ⭐' : ''}
                </Text>
                {getDuelo(p.clube) && (
                  <Text style={styles.dueloText}>{getDuelo(p.clube)}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => navigation.navigate('Justificar', { apelido: p.apelido, atleta_id: p.atleta_id, clube: p.clube })}
              >
                <Text style={styles.detailBtnText}>i</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.playerStats}>
              <View style={styles.playerStat}>
                <Text style={styles.playerStatValue}>C$ {p.preco.toFixed(2)}</Text>
                <Text style={styles.playerStatLabel}>Preço</Text>
              </View>
              <View style={styles.playerStat}>
                <Text style={styles.playerStatValue}>
                  {p.previsto.toFixed(1)}
                  {pts !== null ? ` (${pts.toFixed(1)})` : ''}
                </Text>
                <Text style={styles.playerStatLabel}>Projeção</Text>
              </View>
              <View style={styles.playerStat}>
                <Text style={[styles.playerStatValue, { color: theme.colors.info }]}>
                  {p.preco_projetado != null ? `${(p.preco_projetado - p.preco) >= 0 ? '+' : ''}C$ ${(p.preco_projetado - p.preco).toFixed(2)}` : '—'}
                </Text>
                <Text style={styles.playerStatLabel}>Valorização</Text>
              </View>
            </View>
          </Card>
        );
      })}

      {response.tecnico && (() => {
        const pts = getPontuacao(response.tecnico.atleta_id);
        return (
          <>
            <SectionHeader label="Técnico" />
            <Card style={styles.tecnicoCard}>
              <View style={styles.tecnicoRow}>
                <View>
                  <Text style={styles.tecnicoName}>
                    {response.tecnico.apelido} · {response.tecnico.clube}
                  </Text>
                  {getDuelo(response.tecnico.clube) && (
                    <Text style={styles.dueloText}>{getDuelo(response.tecnico.clube)}</Text>
                  )}
                </View>
                <View style={styles.playerRight}>
                  <Text style={styles.playerClub}>
                    C$ {response.tecnico.preco.toFixed(2)}
                  </Text>
                  <Text style={styles.tecnicoPts}>
                    {response.tecnico.previsto.toFixed(1)}
                    {pts !== null ? ` (${pts.toFixed(1)})` : ''} pts
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.detailBtn}
                  onPress={() => navigation.navigate('Justificar', { apelido: response.tecnico.apelido, atleta_id: response.tecnico.atleta_id, clube: response.tecnico.clube })}
                >
                  <Text style={styles.detailBtnText}>i</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </>
        );
      })()}

      {hasPontuados && (
        <Card highlight style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            Proj: {response.pontos_previstos.toFixed(1)} · Real: {totalReal!.toFixed(1)}
            {substituicaoResult && substituicaoResult.pontos_finais !== totalReal
              ? ` → ${substituicaoResult.pontos_finais.toFixed(1)} pts`
              : ''}
          </Text>
        </Card>
      )}

      {Object.keys(response.reservas).length > 0 && (
        <>
          <SectionHeader label="Reservas" />
          {Object.entries(response.reservas).map(([pos, r]) => {
            const reserva = r as Reserva;
            return (
              <Card key={pos}>
                <View style={styles.reservaTop}>
                  <View>
                    <Text style={styles.reservaPos}>
                      {posicoes[pos] || pos}{reserva.luxo ? ' ⭐' : ''}
                    </Text>
                    <Text style={styles.reservaName}>
                      {reserva.apelido} · {reserva.clube}
                    </Text>
                    {getDuelo(reserva.clube) && (
                      <Text style={styles.dueloText}>{getDuelo(reserva.clube)}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.reservaStats}>
                  <View style={styles.playerStat}>
                    <Text style={styles.playerStatValue}>C$ {reserva.preco.toFixed(2)}</Text>
                    <Text style={styles.playerStatLabel}>Preço</Text>
                  </View>
                  <View style={styles.playerStat}>
                    <Text style={styles.playerStatValue}>{reserva.previsto.toFixed(1)}</Text>
                    <Text style={styles.playerStatLabel}>Projeção</Text>
                  </View>
                  <View style={styles.playerStat}>
                    <Text style={[styles.playerStatValue, { color: theme.colors.info }]}>
                      {reserva.preco_projetado != null
                        ? `${(reserva.preco_projetado - reserva.preco) >= 0 ? '+' : ''}C$ ${(reserva.preco_projetado - reserva.preco).toFixed(2)}`
                        : '—'}
                    </Text>
                    <Text style={styles.playerStatLabel}>Valorização</Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </>
      )}

      {response.comparacao?.length > 0 && (
        <>
          <SectionHeader label="Comparação" />
          {response.comparacao.map((c: any) => (
            <Card key={c.formacao} style={styles.compRow}>
              <Text style={styles.compFormacao}>{c.formacao}</Text>
              <Text style={styles.compPts}>{c.pontos_previstos.toFixed(1)} pts</Text>
            </Card>
          ))}
        </>
      )}

      {substituicaoResult && (
        <>
          <SectionHeader label="Substituições" />
          <Card elevated>
            <Text style={styles.resultOrcamento}>
              Pontos: {substituicaoResult.pontos_originais.toFixed(1)} → {substituicaoResult.pontos_finais.toFixed(1)}
              {' · '}Ajuste: {substituicaoResult.patrimonio_ajuste >= 0 ? '+' : ''}C$ {substituicaoResult.patrimonio_ajuste.toFixed(2)}
            </Text>
            {substituicaoResult.substituicoes.map((s, i) => (
              <View key={i} style={styles.substituicaoRow}>
                <Badge
                  variant={s.motivo === 'nao_jogou' ? 'danger' : 'accent'}
                  label={s.motivo === 'nao_jogou' ? 'NÃO JOGOU' : 'RESERVA LUXO'}
                />
                <Text style={styles.substituicaoText}>
                  <Text style={{ color: theme.colors.danger }}>{s.substituido_apelido}</Text>
                  {' → '}
                  <Text style={{ color: theme.colors.primary }}>{s.substituto_apelido}</Text>
                </Text>
                <Text style={styles.substituicaoDetalhe}>
                  {s.posicao} · {s.pontuacao_substituto > s.pontuacao_substituido ? '+' : ''}{(s.pontuacao_substituto - s.pontuacao_substituido).toFixed(1)} pts · C$ {s.diferenca_preco >= 0 ? '+' : ''}{s.diferenca_preco.toFixed(2)}
                </Text>
              </View>
            ))}
          </Card>

          <Button
            variant="primary"
            label={salvandoSubstituicao ? 'Salvando...' : 'Salvar substituição'}
            onPress={handleSalvarSubstituicao}
            disabled={salvandoSubstituicao}
          />
        </>
      )}

      {hasPontuados && !substituicaoResult && (
        <Button
          variant="primary"
          label="Simular substituição"
          onPress={handleSimularSubstituicao}
        />
      )}

      <Button variant="outline" label="Exportar JSON" onPress={handleExportJson} />

      <Button
        variant="primary"
        label="Gerar nova escalação"
        onPress={() =>
          navigation.navigate('NewLineup', {
            rodada: lineup.rodada,
            nome: `Nova ${lineup.nome}`,
            orcamento: String(lineup.params?.orcamento ?? 100),
            formacao: lineup.params?.formacao ?? 'auto',
            perfil: lineup.params?.perfil ?? 'neutro',
            foco: lineup.params?.foco ?? 1.0,
            incluir_duvidosos: lineup.params?.incluir_duvidosos ?? false,
            reserva_luxo: lineup.params?.reserva_luxo ?? true,
            obrigarText: (lineup.params?.obrigar ?? []).join(','),
            excluirText: (lineup.params?.excluir ?? []).join(','),
          })
        }
      />

      <Button variant="outline" label="Voltar" onPress={() => navigation.goBack()} />

      <Button variant="danger" label="Excluir escalação" onPress={() => setShowDeleteModal(true)} />

      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Excluir escalação</Text>
            <Text style={styles.modalMsg}>
              Tem certeza que deseja excluir "{lineup.nome}"?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleDelete}
              >
                <Text style={styles.modalConfirmText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  inner: {
    padding: theme.spacing.xl,
    paddingBottom: 40,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
  },
  paramsBox: {
    marginBottom: theme.spacing.lg,
  },
  paramsTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.md,
  },
  paramsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  paramsLabel: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  paramsValue: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  resultTitle: {
    fontSize: theme.fontSize['2xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  resultRodada: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  resultFormacao: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  resultEsquema: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.xs,
  },
  resultOrcamento: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  detailBtn: {
    position: 'absolute',
    right: theme.spacing.sm,
    top: theme.spacing.sm,
    width: 22,
    height: 22,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBtnText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    fontStyle: 'italic',
  },
  playerCard: {
    marginBottom: theme.spacing.sm,
  },
  tecnicoCard: {
    marginBottom: theme.spacing.sm,
  },
  tecnicoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tecnicoName: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  tecnicoClub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  playerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  playerPos: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  playerName: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
    marginTop: theme.spacing.xs,
  },
  playerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: theme.spacing.md,
  },
  playerStat: {
    alignItems: 'center',
  },
  playerStatValue: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
  },
  playerStatLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    textTransform: 'uppercase',
  },
  playerRight: {
    alignItems: 'flex-end',
  },
  playerClub: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  tecnicoPts: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  totalLabel: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  totalValue: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  dueloText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.warning,
    marginTop: theme.spacing.xs,
    fontWeight: theme.fontWeight.medium,
  },
  reservaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  reservaPos: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  reservaName: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
    marginTop: theme.spacing.xs,
  },
  reservaStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: theme.spacing.md,
  },
  compRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compFormacao: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  compPts: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['3xl'],
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  modalMsg: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    lineHeight: theme.spacing.xl,
    marginBottom: theme.spacing['2xl'],
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
  modalConfirm: {
    flex: 1,
    backgroundColor: theme.colors.danger,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
  playerPosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  substituicaoRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  substituicaoText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  substituicaoDetalhe: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
});

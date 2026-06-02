import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Player, Reserva, PartidasResponse } from '../types';
import { deleteLineup } from '../services/storage';
import { fetchPontuados, fetchPartidas } from '../services/api';
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
  const [actualScores, setActualScores] = useState<Record<string, number> | null>(null);
  const [partidasData, setPartidasData] = useState<PartidasResponse | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  useEffect(() => {
    fetchPontuados(lineup.rodada)
      .then((data) => {
        const scores: Record<string, number> = {};
        for (const [id, athlete] of Object.entries(data.atletas)) {
          scores[id] = athlete.pontuacao;
        }
        setActualScores(scores);
      })
      .catch(() => {});
    fetchPartidas(lineup.rodada)
      .then(setPartidasData)
      .catch(() => {});
  }, [lineup.rodada]);

  const getActual = (atleta_id: number): number | null => {
    if (!actualScores) return null;
    return actualScores[String(atleta_id)] ?? null;
  };

  const hasActual = actualScores !== null;

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

  const allPlayers = [
    ...response.players,
    ...(response.tecnico ? [response.tecnico] : []),
  ];
  const totalReal = hasActual
    ? allPlayers.reduce((sum, p) => sum + (getActual(p.atleta_id) ?? 0), 0)
    : null;

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
        const real = getActual(p.atleta_id);
        return (
          <Card key={p.atleta_id} style={styles.playerCard}>
            <View style={styles.playerTop}>
              <View>
                <Text style={styles.playerPos}>
                  {posicoes[p.posicao] || p.posicao}
                </Text>
                <Text style={styles.playerName}>
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
                  {real !== null ? ` (${real.toFixed(1)})` : ''}
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
        const real = getActual(response.tecnico.atleta_id);
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
                    {real !== null ? ` (${real.toFixed(1)})` : ''} pts
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

      {hasActual && (
        <Card highlight style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            Proj: {response.pontos_previstos.toFixed(1)} · Real: {totalReal!.toFixed(1)}
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
});

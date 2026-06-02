import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Player, Reserva, PartidasResponse } from '../types';
import { deleteLineup } from '../services/storage';
import { fetchPontuados, fetchPartidas } from '../services/api';

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
      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>{lineup.nome}</Text>
        <Text style={styles.resultRodada}>Rodada {lineup.rodada}</Text>
        <Text style={styles.resultEsquema}>
          Esquema tático: {response.formation}
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
      </View>

      {lineup.params?.foco != null && (
        <View style={styles.paramsBox}>
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
              <Text style={[styles.paramsValue, { color: '#3b82f6' }]}>
                {response.valorizacao_total >= 0 ? '+' : ''}C$ {response.valorizacao_total.toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Titulares</Text>
      {response.players.map((p: Player) => {
        const real = getActual(p.atleta_id);
        return (
          <View key={p.atleta_id} style={styles.playerRow}>
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
                <Text style={[styles.playerStatValue, { color: '#3b82f6' }]}>
                  {p.preco_projetado != null ? `${(p.preco_projetado - p.preco) >= 0 ? '+' : ''}C$ ${(p.preco_projetado - p.preco).toFixed(2)}` : '—'}
                </Text>
                <Text style={styles.playerStatLabel}>Valorização</Text>
              </View>
            </View>
          </View>
        );
      })}

      {response.tecnico && (() => {
        const real = getActual(response.tecnico.atleta_id);
        return (
          <>
            <Text style={styles.sectionTitle}>Técnico</Text>
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
          </>
        );
      })()}

      {hasActual && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            Proj: {response.pontos_previstos.toFixed(1)} · Real: {totalReal!.toFixed(1)}
          </Text>
        </View>
      )}

          {Object.keys(response.reservas).length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Reservas</Text>
          {Object.entries(response.reservas).map(([pos, r]) => {
            const reserva = r as Reserva;
            return (
            <View key={pos} style={styles.reservaCard}>
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
                  <Text style={[styles.playerStatValue, { color: '#3b82f6' }]}>
                    {reserva.preco_projetado != null
                      ? `${(reserva.preco_projetado - reserva.preco) >= 0 ? '+' : ''}C$ ${(reserva.preco_projetado - reserva.preco).toFixed(2)}`
                      : '—'}
                  </Text>
                  <Text style={styles.playerStatLabel}>Valorização</Text>
                </View>
              </View>
            </View>
            );
          })}
        </>
      )}

      {response.comparacao?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Comparação</Text>
          {response.comparacao.map((c: any) => (
            <View key={c.formacao} style={styles.compRow}>
              <Text style={styles.compFormacao}>{c.formacao}</Text>
              <Text style={styles.compPts}>{c.pontos_previstos.toFixed(1)} pts</Text>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity
        style={styles.exportBtn}
        onPress={handleExportJson}
      >
        <Text style={styles.exportBtnText}>Exportar JSON</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backBtnText}>Voltar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => setShowDeleteModal(true)}
      >
        <Text style={styles.deleteBtnText}>Excluir escalação</Text>
      </TouchableOpacity>

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
    backgroundColor: '#0f172a',
  },
  inner: {
    padding: 20,
    paddingBottom: 40,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  paramsBox: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  paramsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  paramsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paramsLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  paramsValue: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '600',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  resultRodada: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  resultFormacao: {
    fontSize: 14,
    color: '#94a3b8',
  },
  resultEsquema: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
    marginBottom: 2,
  },
  resultOrcamento: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 20,
  },
  detailBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  playerRow: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  tecnicoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  tecnicoName: {
    fontSize: 15,
    color: '#f8fafc',
    fontWeight: '600',
  },
  tecnicoClub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  playerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  playerPos: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  playerName: {
    fontSize: 15,
    color: '#f8fafc',
    fontWeight: '600',
    marginTop: 1,
  },
  playerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  playerStat: {
    alignItems: 'center',
  },
  playerStatValue: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '700',
  },
  playerStatLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  playerRight: {
    alignItems: 'flex-end',
  },
  playerClub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  tecnicoPts: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  dueloText: {
    fontSize: 11,
    color: '#f97316',
    marginTop: 2,
    fontWeight: '500',
  },
  reservaCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  reservaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  reservaPos: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  reservaName: {
    fontSize: 15,
    color: '#f8fafc',
    fontWeight: '600',
    marginTop: 1,
  },
  reservaStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  compRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  compFormacao: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  compPts: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
  backBtn: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  backBtnText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  exportBtn: {
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  exportBtnText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  modalMsg: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

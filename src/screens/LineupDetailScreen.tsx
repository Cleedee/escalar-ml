import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Player } from '../types';
import { deleteLineup } from '../services/storage';
import { fetchPontuados } from '../services/api';

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

  const handleDelete = () => {
    Alert.alert(
      'Excluir escalação',
      `Tem certeza que deseja excluir "${lineup.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteLineup(lineup.id);
            navigation.goBack();
          },
        },
      ]
    );
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
  }, [lineup.rodada]);

  const getActual = (atleta_id: number): number | null => {
    if (!actualScores) return null;
    return actualScores[String(atleta_id)] ?? null;
  };

  const hasActual = actualScores !== null;

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
        <Text style={styles.resultFormacao}>
          {response.formation} · Proj: {response.pontos_previstos.toFixed(1)} pts
          {totalReal !== null ? ` · Real: ${totalReal.toFixed(1)} pts` : ''}
        </Text>
        <Text style={styles.resultOrcamento}>
          C$ {response.orcamento_usado.toFixed(2)} usados
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Titulares</Text>
      {response.players.map((p: Player) => {
        const real = getActual(p.atleta_id);
        return (
          <View key={p.atleta_id} style={styles.playerRow}>
            <View style={styles.playerLeft}>
              <Text style={styles.playerPos}>
                {posicoes[p.posicao] || p.posicao}
              </Text>
              <Text style={styles.playerName}>
                {p.apelido}
                {p.role === 'capitao' ? ' ⭐' : ''}
              </Text>
            </View>
            <View style={styles.playerRight}>
              <Text style={styles.playerClub}>{p.clube}</Text>
              <Text style={styles.playerPrice}>
                C$ {p.preco.toFixed(2)} · {p.previsto.toFixed(1)}
                {real !== null ? ` (${real.toFixed(1)})` : ''} pts
              </Text>
            </View>
            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => navigation.navigate('Justificar', { apelido: p.apelido })}
            >
              <Text style={styles.detailBtnText}>i</Text>
            </TouchableOpacity>
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
                <Text style={styles.tecnicoName}>{response.tecnico.apelido}</Text>
                <Text style={styles.tecnicoClub}>{response.tecnico.clube}</Text>
              </View>
              <View style={styles.playerRight}>
                <Text style={styles.playerClub}>
                  C$ {response.tecnico.preco.toFixed(2)}
                </Text>
                <Text style={styles.playerPrice}>
                  {response.tecnico.previsto.toFixed(1)}
                  {real !== null ? ` (${real.toFixed(1)})` : ''} pts
                </Text>
              </View>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => navigation.navigate('Justificar', { apelido: response.tecnico.apelido })}
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
          {Object.entries(response.reservas as Record<string, { apelido: string; luxo: boolean }>).map(([pos, r]) => (
            <View key={pos} style={styles.reservaRow}>
              <Text style={styles.reservaPos}>
                {posicoes[pos] || pos}
              </Text>
              <Text style={styles.reservaName}>
                {r.apelido}
                {r.luxo ? ' ⭐' : ''}
              </Text>
            </View>
          ))}
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
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backBtnText}>Voltar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={handleDelete}
      >
        <Text style={styles.deleteBtnText}>Excluir escalação</Text>
      </TouchableOpacity>
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
    color: '#22c55e',
    marginTop: 4,
    fontWeight: '600',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  playerLeft: {},
  playerPos: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  playerName: {
    fontSize: 15,
    color: '#f8fafc',
    fontWeight: '600',
  },
  playerRight: {
    alignItems: 'flex-end',
  },
  playerClub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  playerPrice: {
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
  reservaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  reservaPos: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  reservaName: {
    fontSize: 15,
    color: '#f8fafc',
    fontWeight: '600',
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
});

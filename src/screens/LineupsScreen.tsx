import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CartolaTeamResponse, League, Lineup, OtimizarResponse, Player, Tecnico } from '../types';
import { API_BASE } from '../config';
import { fetchClubes, fetchStatus, fetchTeamById } from '../services/api';
import { getLeagues, getLineupsByRodada, saveLineup } from '../services/storage';

const POS_MAP: Record<number, string> = { 1: 'GOL', 2: 'LAT', 3: 'ZAG', 4: 'MEI', 5: 'ATA', 6: 'TEC' };

function mapCartolaToLineup(data: CartolaTeamResponse, clubes: Record<string, { nome: string }>): { response: OtimizarResponse; nome: string } {
  const clubeNome = (clubeId: number) => clubes[String(clubeId)]?.nome || String(clubeId);

  const tecData = data.atletas.find((a) => a.posicao_id === 6);
  const fieldPlayers = data.atletas.filter((a) => a.posicao_id !== 6);

  const tecnico: Tecnico = {
    atleta_id: tecData?.atleta_id || 0,
    apelido: tecData?.apelido || '',
    clube: tecData ? clubeNome(tecData.clube_id) : '',
    preco: tecData?.preco_num || 0,
    previsto: tecData?.media_num || 0,
    media_num: tecData?.media_num,
    jogos_num: tecData?.jogos_num,
  };

  const players: Player[] = fieldPlayers.map((a) => ({
    atleta_id: a.atleta_id,
    apelido: a.apelido,
    posicao: POS_MAP[a.posicao_id] || String(a.posicao_id),
    preco: a.preco_num,
    previsto: a.media_num,
    clube: clubeNome(a.clube_id),
    role: a.atleta_id === data.capitao_id ? 'capitao' as const : undefined,
    variacao_num: a.variacao_num,
    media_num: a.media_num,
    jogos_num: a.jogos_num,
  }));

  return {
    nome: `📥 ${data.time.nome_cartola} - R${data.rodada_atual}`,
    response: {
      formation: 'Importada',
      pontos_previstos: data.pontos,
      orcamento_usado: data.patrimonio,
      players,
      tecnico,
      reservas: {},
      comparacao: [],
      rodada: data.rodada_atual,
    },
  };
}

export default function LineupsScreen({ navigation }: any) {
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [rodada, setRodada] = useState<number>(17);
  const [rodadaAtual, setRodadaAtual] = useState<number>(17);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [leagues, setLeagues] = useState<League[]>([]);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importTimeId, setImportTimeId] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importTeamName, setImportTeamName] = useState('');
  const [importData, setImportData] = useState<CartolaTeamResponse | null>(null);
  const [importClubes, setImportClubes] = useState<Record<string, { nome: string }> | null>(null);

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

  const handleSearchTeam = async () => {
    const id = importTimeId.trim();
    if (!id) { Alert.alert('Erro', 'Informe o ID do time'); return; }
    setImportLoading(true);
    setImportTeamName('');
    setImportData(null);
    try {
      const [data, clubes] = await Promise.all([
        fetchTeamById(id),
        importClubes || fetchClubes(),
      ]);
      setImportData(data);
      setImportClubes(clubes);
      setImportTeamName(data.time.nome_cartola);
    } catch {
      Alert.alert('Erro', 'Time não encontrado. Verifique o ID.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importData || !importClubes) return;
    setImportLoading(true);
    try {
      const { nome, response } = mapCartolaToLineup(importData, importClubes);
      const lineup: Lineup = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        nome,
        rodada: importData.rodada_atual,
        created_at: new Date().toISOString(),
        params: { orcamento: importData.patrimonio, formacao: 'auto', perfil: 'neutro', foco: 1, incluir_duvidosos: false, reserva_luxo: true },
        response,
      };
      await saveLineup(lineup);
      setShowImportModal(false);
      setImportTimeId('');
      setImportTeamName('');
      setImportData(null);
      setRodada(importData.rodada_atual);
      navigation.navigate('LineupDetail', { lineup });
    } catch {
      Alert.alert('Erro', 'Falha ao importar escalação');
    } finally {
      setImportLoading(false);
    }
  };

  const openImport = () => {
    setImportTimeId('');
    setImportTeamName('');
    setImportData(null);
    setShowImportModal(true);
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
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.novaBtn}
            onPress={() => navigation.navigate('NewLineup', { rodada })}
          >
            <Text style={styles.novaBtnText}>+ Nova</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.importBtn} onPress={openImport}>
            <Text style={styles.importBtnText}>📥 Importar</Text>
          </TouchableOpacity>
        </View>
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
                {item.response.formation} · {item.response.pontos_previstos.toFixed(1)} pts
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
                  C$ {item.response.orcamento_usado.toFixed(2)}
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

      <Modal visible={showImportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Importar escalação</Text>
            <Text style={styles.modalSub}>ID do time no Cartola</Text>
            <TextInput
              style={styles.input}
              value={importTimeId}
              onChangeText={setImportTimeId}
              keyboardType="number-pad"
              placeholder="Ex: 50062955"
              placeholderTextColor="#64748b"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearchTeam} disabled={importLoading}>
              {importLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.searchBtnText}>Buscar</Text>
              )}
            </TouchableOpacity>

            {importTeamName ? (
              <View style={styles.teamFound}>
                <Text style={styles.teamFoundLabel}>Time:</Text>
                <Text style={styles.teamFoundName}>{importTeamName}</Text>
              </View>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowImportModal(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importConfirmBtn, !importData && styles.btnDisabled]}
                onPress={handleImport}
                disabled={!importData || importLoading}
              >
                <Text style={styles.importConfirmBtnText}>Importar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  novaBtn: {
    flex: 1,
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
  importBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  importBtnText: {
    color: '#3b82f6',
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
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 12,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  teamFound: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
  },
  teamFoundLabel: {
    fontSize: 13,
    color: '#64748b',
    marginRight: 6,
  },
  teamFoundName: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  importConfirmBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  importConfirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});

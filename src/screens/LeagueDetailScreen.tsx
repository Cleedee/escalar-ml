import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CartolaTeamSearchResult, League, Team } from '../types';
import { fetchCartolaTeams, fetchStatus } from '../services/api';
import { saveLeague } from '../services/storage';

const RODADAS = Array.from({ length: 38 }, (_, i) => i + 1);

export default function LeagueDetailScreen({ route, navigation }: any) {
  const { league: initialLeague } = route.params;
  const [league, setLeague] = useState<League>(initialLeague);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showLeagueForm, setShowLeagueForm] = useState(false);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [proprietario, setProprietario] = useState('');
  const [timeId, setTimeId] = useState('');
  const [patrimonio, setPatrimonio] = useState('');
  const [ranking, setRanking] = useState('');
  const [leagueNome, setLeagueNome] = useState(league.nome);
  const [leagueModalidade, setLeagueModalidade] = useState(league.modalidade);
  const [leagueInicial, setLeagueInicial] = useState(league.rodada_inicial);
  const [leagueFinal, setLeagueFinal] = useState(league.rodada_final);
  const [showCartolaSearch, setShowCartolaSearch] = useState(false);
  const [cartolaQuery, setCartolaQuery] = useState('');
  const [cartolaResults, setCartolaResults] = useState<CartolaTeamSearchResult[]>([]);
  const [cartolaLoading, setCartolaLoading] = useState(false);
  const cartolaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveLeague(league);
  }, [league]);

  const modalidade = league.modalidade;
  const sorted = [...league.times].sort((a, b) => b.total_acumulado - a.total_acumulado);

  const openNew = () => {
    setEditTeamId(null);
    setNome('');
    setProprietario('');
    setTimeId('');
    setPatrimonio('');
    setRanking('');
    setShowTeamForm(true);
  };

  const openEdit = (team: Team) => {
    setEditTeamId(team.id);
    setNome(team.nome);
    setProprietario(team.proprietario);
    setTimeId(team.time_id || '');
    setPatrimonio(String(team.patrimonio));
    setRanking(String(team.ranking));
    setShowTeamForm(true);
  };

  const handleSaveTeam = () => {
    if (!nome.trim()) return;
    const p = parseFloat(patrimonio) || 0;
    const r = parseFloat(ranking) || 0;
    const total = modalidade === 'patrimonio' ? p : r;
    const team: Team = {
      id: editTeamId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nome: nome.trim(),
      proprietario: proprietario.trim(),
      time_id: timeId.trim() || undefined,
      patrimonio: p,
      ranking: r,
      total_acumulado: total,
      is_user: false,
    };
    const times = editTeamId
      ? league.times.map((t) => (t.id === editTeamId ? team : t))
      : [...league.times, team];
    setLeague({ ...league, times });
    setShowTeamForm(false);
  };

  const handleDeleteTeam = (teamId: string) => {
    setLeague({ ...league, times: league.times.filter((t) => t.id !== teamId) });
  };

  const openEditLeague = () => {
    setLeagueNome(league.nome);
    setLeagueModalidade(league.modalidade);
    setLeagueInicial(league.rodada_inicial);
    setLeagueFinal(league.rodada_final);
    setShowLeagueForm(true);
  };

  const handleSaveLeague = () => {
    if (!leagueNome.trim()) return;
    if (leagueInicial > leagueFinal) return;
    setLeague({
      ...league,
      nome: leagueNome.trim(),
      modalidade: leagueModalidade,
      rodada_inicial: leagueInicial,
      rodada_final: leagueFinal,
    });
    setShowLeagueForm(false);
  };

  const handleCartolaQuery = (text: string) => {
    setCartolaQuery(text);
    if (cartolaTimer.current) clearTimeout(cartolaTimer.current);
    if (!text.trim()) {
      setCartolaResults([]);
      return;
    }
    cartolaTimer.current = setTimeout(() => {
      setCartolaLoading(true);
      fetchCartolaTeams(text.trim())
        .then(setCartolaResults)
        .catch(() => setCartolaResults([]))
        .finally(() => setCartolaLoading(false));
    }, 400);
  };

  const selectCartolaTeam = (team: CartolaTeamSearchResult) => {
    setNome(team.nome || '');
    setProprietario(team.nome_cartola || '');
    setTimeId(String(team.time_id ?? ''));
    setShowCartolaSearch(false);
    setCartolaQuery('');
    setCartolaResults([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{league.nome}</Text>
            <Text style={styles.modalidade}>
              {modalidade === 'pontuacao' ? 'Pontuação' : 'Patrimônio'}
              · R{league.rodada_inicial}{league.rodada_final !== league.rodada_inicial ? `-R${league.rodada_final}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={openEditLeague} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Editar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalText}>
          Total: {sorted.reduce((s, t) => s + t.total_acumulado, 0).toFixed(2)}
        </Text>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhum time adicionado</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.teamCard} onPress={() => openEdit(item)}>
            <View style={styles.posRow}>
              <Text style={styles.pos}>{index + 1}º</Text>
              <View style={styles.teamInfo}>
                <Text style={styles.teamNome}>{item.nome}</Text>
                <Text style={styles.teamProp}>{item.proprietario}</Text>
                {item.time_id && <Text style={styles.teamId}>ID: {item.time_id}</Text>}
              </View>
            </View>
            <View style={styles.statsCol}>
              <Text style={styles.statTotal}>
                {item.total_acumulado.toFixed(2)}
              </Text>
              {modalidade === 'patrimonio' ? (
                <Text style={styles.statSub}>Pat: {item.patrimonio.toFixed(2)}</Text>
              ) : (
                <Text style={styles.statSub}>Rank: {item.ranking.toFixed(2)}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => handleDeleteTeam(item.id)}>
              <Text style={styles.removeBtn}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.addBtn} onPress={openNew}>
        <Text style={styles.addBtnText}>+ Adicionar Time</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>Voltar</Text>
      </TouchableOpacity>

      <Modal visible={showTeamForm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editTeamId ? 'Editar Time' : 'Novo Time'}
              </Text>

              <Text style={styles.label}>Nome do time</Text>
              <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex: FFort EC" placeholderTextColor="#64748b" />

              <TouchableOpacity style={styles.cartolaSearchBtn} onPress={() => setShowCartolaSearch(true)}>
                <Text style={styles.cartolaSearchBtnText}>Buscar no Cartola</Text>
              </TouchableOpacity>

              {showCartolaSearch && (
                <View style={styles.cartolaSearchArea}>
                  <TextInput
                    style={styles.input}
                    placeholder="Nome do time no Cartola..."
                    placeholderTextColor="#64748b"
                    value={cartolaQuery}
                    onChangeText={handleCartolaQuery}
                    autoFocus
                  />
                  {cartolaLoading ? (
                    <ActivityIndicator size="small" color="#22c55e" style={{ marginVertical: 12 }} />
                  ) : cartolaResults.length > 0 ? (
                    <View style={styles.cartolaResults}>
                      {cartolaResults.map((item) => (
                        <TouchableOpacity
                          key={item.time_id}
                          style={styles.cartolaResultItem}
                          onPress={() => selectCartolaTeam(item)}
                        >
                          <Text style={styles.cartolaResultNome}>{item.nome_cartola}</Text>
                          <Text style={styles.cartolaResultProp}>{item.nome}</Text>
                          <Text style={styles.cartolaResultId}>ID: {item.time_id}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : cartolaQuery.trim() ? (
                    <Text style={styles.cartolaEmpty}>Nenhum time encontrado</Text>
                  ) : null}
                </View>
              )}

              <Text style={styles.label}>Proprietário</Text>
              <TextInput style={styles.input} value={proprietario} onChangeText={setProprietario} placeholder="Nome do cartoleiro" placeholderTextColor="#64748b" />

              <Text style={styles.label}>Time ID (Cartola FC)</Text>
              <TextInput style={styles.input} value={timeId} onChangeText={setTimeId} placeholder="Opcional" placeholderTextColor="#64748b" />

              <Text style={styles.label}>Patrimônio</Text>
              <TextInput style={styles.input} value={patrimonio} onChangeText={setPatrimonio} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#64748b" />

              <Text style={styles.label}>Ranking</Text>
              <TextInput style={styles.input} value={ranking} onChangeText={setRanking} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#64748b" />

              {!editTeamId && (
                <Text style={styles.hint}>
                  Total acumulado será calculado automaticamente conforme a modalidade da liga ({modalidade === 'patrimonio' ? 'Patrimônio' : 'Ranking'}).
                </Text>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTeamForm(false)}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveTeam}>
                  <Text style={styles.confirmBtnText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showLeagueForm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Editar Liga</Text>

              <Text style={styles.label}>Nome</Text>
              <TextInput style={styles.input} value={leagueNome} onChangeText={setLeagueNome} placeholder="Nome da liga" placeholderTextColor="#64748b" />

              <Text style={styles.label}>Rodada Inicial</Text>
              <View style={styles.pickerRow}>
                {RODADAS.filter((r) => r <= leagueFinal).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.pickerItemSm, leagueInicial === r && styles.pickerActive]}
                    onPress={() => setLeagueInicial(r)}
                  >
                    <Text style={[styles.pickerTextSm, leagueInicial === r && styles.pickerTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Rodada Final</Text>
              <View style={styles.pickerRow}>
                {RODADAS.filter((r) => r >= leagueInicial).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.pickerItemSm, leagueFinal === r && styles.pickerActive]}
                    onPress={() => setLeagueFinal(r)}
                  >
                    <Text style={[styles.pickerTextSm, leagueFinal === r && styles.pickerTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {leagueInicial === leagueFinal ? (
                <Text style={styles.hint}>Liga de rodada única (R{leagueInicial})</Text>
              ) : (
                <Text style={styles.hint}>Liga com {leagueFinal - leagueInicial + 1} rodadas (R{leagueInicial} a R{leagueFinal})</Text>
              )}

              <Text style={styles.label}>Modalidade</Text>
              <View style={styles.pickerRow}>
                <TouchableOpacity
                  style={[styles.pickerItem, leagueModalidade === 'pontuacao' && styles.pickerActive]}
                  onPress={() => setLeagueModalidade('pontuacao')}
                >
                  <Text style={[styles.pickerText, leagueModalidade === 'pontuacao' && styles.pickerTextActive]}>Pontuação</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickerItem, leagueModalidade === 'patrimonio' && styles.pickerActive]}
                  onPress={() => setLeagueModalidade('patrimonio')}
                >
                  <Text style={[styles.pickerText, leagueModalidade === 'patrimonio' && styles.pickerTextActive]}>Patrimônio</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLeagueForm(false)}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveLeague}>
                  <Text style={styles.confirmBtnText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 8,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  editBtnText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalidade: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
    marginTop: 2,
  },
  totalRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  totalText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
  },
  teamCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  posRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pos: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
    width: 36,
  },
  teamInfo: {
    flex: 1,
  },
  teamNome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
  },
  teamProp: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  teamId: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  statsCol: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  statTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  statSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  removeBtn: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    paddingLeft: 8,
  },
  addBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  backBtn: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
  },
  backBtnText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalScroll: {
    maxHeight: '80%',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pickerItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  pickerItemSm: {
    width: 38,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  pickerActive: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  pickerText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  pickerTextSm: {
    fontSize: 13,
    color: '#94a3b8',
  },
  pickerTextActive: {
    color: '#22c55e',
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 12,
    fontStyle: 'italic',
  },
  cartolaSearchBtn: {
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  cartolaSearchBtnText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '600',
  },
  cartolaSearchArea: {
    marginTop: 8,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
  },
  cartolaResults: {
    marginTop: 8,
  },
  cartolaResultItem: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  cartolaResultNome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
  },
  cartolaResultProp: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  cartolaResultId: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  cartolaEmpty: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
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
  confirmBtn: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

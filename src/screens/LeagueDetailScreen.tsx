import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { BotEscalarRequest, BotEscalarResponse, TeamSearchResult, League, Lineup, OtimizarParams, Player, Reserva, Tecnico, Team } from '../types';
import { fetchTeams, fetchTeamBySlug, fetchStatus, postBotEscalar } from '../services/api';
import { getLineups, saveLeague, saveLineup } from '../services/storage';

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
  const [showTeamSearch, setShowTeamSearch] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');
  const [teamResults, setTeamResults] = useState<TeamSearchResult[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const teamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isBot, setIsBot] = useState(false);
  const [cartoletasIniciais, setCartoletasIniciais] = useState('');
  const [posicaoCampo, setPosicaoCampo] = useState('');
  const [estrategia, setEstrategia] = useState<'auto' | 'manual'>('auto');
  const [focoBot, setFocoBot] = useState(1.0);
  const [perfilBot, setPerfilBot] = useState<'neutro' | 'agressivo' | 'conservador'>('neutro');
  const [gerenciandoBot, setGerenciandoBot] = useState<Team | null>(null);
  const [botResult, setBotResult] = useState<BotEscalarResponse | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [rodadaAtual, setRodadaAtual] = useState(1);
  const [editEstrategia, setEditEstrategia] = useState<'auto' | 'manual'>('auto');
  const [editFoco, setEditFoco] = useState(1.0);
  const [editPerfil, setEditPerfil] = useState<'neutro' | 'agressivo' | 'conservador'>('neutro');
  const [lineups, setLineups] = useState<Lineup[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchStatus().then((s) => setRodadaAtual(s.rodada_atual)).catch(() => {});
      getLineups().then(setLineups).catch(() => {});
    }, [])
  );

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
    setIsBot(false);
    setCartoletasIniciais('');
    setPosicaoCampo('');
    setEstrategia('auto');
    setFocoBot(1.0);
    setPerfilBot('neutro');
    setShowTeamForm(true);
  };

  const openEdit = (team: Team) => {
    setEditTeamId(team.id);
    setNome(team.nome);
    setProprietario(team.proprietario);
    setTimeId(team.time_id || '');
    setPatrimonio(String(team.patrimonio));
    setRanking(String(team.ranking));
    setIsBot(team.is_bot || false);
    setCartoletasIniciais(team.cartoletas_iniciais ? String(team.cartoletas_iniciais) : '');
    setPosicaoCampo(team.posicao ? String(team.posicao) : '');
    setEstrategia(team.estrategia || 'auto');
    setFocoBot(team.foco ?? 1.0);
    setPerfilBot(team.perfil || 'neutro');
    setShowTeamForm(true);
  };

  const handleSaveTeam = () => {
    if (!nome.trim()) return;
    const p = parseFloat(patrimonio) || 0;
    const r = parseFloat(ranking) || 0;
    const total = modalidade === 'patrimonio' ? p : r;
    const ci = parseFloat(cartoletasIniciais) || undefined;
    const team: Team = {
      id: editTeamId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nome: nome.trim(),
      proprietario: proprietario.trim(),
      time_id: timeId.trim() || undefined,
      patrimonio: p,
      ranking: r,
      total_acumulado: total,
      is_user: false,
      is_bot: isBot || undefined,
      cartoletas_iniciais: isBot ? ci : undefined,
      posicao: isBot ? (parseInt(posicaoCampo) || undefined) : undefined,
      ativo: isBot ? true : undefined,
      estrategia: isBot ? estrategia : undefined,
      foco: isBot ? focoBot : undefined,
      perfil: isBot ? perfilBot : undefined,
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

  const selectTeam = async (team: TeamSearchResult) => {
    setNome(team.nome || '');
    setProprietario(team.nome_cartola || '');
    setTimeId(String(team.time_id ?? ''));
    setShowTeamSearch(false);
    setTeamQuery('');
    setTeamResults([]);

    if (team.slug) {
      try {
        const detail = await fetchTeamBySlug(team.slug);
        setPatrimonio(String(detail.patrimonio ?? ''));
        setRanking(String(detail.pontos?.campeonato ?? ''));
      } catch {
        // silently ignore — user can type patrimonio/ranking manually
      }
    }
  };

  const openGerenciarBot = (bot: Team) => {
    setGerenciandoBot(bot);
    setEditEstrategia(bot.estrategia || 'auto');
    setEditFoco(bot.foco ?? 1.0);
    setEditPerfil(bot.perfil || 'neutro');
    setBotResult(null);
  };

  const salvarEstrategiaBot = () => {
    if (!gerenciandoBot) return;
    const updated: Team = {
      ...gerenciandoBot,
      estrategia: editEstrategia,
      foco: editFoco,
      perfil: editPerfil,
    };
    setLeague({
      ...league,
      times: league.times.map((t) => (t.id === updated.id ? updated : t)),
    });
    setGerenciandoBot(updated);
  };

  const closeGerenciarBot = () => {
    setGerenciandoBot(null);
    setBotResult(null);
  };

  function mapBotResponseToLineup(botRes: BotEscalarResponse, bot: Team): { params: OtimizarParams; response: Lineup['response'] } {
    const mapPlayer = (p: BotEscalarResponse['players'][0]): Player => ({
      atleta_id: p.atleta_id,
      apelido: p.apelido,
      posicao: p.posicao,
      preco: p.preco,
      previsto: p.previsto,
      clube: p.clube,
      potential_valorizacao: p.potential_valorizacao,
      preco_projetado: p.preco_projetado,
      variacao_num: p.variacao_num,
      role: p.role === 'capitao' ? 'capitao' : undefined,
    });
    const mapTecnico = (p: BotEscalarResponse['tecnico']): Tecnico => ({
      atleta_id: p.atleta_id,
      apelido: p.apelido,
      clube: p.clube,
      preco: p.preco,
      previsto: p.previsto,
      potential_valorizacao: p.potential_valorizacao,
      preco_projetado: p.preco_projetado,
    });
    const reservas: Record<string, Reserva> = {};
    for (const [pos, r] of Object.entries(botRes.reservas)) {
      reservas[pos] = {
        atleta_id: r.atleta_id,
        apelido: r.apelido,
        clube: r.clube,
        posicao: r.posicao,
        preco: r.preco,
        previsto: r.previsto,
        media_num: r.media_num,
        jogos_num: r.jogos_num,
        variacao_num: r.variacao_num,
        potential_valorizacao: r.potential_valorizacao,
        preco_projetado: r.preco_projetado,
        tendencia: r.tendencia,
        eficiencia: r.eficiencia,
        luxo: r.luxo || false,
      };
    }
    return {
      params: {
        orcamento: bot.patrimonio,
        formacao: botRes.formacao,
        perfil: editPerfil,
        foco: editFoco,
        incluir_duvidosos: false,
        reserva_luxo: true,
      },
      response: {
        formation: botRes.formacao,
        pontos_previstos: botRes.pontos_previstos,
        orcamento_usado: botRes.orcamento_usado,
        players: botRes.players.map(mapPlayer),
        tecnico: mapTecnico(botRes.tecnico),
        reservas,
        comparacao: botRes.comparacao || [],
        valorizacao_total: botRes.valorizacao_total,
      },
    };
  }

  const handleEscalarBot = async () => {
    const bot = gerenciandoBot;
    if (!bot?.is_bot) return;
    setBotLoading(true);
    setBotResult(null);
    try {
      const lider = sorted[0];
      const proximo = sorted.find((t) => t.total_acumulado > bot.total_acumulado && t.id !== bot.id);
      const params: BotEscalarRequest = {
        nome: bot.nome,
        orcamento_atual: bot.patrimonio,
        total_pontos: bot.total_acumulado,
        posicao: bot.posicao || league.times.length,
        total_participantes: league.times.length,
        rodada_atual: rodadaAtual,
        rodada_inicio: league.rodada_inicial,
        rodada_fim: league.rodada_final,
        pontos_lider: lider?.total_acumulado || 0,
        pontos_proximo: proximo ? proximo.total_acumulado - bot.total_acumulado : 0,
        modalidade: league.modalidade,
        estrategia: editEstrategia === 'manual'
          ? { perfil: editPerfil, foco: editFoco }
          : 'auto',
      };
      const result = await postBotEscalar(params);
      setBotResult(result);

      const lineups = await getLineups();
      const existingIdx = lineups.findIndex(
        (l) => l.atribuido_a_team_id === bot.id && l.rodada === rodadaAtual
      );
      const { params: otimizarParams, response } = mapBotResponseToLineup(result, bot);
      const lineup: Lineup = {
        id: existingIdx >= 0 ? lineups[existingIdx].id : Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        nome: `${bot.nome} - R${rodadaAtual}`,
        rodada: rodadaAtual,
        atribuido_a_team_id: bot.id,
        created_at: new Date().toISOString(),
        params: otimizarParams,
        response,
        estrategia: result.estrategia,
      };
      await saveLineup(lineup);
    } catch (e: any) {
      setBotResult(null);
    } finally {
      setBotLoading(false);
    }
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
          <View style={styles.teamCard}>
            <TouchableOpacity style={styles.teamCardTouch} onPress={() => openEdit(item)}>
              <View style={styles.posRow}>
                <Text style={styles.pos}>{index + 1}º</Text>
                <View style={styles.teamInfo}>
                  <View style={styles.teamNomeRow}>
                    <Text style={styles.teamNome}>{item.nome}</Text>
                    {item.is_bot && <Text style={styles.botBadge}> 🤖</Text>}
                  </View>
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
            </TouchableOpacity>
            <View style={styles.teamActions}>
              {(() => {
                const teamLineup = lineups.find((l) => l.atribuido_a_team_id === item.id && l.rodada === rodadaAtual);
                return teamLineup ? (
                  <TouchableOpacity style={styles.lineupActionBtn} onPress={() => navigation.navigate('Escalações', { screen: 'LineupDetail', params: { lineup: teamLineup } })}>
                    <Text style={styles.lineupActionBtnText}>📋</Text>
                  </TouchableOpacity>
                ) : null;
              })()}
              {item.is_bot && (
                <TouchableOpacity style={styles.botActionBtn} onPress={() => openGerenciarBot(item)}>
                  <Text style={styles.botActionBtnText}>⚙</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleDeleteTeam(item.id)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
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

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Bot (automático)</Text>
                <TouchableOpacity
                  style={[styles.toggle, isBot && styles.toggleActive]}
                  onPress={() => setIsBot(!isBot)}
                >
                  <View style={[styles.toggleThumb, isBot && styles.toggleThumbActive]} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.teamSearchBtn} onPress={() => setShowTeamSearch(true)}>
                <Text style={styles.teamSearchBtnText}>Buscar time</Text>
              </TouchableOpacity>

              {showTeamSearch && (
                <View style={styles.teamSearchArea}>
                  <TextInput
                    style={styles.input}
                    placeholder="Nome do time..."
                    placeholderTextColor="#64748b"
                    value={teamQuery}
                    onChangeText={handleTeamQuery}
                    autoFocus
                  />
                  {teamLoading ? (
                    <ActivityIndicator size="small" color="#22c55e" style={{ marginVertical: 12 }} />
                  ) : teamResults.length > 0 ? (
                    <View style={styles.teamResults}>
                      {teamResults.map((item) => (
                        <TouchableOpacity
                          key={item.time_id}
                          style={styles.teamResultItem}
                          onPress={() => selectTeam(item)}
                        >
                          <Text style={styles.teamResultNome}>{item.nome_cartola}</Text>
                          <Text style={styles.teamResultProp}>{item.nome}</Text>
                          <Text style={styles.teamResultId}>ID: {item.time_id}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : teamQuery.trim() ? (
                    <Text style={styles.teamEmpty}>Nenhum time encontrado</Text>
                  ) : null}
                </View>
              )}

              <Text style={styles.label}>Proprietário</Text>
              <TextInput style={styles.input} value={proprietario} onChangeText={setProprietario} placeholder="Nome do proprietário" placeholderTextColor="#64748b" />

              <Text style={styles.label}>Time ID</Text>
              <TextInput style={styles.input} value={timeId} onChangeText={setTimeId} placeholder="Opcional" placeholderTextColor="#64748b" />

              <Text style={styles.label}>Patrimônio</Text>
              <TextInput style={styles.input} value={patrimonio} onChangeText={setPatrimonio} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#64748b" />

              {isBot && (
                <>
                  <Text style={styles.label}>Cartoletas Iniciais</Text>
                  <TextInput style={styles.input} value={cartoletasIniciais} onChangeText={setCartoletasIniciais} keyboardType="decimal-pad" placeholder="Ex: 100" placeholderTextColor="#64748b" />

                  <Text style={styles.label}>Posição na Liga</Text>
                  <TextInput style={styles.input} value={posicaoCampo} onChangeText={setPosicaoCampo} keyboardType="number-pad" placeholder="Última posição conhecida" placeholderTextColor="#64748b" />

                  <Text style={styles.label}>Estratégia</Text>
                  <View style={styles.pickerRow}>
                    <TouchableOpacity
                      style={[styles.pickerItem, estrategia === 'auto' && styles.pickerActive]}
                      onPress={() => setEstrategia('auto')}
                    >
                      <Text style={[styles.pickerText, estrategia === 'auto' && styles.pickerTextActive]}>Auto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickerItem, estrategia === 'manual' && styles.pickerActive]}
                      onPress={() => setEstrategia('manual')}
                    >
                      <Text style={[styles.pickerText, estrategia === 'manual' && styles.pickerTextActive]}>Manual</Text>
                    </TouchableOpacity>
                  </View>

                  {estrategia === 'manual' && (
                    <>
                      <Text style={styles.label}>Foco</Text>
                      <Text style={styles.focoHint}>
                        {focoBot === 1.0 ? 'Só Pontuação' : focoBot >= 0.8 ? '↑ Pontuação' : focoBot === 0.7 ? 'Valoriz. Leve' : focoBot === 0.5 ? 'Equilibrado' : focoBot === 0.3 ? '↑ Valorização' : focoBot === 0.0 ? 'Só Valorização' : focoBot.toFixed(1)}
                      </Text>
                      <View style={styles.pickerRow}>
                        {[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((v) => (
                          <TouchableOpacity
                            key={v}
                            style={[styles.pesoItem, focoBot === v && styles.pesoActive]}
                            onPress={() => setFocoBot(v)}
                          >
                            <Text style={[styles.pickerTextSm, focoBot === v && styles.pickersmTextActive]}>
                              {v.toFixed(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.label}>Perfil</Text>
                      <View style={styles.pickerRow}>
                        <TouchableOpacity
                          style={[styles.pickerItem, perfilBot === 'neutro' && styles.pickerActive]}
                          onPress={() => setPerfilBot('neutro')}
                        >
                          <Text style={[styles.pickerText, perfilBot === 'neutro' && styles.pickerTextActive]}>Neutro</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.pickerItem, perfilBot === 'agressivo' && styles.pickerActive]}
                          onPress={() => setPerfilBot('agressivo')}
                        >
                          <Text style={[styles.pickerText, perfilBot === 'agressivo' && styles.pickerTextActive]}>Agressivo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.pickerItem, perfilBot === 'conservador' && styles.pickerActive]}
                          onPress={() => setPerfilBot('conservador')}
                        >
                          <Text style={[styles.pickerText, perfilBot === 'conservador' && styles.pickerTextActive]}>Conservador</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}

              <Text style={styles.label}>Ranking</Text>
              <TextInput style={styles.input} value={ranking} onChangeText={setRanking} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#64748b" />

              {!editTeamId && (
                <Text style={styles.hint}>
                  {isBot
                    ? 'Patrimônio = orçamento atual do bot. Atualize após cada rodada processada.'
                    : `Total acumulado será calculado automaticamente conforme a modalidade da liga (${modalidade === 'patrimonio' ? 'Patrimônio' : 'Ranking'}).`
                  }
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

      <Modal visible={!!gerenciandoBot} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🤖 {gerenciandoBot?.nome}</Text>

              <View style={styles.botInfoGrid}>
                <View style={styles.botInfoItem}>
                  <Text style={styles.botInfoLabel}>Orçamento</Text>
                  <Text style={styles.botInfoValue}>C$ {gerenciandoBot?.patrimonio.toFixed(2)}</Text>
                </View>
                <View style={styles.botInfoItem}>
                  <Text style={styles.botInfoLabel}>Cartoletas iniciais</Text>
                  <Text style={styles.botInfoValue}>C$ {gerenciandoBot?.cartoletas_iniciais?.toFixed(2) || '—'}</Text>
                </View>
                <View style={styles.botInfoItem}>
                  <Text style={styles.botInfoLabel}>Pontos</Text>
                  <Text style={styles.botInfoValue}>{gerenciandoBot?.total_acumulado.toFixed(2)}</Text>
                </View>
                <View style={styles.botInfoItem}>
                  <Text style={styles.botInfoLabel}>Posição</Text>
                  <Text style={styles.botInfoValue}>{gerenciandoBot?.posicao || '—'}º</Text>
                </View>
              </View>

              <Text style={styles.label}>Estratégia</Text>
              <View style={styles.pickerRow}>
                <TouchableOpacity
                  style={[styles.pickerItem, editEstrategia === 'auto' && styles.pickerActive]}
                  onPress={() => setEditEstrategia('auto')}
                >
                  <Text style={[styles.pickerText, editEstrategia === 'auto' && styles.pickerTextActive]}>Auto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickerItem, editEstrategia === 'manual' && styles.pickerActive]}
                  onPress={() => setEditEstrategia('manual')}
                >
                  <Text style={[styles.pickerText, editEstrategia === 'manual' && styles.pickerTextActive]}>Manual</Text>
                </TouchableOpacity>
              </View>

              {editEstrategia === 'manual' && (
                <>
                  <Text style={styles.label}>Foco</Text>
                  <Text style={styles.focoHint}>
                    {editFoco === 1.0 ? 'Só Pontuação' : editFoco >= 0.8 ? '↑ Pontuação' : editFoco === 0.7 ? 'Valoriz. Leve' : editFoco === 0.5 ? 'Equilibrado' : editFoco === 0.3 ? '↑ Valorização' : editFoco === 0.0 ? 'Só Valorização' : editFoco.toFixed(1)}
                  </Text>
                  <View style={styles.pickerRow}>
                    {[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((v) => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.pesoItem, editFoco === v && styles.pesoActive]}
                        onPress={() => setEditFoco(v)}
                      >
                        <Text style={[styles.pickerTextSm, editFoco === v && styles.pickersmTextActive]}>
                          {v.toFixed(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Perfil</Text>
                  <View style={styles.pickerRow}>
                    <TouchableOpacity
                      style={[styles.pickerItem, editPerfil === 'neutro' && styles.pickerActive]}
                      onPress={() => setEditPerfil('neutro')}
                    >
                      <Text style={[styles.pickerText, editPerfil === 'neutro' && styles.pickerTextActive]}>Neutro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickerItem, editPerfil === 'agressivo' && styles.pickerActive]}
                      onPress={() => setEditPerfil('agressivo')}
                    >
                      <Text style={[styles.pickerText, editPerfil === 'agressivo' && styles.pickerTextActive]}>Agressivo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickerItem, editPerfil === 'conservador' && styles.pickerActive]}
                      onPress={() => setEditPerfil('conservador')}
                    >
                      <Text style={[styles.pickerText, editPerfil === 'conservador' && styles.pickerTextActive]}>Conservador</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {botLoading && (
                <ActivityIndicator size="large" color="#22c55e" style={{ marginVertical: 24 }} />
              )}

              {botResult && (
                <View style={styles.botResultArea}>
                  <Text style={styles.botEstrategia}>📋 {botResult.estrategia}</Text>
                  <View style={styles.botResultRow}>
                    <Text style={styles.botResultLabel}>Foco:</Text>
                    <Text style={styles.botResultValue}>
                      {editFoco.toFixed(1)} ({editFoco === 1.0 ? 'Só Pontuação' : editFoco === 0.0 ? 'Só Valorização' : editFoco >= 0.8 ? '↑ Pontuação' : editFoco === 0.7 ? 'Valoriz. Leve' : editFoco === 0.5 ? 'Equilibrado' : editFoco === 0.3 ? '↑ Valorização' : ''})
                    </Text>
                  </View>
                  <View style={styles.botResultRow}>
                    <Text style={styles.botResultLabel}>Perfil:</Text>
                    <Text style={styles.botResultValue}>{botResult.perfil}</Text>
                  </View>
                  <View style={styles.botResultRow}>
                    <Text style={styles.botResultLabel}>Formação:</Text>
                    <Text style={styles.botResultValue}>{botResult.formacao}</Text>
                  </View>
                  <View style={styles.botResultRow}>
                    <Text style={styles.botResultLabel}>Orçamento usado:</Text>
                    <Text style={styles.botResultValue}>C$ {botResult.orcamento_usado.toFixed(2)}</Text>
                  </View>
                  <View style={styles.botResultRow}>
                    <Text style={styles.botResultLabel}>Pontos previstos:</Text>
                    <Text style={styles.botResultValue}>{botResult.pontos_previstos.toFixed(2)}</Text>
                  </View>
                </View>
              )}

              <View style={styles.modalButtonsGroup}>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeGerenciarBot}>
                    <Text style={styles.cancelBtnText}>Fechar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={salvarEstrategiaBot}>
                    <Text style={styles.saveBtnText}>Salvar</Text>
                  </TouchableOpacity>
                </View>
                {gerenciandoBot && (
                  <TouchableOpacity
                    style={[styles.confirmBtn, botLoading && { opacity: 0.5 }]}
                    onPress={handleEscalarBot}
                    disabled={botLoading}
                  >
                    <Text style={styles.confirmBtnText}>{botLoading ? 'Escalando...' : 'Escalar'}</Text>
                  </TouchableOpacity>
                )}
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
  teamSearchBtn: {
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  teamSearchBtnText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '600',
  },
  teamSearchArea: {
    marginTop: 8,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
  },
  teamResults: {
    marginTop: 8,
  },
  teamResultItem: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  teamResultNome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
  },
  teamResultProp: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  teamResultId: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  teamEmpty: {
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#f8fafc',
    fontWeight: '600',
  },
  toggle: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#334155',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#22c55e',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f8fafc',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  teamCardTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  botBadge: {
    fontSize: 14,
  },
  teamActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  botActionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  botActionBtnText: {
    fontSize: 18,
  },
  lineupActionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  lineupActionBtnText: {
    fontSize: 16,
  },
  botInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  botInfoItem: {
    width: '47%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
  },
  botInfoLabel: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  botInfoValue: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '700',
    marginTop: 4,
  },
  botResultArea: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  botEstrategia: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '600',
    marginBottom: 12,
  },
  botResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  botResultLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  botResultValue: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '600',
  },
  modalButtonsGroup: {
    marginTop: 24,
    gap: 12,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pickersmTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  focoHint: {
    fontSize: 12,
    color: '#3b82f6',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  pesoItem: {
    width: 52,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  pesoActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
});

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
import { useFocusEffect } from '@react-navigation/native';
import { BotEscalarRequest, BotEscalarResponse, CartolaAthlete, CartolaTeamResponse, League, Lineup, OtimizarParams, OtimizarResponse, Player, ProjetarResponse, Reserva, ResultadoResponse, TeamSearchResult, Tecnico, Team } from '../types';
import { fetchClubes, fetchMercado, fetchStatus, fetchTeamById, fetchTeams, fetchTeamBySlug, postBotEscalar, postProjetar, postResultado } from '../services/api';
import { getLineups, saveLeague, saveLineup } from '../services/storage';
import { theme } from '../theme';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import usePageTitle from '../usePageTitle';

const RODADAS = Array.from({ length: 38 }, (_, i) => i + 1);
const POS_MAP: Record<number, string> = { 1: 'GOL', 2: 'LAT', 3: 'ZAG', 4: 'MEI', 5: 'ATA', 6: 'TEC' };

const POS_ABBR: Record<number, string> = {
  1: 'GOL',
  2: 'LAT',
  3: 'ZAG',
  4: 'MEI',
  5: 'ATA',
  6: 'TEC',
};

function mapCartolaToLineup(res: CartolaTeamResponse, clubes: Record<string, { nome: string }>, rodada: number): Lineup {
  const clubMap: Record<number, string> = {};
  for (const [idStr, c] of Object.entries(clubes)) {
    clubMap[Number(idStr)] = c.nome;
  }

  const fc = (id: number) => clubMap[id] || String(id);

  const starters = res.atletas.filter((a) => a.posicao_id !== 6);
  const tecAtletas = res.atletas.filter((a) => a.posicao_id === 6);
  const bench = res.reservas || [];

  const players: Player[] = starters.map((atleta) => ({
    atleta_id: atleta.atleta_id,
    apelido: atleta.apelido,
    posicao: POS_ABBR[atleta.posicao_id] || 'MEI',
    preco: atleta.preco_num,
    previsto: atleta.media_num,
    clube: fc(atleta.clube_id),
    role: res.capitao_id === atleta.atleta_id ? 'capitao' : undefined,
  }));

  const reservas: Record<string, Reserva> = {};
  for (const atleta of bench) {
    const pos = POS_ABBR[atleta.posicao_id] || 'MEI';
    reservas[pos] = {
      atleta_id: atleta.atleta_id,
      apelido: atleta.apelido,
      clube: fc(atleta.clube_id),
      posicao: pos,
      preco: atleta.preco_num,
      previsto: atleta.media_num,
      media_num: atleta.media_num,
      jogos_num: atleta.jogos_num,
      variacao_num: atleta.variacao_num,
      potential_valorizacao: 0,
      preco_projetado: atleta.preco_num,
      tendencia: '',
      eficiencia: 0,
      luxo: res.reserva_luxo_id === atleta.atleta_id,
    };
  }

  let tecnico: Tecnico = {
    apelido: '',
    clube: '',
    atleta_id: 0,
    preco: 0,
    previsto: 0,
  };
  if (tecAtletas.length > 0) {
    const t = tecAtletas[0];
    tecnico = {
      apelido: t.apelido,
      clube: fc(t.clube_id),
      atleta_id: t.atleta_id,
      preco: t.preco_num,
      previsto: t.media_num,
      media_num: t.media_num,
      jogos_num: t.jogos_num,
    };
  }

  const defCount = players.filter((p) => p.posicao === 'LAT' || p.posicao === 'ZAG').length;
  const meiCount = players.filter((p) => p.posicao === 'MEI').length;
  const ataCount = players.filter((p) => p.posicao === 'ATA').length;

  const response: OtimizarResponse = {
    formacao: `${defCount}-${meiCount}-${ataCount}`,
    pontos_previstos: players.reduce((s, p) => s + p.previsto, 0) + tecnico.previsto,
    orcamento_usado: players.reduce((s, p) => s + p.preco, 0) + tecnico.preco,
    players,
    reservas,
    tecnico,
    comparacao: [],
  };

  return {
    id: `cartola-${res.time.time_id}-${Date.now()}`,
    nome: res.time.nome_cartola,
    rodada,
    atribuido_a_team_id: undefined,
    created_at: new Date().toISOString(),
    response,
  };
}

export default function LeagueDetailScreen({ route, navigation }: any) {
  usePageTitle(route.params?.league?.nome ?? 'Liga');
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
  const [botLoading, setBotLoading] = useState(false);
  const [consolidando, setConsolidando] = useState(false);
  const [consolidacaoLog, setConsolidacaoLog] = useState<string[]>([]);
  const [rodadaAtual, setRodadaAtual] = useState(1);
  const [statusMercado, setStatusMercado] = useState(0);
  const [rodadaSelecionada, setRodadaSelecionada] = useState(1);
  const [editEstrategia, setEditEstrategia] = useState<'auto' | 'manual'>('auto');
  const [editFoco, setEditFoco] = useState(1.0);
  const [editPerfil, setEditPerfil] = useState<'neutro' | 'agressivo' | 'conservador'>('neutro');
  const [editObrigarText, setEditObrigarText] = useState('');
  const [editExcluirText, setEditExcluirText] = useState('');
  const [mercadoAtletas, setMercadoAtletas] = useState<CartolaAthlete[]>([]);
  const [clubeMap, setClubeMap] = useState<Record<string, string>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [searchTarget, setSearchTarget] = useState<'obrigar' | 'excluir'>('obrigar');
  const [searchQuery, setSearchQuery] = useState('');
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      fetchStatus()
        .then((s) => {
          setRodadaAtual(s.rodada_atual);
          setStatusMercado(s.status_mercado);
          if (firstFocus.current) {
            setRodadaSelecionada(s.rodada_atual);
            firstFocus.current = false;
          }
        })
        .catch(() => {});
      getLineups().then(setLineups).catch(() => {});
    }, [])
  );

  useEffect(() => {
    saveLeague(league);
  }, [league]);

  const modalidade = league.modalidade;
  const sorted = [...league.times].sort((a, b) => b.total_acumulado - a.total_acumulado);

  const changeRodada = (delta: number) => {
    const nova = rodadaSelecionada + delta;
    if (nova >= league.rodada_inicial && nova <= league.rodada_final) setRodadaSelecionada(nova);
  };

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

  const handleImportTeam = async (team: Team) => {
    try {
      const [teamData, clubes] = await Promise.all([
        fetchTeamById(team.time_id!),
        fetchClubes(),
      ]);

      const lineup = mapCartolaToLineup(teamData, clubes, rodadaAtual);

      try {
        const fieldAtletas = teamData.atletas.filter((a) => a.posicao_id !== 6);
        const tecAtletas = teamData.atletas.filter((a) => a.posicao_id === 6);
        const precoCompra: Record<number, number> = {};
        for (const a of teamData.atletas) {
          precoCompra[a.atleta_id] = a.preco_num;
        }
        for (const a of teamData.reservas || []) {
          precoCompra[a.atleta_id] = a.preco_num;
        }

        const projetada = await postProjetar({
          atletas: fieldAtletas.map((a) => a.atleta_id),
          tecnico_id: tecAtletas[0]?.atleta_id ?? 0,
          capitao_id: teamData.capitao_id,
          rodada: rodadaAtual,
          forcar: false,
          preco_compra: precoCompra,
        });

        lineup.response.players = lineup.response.players.map((p) => {
          const enriched = projetada.jogadores.find((j) => j.atleta_id === p.atleta_id);
          return enriched ? { ...p, ...enriched } : p;
        });

        const tecEnriched = projetada.tecnico;
        if (tecEnriched?.atleta_id) {
          Object.assign(lineup.response.tecnico, tecEnriched);
        }

        lineup.response.pontos_previstos = projetada.pontos_previstos;
        lineup.response.valorizacao_total = projetada.valorizacao_total;
      } catch {
        // enrichment is optional — keep basic lineup from mapCartolaToLineup
      }

      lineup.atribuido_a_team_id = team.id;
      lineup.nome = `${team.nome} (importado)`;
      await saveLineup(lineup);
      setLineups((prev) => [...prev, lineup]);
      navigation.navigate('Escalações', { screen: 'LineupDetail', params: { lineup, league } });
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível importar a escalação do time.');
    }
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
        setRanking(String(detail.pontos_campeonato ?? detail.pontos?.campeonato ?? ''));
      } catch {
        // silently ignore — user can type patrimonio/pontuação manually
      }
    }
  };

  const openGerenciarBot = (bot: Team) => {
    setGerenciandoBot(bot);
    setEditEstrategia(bot.estrategia || 'auto');
    setEditFoco(bot.foco ?? 1.0);
    setEditPerfil(bot.perfil || 'neutro');
    setEditObrigarText((bot.obrigar ?? []).join(', '));
    setEditExcluirText((bot.excluir ?? []).join(', '));
  };

  const salvarEstrategiaBot = () => {
    if (!gerenciandoBot) return;
    const parseIds = (text: string) =>
      text.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    const updated: Team = {
      ...gerenciandoBot,
      estrategia: editEstrategia,
      foco: editFoco,
      perfil: editPerfil,
      obrigar: parseIds(editObrigarText),
      excluir: parseIds(editExcluirText),
    };
    setLeague({
      ...league,
      times: league.times.map((t) => (t.id === updated.id ? updated : t)),
    });
    setGerenciandoBot(updated);
  };

  const closeGerenciarBot = () => {
    setGerenciandoBot(null);
  };

  const filteredAtletas = searchQuery.trim()
    ? mercadoAtletas.filter((a) =>
        a.apelido.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 30)
    : mercadoAtletas.slice(0, 30);

  const openSearch = (target: 'obrigar' | 'excluir') => {
    setSearchTarget(target);
    setSearchQuery('');
    setShowSearch(true);
  };

  const selectAthlete = (athlete: CartolaAthlete) => {
    const idStr = String(athlete.atleta_id);
    if (searchTarget === 'obrigar') {
      setEditObrigarText((prev) => {
        const ids = prev ? prev.split(',').map(s => s.trim()) : [];
        if (ids.includes(idStr)) return prev;
        return prev ? `${prev}, ${idStr}` : idStr;
      });
    } else {
      setEditExcluirText((prev) => {
        const ids = prev ? prev.split(',').map(s => s.trim()) : [];
        if (ids.includes(idStr)) return prev;
        return prev ? `${prev}, ${idStr}` : idStr;
      });
    }
    setShowSearch(false);
  };

  useEffect(() => {
    Promise.all([fetchMercado(), fetchClubes()])
      .then(([mercado, clubes]) => {
        setMercadoAtletas(Object.values(mercado.atletas));
        const map: Record<string, string> = {};
        for (const [id, c] of Object.entries(clubes)) {
          map[id] = c.nome;
        }
        setClubeMap(map);
      })
      .catch(() => {});
  }, []);

  function mapBotResponseToLineup(botRes: BotEscalarResponse, bot: Team, perfil: string, foco: number): { params: OtimizarParams; response: Lineup['response'] } {
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
        perfil,
        foco,
        incluir_duvidosos: false,
        reserva_luxo: true,
      },
      response: {
        formacao: botRes.formacao,
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
    try {
      const lider = sorted[0];
      const proximo = sorted.find((t) => t.total_acumulado > bot.total_acumulado && t.id !== bot.id);
      const parseIds = (text: string) =>
        text.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      const obrigar = parseIds(editObrigarText);
      const excluir = parseIds(editExcluirText);
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
        ...(obrigar.length > 0 && { obrigar }),
        ...(excluir.length > 0 && { excluir }),
      };
      const result = await postBotEscalar(params);

      const resolvedPerfil = editEstrategia === 'auto' ? result.perfil : editPerfil;
      const resolvedFoco = editEstrategia === 'auto' ? result.foco : editFoco;

      const lineups = await getLineups();
      const existingIdx = lineups.findIndex(
        (l) => l.atribuido_a_team_id === bot.id && l.rodada === rodadaAtual
      );
      const { params: otimizarParams, response } = mapBotResponseToLineup(result, bot, resolvedPerfil, resolvedFoco);
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
      setGerenciandoBot(null);
      navigation.navigate('Escalações', { screen: 'LineupDetail', params: { lineup, league } });
    } catch (e: any) {
    } finally {
      setBotLoading(false);
    }
  };

  const handleConsolidarRodada = async () => {
    setConsolidando(true);
    setConsolidacaoLog([]);
    const log = (msg: string) => setConsolidacaoLog((prev) => [...prev, msg]);
    const rodada = rodadaSelecionada;

    let importados = 0;
    let botsCriados = 0;
    let botsPulados = 0;
    let atualizados = 0;
    let ignorados = 0;
    let erros = 0;

    const processLineup = async (lineup: Lineup, team: Team) => {
      const ids = lineup.response.players.map((p: Player) => p.atleta_id);
      const tecnicoId = lineup.response.tecnico?.atleta_id ?? 0;
      const capitaoId = lineup.response.players.find((p: Player) => p.role === 'capitao')?.atleta_id ?? 0;
      if (ids.length === 0) return;

      // Enrich with projected data
      try {
        const projetada = await postProjetar({
          atletas: ids,
          tecnico_id: tecnicoId,
          capitao_id: capitaoId,
          rodada,
          forcar: false,
        });
        lineup.response.players = lineup.response.players.map((p: Player) => {
          const enriched = (projetada as any).jogadores?.find((j: any) => Number(j.atleta_id) === p.atleta_id)
            ?? (projetada as any).players?.find((j: any) => Number(j.atleta_id) === p.atleta_id);
          return enriched ? { ...p, ...enriched, role: p.role } : p;
        });
        if (projetada.tecnico) Object.assign(lineup.response.tecnico, projetada.tecnico);
        lineup.response.pontos_previstos = projetada.pontos_previstos;
        lineup.response.valorizacao_total = projetada.valorizacao_total;
      } catch {}

      // Get real scores from /resultado
      let totalPontos = 0;
      let valorizacaoParaLiga = 0;
      try {
        const resultado = await postResultado({
          atletas: ids,
          tecnico_id: tecnicoId,
          capitao_id: capitaoId,
          rodada,
        });
        totalPontos = resultado.total_pontos;

        // Sum individual variation (preco_depois - preco_antes) for starters + coach
        for (const j of resultado.jogadores) {
          valorizacaoParaLiga += Math.max(0, j.variacao);
        }
        valorizacaoParaLiga += Math.max(0, resultado.tecnico.variacao);

        // Update team in league
        const teams = [...league.times];
        const teamIdx = teams.findIndex((t) => t.id === team.id);
        if (teamIdx >= 0) {
          teams[teamIdx] = {
            ...teams[teamIdx],
            patrimonio: teams[teamIdx].patrimonio + valorizacaoParaLiga,
          };
          if (league.modalidade === 'patrimonio') {
            teams[teamIdx].ranking = teams[teamIdx].patrimonio;
          } else {
            teams[teamIdx].ranking = teams[teamIdx].total_acumulado + totalPontos;
          }
          teams[teamIdx].total_acumulado = league.modalidade === 'patrimonio'
            ? teams[teamIdx].patrimonio
            : teams[teamIdx].ranking;
          await saveLeague({ ...league, times: teams });
        }
      } catch {
        // /resultado not available (rodada not finished or API error) — skip league update
      }
    };

    try {
      const lineupsExistentes = await getLineups();

      for (const team of league.times) {
        if (team.time_id) {
          try {
            const [teamData, clubes] = await Promise.all([
              fetchTeamById(team.time_id),
              fetchClubes(),
            ]);
            const lineup = mapCartolaToLineup(teamData, clubes, rodada);
            lineup.atribuido_a_team_id = team.id;
            lineup.nome = `${team.nome} (R${rodada})`;
            await processLineup(lineup, team);
            await saveLineup(lineup);
            importados++;
            log(`✅ ${team.nome}: escalação importada do Cartola`);
          } catch {
            erros++;
            log(`❌ ${team.nome}: erro ao importar do Cartola`);
          }
        } else if (team.is_bot && team.estrategia) {
          const jaTemLineup = lineupsExistentes.find(
            (l) => l.atribuido_a_team_id === team.id && l.rodada === rodada,
          );
          if (jaTemLineup) {
            botsPulados++;
            await processLineup(jaTemLineup, team);
            await saveLineup(jaTemLineup);
            log(`⏭️ ${team.nome}: já possui escalação, projeções atualizadas`);
            continue;
          }
          try {
            const lider = league.times[0];
            const proximo = league.times.find(
              (t) => t.total_acumulado > team.total_acumulado && t.id !== team.id,
            );
            const obrigar = team.obrigar ?? [];
            const excluir = team.excluir ?? [];
            const params: BotEscalarRequest = {
              nome: team.nome,
              orcamento_atual: team.patrimonio,
              total_pontos: team.total_acumulado,
              posicao: team.posicao || league.times.length,
              total_participantes: league.times.length,
              rodada_atual: rodada,
              rodada_inicio: league.rodada_inicial,
              rodada_fim: league.rodada_final,
              pontos_lider: lider?.total_acumulado || 0,
              pontos_proximo: proximo ? proximo.total_acumulado - team.total_acumulado : 0,
              modalidade: league.modalidade,
              estrategia: team.estrategia === 'manual'
                ? { perfil: team.perfil || 'neutro', foco: team.foco ?? 1.0 }
                : 'auto',
              ...(obrigar.length > 0 && { obrigar }),
              ...(excluir.length > 0 && { excluir }),
            };
            const result = await postBotEscalar(params);
            const resolvedPerfil = team.estrategia === 'auto' ? result.perfil : (team.perfil || 'neutro');
            const resolvedFoco = team.estrategia === 'auto' ? result.foco : (team.foco ?? 1.0);
            const { params: otimizarParams, response } = mapBotResponseToLineup(result, team, resolvedPerfil, resolvedFoco);
            const lineup: Lineup = {
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              nome: `${team.nome} - R${rodada}`,
              rodada,
              atribuido_a_team_id: team.id,
              created_at: new Date().toISOString(),
              params: otimizarParams,
              response,
              estrategia: result.estrategia,
            };
            await processLineup(lineup, team);
            await saveLineup(lineup);
            botsCriados++;
            log(`🤖 ${team.nome}: escalação gerada pelo bot`);
          } catch {
            erros++;
            log(`❌ ${team.nome}: erro ao escalar bot`);
          }
        } else {
          const existing = lineupsExistentes.find(
            (l) => l.atribuido_a_team_id === team.id && l.rodada === rodada,
          );
          if (existing) {
            atualizados++;
            await processLineup(existing, team);
            await saveLineup(existing);
            log(`🔄 ${team.nome}: projeções atualizadas`);
          } else {
            ignorados++;
            log(`— ${team.nome}: sem escalação, Cartola ID ou estratégia, ignorado`);
          }
        }
      }

      log(`\nResumo: ${importados} importados, ${botsCriados} bots, ${botsPulados} bots com escalação, ${atualizados} com projeções atualizadas, ${ignorados} ignorados, ${erros} erros`);
    } catch {
      log('❌ Erro inesperado durante consolidação');
    } finally {
      setConsolidando(false);
      await getLineups().then(setLineups).catch(() => {});
    }
  };

  const rodadaFutura = rodadaSelecionada > rodadaAtual;
  const rodadaEmAndamento = rodadaSelecionada === rodadaAtual && statusMercado !== 3;
  const consolidarDesabilitado = consolidando || rodadaFutura || rodadaEmAndamento;
  const consolidarLabel = rodadaFutura
    ? 'Rodada futura'
    : rodadaEmAndamento
      ? 'Aguardar fim da rodada'
      : consolidando
        ? 'Consolidando...'
        : 'Consolidar rodada';

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

      <View style={styles.rodadaRow}>
        <TouchableOpacity onPress={() => changeRodada(-1)} style={styles.arrow}>
          <Text style={styles.arrowText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.rodadaInfo}>
          <Text style={styles.rodadaLabel}>Rodada</Text>
          <Text style={styles.rodadaValue}>{rodadaSelecionada}</Text>
        </View>
        <TouchableOpacity onPress={() => changeRodada(1)} style={styles.arrow}>
          <Text style={styles.arrowText}>{'>'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setRodadaSelecionada(rodadaAtual)}
          style={styles.atualBtn}
        >
          <Text style={styles.atualBtnText}>Atual</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sorted}
        extraData={rodadaSelecionada}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhum time adicionado</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Card style={styles.teamCard}>
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
                  <Text style={styles.statSub}>Pont: {item.ranking.toFixed(2)}</Text>
                )}
              </View>
            </TouchableOpacity>
            <View style={styles.teamActions}>
              {(() => {
                const teamLineup = lineups.find((l) => l.atribuido_a_team_id === item.id && l.rodada === rodadaSelecionada);
                return teamLineup ? (
                  <TouchableOpacity style={styles.lineupActionBtn} onPress={() => navigation.navigate('Escalações', { screen: 'LineupDetail', params: { lineup: teamLineup, league } })}>
                    <Text style={styles.lineupActionBtnText}>📋</Text>
                  </TouchableOpacity>
                ) : null;
              })()}
              {item.time_id && (
                <TouchableOpacity style={styles.importActionBtn} onPress={() => handleImportTeam(item)}>
                  <Text style={styles.importActionBtnText}>📥</Text>
                </TouchableOpacity>
              )}
              {item.is_bot && (
                <TouchableOpacity style={styles.botActionBtn} onPress={() => openGerenciarBot(item)}>
                  <Text style={styles.botActionBtnText}>⚙</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleDeleteTeam(item.id)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      />

      <Button variant="primary" label="+ Adicionar Time" onPress={openNew} />

      <Button
        variant="primary"
        label={consolidarLabel}
        onPress={handleConsolidarRodada}
        disabled={consolidarDesabilitado}
      />

      <Button variant="outline" label="Voltar" onPress={() => navigation.goBack()} />

      <Modal visible={consolidando || consolidacaoLog.length > 0} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Consolidando rodada {rodadaSelecionada}…</Text>
            <ScrollView style={{ maxHeight: 300, marginVertical: 16 }}>
              {consolidacaoLog.map((msg, i) => (
                <Text key={i} style={{ color: theme.colors.text, fontSize: 13, lineHeight: 20 }}>
                  {msg}
                </Text>
              ))}
            </ScrollView>
            {!consolidando && (
              <Button variant="primary" label="Fechar" onPress={() => setConsolidacaoLog([])} />
            )}
          </View>
        </View>
      </Modal>

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

              <Text style={styles.label}>Pontuação (pts)</Text>
              <TextInput style={styles.input} value={ranking} onChangeText={setRanking} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#64748b" />

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

              {!editTeamId && (
                <Text style={styles.hint}>
                  {isBot
                    ? 'Patrimônio = orçamento atual do bot. Atualize após cada rodada processada.'
                    : `Total acumulado será calculado automaticamente conforme a modalidade da liga (${modalidade === 'patrimonio' ? 'Patrimônio' : 'Pontuação'}).`
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

              <Text style={styles.label}>Obrigar</Text>
              <View style={styles.flexRow}>
                <TextInput
                  style={[styles.input, styles.flex1]}
                  placeholder="IDs separados por vírgula"
                  placeholderTextColor={theme.colors.textMuted}
                  value={editObrigarText}
                  onChangeText={setEditObrigarText}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={() => openSearch('obrigar')}>
                  <Text style={styles.searchBtnText}>🔍</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Excluir</Text>
              <View style={styles.flexRow}>
                <TextInput
                  style={[styles.input, styles.flex1]}
                  placeholder="IDs separados por vírgula"
                  placeholderTextColor={theme.colors.textMuted}
                  value={editExcluirText}
                  onChangeText={setEditExcluirText}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={() => openSearch('excluir')}>
                  <Text style={styles.searchBtnText}>🔍</Text>
                </TouchableOpacity>
              </View>

              {botLoading && (
                <ActivityIndicator size="large" color="#22c55e" style={{ marginVertical: 24 }} />
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

      <Modal visible={showSearch} transparent animationType="slide">
        <View style={styles.searchModalOverlay}>
          <View style={styles.searchModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {searchTarget === 'obrigar' ? 'Obrigar' : 'Excluir'} — selecione o atleta
              </Text>
              <TouchableOpacity onPress={() => setShowSearch(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearch}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar por apelido..."
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
            />
            <ScrollView style={styles.modalList}>
              {filteredAtletas.length === 0 ? (
                <Text style={styles.modalEmpty}>Nenhum atleta encontrado</Text>
              ) : (
                filteredAtletas.map((a) => (
                  <TouchableOpacity
                    key={a.atleta_id}
                    style={styles.modalItem}
                    onPress={() => selectAthlete(a)}
                  >
                    <View style={styles.modalItemLeft}>
                      <Text style={styles.modalItemName}>{a.apelido}</Text>
                      <Text style={styles.modalItemDetail}>
                        {POS_MAP[a.posicao_id] || '?'} · {clubeMap[String(a.clube_id)] || a.clube_id} · C$ {a.preco_num.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={styles.modalItemId}>#{a.atleta_id}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
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
    paddingTop: theme.spacing.sm,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  editBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  editBtnText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
  title: {
    fontSize: theme.fontSize['3xl'],
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  modalidade: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    marginTop: theme.spacing.xs,
  },
  totalRow: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  totalText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.base,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  posRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pos: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    width: 36,
  },
  teamInfo: {
    flex: 1,
  },
  teamNome: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  teamProp: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  teamId: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  statsCol: {
    alignItems: 'flex-end',
    marginRight: theme.spacing.sm,
  },
  statTotal: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  statSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  removeBtn: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    paddingLeft: theme.spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    padding: theme.spacing['2xl'],
  },
  searchModalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  searchModalContent: {
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '80%',
    padding: theme.spacing.xl,
  },
  modalScroll: {
    maxHeight: '80%',
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  flexRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  flex1: {
    flex: 1,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  pickerItem: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
  },
  pickerItemSm: {
    width: 38,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
  },
  pickerActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryGlow,
  },
  pickerText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  pickerTextSm: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  pickerTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  hint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
  teamSearchBtn: {
    borderWidth: 1,
    borderColor: theme.colors.info,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  teamSearchBtnText: {
    color: theme.colors.info,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
  teamSearchArea: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  teamResults: {
    marginTop: theme.spacing.sm,
  },
  teamResultItem: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  teamResultNome: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  teamResultProp: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  teamResultId: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  teamEmpty: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.base,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing['2xl'],
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  toggleLabel: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  toggle: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.borderLight,
    padding: theme.spacing.xs,
  },
  toggleActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.text,
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
    fontSize: theme.fontSize.base,
  },
  teamActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  botActionBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  botActionBtnText: {
    fontSize: theme.fontSize.xl,
  },
  lineupActionBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  lineupActionBtnText: {
    fontSize: theme.fontSize.lg,
  },
  importActionBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  importActionBtnText: {
    fontSize: theme.fontSize.lg,
  },
  botInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  botInfoItem: {
    width: '47%',
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  botInfoLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: theme.fontWeight.semibold,
  },
  botInfoValue: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
    marginTop: theme.spacing.xs,
  },
  modalButtonsGroup: {
    marginTop: theme.spacing['2xl'],
    gap: theme.spacing.md,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: theme.colors.info,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
  pickersmTextActive: {
    color: theme.colors.info,
    fontWeight: theme.fontWeight.semibold,
  },
  focoHint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.info,
    marginBottom: theme.spacing.sm,
    fontStyle: 'italic',
  },
  pesoItem: {
    width: 52,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surfaceElevated,
  },
  pesoActive: {
    borderColor: theme.colors.info,
    backgroundColor: theme.colors.infoGlow,
  },
  rodadaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
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
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    fontSize: theme.fontSize.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalClose: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.textSecondary,
    padding: theme.spacing.xs,
  },
  modalSearch: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.borderRadius.md,
    padding: 14,
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
    borderBottomColor: theme.colors.borderLight,
  },
  modalItemLeft: {
    flex: 1,
  },
  modalItemName: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  modalItemDetail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalItemId: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.sm,
  },
});

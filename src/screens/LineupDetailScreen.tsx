import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  CartolaAthlete,
  Lineup,
  LineupEdit,
  OtimizarResponse,
  Player,
  PontuadoAthlete,
  Reserva,
  SubstituicaoResult,
  Team,
  PartidasResponse,
} from '../types';
import { deleteLineup, getLeagues, getLineupsByRodada, saveLeague, saveLineup } from '../services/storage';
import { fetchClubes, fetchPontuados, fetchPartidas, postProjetar } from '../services/api';
import { calcularSubstituicoes } from '../services/substituicaoEngine';
import { importCartolaLineup } from '../services/cartola';
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import Button from '../components/Button';
import Badge from '../components/Badge';
import SoccerField from '../components/SoccerField';
import PlayerSwapModal from '../components/PlayerSwapModal';
import { version as APP_VERSION } from '../../package.json';
import usePageTitle from '../usePageTitle';

const posicoes: Record<string, string> = {
  GOL: 'Goleiro',
  LAT: 'Lateral',
  ZAG: 'Zagueiro',
  MEI: 'Meia',
  ATA: 'Atacante',
  TEC: 'Técnico',
};

const MAX_VERSIONS = 10;

/** Empurra um snapshot do response atual para o histórico de versões (máx. 10). */
function pushVersion(lineup: Lineup, response: OtimizarResponse): OtimizarResponse[] {
  const versions = [...(lineup.versions ?? [])];
  versions.push(JSON.parse(JSON.stringify(response)));
  while (versions.length > MAX_VERSIONS) versions.shift();
  return versions;
}

const SOURCE_LABELS: Record<string, string> = {
  otimizar: 'Gerado pelo otimizador',
  import: 'Importado do Cartola',
  draft: 'Montado na mão',
  manual: 'Editado manualmente',
};

/** Re-projeta o time (titulares + técnico) e retorna o response atualizado. */
async function projetarPlayers(
  players: Player[],
  tecnico: any,
  rodada: number,
) {
  const capitaoId = players.find((p) => p.role === 'capitao')?.atleta_id;
  const result = await postProjetar({
    atletas: players.map((p) => p.atleta_id),
    tecnico_id: tecnico?.atleta_id ?? 0,
    capitao_id: capitaoId ?? 0,
    rodada,
    forcar: false,
  });
  const enrichedPlayers = players.map((p) => {
    const enriched = ((result as any).jogadores ?? (result as any).players ?? []).find(
      (j: any) => Number(j.atleta_id) === p.atleta_id,
    );
    return enriched ? { ...p, ...enriched, role: p.role } : p;
  });
  return {
    pontos_previstos: result.pontos_previstos,
    valorizacao_total: result.valorizacao_total,
    players: enrichedPlayers,
    tecnico: result.tecnico ?? tecnico,
  };
}

export default function LineupDetailScreen({ route, navigation }: any) {
  usePageTitle('Escalação');
  const { league } = route.params;
  const [lineup, setLineup] = useState(route.params.lineup);
  const { response } = lineup;
  const [pontuadosAtletas, setPontuadosAtletas] = useState<Record<string, PontuadoAthlete> | null>(null);
  const [partidasData, setPartidasData] = useState<PartidasResponse | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [substituicaoResult, setSubstituicaoResult] = useState<SubstituicaoResult | null>(null);
  const [salvandoSubstituicao, setSalvandoSubstituicao] = useState(false);
  const [projetando, setProjetando] = useState(false);
  const [showField, setShowField] = useState(false);
  const [clubeMap, setClubeMap] = useState<Record<string, string>>({});

  // ── Swap modal state ──
  const [swapVisible, setSwapVisible] = useState(false);
  const [swapPosicao, setSwapPosicao] = useState('MEI');
  const [swapApelidoAtual, setSwapApelidoAtual] = useState('');
  const [swapPrecoSaindo, setSwapPrecoSaindo] = useState(0);
  const [swapTipo, setSwapTipo] = useState<'titular' | 'reserva'>('titular');

  // ── Rival comparison (Fase 4.1) ──
  const [rivalInfo, setRivalInfo] = useState<{
    ligaNome: string;
    meuPosicao: number;
    rivales: Array<{ team: Team; direcao: 'acima' | 'abaixo'; lineup?: Lineup }>;
  } | null>(null);
  const [rivalRefresh, setRivalRefresh] = useState(0);
  const [importandoRival, setImportandoRival] = useState(false);

  useEffect(() => {
    fetchClubes()
      .then((clubes) => {
        const map: Record<string, string> = {};
        for (const [id, c] of Object.entries(clubes)) map[id] = c.nome;
        setClubeMap(map);
      })
      .catch(() => {});
  }, []);

  // ── Rival comparison (Fase 4.1) ──
  useEffect(() => {
    if (!lineup.atribuido_a_team_id) { setRivalInfo(null); return; }
    let cancelled = false;
    (async () => {
      const leagues = await getLeagues();
      if (cancelled) return;
      for (const liga of leagues) {
        const teamIdx = liga.times.findIndex((t) => t.id === lineup.atribuido_a_team_id);
        if (teamIdx === -1) continue;
        const sorted = [...liga.times].sort((a, b) =>
          liga.modalidade === 'patrimonio'
            ? b.patrimonio - a.patrimonio
            : b.total_acumulado - a.total_acumulado,
        );
        const pos = sorted.findIndex((t) => t.id === lineup.atribuido_a_team_id);
        const rivales: Array<{ team: Team; direcao: 'acima' | 'abaixo' }> = [];
        if (pos > 0) rivales.push({ team: sorted[pos - 1], direcao: 'acima' });
        if (pos < sorted.length - 1) rivales.push({ team: sorted[pos + 1], direcao: 'abaixo' });

        const lineupsRodada = await getLineupsByRodada(lineup.rodada);
        if (cancelled) return;
        const mapped = rivales.map((r) => ({
          ...r,
          lineup: lineupsRodada.find((l) => l.atribuido_a_team_id === r.team.id),
        }));
        setRivalInfo({ ligaNome: liga.nome, meuPosicao: pos + 1, rivales: mapped });
        break;
      }
    })();
    return () => { cancelled = true; };
  }, [lineup.id, lineup.atribuido_a_team_id, lineup.rodada, rivalRefresh]);

  // ── Swap modal handlers ──
  const openSwap = (posicao: string, apelido: string, preco: number, tipo: 'titular' | 'reserva') => {
    setSwapPosicao(posicao);
    setSwapApelidoAtual(apelido);
    setSwapPrecoSaindo(preco);
    setSwapTipo(tipo);
    setSwapVisible(true);
  };

  const handleSwapConfirm = async (athlete: CartolaAthlete) => {
    setSwapVisible(false);
    const versions = pushVersion(lineup, response);
    const edit: LineupEdit = {
      tipo: 'swap',
      ts: Date.now(),
      posicao: swapPosicao,
    };

    let novosPlayers = [...response.players];
    let novasReservas = { ...response.reservas };

    if (swapTipo === 'titular') {
      const idx = novosPlayers.findIndex((p) => p.posicao === swapPosicao);
      if (idx === -1) return;
      const antigo = novosPlayers[idx];

      edit.jogador_removido = {
        atleta_id: antigo.atleta_id, apelido: antigo.apelido, posicao: antigo.posicao,
        preco: antigo.preco, previsto: antigo.previsto, clube: antigo.clube, role: antigo.role,
        media_num: antigo.media_num, jogos_num: antigo.jogos_num, variacao_num: antigo.variacao_num,
        potential_valorizacao: antigo.potential_valorizacao, preco_projetado: antigo.preco_projetado,
        tendencia: antigo.tendencia, eficiencia: antigo.eficiencia,
      };
      const novoClube = clubeMap[String(athlete.clube_id)] || String(athlete.clube_id);
      edit.jogador_adicionado = {
        atleta_id: athlete.atleta_id, apelido: athlete.apelido, posicao: antigo.posicao,
        preco: athlete.preco_num, previsto: athlete.media_num, clube: novoClube,
        role: antigo.role, media_num: athlete.media_num, jogos_num: athlete.jogos_num,
        variacao_num: athlete.variacao_num, potential_valorizacao: athlete.potential_valorizacao,
      };

      novosPlayers[idx] = {
        ...antigo,
        atleta_id: athlete.atleta_id, apelido: athlete.apelido,
        preco: athlete.preco_num, previsto: athlete.media_num,
        clube: novoClube, media_num: athlete.media_num, jogos_num: athlete.jogos_num,
        variacao_num: athlete.variacao_num, preco_projetado: athlete.preco_num,
        potential_valorizacao: athlete.potential_valorizacao,
      };

      novasReservas[swapPosicao] = {
        atleta_id: antigo.atleta_id, apelido: antigo.apelido, clube: antigo.clube,
        posicao: swapPosicao, preco: antigo.preco, previsto: antigo.previsto,
        media_num: antigo.media_num ?? 0, jogos_num: antigo.jogos_num ?? 0,
        variacao_num: 0, potential_valorizacao: 0, preco_projetado: antigo.preco,
        tendencia: '', eficiencia: 0, luxo: novasReservas[swapPosicao]?.luxo ?? false,
      };
    } else {
      const antigo = novasReservas[swapPosicao];
      if (!antigo) return;
      const novoClube = clubeMap[String(athlete.clube_id)] || String(athlete.clube_id);

      edit.jogador_removido = {
        atleta_id: antigo.atleta_id, apelido: antigo.apelido, posicao: antigo.posicao,
        preco: antigo.preco, previsto: antigo.previsto, clube: antigo.clube,
        media_num: antigo.media_num, jogos_num: antigo.jogos_num, variacao_num: antigo.variacao_num,
        potential_valorizacao: antigo.potential_valorizacao, preco_projetado: antigo.preco_projetado,
        tendencia: antigo.tendencia, eficiencia: antigo.eficiencia,
      };
      edit.jogador_adicionado = {
        atleta_id: athlete.atleta_id, apelido: athlete.apelido, posicao: swapPosicao,
        preco: athlete.preco_num, previsto: athlete.media_num, clube: novoClube,
      };

      novasReservas[swapPosicao] = {
        atleta_id: athlete.atleta_id, apelido: athlete.apelido, clube: novoClube,
        posicao: swapPosicao, preco: athlete.preco_num, previsto: athlete.media_num,
        media_num: athlete.media_num, jogos_num: athlete.jogos_num,
        variacao_num: athlete.variacao_num, potential_valorizacao: athlete.potential_valorizacao,
        preco_projetado: athlete.preco_num, tendencia: '', eficiencia: 0, luxo: antigo.luxo,
      };
    }

    const updatedResponse = { ...response, players: novosPlayers, reservas: novasReservas };
    const edits = [...(lineup.edits ?? []), edit];
    const newLineup = { ...lineup, response: updatedResponse, edits, versions, source: lineup.source ?? 'manual' as const };

    try {
      const enriched = await projetarPlayers(novosPlayers, response.tecnico, lineup.rodada);
      Object.assign(updatedResponse, enriched);
    } catch {}

    await saveLineup(newLineup);
    setLineup(newLineup);
  };

  // ── Captain change ──
  const handleCaptainChange = async (player: Player) => {
    Alert.alert(
      'Novo capitão',
      `Tornar ${player.apelido} o capitão? Os pontos serão multiplicados por 1.5.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            const versions = pushVersion(lineup, response);
            const antigoCapId = response.players.find((p) => p.role === 'capitao')?.atleta_id;
            const novosPlayers = response.players.map((p) => ({
              ...p,
              role: (p.atleta_id === player.atleta_id ? 'capitao' as const
                : p.atleta_id === antigoCapId ? undefined : p.role) as 'capitao' | undefined,
            }));

            const edit: LineupEdit = {
              tipo: 'capitao', ts: Date.now(),
              capitao_anterior_id: antigoCapId, capitao_novo_id: player.atleta_id,
            };

            const updatedResponse = { ...response, players: novosPlayers };
            const edits = [...(lineup.edits ?? []), edit];
            const newLineup = { ...lineup, response: updatedResponse, edits, versions, source: 'manual' as const };

            try {
              const enriched = await projetarPlayers(novosPlayers, response.tecnico, lineup.rodada);
              Object.assign(updatedResponse, enriched);
            } catch {}

            await saveLineup(newLineup);
            setLineup(newLineup);
          },
        },
      ],
    );
  };

  // ── Undo last edit ──
  const handleUndo = async () => {
    const edits = lineup.edits ?? [];
    if (edits.length === 0) return;
    const last = edits[edits.length - 1];
    const restante = edits.slice(0, -1);
    const versions = [...(lineup.versions ?? [])];
    versions.pop(); // remove the snapshot that corresponded to this edit

    if (last.tipo === 'swap' && last.jogador_removido && last.jogador_adicionado) {
      const removido = last.jogador_removido;
      const adicionado = last.jogador_adicionado;
      let novosPlayers = [...response.players];
      let novasReservas = { ...response.reservas };

      const idx = novosPlayers.findIndex((p) => p.atleta_id === adicionado.atleta_id);
      if (idx !== -1) {
        // Undo titular swap
        novosPlayers[idx] = {
          ...novosPlayers[idx],
          atleta_id: removido.atleta_id, apelido: removido.apelido, preco: removido.preco,
          previsto: removido.previsto, clube: removido.clube, role: removido.role,
          media_num: removido.media_num, jogos_num: removido.jogos_num,
          variacao_num: removido.variacao_num, potential_valorizacao: removido.potential_valorizacao,
          preco_projetado: removido.preco_projetado, tendencia: removido.tendencia,
          eficiencia: removido.eficiencia,
        };
        const pos = last.posicao!;
        novasReservas[pos] = {
          atleta_id: adicionado.atleta_id, apelido: adicionado.apelido, clube: adicionado.clube,
          posicao: adicionado.posicao, preco: adicionado.preco, previsto: adicionado.previsto,
          media_num: 0, jogos_num: 0, variacao_num: 0, potential_valorizacao: 0,
          preco_projetado: adicionado.preco, tendencia: '', eficiencia: 0,
          luxo: novasReservas[pos]?.luxo ?? false,
        };
      } else {
        // Undo reserva swap
        const pos = last.posicao!;
        novasReservas[pos] = {
          atleta_id: removido.atleta_id, apelido: removido.apelido, clube: removido.clube,
          posicao: removido.posicao, preco: removido.preco, previsto: removido.previsto,
          media_num: removido.media_num ?? 0, jogos_num: removido.jogos_num ?? 0,
          variacao_num: removido.variacao_num ?? 0, potential_valorizacao: removido.potential_valorizacao ?? 0,
          preco_projetado: removido.preco_projetado ?? removido.preco,
          tendencia: removido.tendencia ?? '', eficiencia: removido.eficiencia ?? 0,
          luxo: novasReservas[pos]?.luxo ?? false,
        };
      }

      const updatedResponse = { ...response, players: novosPlayers, reservas: novasReservas };
      const newLineup = { ...lineup, response: updatedResponse, edits: restante, versions };
      try { Object.assign(updatedResponse, await projetarPlayers(novosPlayers, response.tecnico, lineup.rodada)); } catch {}
      await saveLineup(newLineup);
      setLineup(newLineup);
    } else if (last.tipo === 'capitao' && last.capitao_anterior_id != null && last.capitao_novo_id != null) {
      let novosPlayers = response.players.map((p) => ({
        ...p,
        role: (p.atleta_id === last.capitao_novo_id ? undefined
          : p.atleta_id === last.capitao_anterior_id ? 'capitao' as const : p.role) as 'capitao' | undefined,
      }));
      const updatedResponse = { ...response, players: novosPlayers };
      const newLineup = { ...lineup, response: updatedResponse, edits: restante, versions };
      try { Object.assign(updatedResponse, await projetarPlayers(novosPlayers, response.tecnico, lineup.rodada)); } catch {}
      await saveLineup(newLineup);
      setLineup(newLineup);
    }
  };

  // ── Existing handlers ──
  const handleProjetar = async () => {
    setProjetando(true);
    try {
      const versions = pushVersion(lineup, response);
      const enriched = await projetarPlayers(response.players, response.tecnico, lineup.rodada);
      const updatedResponse = { ...response, ...enriched };
      const updatedLineup = { ...lineup, response: updatedResponse, versions };
      await saveLineup(updatedLineup);
      setLineup(updatedLineup);
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar as projeções.');
    } finally {
      setProjetando(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteModal(false);
    await deleteLineup(lineup.id);
    handleVoltar();
  };

  // ── Restore version (Fase 4.2) ──
  const handleRestoreVersion = async (index: number) => {
    const versions = lineup.versions ?? [];
    const target = versions[index];
    if (!target) return;
    const novasVersions = versions.slice(0, index);
    // Restaura a estrutura; marca como editada manualmente (nunca reescreve pontuações reais).
    const newLineup = {
      ...lineup,
      response: JSON.parse(JSON.stringify(target)),
      versions: novasVersions,
      source: 'manual' as const,
      projetado: true,
    };
    await saveLineup(newLineup);
    setLineup(newLineup);
  };

  // ── Import rival lineup (Fase 4.1) ──
  const handleImportRival = async (team: Team) => {
    if (!team.time_id) {
      Alert.alert('Sem time_id', 'Este time não possui time_id do Cartola para importar.');
      return;
    }
    setImportandoRival(true);
    try {
      const lineupRival = await importCartolaLineup(team.time_id, lineup.rodada, {
        atribuido_a_team_id: team.id,
        nome: `${team.nome} (R${lineup.rodada})`,
      });
      await saveLineup(lineupRival);
      setRivalRefresh((k) => k + 1);
      Alert.alert('Importado', `Escalação de ${team.nome} importada e projetada.`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível importar a escalação do rival.');
    } finally {
      setImportandoRival(false);
    }
  };

  const handleExportJson = async () => {
    const payload = {
      ...response,
      params: lineup.params,
      nome: lineup.nome,
      rodada: lineup.rodada,
      edits: lineup.edits,
      versions: lineup.versions,
      source: lineup.source,
    };
    try {
      await Clipboard.setStringAsync(JSON.stringify(payload, null, 2));
      Alert.alert('Exportado', 'JSON copiado para a área de transferência');
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar o JSON');
    }
  };

  const handleExportTxt = async () => {
    const capitao = response.players.find((p: Player) => p.role === 'capitao');
    const posOrder = ['GOL', 'LAT', 'ZAG', 'MEI', 'ATA'];
    const posLabel: Record<string, string> = { GOL: 'Goleiro', LAT: 'Laterais', ZAG: 'Zagueiros', MEI: 'Meias', ATA: 'Atacantes' };

    let text = `═ ESCALAÇÃO: ${lineup.nome} ═\n\n`;
    text += `Rodada ${lineup.rodada}  |  ${response.formacao}  |  C$ ${response.orcamento_usado?.toFixed(2)}\n`;
    text += `${response.pontos_previstos?.toFixed(1)} pts previstos`;
    if (response.valorizacao_total) text += `  |  +${response.valorizacao_total.toFixed(2)}% valorização`;
    text += `\n\n`;

    for (const pos of posOrder) {
      const players = response.players.filter((p: Player) => p.posicao === pos);
      if (players.length === 0) continue;
      text += `▸ ${posLabel[pos]}\n`;
      for (const p of players) {
        const isCap = p.atleta_id === capitao?.atleta_id;
        text += `  ${p.apelido} (${p.clube}) — C$ ${p.preco?.toFixed(2)} — ${p.previsto?.toFixed(1)} pts${isCap ? ' 👑' : ''}\n`;
      }
      text += '\n';
    }

    if (response.tecnico) {
      const t = response.tecnico;
      text += `▸ Técnico\n  ${t.apelido} (${t.clube}) — C$ ${t.preco?.toFixed(2)} — ${t.previsto?.toFixed(1)} pts\n\n`;
    }

    if (response.reservas && Object.keys(response.reservas).length > 0) {
      text += `▸ Reservas\n`;
      for (const [pos, r] of Object.entries(response.reservas)) {
        const rv = r as Reserva;
        text += `  ${posLabel[pos] || pos}: ${rv.apelido} (${rv.clube}) — C$ ${rv.preco?.toFixed(2)} — ${rv.previsto?.toFixed(1)} pts${rv.luxo ? ' 💎' : ''}\n`;
      }
      text += '\n';
    }

    if (response.comparacao?.length > 1) {
      text += `▸ Comparação de formações\n`;
      for (const c of response.comparacao) {
        text += `  ${c.formacao}: ${c.pontos_previstos?.toFixed(1)} pts | C$ ${c.orcamento_usado?.toFixed(2)}\n`;
      }
      text += '\n';
    }

    text += `─\nGerado por EscalarML v${APP_VERSION}\n`;

    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(text);
        Alert.alert('Copiado', 'Texto copiado! Cole no WhatsApp.');
      } else {
        const uri = FileSystem.cacheDirectory + `escalacao_${lineup.rodada}_${Date.now()}.txt`;
        await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Compartilhar escalação' });
      }
    } catch {
      await Clipboard.setStringAsync(text);
      Alert.alert('Texto copiado', 'Não foi possível compartilhar o arquivo. O texto foi copiado para a área de transferência.');
    }
  };

  const handleVoltar = () => { navigation.goBack(); };

  const handleSimularSubstituicao = () => {
    if (!pontuadosAtletas || !partidasData) {
      Alert.alert('Aguardando', 'Carregando dados de pontuação...');
      return;
    }
    const result = calcularSubstituicoes(lineup, pontuadosAtletas, partidasData.partidas, partidasData.clubes);
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
      const versions = pushVersion(lineup, response);
      const novosPlayers = [...response.players];
      const novasReservas = { ...response.reservas };

      for (const sub of substituicaoResult.substituicoes) {
        const idx = novosPlayers.findIndex((p) => p.atleta_id === sub.substituido_id);
        if (idx === -1) continue;
        const substituto = novasReservas[sub.posicao];
        if (!substituto) continue;
        const substituido = novosPlayers[idx];

        novosPlayers[idx] = {
          atleta_id: substituto.atleta_id, apelido: substituto.apelido, posicao: substituto.posicao,
          preco: substituto.preco, previsto: substituto.previsto, clube: substituto.clube,
          role: substituido.role === 'capitao' ? 'capitao' : undefined,
          media_num: substituto.media_num, jogos_num: substituto.jogos_num,
          variacao_num: substituto.variacao_num, potential_valorizacao: substituto.potential_valorizacao,
          preco_projetado: substituto.preco_projetado, tendencia: substituto.tendencia,
          eficiencia: substituto.eficiencia,
        };

        novasReservas[sub.posicao] = {
          atleta_id: substituido.atleta_id, apelido: substituido.apelido,
          clube: substituido.clube, posicao: substituido.posicao,
          preco: substituido.preco, previsto: 0, media_num: 0, jogos_num: 0,
          variacao_num: 0, potential_valorizacao: 0, preco_projetado: 0,
          tendencia: '', eficiencia: 0, luxo: sub.motivo === 'reserva_luxo',
        };
      }

      const novoOrcamento = response.orcamento_usado + substituicaoResult.patrimonio_ajuste;
      const updatedResponse = {
        ...response, players: novosPlayers, reservas: novasReservas,
        pontos_previstos: substituicaoResult.pontos_finais, orcamento_usado: novoOrcamento,
        substituicao: substituicaoResult,
      };
      const updatedLineup = {
        ...lineup,
        versions,
        params: lineup.params ? { ...lineup.params, orcamento: novoOrcamento } : undefined,
        response: updatedResponse,
      };

      await saveLineup(updatedLineup);

      try {
        const enriched = await projetarPlayers(novosPlayers, response.tecnico, lineup.rodada);
        Object.assign(updatedResponse, enriched);
        updatedLineup.response = updatedResponse;
        await saveLineup(updatedLineup);
      } catch {}

      if (lineup.atribuido_a_team_id) {
        const todosTitulares = [...novosPlayers, ...(response.tecnico ? [response.tecnico] : [])];
        const valorizacaoTotal = todosTitulares.reduce((sum, p) => sum + Math.max(0, p.variacao_num ?? 0), 0);
        const capId = novosPlayers.find((p) => p.role === 'capitao')?.atleta_id;
        const ptsCom = (id: number) => { const pts = getPontuacao(id) ?? 0; return id === capId ? pts * 1.5 : pts; };
        const pontuacaoTotal = todosTitulares.reduce((sum, p) => sum + ptsCom(p.atleta_id), 0);

        const leagues = await getLeagues();
        for (const liga of leagues) {
          const teamIdx = liga.times.findIndex((t) => t.id === lineup.atribuido_a_team_id);
          if (teamIdx === -1) continue;
          const team = { ...liga.times[teamIdx] };
          team.patrimonio += valorizacaoTotal;
          team.ranking = liga.modalidade === 'patrimonio' ? team.patrimonio : team.ranking + pontuacaoTotal;
          team.total_acumulado = liga.modalidade === 'patrimonio' ? team.patrimonio : team.ranking;
          const updatedTimes = [...liga.times]; updatedTimes[teamIdx] = team;
          await saveLeague({ ...liga, times: updatedTimes }); break;
        }
      }

      Alert.alert('Salvo', 'Substituições aplicadas e salvas com sucesso!');
      setLineup(updatedLineup);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as substituições.');
    } finally {
      setSalvandoSubstituicao(false);
    }
  };

  // ── Data fetch ──
  useEffect(() => {
    setSubstituicaoResult(response.substituicao ?? null);
    setPontuadosAtletas(null);
    setPartidasData(null);
    fetchPontuados(lineup.rodada)
      .then((data) => setPontuadosAtletas(data.atletas))
      .catch(() => {});
    fetchPartidas(lineup.rodada)
      .then(setPartidasData)
      .catch(() => {});
  }, [lineup.id]);

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

  const getDuelo = (clube: string): string | null => clubOpponents[clube] ?? null;

  const capitaoId = response.players.find((p) => p.role === 'capitao')?.atleta_id;
  const ptsComBonus = (atleta_id: number): number => {
    const pts = getPontuacao(atleta_id) ?? 0;
    return atleta_id === capitaoId ? pts * 1.5 : pts;
  };

  const allPlayers = [...response.players, ...(response.tecnico ? [response.tecnico] : [])];
  const totalReal = hasPontuados
    ? (substituicaoResult?.pontos_finais ?? allPlayers.reduce((sum, p) => sum + ptsComBonus(p.atleta_id), 0))
    : null;

  const substituidoIds = new Set(substituicaoResult?.substituicoes.map((s) => s.substituido_id) ?? []);
  const substitutoIds = new Set(substituicaoResult?.substituicoes.map((s) => s.substituto_id) ?? []);

  const edits = lineup.edits ?? [];
  const podeDesfazer = edits.length > 0 && !substituicaoResult;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Card style={styles.resultHeader}>
        <Text style={styles.resultTitle}>{lineup.nome}</Text>
        <Text style={styles.resultRodada}>Rodada {lineup.rodada}</Text>
        <Text style={styles.resultEsquema}>Esquema tático: {response.formacao}</Text>
        <Text style={styles.resultFormacao}>
          Proj: {response.pontos_previstos.toFixed(1)} pts
          {totalReal !== null ? ` · Real: ${totalReal.toFixed(1)} pts` : ''}
        </Text>
        <Text style={styles.resultOrcamento}>
          C$ {response.orcamento_usado.toFixed(2)} usados
          {lineup.params?.orcamento != null ? ` (patrimônio C$ ${lineup.params.orcamento.toFixed(2)})` : ''}
          {response.valorizacao_total != null ? ` · Val: ${response.valorizacao_total >= 0 ? '+' : ''}C$ ${response.valorizacao_total.toFixed(2)}` : ''}
        </Text>
        {lineup.source && (
          <Badge variant={lineup.source === 'import' ? 'accent' : lineup.source === 'otimizar' ? 'primary' : 'info'}
            label={SOURCE_LABELS[lineup.source] ?? lineup.source} size="md" />
        )}
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
              <Text style={styles.paramsValue}>{lineup.params.perfil.charAt(0).toUpperCase() + lineup.params.perfil.slice(1)}</Text>
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

      {rivalInfo && (
        <Card style={styles.rivalCard}>
          <SectionHeader
            label={`Duelo · ${rivalInfo.ligaNome}`}
            action={
              <Text style={styles.rivalPos}>{rivalInfo.meuPosicao}º</Text>
            }
          />
          {importandoRival && (
            <View style={styles.rivalImporting}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.rivalImportingText}>Importando escalação do rival...</Text>
            </View>
          )}
          {rivalInfo.rivales.map((r) => {
            const meuPts = response.pontos_previstos;
            const rivalPts = r.lineup?.response?.pontos_previstos ?? null;
            const dif = rivalPts != null ? meuPts - rivalPts : null;
            return (
              <View key={r.team.id} style={styles.rivalRow}>
                <View style={styles.rivalInfo}>
                  <Text style={styles.rivalName}>
                    {r.direcao === 'acima' ? '⬆ ' : '⬇ '}{r.team.nome}
                  </Text>
                  <Text style={styles.rivalDetail}>
                    {r.team.proprietario}
                    {r.lineup?.response?.orcamento_usado != null
                      ? ` · C$ ${r.lineup.response.orcamento_usado.toFixed(2)}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.rivalRight}>
                  {rivalPts != null ? (
                    <>
                      <Text style={[styles.rivalPts, dif != null && dif >= 0 ? styles.rivalPtsWin : styles.rivalPtsLose]}>
                        {rivalPts.toFixed(1)} pts
                      </Text>
                      <Text style={styles.rivalDiff}>
                        {dif != null ? (dif >= 0 ? `+${dif.toFixed(1)}` : dif.toFixed(1)) : ''} vs você
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.rivalPtsPlaceholder}>sem escalação</Text>
                      <TouchableOpacity
                        style={styles.rivalImportBtn}
                        onPress={() => handleImportRival(r.team)}
                        disabled={importandoRival}
                      >
                        <Text style={styles.rivalImportBtnText}>📥 Importar</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {lineup.versions && lineup.versions.length > 0 && (
        <Card style={styles.editHistoryCard}>
          <Text style={styles.paramsTitle}>Versões anteriores</Text>
          {lineup.versions.map((v: OtimizarResponse, i: number) => (
            <View key={i} style={styles.versionRow}>
              <View style={styles.versionInfo}>
                <Text style={styles.versionText}>
                  v{lineup.versions!.length - i} · {v.formacao} · {v.pontos_previstos != null ? v.pontos_previstos.toFixed(1) : '—'} pts
                </Text>
                <Text style={styles.versionDetail}>
                  C$ {v.orcamento_usado != null ? v.orcamento_usado.toFixed(2) : '—'}
                  {v.valorizacao_total != null ? ` · Val ${v.valorizacao_total >= 0 ? '+' : ''}C$ ${v.valorizacao_total.toFixed(2)}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={() => handleRestoreVersion(i)}
              >
                <Text style={styles.restoreBtnText}>↩ Restaurar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      )}

      {edits.length > 0 && (
        <Card style={styles.editHistoryCard}>
          <View style={styles.editHistoryRow}>
            <Text style={styles.editHistoryTitle}>{edits.length} edição{edits.length > 1 ? 'ões' : ''}</Text>
            {podeDesfazer && (
              <TouchableOpacity style={styles.undoBtn} onPress={handleUndo}>
                <Text style={styles.undoBtnText}>↩ Desfazer</Text>
              </TouchableOpacity>
            )}
          </View>
          {edits.slice(-3).reverse().map((e, i) => (
            <View key={e.ts + i} style={styles.editHistoryItem}>
              <Text style={styles.editHistoryText}>
                {e.tipo === 'swap'
                  ? `⇄ Trocou ${e.jogador_adicionado?.apelido ?? '?'} por ${e.jogador_removido?.apelido ?? '?'} (${e.posicao})`
                  : `⭐ ${e.capitao_novo_id ? 'Novo capitão' : 'Capitão alterado'}`
                }
              </Text>
              <Text style={styles.editHistoryTime}>
                {new Date(e.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))}
        </Card>
      )}

      <View style={styles.viewToggle}>
        <TouchableOpacity style={[styles.viewToggleBtn, !showField && styles.viewToggleActive]} onPress={() => setShowField(false)}>
          <Text style={[styles.viewToggleText, !showField && styles.viewToggleTextActive]}>Lista</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.viewToggleBtn, showField && styles.viewToggleActive]} onPress={() => setShowField(true)}>
          <Text style={[styles.viewToggleText, showField && styles.viewToggleTextActive]}>Campo</Text>
        </TouchableOpacity>
      </View>

      {showField ? (
        <SoccerField players={response.players} formacao={response.formacao} tecnico={response.tecnico} reservas={response.reservas} />
      ) : (
      <><SectionHeader label="Titulares" />
      {response.players.map((p: Player) => {
        const pts = getPontuacao(p.atleta_id);
        const foiSubstituido = substituidoIds.has(p.atleta_id);
        const isSubstituto = substitutoIds.has(p.atleta_id);
        const isCap = p.role === 'capitao';
        const borderColor = foiSubstituido ? theme.colors.danger : isSubstituto ? theme.colors.primary : undefined;

        return (
          <Card key={p.atleta_id} style={[styles.playerCard, borderColor ? { borderColor, borderWidth: 1.5 } : undefined]}>
            <View style={styles.playerTop}>
              <View style={{ flex: 1 }}>
                <View style={styles.playerPosRow}>
                  <Text style={styles.playerPos}>{posicoes[p.posicao] || p.posicao}</Text>
                  {entrouEmCampo(p.atleta_id) === false && hasPontuados && <Badge variant="danger" label="NÃO JOGOU" size="sm" />}
                  {foiSubstituido && <Badge variant="danger" label="SUBSTITUÍDO" size="sm" />}
                  {isSubstituto && <Badge variant="primary" label="ENTROU" size="sm" />}
                </View>
                <View style={styles.playerNameRow}>
                  <Text style={[styles.playerName, foiSubstituido ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined]}>
                    {p.apelido} · {p.clube}
                  </Text>
                  {isCap && (
                    <TouchableOpacity style={styles.captainBtn} onPress={() => handleCaptainChange(p)}>
                      <Text style={styles.captainBtnText}>⭐</Text>
                    </TouchableOpacity>
                  )}
                  {!isCap && <Text style={styles.captainDim}> ☆</Text>}
                </View>
                {getDuelo(p.clube) && <Text style={styles.dueloText}>{getDuelo(p.clube)}</Text>}
              </View>
              <View style={styles.playerActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openSwap(p.posicao, p.apelido, p.preco, 'titular')}>
                  <Text style={styles.actionBtnText}>⇄</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Justificar', { apelido: p.apelido, atleta_id: p.atleta_id, clube: p.clube })}>
                  <Text style={styles.actionBtnText}>i</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.playerStats}>
              <View style={styles.playerStat}>
                <Text style={styles.playerStatValue}>C$ {p.preco.toFixed(2)}</Text>
                <Text style={styles.playerStatLabel}>Preço</Text>
              </View>
              <View style={styles.playerStat}>
                <Text style={styles.playerStatValue}>
                  {p.previsto.toFixed(1)}
                  {pts !== null ? ` (${isCap ? (pts * 1.5).toFixed(1) : pts.toFixed(1)})` : ''}
                </Text>
                <Text style={styles.playerStatLabel}>Projeção</Text>
              </View>
              <View style={styles.playerStat}>
                <Text style={[styles.playerStatValue, { color: theme.colors.info }]}>
                  {p.preco_projetado != null ? `${(p.preco_projetado - p.preco) >= 0 ? '+' : ''}C$ ${(p.preco_projetado - p.preco).toFixed(2)}` : '—'}
                </Text>
                <Text style={styles.playerStatLabel}>Valorização</Text>
              </View>
              {p.upside_score != null && (
                <View style={styles.playerStat}>
                  <Text style={[styles.playerStatValue, { color: theme.colors.accent }]}>{p.upside_score.toFixed(1)}</Text>
                  <Text style={styles.playerStatLabel}>Upside</Text>
                </View>
              )}
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
                  <Text style={styles.tecnicoName}>{response.tecnico.apelido} · {response.tecnico.clube}</Text>
                  {getDuelo(response.tecnico.clube) && <Text style={styles.dueloText}>{getDuelo(response.tecnico.clube)}</Text>}
                </View>
                <View style={styles.playerRight}>
                  <Text style={styles.playerClub}>C$ {response.tecnico.preco.toFixed(2)}</Text>
                  <Text style={styles.tecnicoPts}>{response.tecnico.previsto.toFixed(1)}{pts !== null ? ` (${pts.toFixed(1)})` : ''} pts</Text>
                </View>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Justificar', { apelido: response.tecnico.apelido, atleta_id: response.tecnico.atleta_id, clube: response.tecnico.clube })}>
                  <Text style={styles.actionBtnText}>i</Text>
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
            {substituicaoResult && substituicaoResult.pontos_finais !== totalReal ? ` → ${substituicaoResult.pontos_finais.toFixed(1)} pts` : ''}
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
                  <View style={{ flex: 1 }}>
                    <View style={styles.playerPosRow}>
                      <Text style={styles.reservaPos}>{posicoes[pos] || pos}</Text>
                      {reserva.luxo && <Badge variant="accent" label="LUXO" size="sm" />}
                    </View>
                    <Text style={styles.reservaName}>{reserva.apelido} · {reserva.clube}</Text>
                    {getDuelo(reserva.clube) && <Text style={styles.dueloText}>{getDuelo(reserva.clube)}</Text>}
                  </View>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openSwap(pos, reserva.apelido, reserva.preco, 'reserva')}>
                    <Text style={styles.actionBtnText}>⇄</Text>
                  </TouchableOpacity>
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
                  {reserva.upside_score != null && (
                    <View style={styles.playerStat}>
                      <Text style={[styles.playerStatValue, { color: theme.colors.accent }]}>{reserva.upside_score.toFixed(1)}</Text>
                      <Text style={styles.playerStatLabel}>Upside</Text>
                    </View>
                  )}
                </View>
              </Card>
            );
          })}
        </>
      )}
      </>)}  {/********** end of showField else / lista view **********/}

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
                <Badge variant={s.motivo === 'nao_jogou' ? 'danger' : 'accent'} label={s.motivo === 'nao_jogou' ? 'NÃO JOGOU' : 'RESERVA LUXO'} />
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
          <Button variant="primary" label={salvandoSubstituicao ? 'Salvando...' : 'Salvar substituição'} onPress={handleSalvarSubstituicao} disabled={salvandoSubstituicao} />
        </>
      )}

      {hasPontuados && !substituicaoResult && (
        <Button variant="primary" label="Simular substituição" onPress={handleSimularSubstituicao} />
      )}

      <Button variant="outline" label={projetando ? "Projetando..." : "Atualizar projeções"} onPress={handleProjetar} disabled={projetando} />

      <Button variant="primary" label="Gerar nova escalação"
        onPress={() => {
          const params = {
            rodada: lineup.rodada, nome: `Nova ${lineup.nome}`,
            orcamento: String(lineup.params?.orcamento ?? 100),
            formacao: lineup.params?.formacao ?? 'auto',
            perfil: lineup.params?.perfil ?? 'neutro',
            foco: lineup.params?.foco ?? 1.0,
            incluir_duvidosos: lineup.params?.incluir_duvidosos ?? false,
            reserva_luxo: lineup.params?.reserva_luxo ?? true,
            obrigarText: (lineup.params?.obrigar ?? []).join(','),
            excluirText: (lineup.params?.excluir ?? []).join(','),
          };
          if (league) navigation.getParent()?.navigate('Escalações', { screen: 'NewLineup', params });
          else navigation.navigate('NewLineup', params);
        }}
      />

      <Button variant="outline" label="Exportar JSON" onPress={handleExportJson} />
      <Button variant="outline" label="Compartilhar" onPress={handleExportTxt} />

      <View style={styles.bottomButtons}>
        <Button variant="outline" label="Voltar" onPress={handleVoltar} />
        <Button variant="danger" label="Excluir escalação" onPress={() => setShowDeleteModal(true)} />
      </View>

      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Excluir escalação</Text>
            <Text style={styles.modalMsg}>Tem certeza que deseja excluir "{lineup.nome}"?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleDelete}>
                <Text style={styles.modalConfirmText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PlayerSwapModal
        visible={swapVisible}
        posicao={swapPosicao}
        apelidoAtual={swapApelidoAtual}
        precoSaindo={swapPrecoSaindo}
        orcamentoUsado={response.orcamento_usado}
        orcamentoMax={lineup.params?.orcamento}
        onClose={() => setSwapVisible(false)}
        onConfirm={handleSwapConfirm}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  inner: { padding: theme.spacing.xl, paddingBottom: 40 },
  resultHeader: { alignItems: 'center', marginBottom: theme.spacing['2xl'] },
  paramsBox: { marginBottom: theme.spacing.lg },
  paramsTitle: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: theme.letterSpacing.wider, marginBottom: theme.spacing.md },
  paramsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  paramsLabel: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.textSecondary },
  paramsValue: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.text, fontWeight: theme.fontWeight.semibold },
  resultTitle: { fontFamily: theme.fonts.heading, fontSize: theme.fontSize['2xl'], color: theme.colors.text, marginBottom: theme.spacing.xs, letterSpacing: theme.letterSpacing.tight },
  resultRodada: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  resultFormacao: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.textSecondary },
  resultEsquema: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.primary, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.xs },
  resultOrcamento: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  editHistoryCard: { marginBottom: theme.spacing.md, paddingVertical: theme.spacing.md },
  editHistoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
  editHistoryTitle: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.semibold },
  undoBtn: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.sm, borderWidth: 1, borderColor: theme.colors.warning, backgroundColor: 'rgba(210,153,34,0.1)' },
  undoBtnText: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, color: theme.colors.warning, fontWeight: theme.fontWeight.semibold },
  editHistoryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.xs },
  editHistoryText: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, flex: 1 },
  editHistoryTime: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginLeft: theme.spacing.sm },
  playerCard: { marginBottom: theme.spacing.sm },
  tecnicoCard: { marginBottom: theme.spacing.sm },
  tecnicoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tecnicoName: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.md, color: theme.colors.text, fontWeight: theme.fontWeight.semibold },
  playerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md },
  playerPosRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
  playerPos: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.xs, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: theme.letterSpacing.wide },
  playerNameRow: { flexDirection: 'row', alignItems: 'center' },
  playerName: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.md, color: theme.colors.text, fontWeight: theme.fontWeight.semibold, marginTop: theme.spacing.xs },
  captainBtn: { padding: 2 },
  captainBtnText: { fontSize: theme.fontSize.lg },
  captainDim: { fontSize: theme.fontSize.lg, color: theme.colors.textMuted },
  playerActions: { flexDirection: 'row', gap: theme.spacing.xs },
  actionBtn: { width: 26, height: 26, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold },
  playerStats: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md },
  playerStat: { alignItems: 'center' },
  playerStatValue: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.primary, fontWeight: theme.fontWeight.bold },
  playerStatLabel: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: theme.spacing.xs, textTransform: 'uppercase', letterSpacing: theme.letterSpacing.wide },
  playerRight: { alignItems: 'flex-end' },
  playerClub: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  tecnicoPts: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.spacing.md },
  totalLabel: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  totalValue: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, color: theme.colors.primary },
  dueloText: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.xs, color: theme.colors.warning, marginTop: theme.spacing.xs, fontWeight: theme.fontWeight.medium },
  reservaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md },
  reservaPos: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.xs, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: theme.letterSpacing.wide },
  reservaName: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.md, color: theme.colors.text, fontWeight: theme.fontWeight.semibold, marginTop: theme.spacing.xs },
  reservaStats: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md },
  compRow: { flexDirection: 'row', justifyContent: 'space-between' },
  compFormacao: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.text },
  compPts: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.primary, fontWeight: theme.fontWeight.semibold },
  modalOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'center', alignItems: 'center', padding: theme.spacing['3xl'] },
  modalContent: { backgroundColor: theme.colors.surfaceElevated, borderRadius: theme.borderRadius.xl, padding: theme.spacing['2xl'], width: '100%', maxWidth: 340, borderWidth: 1, borderColor: theme.colors.border },
  modalTitle: { fontFamily: theme.fonts.heading, fontSize: theme.fontSize.xl, color: theme.colors.text, marginBottom: theme.spacing.sm, letterSpacing: theme.letterSpacing.tight },
  modalMsg: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.textSecondary, lineHeight: theme.spacing.xl, marginBottom: theme.spacing['2xl'] },
  modalButtons: { flexDirection: 'row', gap: theme.spacing.md },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: theme.colors.borderLight, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.md, alignItems: 'center', backgroundColor: theme.colors.surface },
  modalCancelText: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold },
  modalConfirm: { flex: 1, backgroundColor: theme.colors.danger, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.md, alignItems: 'center' },
  modalConfirmText: { fontFamily: theme.fonts.body, color: '#fff', fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold },
  substituicaoRow: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginTop: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  substituicaoText: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.text, marginTop: theme.spacing.xs },
  substituicaoDetalhe: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  viewToggle: { flexDirection: 'row', gap: 0, marginBottom: theme.spacing.lg, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.borderLight, overflow: 'hidden', alignSelf: 'stretch' },
  viewToggleBtn: { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center', backgroundColor: theme.colors.surface },
  viewToggleActive: { backgroundColor: theme.colors.primaryGlow },
  viewToggleText: { fontFamily: theme.fonts.body, fontSize: theme.fontSize.base, color: theme.colors.textMuted, fontWeight: theme.fontWeight.medium, letterSpacing: theme.letterSpacing.wide },
  viewToggleTextActive: { color: theme.colors.primary, fontWeight: theme.fontWeight.semibold },
  bottomButtons: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
  // ── Rival comparison (Fase 4.1) ──
  rivalCard: { marginBottom: theme.spacing.md },
  rivalPos: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.lg,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.bold,
  },
  rivalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rivalInfo: { flex: 1 },
  rivalName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  rivalDetail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  rivalRight: { alignItems: 'flex-end', marginLeft: theme.spacing.md },
  rivalPts: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  rivalPtsWin: { color: theme.colors.primary },
  rivalPtsLose: { color: theme.colors.danger },
  rivalDiff: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  rivalPtsPlaceholder: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  rivalImportBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryGlow,
  },
  rivalImportBtnText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  rivalImporting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  rivalImportingText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  // ── Versões (Fase 4.2) ──
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  versionInfo: { flex: 1 },
  versionText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
  },
  versionDetail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  restoreBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.info,
    backgroundColor: theme.colors.infoGlow,
    marginLeft: theme.spacing.md,
  },
  restoreBtnText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.sm,
    color: theme.colors.info,
    fontWeight: theme.fontWeight.semibold,
  },
});

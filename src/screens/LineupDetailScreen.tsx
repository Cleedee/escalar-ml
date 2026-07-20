import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Player, PontuadoAthlete, Reserva, SubstituicaoResult, PartidasResponse } from '../types';
import { deleteLineup, getLeagues, saveLeague, saveLineup } from '../services/storage';
import { fetchPontuados, fetchPartidas, postProjetar } from '../services/api';
import { calcularSubstituicoes } from '../services/substituicaoEngine';
import { theme } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';
import Button from '../components/Button';
import Badge from '../components/Badge';
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

export default function LineupDetailScreen({ route, navigation }: any) {
  usePageTitle('Escalação');
  const { lineup, league } = route.params;
  const { response } = lineup;
  const [pontuadosAtletas, setPontuadosAtletas] = useState<Record<string, PontuadoAthlete> | null>(null);
  const [partidasData, setPartidasData] = useState<PartidasResponse | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [substituicaoResult, setSubstituicaoResult] = useState<SubstituicaoResult | null>(null);
  const [salvandoSubstituicao, setSalvandoSubstituicao] = useState(false);
  const [projetando, setProjetando] = useState(false);

  const handleProjetar = async () => {
    setProjetando(true);
    try {
      const capitaoId = response.players.find((p: Player) => p.role === 'capitao')?.atleta_id;
      const request = {
        atletas: response.players.map((p: Player) => p.atleta_id),
        tecnico_id: response.tecnico?.atleta_id ?? 0,
        capitao_id: capitaoId ?? 0,
        rodada: lineup.rodada,
        forcar: false,
      };
      const result = await postProjetar(request);

      const enrichedPlayers = response.players.map((p: Player) => {
        const enriched = ((result as any).jogadores ?? (result as any).players ?? []).find(
          (j: any) => Number(j.atleta_id) === p.atleta_id,
        );
        return enriched ? { ...p, ...enriched, role: p.role } : p;
      });

      const updatedResponse = {
        ...response,
        pontos_previstos: result.pontos_previstos,
        valorizacao_total: result.valorizacao_total,
        players: enrichedPlayers,
        tecnico: result.tecnico ?? response.tecnico,
      };

      const updatedLineup = { ...lineup, response: updatedResponse };

      await saveLineup(updatedLineup);
      navigation.replace('LineupDetail', { lineup: updatedLineup, league });
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

  const handleVoltar = () => {
    if (league) {
      navigation.navigate('Ligas', { screen: 'LeagueDetail', params: { league } });
    } else {
      navigation.goBack();
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
          role: substituido.role === 'capitao' ? 'capitao' : undefined,
          media_num: substituto.media_num,
          jogos_num: substituto.jogos_num,
          variacao_num: substituto.variacao_num,
          potential_valorizacao: substituto.potential_valorizacao,
          preco_projetado: substituto.preco_projetado,
          tendencia: substituto.tendencia,
          eficiencia: substituto.eficiencia,
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

      // Enrich with /projetar
      try {
        const capitaoId = novosPlayers.find((p: Player) => p.role === 'capitao')?.atleta_id;
        const projetada = await postProjetar({
          atletas: novosPlayers.map((p: Player) => p.atleta_id),
          tecnico_id: response.tecnico?.atleta_id ?? 0,
          capitao_id: capitaoId ?? 0,
          rodada: lineup.rodada,
          forcar: false,
        });

        const enrichedPlayers = novosPlayers.map((p: Player) => {
          const enriched = ((projetada as any).jogadores ?? (projetada as any).players ?? []).find(
            (j: any) => Number(j.atleta_id) === p.atleta_id,
          );
          return enriched ? { ...p, ...enriched, role: p.role } : p;
        });

        updatedResponse.players = enrichedPlayers;
        if (projetada.tecnico) updatedResponse.tecnico = projetada.tecnico;
        updatedResponse.pontos_previstos = projetada.pontos_previstos;
        updatedResponse.valorizacao_total = projetada.valorizacao_total;
        updatedLineup.response = updatedResponse;
        await saveLineup(updatedLineup);
      } catch {
        // enrichment non-fatal — substitution data already saved
      }

      // Update team in league if linked
      if (lineup.atribuido_a_team_id) {
        const todosTitulares = [
          ...novosPlayers,
          ...(response.tecnico ? [response.tecnico] : []),
        ];

        const valorizacaoTotal = todosTitulares.reduce(
          (sum, p) => sum + Math.max(0, p.variacao_num ?? 0),
          0,
        );

        const capitaoId = novosPlayers.find((p) => p.role === 'capitao')?.atleta_id;
        const ptsComBonus = (atleta_id: number) => {
          const pts = getPontuacao(atleta_id) ?? 0;
          return atleta_id === capitaoId ? pts * 1.5 : pts;
        };

        const pontuacaoTotal = todosTitulares.reduce(
          (sum, p) => sum + ptsComBonus(p.atleta_id),
          0,
        );

        const leagues = await getLeagues();
        for (const league of leagues) {
          const teamIdx = league.times.findIndex((t) => t.id === lineup.atribuido_a_team_id);
          if (teamIdx === -1) continue;

          const team = { ...league.times[teamIdx] };

          team.patrimonio += valorizacaoTotal;

          if (league.modalidade === 'patrimonio') {
            team.ranking += valorizacaoTotal;
          } else {
            team.ranking += pontuacaoTotal;
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
      navigation.replace('LineupDetail', { lineup: updatedLineup, league });
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as substituições.');
    } finally {
      setSalvandoSubstituicao(false);
    }
  };

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

  const getDuelo = (clube: string): string | null => {
    return clubOpponents[clube] ?? null;
  };

  const getEntrouEmCampoColor = (atleta_id: number, isSubstituto?: boolean): string | undefined => {
    if (isSubstituto) return theme.colors.primary;
    if (entrouEmCampo(atleta_id) === false) return theme.colors.danger;
    return undefined;
  };

  const capitaoId = response.players.find((p) => p.role === 'capitao')?.atleta_id;
  const ptsComBonus = (atleta_id: number): number => {
    const pts = getPontuacao(atleta_id) ?? 0;
    return atleta_id === capitaoId ? pts * 1.5 : pts;
  };

  const allPlayers = [
    ...response.players,
    ...(response.tecnico ? [response.tecnico] : []),
  ];
  const totalReal = hasPontuados
    ? (substituicaoResult?.pontos_finais ??
       allPlayers.reduce((sum, p) => sum + ptsComBonus(p.atleta_id), 0))
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
                  {pts !== null ? ` (${p.role === 'capitao' ? (pts * 1.5).toFixed(1) : pts.toFixed(1)})` : ''}
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

      <Button variant="outline" label={projetando ? "Projetando..." : "Atualizar projeções"} onPress={handleProjetar} disabled={projetando} />

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
  bottomButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
});

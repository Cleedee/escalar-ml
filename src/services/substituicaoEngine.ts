import { Lineup, Player, PontuadoAthlete, Reserva, SubstituicaoInfo, SubstituicaoResult } from '../types';

const POS_ORDER: Record<string, number> = { GOL: 1, LAT: 2, ZAG: 3, MEI: 4, ATA: 5, TEC: 6 };

function entraramEmCampo(
  atleta_id: number,
  pontuados: Record<string, PontuadoAthlete>,
): boolean {
  const p = pontuados[String(atleta_id)];
  return p ? p.entrou_em_campo : false;
}

function getPontuacao(
  atleta_id: number,
  pontuados: Record<string, PontuadoAthlete>,
): number {
  const p = pontuados[String(atleta_id)];
  return p ? p.pontuacao : 0;
}

function posicaoNumber(pos: string): number {
  return POS_ORDER[pos] || 99;
}

function comparePartidaData(
  aId: number,
  bId: number,
  pontuados: Record<string, PontuadoAthlete>,
  partidas: Array<{ clube_casa_id: number; clube_visitante_id: number; partida_data: string }>,
  clubes: Record<string, { nome: string }>,
  players: Player[],
): number {
  const a = players.find((p) => p.atleta_id === aId);
  const b = players.find((p) => p.atleta_id === bId);
  if (!a || !b) return 0;

  const getTime = (clubeNome: string): string | null => {
    for (const p of partidas) {
      const casa = clubes[String(p.clube_casa_id)];
      const visit = clubes[String(p.clube_visitante_id)];
      if (casa && casa.nome === clubeNome) return p.partida_data;
      if (visit && visit.nome === clubeNome) return p.partida_data;
    }
    return null;
  };

  const ta = getTime(a.clube);
  const tb = getTime(b.clube);

  if (ta && tb && ta !== tb) {
    return new Date(ta).getTime() - new Date(tb).getTime();
  }

  // Mesmo horário: 1. Capitão, 2. Maior preço, 3. Alfabética
  if (a.role === 'capitao' && b.role !== 'capitao') return -1;
  if (b.role === 'capitao' && a.role !== 'capitao') return 1;
  if (b.preco !== a.preco) return b.preco - a.preco;
  return a.apelido.localeCompare(b.apelido);
}

export function calcularSubstituicoes(
  lineup: Lineup,
  pontuados: Record<string, PontuadoAthlete>,
  partidas: Array<{ clube_casa_id: number; clube_visitante_id: number; partida_data: string }>,
  clubes: Record<string, { nome: string }>,
): SubstituicaoResult | null {
  const { response } = lineup;
  if (!response.players.length) return null;

  const substituicoes: SubstituicaoInfo[] = [];
  const usedReserveKeys = new Set<string>();
  let novosPlayers = [...response.players];
  let novasReservas = { ...response.reservas };
  let patrimonioAjuste = 0;
  let capitaoId = novosPlayers.find((p) => p.role === 'capitao')?.atleta_id;

  // 1. Substituir titulares que não entraram em campo
  const naoJogaram = novosPlayers
    .filter((p) => !entraramEmCampo(p.atleta_id, pontuados))
    .sort((a, b) => comparePartidaData(a.atleta_id, b.atleta_id, pontuados, partidas, clubes, novosPlayers));

  for (const substitudo of naoJogaram) {
    const pos = substitudo.posicao;
    const reserveKey = Object.keys(novasReservas).find(
      (k) => k === pos && !usedReserveKeys.has(k),
    );
    if (!reserveKey) continue;

    const reserva = novasReservas[reserveKey];
    if (!reserva) continue;

    usedReserveKeys.add(reserveKey);

    const pontSubstitudo = getPontuacao(substitudo.atleta_id, pontuados);
    const pontReserva = getPontuacao(reserva.atleta_id, pontuados);
    const diffPreco = reserva.preco - substitudo.preco;

    substituicoes.push({
      substituido_id: substitudo.atleta_id,
      substituido_apelido: substitudo.apelido,
      substituto_id: reserva.atleta_id,
      substituto_apelido: reserva.apelido,
      posicao: pos,
      motivo: 'nao_jogou',
      diferenca_preco: diffPreco,
      pontuacao_substituido: pontSubstitudo,
      pontuacao_substituto: pontReserva,
    });

    patrimonioAjuste += diffPreco;

    // Replace in players (propagate captain role)
    const isCapitao = substitudo.role === 'capitao';
    if (isCapitao) capitaoId = reserva.atleta_id;

    novosPlayers = novosPlayers.map((p) =>
      p.atleta_id === substitudo.atleta_id
        ? {
            atleta_id: reserva.atleta_id,
            apelido: reserva.apelido,
            posicao: reserva.posicao,
            preco: reserva.preco,
            previsto: reserva.previsto,
            clube: reserva.clube,
            role: isCapitao ? 'capitao' : undefined,
          }
        : p,
    );

    // Add substituted player back to reserves
    novasReservas[reserveKey] = {
      ...substitudo,
      media_num: substitudo.media_num ?? 0,
      jogos_num: substitudo.jogos_num ?? 0,
      variacao_num: 0,
      potential_valorizacao: 0,
      preco_projetado: substitudo.preco,
      tendencia: '',
      eficiencia: 0,
      luxo: false,
    };
  }

  // 2. Substituir por reserva de luxo
  if (lineup.params?.reserva_luxo) {
    const reservaLuxoKey = Object.keys(novasReservas).find(
      (k) => novasReservas[k]?.luxo && !usedReserveKeys.has(k),
    );
    if (reservaLuxoKey) {
      const reservaLuxo = novasReservas[reservaLuxoKey];
      const pos = reservaLuxo.posicao;

      // Find worst starter in same position who didn't zero or negative
      let piorTitular: Player | null = null;
      let piorPontuacao = Infinity;

      for (const p of novosPlayers) {
        if (p.posicao !== pos) continue;
        const pts = getPontuacao(p.atleta_id, pontuados);
        if (pts <= 0) continue;
        if (pts < piorPontuacao) {
          piorPontuacao = pts;
          piorTitular = p;
        }
      }

      if (piorTitular) {
        const ptsTitular = getPontuacao(piorTitular.atleta_id, pontuados);
        const ptsReserva = getPontuacao(reservaLuxo.atleta_id, pontuados);

        if (ptsReserva > ptsTitular && ptsReserva > 0) {
          usedReserveKeys.add(reservaLuxoKey);

          const diffPreco = reservaLuxo.preco - piorTitular.preco;

          substituicoes.push({
            substituido_id: piorTitular.atleta_id,
            substituido_apelido: piorTitular.apelido,
            substituto_id: reservaLuxo.atleta_id,
            substituto_apelido: reservaLuxo.apelido,
            posicao: pos,
            motivo: 'reserva_luxo',
            diferenca_preco: diffPreco,
            pontuacao_substituido: ptsTitular,
            pontuacao_substituto: ptsReserva,
          });

          patrimonioAjuste += diffPreco;

          const isCapitao = piorTitular.role === 'capitao';
          if (isCapitao) capitaoId = reservaLuxo.atleta_id;

          novosPlayers = novosPlayers.map((p) =>
            p.atleta_id === piorTitular!.atleta_id
              ? {
                  atleta_id: reservaLuxo.atleta_id,
                  apelido: reservaLuxo.apelido,
                  posicao: reservaLuxo.posicao,
                  preco: reservaLuxo.preco,
                  previsto: reservaLuxo.previsto,
                  clube: reservaLuxo.clube,
                  role: isCapitao ? 'capitao' : undefined,
                }
              : p,
          );

          novasReservas[reservaLuxoKey] = {
            atleta_id: piorTitular.atleta_id,
            apelido: piorTitular.apelido,
            clube: piorTitular.clube,
            posicao: piorTitular.posicao,
            preco: piorTitular.preco,
            previsto: piorTitular.previsto,
            media_num: piorTitular.media_num ?? 0,
            jogos_num: piorTitular.jogos_num ?? 0,
            variacao_num: 0,
            potential_valorizacao: 0,
            preco_projetado: piorTitular.preco,
            tendencia: '',
            eficiencia: 0,
            luxo: true,
          };
        }
      }
    }
  }

  if (substituicoes.length === 0) return null;

  const ptsComBonus = (atleta_id: number, isCapitao: boolean): number => {
    const pts = getPontuacao(atleta_id, pontuados);
    return isCapitao ? pts * 1.5 : pts;
  };

  // Calculate points using original players first
  const capitaoOriginalId = response.players.find((p) => p.role === 'capitao')?.atleta_id;

  const ptsOrig = response.players.reduce(
    (s, p) => s + ptsComBonus(p.atleta_id, p.atleta_id === capitaoOriginalId),
    0,
  );

  const ptsFinais = novosPlayers.reduce(
    (s, p) => s + ptsComBonus(p.atleta_id, p.atleta_id === capitaoId),
    0,
  );

  return {
    substituicoes,
    pontos_originais: ptsOrig,
    pontos_finais: ptsFinais,
    patrimonio_ajuste: patrimonioAjuste,
  };
}

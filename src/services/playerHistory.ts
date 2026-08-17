import { Lineup, Player, PontuadoAthlete } from '../types';
import { fetchPontuados } from './api';
import { getLineups } from './storage';

export interface PlayerAppearance {
  rodada: number;
  previsto: number;
  preco: number;
  media_num: number;
  jogos_num: number;
  variacao_num: number;
  preco_projetado?: number;
  pontuacao_real?: number | null; // null = API retornou mas sem pontuação, undefined = não buscou
  role?: 'capitao';
  clube: string;
}

export interface PlayerHistoryData {
  atleta_id: number;
  apelido: string;
  posicao: string;
  clube: string;
  appearances: PlayerAppearance[];
  total_appearances: number;
  media_previsto: number;
  media_real?: number;
}

/**
 * Escaneia todas as escalações locais e monta o histórico de cada atleta.
 * Funciona 100% offline — só usa dados do AsyncStorage.
 */
export async function buildPlayerHistory(): Promise<PlayerHistoryData[]> {
  const lineups = await getLineups();
  const playerMap = new Map<number, PlayerHistoryData>();

  for (const lineup of lineups) {
    if (!lineup.response?.players) continue;
    const rodada = lineup.rodada;

    for (const p of lineup.response.players) {
      const appearance: PlayerAppearance = {
        rodada,
        previsto: p.previsto,
        preco: p.preco,
        media_num: p.media_num ?? 0,
        jogos_num: p.jogos_num ?? 0,
        variacao_num: p.variacao_num ?? 0,
        preco_projetado: p.preco_projetado,
        role: p.role,
        clube: p.clube,
      };

      const existing = playerMap.get(p.atleta_id);
      if (existing) {
        existing.appearances.push(appearance);
        existing.total_appearances++;
        existing.clube = p.clube;
      } else {
        playerMap.set(p.atleta_id, {
          atleta_id: p.atleta_id,
          apelido: p.apelido,
          posicao: p.posicao,
          clube: p.clube,
          appearances: [appearance],
          total_appearances: 1,
          media_previsto: appearance.previsto,
        });
      }
    }
  }

  // Sort appearances by rodada e recalcula médias
  for (const data of playerMap.values()) {
    data.appearances.sort((a, b) => a.rodada - b.rodada);
    data.media_previsto =
      data.appearances.reduce((s, a) => s + a.previsto, 0) / data.appearances.length;
  }

  // Sort by total appearances descending
  return Array.from(playerMap.values()).sort((a, b) => b.total_appearances - a.total_appearances);
}

/**
 * Enriquece os históricos com pontuações reais buscando GET /cartola/pontuados/{rodada}
 * para cada rodada em que o atleta apareceu. Não falha se alguma rodada não estiver
 * disponível — os campos ficam como undefined.
 */
export async function enrichWithRealScores(
  histories: PlayerHistoryData[],
): Promise<PlayerHistoryData[]> {
  // Coleta rodadas únicas de todos os atletas
  const rodadas = new Set<number>();
  for (const h of histories) {
    for (const a of h.appearances) {
      rodadas.add(a.rodada);
    }
  }

  // Busca pontuações de cada rodada (paralelo)
  const pontuadosMap = new Map<number, Record<string, PontuadoAthlete>>();
  const results = await Promise.allSettled(
    Array.from(rodadas).map(async (rodada) => {
      const data = await fetchPontuados(rodada);
      return { rodada, atletas: data.atletas };
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      pontuadosMap.set(result.value.rodada, result.value.atletas);
    }
    // rejected = rodada indisponível, ignora
  }

  // Enriquece cada aparição
  for (const h of histories) {
    let totalReal = 0;
    let countReal = 0;
    for (const a of h.appearances) {
      const rodadaData = pontuadosMap.get(a.rodada);
      if (rodadaData) {
        const p = rodadaData[String(h.atleta_id)];
        a.pontuacao_real = p?.pontuacao ?? null;
        if (p?.pontuacao != null) {
          totalReal += p.pontuacao;
          countReal++;
        }
      }
    }
    h.media_real = countReal > 0 ? totalReal / countReal : undefined;
  }

  return histories;
}
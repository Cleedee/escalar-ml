import { League, Lineup } from '../types';
import { fetchPontuados } from './api';

export interface ConsolidationResult {
  teamId: string;
  teamNome: string;
  totalPrevisto: number;
  totalReal: number | null;
  rodadasComputadas: number;
  rodadasComReal: number;
  ranking: number;
}

/**
 * Consolida a pontuação de todos os times de uma liga, acumulando os pontos
 * de cada escalação dentro do intervalo rodada_inicial..rodada_final.
 *
 * Passo 1 — Soma `pontos_previstos` de cada escalação salva localmente (sempre disponível).
 * Passo 2 — Tenta enriquecer com pontuações reais via GET /cartola/pontuados/{rodada}
 *           (fallback silencioso se a rodada não estiver disponível).
 */
export async function consolidateLeague(
  league: League,
  allLineups: Lineup[],
): Promise<{ results: ConsolidationResult[]; updatedLeague: League }> {
  const times = league.times;
  const rodadaInicial = league.rodada_inicial;
  const rodadaFinal = league.rodada_final;
  const modalidade = league.modalidade;

  // Coleta rodadas únicas para buscar pontuações reais
  const rodadasNoIntervalo = new Set<number>();
  for (const lineup of allLineups) {
    if (lineup.rodada >= rodadaInicial && lineup.rodada <= rodadaFinal) {
      rodadasNoIntervalo.add(lineup.rodada);
    }
  }

  // Busca pontuações reais (tolerante a falhas)
  const pontuadosMap = new Map<number, Record<string, any>>();
  const results = await Promise.allSettled(
    Array.from(rodadasNoIntervalo).map(async (r) => {
      const data = await fetchPontuados(r);
      return { rodada: r, atletas: data.atletas };
    }),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') {
      pontuadosMap.set(r.value.rodada, r.value.atletas);
    }
  }

  // Para cada time, computa o total
  const consolidados: ConsolidationResult[] = [];

  for (const team of times) {
    const teamLineups = allLineups.filter(
      (l) =>
        l.atribuido_a_team_id === team.id &&
        l.rodada >= rodadaInicial &&
        l.rodada <= rodadaFinal,
    );

    let totalPrevisto = 0;
    let totalReal = 0;
    let rodadasComputadas = 0;
    let rodadasComReal = 0;
    let temReal = false;

    for (const lineup of teamLineups) {
      const pts = lineup.response?.pontos_previstos ?? 0;
      totalPrevisto += pts;
      rodadasComputadas++;

      // Tenta pontuação real somando jogador a jogador
      const rodadaData = pontuadosMap.get(lineup.rodada);
      if (rodadaData) {
        const todosJogadores = [
          ...(lineup.response?.players ?? []),
          ...(lineup.response?.tecnico ? [lineup.response.tecnico] : []),
        ];
        let somaRealRodada = 0;
        for (const p of todosJogadores) {
          const real = rodadaData[String(p.atleta_id)]?.pontuacao;
          if (real != null) {
            const isCap = 'role' in p && p.role === 'capitao';
            somaRealRodada += isCap ? real * 1.5 : real;
          }
        }
        if (somaRealRodada > 0) {
          totalReal += somaRealRodada;
          rodadasComReal++;
          temReal = true;
        } else {
          // fallback para previsto se real for 0
          totalReal += pts;
        }
      } else {
        totalReal += pts;
      }
    }

    // Para modalidade 'patrimonio', o total é o patrimonio (soma de valorização)
    if (modalidade === 'patrimonio') {
      // Patrimônio = valor inicial + valorização acumulada
      // Usamos o campo patrimonio do team que já deve refletir isso
      consolidados.push({
        teamId: team.id,
        teamNome: team.nome,
        totalPrevisto: team.patrimonio,
        totalReal: null,
        rodadasComputadas,
        rodadasComReal: 0,
        ranking: 0,
      });
    } else {
      consolidados.push({
        teamId: team.id,
        teamNome: team.nome,
        totalPrevisto: Math.round(totalPrevisto * 100) / 100,
        totalReal: temReal ? Math.round(totalReal * 100) / 100 : null,
        rodadasComputadas,
        rodadasComReal,
        ranking: 0,
      });
    }
  }

  // Ordena por pontuação real (se disponível) ou prevista
  const useReal = consolidados.some((c) => c.totalReal != null);
  consolidados.sort((a, b) => {
    const va = useReal ? (a.totalReal ?? a.totalPrevisto) : a.totalPrevisto;
    const vb = useReal ? (b.totalReal ?? b.totalPrevisto) : b.totalPrevisto;
    return vb - va;
  });

  // Atribui ranking
  consolidados.forEach((c, i) => {
    c.ranking = i + 1;
  });

  // Atualiza o objeto League
  const updatedTimes = times.map((t) => {
    const c = consolidados.find((cc) => cc.teamId === t.id);
    if (!c) return t;
    const novoTotal = useReal ? (c.totalReal ?? c.totalPrevisto) : c.totalPrevisto;
    return {
      ...t,
      total_acumulado: novoTotal,
      ranking: c.ranking,
      patrimonio: modalidade === 'patrimonio' ? novoTotal : t.patrimonio,
    };
  });

  const updatedLeague: League = {
    ...league,
    times: updatedTimes,
  };

  return { results: consolidados, updatedLeague };
}
import { CartolaTeamResponse, Lineup, OtimizarResponse, Player, Reserva, Tecnico } from '../types';
import { fetchClubes, fetchTeamById, postProjetar } from './api';

const POS_ABBR: Record<number, string> = {
  1: 'GOL',
  2: 'LAT',
  3: 'ZAG',
  4: 'MEI',
  5: 'ATA',
  6: 'TEC',
};

export function mapCartolaToLineup(
  res: CartolaTeamResponse,
  clubes: Record<string, { nome: string }>,
  rodada: number,
): Lineup {
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

export async function enrichLineupWithProjetar(
  lineup: Lineup,
  teamData: CartolaTeamResponse,
): Promise<Lineup> {
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
      rodada: lineup.rodada,
      forcar: false,
      preco_compra: precoCompra,
    });

    lineup.response.players = lineup.response.players.map((p) => {
      const enriched = ((projetada as any).jogadores ?? (projetada as any).players ?? []).find(
        (j: any) => Number(j.atleta_id) === p.atleta_id,
      );
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
  return lineup;
}

/**
 * Importa a escalação de um time do Cartola (por time_id) e enriquece com /projetar.
 * Disponível com mercado aberto ou fechado — reflete a escalação feita no app oficial.
 */
export async function importCartolaLineup(
  timeId: string | number,
  rodada: number,
  opts?: { atribuido_a_team_id?: string; nome?: string },
): Promise<Lineup> {
  const [teamData, clubes] = await Promise.all([fetchTeamById(timeId, rodada), fetchClubes()]);
  const lineup = mapCartolaToLineup(teamData, clubes, rodada);
  await enrichLineupWithProjetar(lineup, teamData);

  if (opts?.atribuido_a_team_id) lineup.atribuido_a_team_id = opts.atribuido_a_team_id;
  if (opts?.nome) lineup.nome = opts.nome;
  lineup.source = 'import';

  return lineup;
}

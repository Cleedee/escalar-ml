import { AtletasResponse, CartolaStatus, CartolaTeamSearchResult, JustificarResponse, OtimizarParams, OtimizarResponse, PontuadosResponse } from '../types';

/* export const API_BASE = 'http://192.168.18.9:8088'; */
/* export const API_BASE = 'http://10.22.196.40:8088'; */
export const API_BASE = 'https://escalar-no-cartola.onrender.com';

export async function fetchStatus(): Promise<CartolaStatus> {
  const res = await fetch(`${API_BASE}/cartola/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchPontuados(rodada: number): Promise<PontuadosResponse> {
  const res = await fetch(`${API_BASE}/cartola/pontuados/${rodada}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchJustificar(q?: string, atleta_id?: number, clube?: string): Promise<JustificarResponse> {
  let url: string;
  if (atleta_id) {
    url = `${API_BASE}/justificar/${atleta_id}`;
  } else {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    if (clube) search.set('clube', clube);
    url = `${API_BASE}/justificar?${search.toString()}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchAtletas(params: {
  q?: string;
  posicao?: string;
  status?: string;
}): Promise<AtletasResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.posicao) search.set('posicao', params.posicao);
  if (params.status) search.set('status', params.status);
  const res = await fetch(`${API_BASE}/atletas?${search.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postOtimizar(params: OtimizarParams): Promise<OtimizarResponse> {
  const res = await fetch(`${API_BASE}/otimizar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchCartolaTeams(q: string): Promise<CartolaTeamSearchResult[]> {
  const res = await fetch(`${API_BASE}/cartola/times?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

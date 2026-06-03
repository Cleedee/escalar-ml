import { API_BASE } from '../config';
import { AtletasResponse, BotEscalarRequest, BotEscalarResponse, CartolaTeamResponse, MarketStatus, MercadoResponse, PartidasResponse, ProjetarRequest, ProjetarResponse, ResultadoResponse, TeamDetailResponse, TeamSearchResult, JustificarResponse, OtimizarParams, OtimizarResponse, PontuadosResponse } from '../types';

const RETRYABLE_CODES = new Set([502, 503, 504]);

async function fetchWithRetry(url: string, opts?: RequestInit, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, opts);
    if (res.ok) return res;
    if (!RETRYABLE_CODES.has(res.status)) throw new Error(`HTTP ${res.status}`);
    if (i < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`HTTP after retries`);
}

export async function fetchStatus(): Promise<MarketStatus> {
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

export async function fetchTeams(q: string): Promise<TeamSearchResult[]> {
  const res = await fetchWithRetry(`${API_BASE}/cartola/times?q=${encodeURIComponent(q)}`);
  return res.json();
}

export async function fetchTeamBySlug(slug: string): Promise<TeamDetailResponse> {
  const res = await fetchWithRetry(`${API_BASE}/cartola/time/slug/${encodeURIComponent(slug)}`);
  return res.json();
}

export async function fetchTeamById(timeId: string | number): Promise<CartolaTeamResponse> {
  const res = await fetchWithRetry(`${API_BASE}/cartola/time/id/${timeId}`);
  return res.json();
}

export async function fetchClubes(): Promise<Record<string, { nome: string; abreviacao: string }>> {
  const res = await fetch(`${API_BASE}/cartola/clubes`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchMercado(): Promise<MercadoResponse> {
  const res = await fetch(`${API_BASE}/cartola/mercado`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchPartidas(rodada: number): Promise<PartidasResponse> {
  const res = await fetch(`${API_BASE}/cartola/partidas/${rodada}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postBotEscalar(params: BotEscalarRequest): Promise<BotEscalarResponse> {
  const res = await fetch(`${API_BASE}/bot/escalar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postProjetar(params: ProjetarRequest): Promise<ProjetarResponse> {
  const res = await fetch(`${API_BASE}/projetar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postResultado(params: {
  atletas: number[];
  tecnico_id: number;
  capitao_id: number;
  rodada: number;
}): Promise<ResultadoResponse> {
  const res = await fetch(`${API_BASE}/resultado`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

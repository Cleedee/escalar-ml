import { CartolaStatus, JustificarResponse, OtimizarParams, OtimizarResponse, PontuadosResponse } from '../types';

/* export const API_BASE = 'http://192.168.18.9:8088'; */
export const API_BASE = 'http://10.22.196.40:8088';

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

export async function fetchJustificar(q: string): Promise<JustificarResponse> {
  const res = await fetch(`${API_BASE}/justificar?q=${encodeURIComponent(q)}`);
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

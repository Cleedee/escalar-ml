/**
 * Helpers de UI compartilhados entre screens.
 * Elimina duplicação de labelFoco, statusBadgeVariant, POS_MAP, etc.
 */

// ── Foco ──

export function labelFoco(v: number): string {
  if (v === 1.0) return 'Só Pontuação';
  if (v >= 0.8) return '↑ Pontuação';
  if (v === 0.7) return 'Valoriz. Leve';
  if (v === 0.5) return 'Equilibrado';
  if (v === 0.3) return '↑ Valorização';
  if (v === 0.0) return 'Só Valorização';
  return v.toFixed(1);
}

// ── Perfil ──

export const PERFIL_DESC: Record<string, string> = {
  neutro: 'Equilíbrio entre pontuação e valorização.',
  agressivo: 'Busca upside: assume mais risco por pontos altos.',
  conservador: 'Prefere atletas com alta chance de jogar.',
  upside: 'Alto risco, alto retorno: atletas de picos altos.',
};

export const PERFIL_LABEL: Record<string, string> = {
  neutro: 'Neutro',
  agressivo: 'Agressivo',
  conservador: 'Conservador',
  upside: 'Upside',
};

// ── Badge variant por status ──

export function statusBadgeVariant(status: string): 'primary' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'Provável': return 'primary';
    case 'Duvidoso': return 'warning';
    case 'Suspenso':
    case 'Lesionado':
    case 'Nulo': return 'danger';
    default: return 'neutral';
  }
}

// ── Posição ──

export const POS_MAP: Record<number, string> = {
  1: 'GOL',
  2: 'LAT',
  3: 'ZAG',
  4: 'MEI',
  5: 'ATA',
  6: 'TEC',
};

export const POS_LABEL: Record<string, string> = {
  GOL: 'Goleiro',
  LAT: 'Lateral',
  ZAG: 'Zagueiro',
  MEI: 'Meia',
  ATA: 'Atacante',
  TEC: 'Técnico',
};

export const POS_ID: Record<string, number> = { GOL: 1, LAT: 2, ZAG: 3, MEI: 4, ATA: 5, TEC: 6 };

export const POSICOES = [
  { key: '', label: 'Todas' },
  { key: 'GOL', label: 'Goleiro' },
  { key: 'LAT', label: 'Lateral' },
  { key: 'ZAG', label: 'Zagueiro' },
  { key: 'MEI', label: 'Meia' },
  { key: 'ATA', label: 'Atacante' },
  { key: 'TEC', label: 'Técnico' },
];

export const STATUS_LIST = [
  { key: '', label: 'Todos' },
  { key: 'Provável', label: 'Provável' },
  { key: 'Duvidoso', label: 'Duvidoso' },
  { key: 'Suspenso', label: 'Suspenso' },
  { key: 'Lesionado', label: 'Lesionado' },
  { key: 'Nulo', label: 'Nulo' },
];

// ── Formação ──

export function descFormacao(f: string): string {
  if (f === 'auto') return 'Automática';
  const parts = f.split('-');
  if (parts.length !== 3) return f;
  return `${parts[0]} defensores · ${parts[1]} meias · ${parts[2]} atacantes`;
}

export function parseFormacao(formacao: string): { def: number; mei: number; ata: number } {
  const parts = formacao.split('-').map(Number);
  return { def: parts[0] ?? 4, mei: parts[1] ?? 3, ata: parts[2] ?? 3 };
}
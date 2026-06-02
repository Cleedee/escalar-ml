export interface OtimizarParams {
  orcamento: number;
  formacao: string;
  perfil: 'neutro' | 'agressivo' | 'conservador';
  foco: number;
  incluir_duvidosos: boolean;
  reserva_luxo: boolean;
  forcar?: boolean;
  excluir?: number[];
  obrigar?: number[];
}

export interface Player {
  atleta_id: number;
  apelido: string;
  posicao: string;
  preco: number;
  previsto: number;
  clube: string;
  role?: 'capitao';
  potential_valorizacao?: number;
  preco_projetado?: number;
  variacao_num?: number;
  media_num?: number;
  jogos_num?: number;
  eficiencia?: number;
  tendencia?: string;
}

export interface Reserva {
  atleta_id: number;
  apelido: string;
  clube: string;
  posicao: string;
  preco: number;
  previsto: number;
  media_num: number;
  jogos_num: number;
  variacao_num: number;
  potential_valorizacao: number;
  preco_projetado: number;
  tendencia: string;
  eficiencia: number;
  luxo: boolean;
}

export interface Tecnico {
  apelido: string;
  clube: string;
  atleta_id: number;
  preco: number;
  previsto: number;
  variacao_num?: number;
  potential_valorizacao?: number;
  preco_projetado?: number;
  media_num?: number;
  jogos_num?: number;
  eficiencia?: number;
  tendencia?: string;
}

export interface SubstituicaoInfo {
  substituido_id: number;
  substituido_apelido: string;
  substituto_id: number;
  substituto_apelido: string;
  posicao: string;
  motivo: 'nao_jogou' | 'reserva_luxo';
  diferenca_preco: number;
  pontuacao_substituido: number;
  pontuacao_substituto: number;
}

export interface SubstituicaoResult {
  substituicoes: SubstituicaoInfo[];
  pontos_originais: number;
  pontos_finais: number;
  patrimonio_ajuste: number;
}

export interface OtimizarResponse {
  formacao: string;
  pontos_previstos: number;
  orcamento_usado: number;
  players: Player[];
  tecnico: Tecnico;
  reservas: Record<string, Reserva>;
  comparacao: Array<{ formacao: string; pontos_previstos: number; orcamento_usado?: number }>;
  valorizacao_total?: number;
  estrategia?: string;
  foco?: number;
  perfil?: string;
  rodada?: number;
  substituicao?: SubstituicaoResult;
}

export interface Lineup {
  id: string;
  nome: string;
  rodada: number;
  atribuido_a_team_id?: string;
  created_at: string;
  params?: OtimizarParams;
  response: OtimizarResponse;
  estrategia?: string;
}

export interface Team {
  id: string;
  nome: string;
  proprietario: string;
  time_id?: string;
  slug?: string;
  patrimonio: number;
  ranking: number;
  total_acumulado: number;
  is_user: boolean;
  is_bot?: boolean;
  cartoletas_iniciais?: number;
  posicao?: number;
  ativo?: boolean;
  estrategia?: 'auto' | 'manual';
  foco?: number;
  perfil?: 'neutro' | 'agressivo' | 'conservador';
}

export interface BotEscalarRequest {
  nome: string;
  orcamento_atual: number;
  total_pontos: number;
  posicao: number;
  total_participantes: number;
  rodada_atual: number;
  rodada_inicio: number;
  rodada_fim: number;
  pontos_lider: number;
  pontos_proximo: number;
  modalidade: 'patrimonio' | 'pontuacao';
  estrategia: 'auto' | { perfil: 'neutro' | 'agressivo' | 'conservador'; foco: number };
}

export interface BotPlayer {
  atleta_id: number;
  apelido: string;
  clube: string;
  posicao: string;
  preco: number;
  previsto: number;
  media_num: number;
  jogos_num: number;
  variacao_num: number;
  potential_valorizacao: number;
  preco_projetado: number;
  tendencia: string;
  eficiencia: number;
  role?: 'capitao';
}

export interface BotReserva {
  atleta_id: number;
  apelido: string;
  clube: string;
  posicao: string;
  preco: number;
  previsto: number;
  media_num: number;
  jogos_num: number;
  variacao_num: number;
  potential_valorizacao: number;
  preco_projetado: number;
  tendencia: string;
  eficiencia: number;
  luxo: boolean;
}

export interface BotEscalarResponse {
  estrategia: string;
  foco: number;
  perfil: string;
  formacao: string;
  orcamento_usado: number;
  pontos_previstos: number;
  valorizacao_total: number;
  players: BotPlayer[];
  tecnico: BotPlayer;
  reservas: Record<string, BotReserva>;
  comparacao: Array<{ formacao: string; pontos_previstos: number; orcamento_usado?: number }>;
  rodada?: number;
}

export interface League {
  id: string;
  nome: string;
  rodada_inicial: number;
  rodada_final: number;
  modalidade: 'patrimonio' | 'pontuacao';
  times: Team[];
  created_at: string;
}

export interface TeamDetailResponse {
  slug: string;
  nome: string;
  nome_cartola: string;
  patrimonio: number;
  url_escudo_png: string;
  pontos_campeonato?: number;
  pontos?: {
    campeonato: number;
    rodada: number;
  };
  ranking?: {
    atual: {
      ranking_id: number;
      mes: number;
      posicao: number;
    };
  };
  time: any;
}

export interface TeamSearchResult {
  rodada_time_id: number;
  nome_cartola: string;
  slug: string;
  url_escudo_png: string;
  nome: string;
  time_id: string;
}

export interface MarketStatus {
  rodada_atual: number;
  status_mercado: number;
  fechamento?: {
    timestamp: number;
    dia: number;
    mes: number;
    ano: number;
    hora: number;
    minuto: number;
  };
  times_escalados?: number;
}

export interface Atleta {
  atleta_id: number;
  apelido: string;
  nome: string;
  clube_id: number;
  clube: string;
  clube_nome: string;
  posicao_id: number;
  posicao: string;
  posicao_nome: string;
  status_id: number;
  status: string;
  preco: number;
  media: number;
  jogos: number;
  variacao_num: number;
  ultima_pontuacao: number;
  potential_valorizacao: number;
  preco_projetado: number;
}

export interface AtletasResponse {
  total: number;
  atletas: Atleta[];
}

export interface JustificarAtleta {
  atleta_id: number;
  apelido: string;
  clube: string;
  posicao: string;
  preco: number;
  media: number;
  jogos: number;
  previsao: number;
  status: string;
  escalacoes: number;
  variacao_num: number;
  eficiencia: number;
}

export interface ScoutItem {
  media: number;
  pontos: number;
}

export interface DesempenhoRodada {
  rodada: number;
  pontos: number;
}

export interface DesempenhoRecente {
  rodadas: DesempenhoRodada[];
  media_ult3: number;
  media_ult5: number;
}

export interface PartidaInfo {
  casa: boolean;
  adversario: string;
  adversario_id: number;
}

export interface Metodologia {
  tipo: string;
  descricao: string;
  formula: string;
}

export interface AnalisePerfil {
  perfil: string;
  selecionado: boolean;
  concorrentes: any[];
}

export interface JustificarResponse {
  atleta: JustificarAtleta;
  matches: Array<{ atleta_id: number; apelido: string; clube: string }>;
  scout: Record<string, ScoutItem>;
  desempenho_recente: DesempenhoRecente;
  partida: PartidaInfo;
  metodologia: Metodologia;
  analise_perfis: AnalisePerfil[];
}

export interface PontuadoAthlete {
  scout: Record<string, number>;
  apelido: string;
  foto: string;
  pontuacao: number;
  posicao_id: number;
  clube_id: number;
  entrou_em_campo: boolean;
}

export interface PontuadosResponse {
  atletas: Record<string, PontuadoAthlete>;
  rodada: number;
  total_atletas: number;
}

export interface PartidaInfo {
  partida_id: number;
  clube_casa_id: number;
  clube_visitante_id: number;
  partida_data: string;
  local: string;
}

export interface PartidasResponse {
  clubes: Record<string, { nome: string; abreviacao: string }>;
  partidas: PartidaInfo[];
}

export interface CartolaAthlete {
  atleta_id: number;
  apelido: string;
  posicao_id: number;
  clube_id: number;
  preco_num: number;
  media_num: number;
  variacao_num: number;
  jogos_num: number;
  pontos_num: number;
  status_id: number;
  entrou_em_campo: boolean;
}

export interface MercadoResponse {
  atletas: Record<string, CartolaAthlete>;
}

export interface CartolaTeamResponse {
  atletas: CartolaAthlete[];
  capitao_id: number;
  reserva_luxo_id: number | null;
  reservas: CartolaAthlete[];
  patrimonio: number;
  pontos: number;
  esquema_id: number;
  rodada_atual: number;
  time: { nome_cartola: string; slug: string; time_id: number };
}

export interface ProjetarRequest {
  atletas: number[];
  tecnico_id: number;
  capitao_id: number;
  rodada: number;
  forcar?: boolean;
  preco_compra?: Record<number, number>;
}

export interface ProjetarResponse {
  pontos_previstos: number;
  valorizacao_total: number;
  jogadores: Player[];
  tecnico: Tecnico;
}

export const STATUS_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'Mercado Aberto', color: '#22c55e' },
  2: { label: 'Mercado Fechado (rodada rolando)', color: '#f97316' },
  3: { label: 'Rodada Concluída', color: '#3b82f6' },
  4: { label: 'Em Atualização', color: '#a855f7' },
  5: { label: 'Em Manutenção', color: '#ef4444' },
};

export const FORMACOES = [
  'auto',
  '4-3-3',
  '4-4-2',
  '4-2-4',
  '3-4-3',
  '3-5-2',
  '5-3-2',
  '5-4-1',
  '4-5-1',
];

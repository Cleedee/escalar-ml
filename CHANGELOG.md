# Changelog

## [1.1.1] — 2026-07-20

### Adicionado
- Botão Compartilhar na escalação: gera arquivo .txt para WhatsApp
- Campos obrigar/excluir na gestão de bots (modal e consolidar)

### Alterado
- `postBotEscalar` usa `fetchWithRetry` para tratar 502/503/504

### Corrigido
- Perfil/foco de bots com estratégia auto: agora respeita valores do backend

## [1.1.0] — 2026-07-20

### Adicionado
- Botão Consolidar rodada na Liga: importa times Cartola + escalas bots sem escalação
- Dados do modelo (último treino) via `/modelo/info` em StatusDetailScreen
- Título dinâmico na aba do navegador para cada tela (web)
- Voltar da escalação retorna à liga de origem quando vindo de LeagueDetail

### Alterado
- Simplifica StatusScreen, move JSON bruto + legenda para StatusDetailScreen
- Contraste dos filtros de atletas e área dos chips aumentados (web)

### Corrigido
- Ajusta `ModeloInfo` para campo único `treinado_em` conforme resposta real da API

## [1.0.1] — 2026-06-03

### Adicionado
- Funcionalidade de substituição na tela de escalação
- Botão Atualizar projeções via `/projetar`
- Botão Gerar nova escalação na LineupDetailScreen (pré-preenche parâmetros)
- Navegação por rodada na tela de detalhe da liga
- Retry logic nas requisições ao proxy Cartola (`fetchWithRetry`)
- Campos obrigar/excluir atletas na Nova Escalação
- Busca de atletas por nome para obrigar/excluir
- Página de ajuda Foco/Perfil
- Integração com endpoint `POST /projetar`
- Botão Importar escalação de time do Cartola via `time_id`
- Reservas reais do Cartola na importação

### Alterado
- Separa esquema tático em linha própria na tela de escalação
- Mostra patrimônio (orçamento) ao lado do total usado e na lista de escalações
- Após salvar substituição, atualiza patrimônio/pontuação do time na liga
- Propaga capitania nas substituições + bônus 1.5x na pontuação
- Torna enriquecimento via `/projetar` não-fatal na importação
- Usa `variacao_num` (diff real) para valorização em vez de `preco_projetado`

### Corrigido
- Crash na LineupDetailScreen: params opcional e guards seguras
- Formação importada: agora calcula defs/meias/atacantes corretamente
- Enriquecimento via `/projetar`: fallback `jogadores`/`players` + cast `atleta_id`
- Estado obsoleto de substituição ao navegar entre escalações
- Campos enriquecidos preservados ao promover reserva para titular
- Times com escalação existente na consolidação têm projeções atualizadas

## [1.0.0] — 2026-05-26

### Adicionado
- Layout base com React Native (Expo, TypeScript)
- Navegação por abas (Status, Escalações, Atletas, Ligas)
- Tela de Status do Mercado com polling
- Tela de Escalações com lista filtrada por rodada
- Otimização de escalação via `POST /otimizar`
- Tela de detalhe da escalação com projeções e comparação
- Busca e filtro de atletas
- Justificativa de atleta com scout, desempenho e metodologia
- CRUD de Ligas (criar, editar, copiar, excluir)
- CRUD de Times em ligas, com busca e importação Cartola
- Gerenciamento de bots em ligas (estratégia auto/manual)
- Suporte a PWA (web) com service worker
- Deploy via GitHub Actions para GitHub Pages

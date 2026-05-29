
# Escalar no Cartola — App Mobile

**Instrução para o agente:** Crie um app React Native (Expo) seguindo este documento. Os dados de ligas, times e escalações ficam salvos localmente no dispositivo do usuário. Use a base URL da API abaixo para consumir os endpoints do backend.

## Stack

- **Backend (API):** FastAPI, Python 3.12, scikit-learn, PuLP, hospedado no Render
- **App Mobile:** React Native (Expo)

## Base URL da API

```
https://escalar-no-cartola.onrender.com
```

## Funcionalidades (do app)

### 1. Cadastro de ligas (dados salvos no dispositivo)

O app deve permitir cadastrar ligas no dispositivo do usuário:

- Nome da liga
- Rodada inicial
- Rodada final
- Modalidade: patrimônio ou pontuação

### 2. Times na liga (dados salvos no dispositivo)

- Cadastrar time do Cartola na liga (via slug encontrado pelo endpoint de busca)
- Cadastrar time do usuário na liga (times criados manualmente no app)
- Ao criar uma liga, o app solicita permissão para cadastrar seu próprio time

### 3. Escalações avulsas (dados salvos no dispositivo)

- Criar escalações via `POST /otimizar` com parâmetros definidos pelo usuário
- Salvar escalações localmente
- Visualizar escalações salvas
- Atribuir escalações a times cadastrados na liga

### 4. Notificações de rodada

- **Abertura:** quando `GET /cartola/status` retorna `status_mercado = 1` (mercado aberto)
- **Fechamento:** quando `status_mercado = 2` e `fechamento.timestamp` está próximo
- **Rodada concluída:** quando `status_mercado = 3` (mercado fechado pós-rodada) ou `status_mercado = 4` (mercado em atualização)
- O app deve fazer polling periódico do `/cartola/status` e disparar notificações locais

## Status do mercado (`GET /cartola/status`)

| Código | Significado | Notificação |
|---|---|---|
| 1 | Mercado aberto | Abertura de rodada |
| 2 | Mercado fechado (rodada rolando) | Fechamento de rodada |
| 3 | Mercado fechado (pós-rodada) | Rodada concluída |
| 4 | Mercado em atualização | Aguardando |
| 5 | Mercado em manutenção | Aguardando |

## Endpoints da API

### Proxy Cartola

| Método | Rota | Uso no app |
|---|---|---|
| `GET` | `/cartola/status` | Polling para notificações + saber rodada atual |
| `GET` | `/cartola/clubes` | Listar clubes para filtros |
| `GET` | `/cartola/mercado` | Listar atletas disponíveis |
| `GET` | `/cartola/pontuados` | Pontuação ao vivo dos atletas |
| `GET` | `/cartola/pontuados/{rodada}` | Pontuação de rodada específica |
| `GET` | `/cartola/partidas/{rodada}` | Partidas da rodada (horários, mandante/visitante) |
| `GET` | `/cartola/times?q={nome}` | Buscar time de um cartoleiro para cadastrar na liga |
| `GET` | `/cartola/time/slug/{slug}` | Ver escalação e patrimônio de um time |
| `GET` | `/cartola/time/slug/{slug}/{rodada}` | Ver escalação de rodada passada |

### Otimização

| Método | Rota | Uso no app |
|---|---|---|
| `POST` | `/otimizar` | Gerar escalação otimizada |
| `POST` | `/bot/escalar` | Gerar escalação para bot com estratégia autônoma ou manual |
| `GET` | `/justificar` | Justificativa detalhada de um atleta |
| `GET` | `preco/historico` | Histórico de preços dos atletas |

### Health

| Método | Rota | Uso |
|---|---|---|
| `GET` | `/` | Health check + versão |

## Fluxo de cadastro de time do Cartola

1. Usuário digita o nome do time/cartoleiro
2. App chama `GET /cartola/times?q={termo}`
3. Usuário seleciona o time na lista
4. App salva `slug` + `time_id` + `nome` localmente
5. Opcional: app chama `GET /cartola/time/slug/{slug}` para ver escalação atual

## Exemplo de `POST /otimizar`

**Request:**
```json
{
  "orcamento": 100,
  "formacao": "auto",
  "perfil": "neutro",
  "foco": 1.0,
  "incluir_duvidosos": false,
  "reserva_luxo": true
}
```

| Parâmetro | Tipo | Padrão | Descrição |
|---|---|---|---|
| `orcamento` | `float` | `100` | Cartoletas disponíveis |
| `formacao` | `string` | `"auto"` | `"auto"` testa as 7 formações, ou específica (`"4-3-3"`, `"4-4-2"`, etc.) |
| `perfil` | `string` | `"neutro"` | `neutro`, `agressivo`, `conservador` |
| `foco` | `float` | `1.0` | Contínuo 0-1: `1.0` = só pontuação, `0.7` = valorização leve, `0.0` = só valorização |
| `incluir_duvidosos` | `bool` | `false` | Incluir atletas com status Dúvida |
| `reserva_luxo` | `bool` | `true` | Incluir reservas de luxo na resposta |
| `forcar` | `bool` | `false` | Ignorar cache e baixar dados novos |
| `excluir` | `list[int]` | `[]` | IDs de atletas a excluir |
| `obrigar` | `list[int]` | `[]` | IDs de atletas obrigatórios |

**Response (resumido):**
```json
{
  "formation": "4-3-3",
  "pontos_previstos": 86.2,
  "orcamento_usado": 99.52,
  "players": [
    {
      "apelido": "Garro", "clube": "COR", "posicao": "MEI",
      "preco": 12.24, "previsto": 8.21, "atleta_id": 117632,
      "variacao_num": 0.1, "media_num": 5.41, "eficiencia": 0.442,
      "tendencia": "subindo",
      "role": "capitao"
    }
  ],
  "reservas": {
    "GOL": { "apelido": "Fintelman", "luxo": false },
    "ATA": { "apelido": "Cuello", "luxo": true }
  },
  "comparacao": [
    { "formacao": "4-3-3", "pontos_previstos": 86.2 },
    { "formacao": "5-3-2", "pontos_previstos": 85.48 }
  ]
}
```

- `role`: `"capitao"` (pontuação ×1.5) ou `"titular"`
- `luxo: true` indica o reserva de luxo (substitui o pior titular)
- `tendencia`: `"subindo"`, `"descendo"` ou `"estavel"` baseado no histórico de preços
- `eficiencia`: `media_num / preco_num` (pontos por cartoleta)
- `comparacao` só vem quando `formacao: "auto"`

## Exemplo de `GET /justificar`

```bash
GET /justificar/{atleta_id}?modo=max-pontos
GET /justificar?q=NOME&clube=CLUBE&modo=valorizacao
```

- `modo=max-pontos` (padrão): justificativa focada em scout e desempenho
- `modo=valorizacao`: justificativa focada em eficiência e variação de preço
- Retorna scout médio, desempenho recente, partida, metodologia e análise nos 3 perfis do otimizador

## Exemplo de `POST /bot/escalar`

**Request (auto):**
```json
{
  "nome": "Robô",
  "orcamento_atual": 100,
  "total_pontos": 0,
  "posicao": 6,
  "total_participantes": 6,
  "rodada_atual": 18,
  "rodada_inicio": 18,
  "rodada_fim": 19,
  "pontos_lider": 120,
  "pontos_proximo": 80,
  "modalidade": "patrimonio",
  "estrategia": "auto"
}
```

**Request (manual):**
```json
{
  "nome": "Robô",
  "orcamento_atual": 100,
  "total_pontos": 320,
  "posicao": 3,
  "total_participantes": 8,
  "rodada_atual": 22,
  "rodada_inicio": 20,
  "rodada_fim": 38,
  "pontos_lider": 420,
  "pontos_proximo": 310,
  "modalidade": "patrimonio",
  "estrategia": {
    "perfil": "agressivo",
    "foco": 0.5
  }
}
```

| Parâmetro | Tipo | Padrão | Descrição |
|---|---|---|---|
| `nome` | `string` | — | Nome do time do bot |
| `orcamento_atual` | `float` | — | Cartoletas disponíveis |
| `total_pontos` | `float` | — | Pontos totais do bot na liga |
| `posicao` | `int` | — | Posição atual no ranking |
| `total_participantes` | `int` | — | Total de times na liga |
| `rodada_atual` | `int` | — | Rodada atual do Cartola |
| `rodada_inicio` | `int` | — | Rodada inicial da competição |
| `rodada_fim` | `int` | — | Rodada final da competição |
| `pontos_lider` | `float` | — | Pontos do líder |
| `pontos_proximo` | `float` | — | Pontos do time imediatamente atrás |
| `modalidade` | `string` | — | `"patrimonio"` ou `"pontuacao"` |
| `estrategia` | `string \| object` | `"auto"` | `"auto"` decide automaticamente, ou objeto com `perfil` e `foco` |

**Resposta (200):** igual ao `POST /otimizar`, acrescido de `"estrategia"` (label descritiva).

## Regras de negócio

- **Sem autenticação:** repo privado + API key fixa (opcional no futuro)
- **Dados do usuário salvos no dispositivo:** ligas, times, escalações avulsas
- **Cache do backend (efêmero):** mercado, partidas, scout — regenera automaticamente
- **Reserva de luxo:** 5 reservas (um por posição), um deles marcado como `luxo: true` (troca pelo pior titular após a rodada)
- **Capitão:** um dos titulares, marcado com `role: "capitao"`, pontuação multiplicada por 1.5
- **Perfis de risco:** `neutro` (padrão), `agressivo` (busca upside), `conservador` (prefere escalados)

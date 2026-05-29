
# Mudanças na API — Refatoração de Response

## Motivação

Os endpoints `POST /otimizar` e `POST /bot/escalar` faziam a mesma coisa (montar escalação) mas devolviam responses com formatos diferentes. Agora compartilham a mesma lógica e o mesmo response shape.

## O que mudou

### 1. Response do `/otimizar` ficou mais rico

**Antes** retornava o `to_dict()` do Squad (shape básico):
```json
{
  "formation": "4-3-3",
  "players": [{"apelido": "Garro", "preco": 12.24, "previsto": 8.21, ...}],
  "reservas": {"GOL": {"apelido": "Fintelman", "luxo": false}}
}
```

**Agora** retorna o mesmo shape enriquecido do bot:
```json
{
  "estrategia": "Manual",
  "foco": 1.0,
  "perfil": "neutro",
  "formacao": "4-3-3",
  "orcamento_usado": 99.52,
  "pontos_previstos": 86.2,
  "valorizacao_total": 3.45,
  "players": [
    {
      "atleta_id": 117632,
      "apelido": "Garro",
      "clube": "COR",
      "posicao": "MEI",
      "preco": 12.24,
      "previsto": 8.21,
      "media_num": 5.41,
      "jogos_num": 15,
      "variacao_num": 0.1,
      "potential_valorizacao": 0.442,
      "preco_projetado": 12.8,
      "tendencia": "subindo",
      "eficiencia": 0.442,
      "role": "capitao"
    }
  ],
  "tecnico": { /* mesmos campos */ },
  "reservas": {
    "GOL": {
      "atleta_id": 123,
      "apelido": "Fintelman",
      "clube": "FLA",
      "posicao": "GOL",
      "preco": 6.21,
      "previsto": 4.12,
      "media_num": 4.8,
      "jogos_num": 10,
      "variacao_num": 0.0,
      "potential_valorizacao": 0.3,
      "preco_projetado": 6.5,
      "tendencia": "estavel",
      "eficiencia": 0.773,
      "luxo": false
    }
  },
  "comparacao": [
    {"formacao": "4-3-3", "pontos_previstos": 86.2, "orcamento_usado": 99.52},
    {"formacao": "5-3-2", "pontos_previstos": 85.48, "orcamento_usado": 98.1}
  ],
  "rodada": 18
}
```

### 2. `/otimizar` agora aceita os mesmos parâmetros de sempre

Nada mudou no request — `foco`, `perfil`, `formacao`, etc. continuam iguais. Só a resposta que ficou mais completa.

### 3. `/bot/escalar` agora retorna `rodada`

O bot endpoint inclui `rodada` no response (valor do `rodada_atual` enviado no request).

### 4. Campos novos no player (antes só no bot, agora também no `/otimizar`)

| Campo | Tipo | Descrição |
|---|---|---|
| `media_num` | float | Média de pontuação do atleta |
| `jogos_num` | int | Quantidade de jogos |
| `tendencia` | string | `"subindo"`, `"descendo"` ou `"estavel"` |
| `preco_projetado` | float | Preço estimado para a próxima rodada |
| `potential_valorizacao` | float | Potencial de valorização (0-1) |
| `eficiencia` | float | `media / preco` (pontos por cartoleta) |

Esses campos já existiam no `/bot/escalar`; agora o `/otimizar` também os retorna.

### 5. `comparacao` agora sempre retorna `orcamento_usado` por formação

Cada item em `comparacao` inclui:
```json
{
  "formacao": "4-3-3",
  "pontos_previstos": 86.2,
  "orcamento_usado": 99.52
}
```

### 6. `estrategia` no `/otimizar`

O campo `estrategia` no `/otimizar` sempre virá `"Manual"`. No `/bot/escalar` pode ser `"Manual: foco=0.7 / neutro"` ou `"Automática: ..."` (quando `estrategia: "auto"`).

## Compatibilidade retroativa

- O response do `/otimizar` é um superconjunto do anterior — todos os campos antigos continuam existindo, só foram adicionados novos
- O response do `/bot/escalar` continua idêntico (só ganhou `rodada`)
- Nenhum campo foi removido

## Resumo para o desenvolvedor

Se o app mobile consome `/otimizar`, agora você tem acesso a `potential_valorizacao`, `preco_projetado`, `tendencia`, `media_num`, `jogos_num`, `eficiencia` e `valorizacao_total` sem precisar chamar outro endpoint. Se antes ignorava `reservas` por serem pobres em dados, agora elas vêm completas com todos os campos de jogador + `luxo`.

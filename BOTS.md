# BOTS

- Bots autônomos em ligas
  - Criar bot em uma liga: nome + cartoletas_iniciais
  - Bot é identificado por `liga_id` (UUID gerado no app) + nome do time
  - A cada rodada (mercado aberto), app chama `POST /bot/escalar` com estado atual do bot + contexto da liga, recebe escalação otimizada com estratégia decidida automaticamente
  - App salva escalação do bot localmente e pode optar por aplicar via `POST /otimizar` com os mesmos parâmetros

## Estrutura de dados dos bots (salva no dispositivo)

```typescript
type Bot = {
  id: string;              // UUID gerado pelo app
  liga_id: string;         // UUID da liga à qual pertence
  nome: string;            // Nome do time do bot
  cartoletas_iniciais: number;
  orcamento_atual: number;
  total_pontos: number;
  posicao: number;         // Última posição conhecida (atualizada após cada rodada)
  ativo: boolean;
};

type BotEscalarRequest = {
  nome: string;
  cartoletas_iniciais: number;
  orcamento_atual: number;
  total_pontos: number;
  posicao: number;
  total_participantes: number;
  rodada_atual: number;
  rodada_inicio: number;
  rodada_fim: number;
  pontos_lider: number;
  pontos_proximo: number;
  modalidade: "patrimonio" | "pontuacao";
};
```

**Resposta de `POST /bot/escalar`:**

```json
{
  "estrategia": "📦 Fim do turno — acumulando cartoletas com segurança",
  "modo": "valorizacao",
  "perfil": "conservador",
  "formacao": "4-3-3",
  "orcamento_usado": 85.49,
  "pontos_previstos": 62.31,
  "players": [
    {
      "atleta_id": 117632,
      "apelido": "Garro",
      "clube": "COR",
      "posicao": "MEI",
      "preco": 12.24,
      "previsto": 8.21,
      "media_num": 5.41,
      "jogos_num": 18,
      "role": "capitao"
    }
  ],
  "tecnico": { "apelido": "...", "clube": "...", "atleta_id": 123, "preco": 7.6, "previsto": 4.2 },
  "reservas": {
    "GOL": { "apelido": "...", "clube": "...", "atleta_id": 456 },
    "LAT": { "apelido": "...", "clube": "...", "atleta_id": 789 },
    "MEI": { "apelido": "...", "clube": "...", "atleta_id": 101 },
    "ATA": { "apelido": "...", "clube": "...", "atleta_id": 112 }
  }
}
```

**Estratégias possíveis** (decididas automaticamente pelo backend):
| Estratégia | Quando |
|---|---|
| `max-pontos` + `agressivo` | Líder ou a menos de 3 rodadas do fim do turno, ou em pontuação, ou a 100+ pts atrás |
| `max-pontos` + `conservador` | Na zona de classificação e turno no meio |
| `valorizacao` + `neutro` | Meio do turno, meio da tabela |
| `valorizacao` + `conservador` | Fim do turno, acumulando patrimônio |


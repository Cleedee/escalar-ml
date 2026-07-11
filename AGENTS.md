# EscalarML — App Mobile

**Nome definitivo:** EscalarML.

React Native (Expo, TypeScript) app.

## Quick start

```bash
npm install
npx expo start             # dev server
npx expo start --tunnel    # if on a different network
npx expo start --web       # web version
npx expo run:android       # build + run on Android
npx expo run:ios           # build + run on iOS
```

**Important:** Current SDK is **54** (Expo Go 54). Do NOT upgrade SDK without updating Expo Go on all test devices first.

## Stack

- **App:** React Native (Expo, TypeScript)
- **Navigation:** `@react-navigation/native` + `native-stack` + `bottom-tabs`
- **Local storage:** AsyncStorage (ligas, times, escalações) — all user data lives on-device only
- **Remote API:** FastAPI backend on Render (no auth, private repo)
- **Web:** `react-native-web` + custom service worker (`web/service-worker.js`)

## API base URL

```
https://escalar-no-cartola.onrender.com
```

Dev override in `src/config.ts`: `https://escalar-no-cartola.onrender.com` (auto-selected when `__DEV__`). Set to `http://127.0.0.1:8000` for local backend.

**Important:** all `/cartola/*` endpoints are proxy-only (ephemeral cache). The `/otimizar` endpoint is the computation engine.

**Undocumented endpoints (discovered during testing):** `POST /resultado` — returns real scores for a lineup (same shape as `/projetar` but with `pontos` reais instead of `previsto`). Requires `atletas`, `tecnico_id`, `rodada`. Returns `total_pontos`, `valorizacao_total` (always 0.0), `jogadores[]`, `tecnico`, `scouts`, `params`.

## Architecture rules

- **No authentication** — API key is optional, not implemented.
- **All user data is local** — never POST leagues/teams/lineups to the backend. Only `POST /otimizar`, `POST /bot/escalar`, and `POST /projetar` go remote.
- **Race condition on /otimizar** — results are ephemeral. Save the response locally immediately or it's lost.
- **Polling for market status** — use `GET /cartola/status` periodically. Dispatch local notifications on transitions (1→abertura, 2→fechamento, 3/4→concluída). Do NOT poll from background — use expo-notifications + app-state awareness.

## Business rules (enforced by the API, but the UI must respect them)

| Rule | Detail |
|---|---|
| Formation | `auto` or explicit (e.g. `4-3-3`). API returns best formation + comparison table. |
| Captain | One starter with `role: "capitao"`, points × 1.5. |
| Luxury sub | 5 reserves (one per position). One has `luxo: true` (replaces worst starter post-round). |
| Risk profiles | `neutro` (default), `agressivo` (upside), `conservador` (prefers likely starters). |
| Budget | Always pass `orcamento` in C$ (max ~C$ 100 for most rounds). |
| Foco | Continuous 0–1 value: `1.0` = max points, `0.0` = max valorization. |

## Screens

| Screen | File | Description |
|---|---|---|
| Status | `StatusScreen.tsx` | Market status (logo, status indicator, raw JSON, legend) |
| Atletas | `AtletasScreen.tsx` | Athlete search, filter by position/status, sort by price/media |
| Justificar | `JustificarScreen.tsx` | Deep dive on athlete: scout, recent performance, next match, methodology, risk profiles |
| Help | `HelpScreen.tsx` | Explains Foco and Perfil concepts |
| Leagues | `LeaguesScreen.tsx` | League list with create/edit/copy/delete |
| LeagueDetail | `LeagueDetailScreen.tsx` | League detail: teams CRUD, search+import Cartola teams, bot management, escalate bot |
| Lineups | `LineupsScreen.tsx` | Lineup list filtered by round, with team attribution links |
| NewLineup | `NewLineupScreen.tsx` | Create lineup form (orçamento, formação, perfil, foco, switches, obrigar/excluir) |
| LineupDetail | `LineupDetailScreen.tsx` | Lineup view: players, proj. vs real scores, duels, comparison, export JSON, delete |

## Navigation

```
Tab Navigator
├── Status (StatusScreen)
├── Escalações (Stack)
│   ├── LineupsList (LineupsScreen)
│   ├── NewLineup (NewLineupScreen)
│   ├── LineupDetail (LineupDetailScreen)
│   ├── Justificar (JustificarScreen)
│   └── Help (HelpScreen)
├── Atletas (AtletasScreen)
└── Ligas (Stack)
    ├── LeaguesList (LeaguesScreen)
    └── LeagueDetail (LeagueDetailScreen)
```

## Endpoints

### Proxy Cartola

| Method | Path | Purpose |
|---|---|---|
| GET | `/cartola/status` | Poll for market state (rodada atual + status) |
| GET | `/cartola/clubes` | Club list for filters |
| GET | `/cartola/mercado` | Available athletes + prices |
| GET | `/cartola/pontuados` | Live scores |
| GET | `/cartola/pontuados/{rodada}` | Scores for a past round |
| GET | `/cartola/partidas/{rodada}` | Match schedule for a round |
| GET | `/cartola/times?q={nome}` | Search a Cartola user's team by name |
| GET | `/cartola/time/slug/{slug}` | Get team lineup + patrimonio |
| GET | `/cartola/time/slug/{slug}/{rodada}` | Past round lineup |
| GET | `/cartola/time/id/{id}` | Get team lineup by numeric ID |

### Optimization

| Method | Path | Purpose |
|---|---|---|
| POST | `/otimizar` | Generate optimized lineup |
| POST | `/bot/escalar` | Generate lineup for bot with auto/manual strategy |
| POST | `/projetar` | Enrich an imported Cartola lineup with projected scores/valuation |

### Athletes

| Method | Path | Purpose |
|---|---|---|
| GET | `/atletas?q=&posicao=&status=` | Search/filter athletes |
| GET | `/justificar/{atleta_id}` | Athlete justification (scout, performance, methodology) |
| GET | `/justificar?q=&clube=` | Athlete search + justification |

### Health

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Health + version |

## Market status codes (polling state machine)

| Code | Meaning | Notify? |
|---|---|---|
| 1 | Open | Abertura |
| 2 | Closed, round in progress | Fechamento (check `fechamento.timestamp`) |
| 3 | Closed, post-round | Rodada concluída |
| 4 | Updating | None (wait) |
| 5 | Maintenance | None (wait) |

## POST /otimizar shape

```json
{
  "orcamento": 100,
  "formacao": "auto",
  "perfil": "neutro",
  "foco": 1.0,
  "incluir_duvidosos": false,
  "reserva_luxo": true,
  "forcar": false,
  "excluir": [123, 456],
  "obrigar": [789]
}
```

| Param | Type | Default | Description |
|---|---|---|---|
| `orcamento` | float | 100 | Budget in C$ |
| `formacao` | string | "auto" | "auto" or explicit ("4-3-3", "4-4-2", etc.) |
| `perfil` | string | "neutro" | "neutro", "agressivo", "conservador" |
| `foco` | float | 1.0 | 0–1: 1.0 = só pontuação, 0.0 = só valorização |
| `incluir_duvidosos` | bool | false | Include doubtful-status athletes |
| `reserva_luxo` | bool | true | Include luxury sub in response |
| `forcar` | bool | false | Ignore cache, force refresh |
| `excluir` | int[] | [] | Athlete IDs to exclude |
| `obrigar` | int[] | [] | Athlete IDs to force include |

### Response

```json
{
  "estrategia": "Manual",
  "foco": 1.0,
  "perfil": "neutro",
  "formacao": "4-3-3",
  "pontos_previstos": 86.2,
  "orcamento_usado": 99.52,
  "valorizacao_total": 3.45,
  "players": [
    {
      "atleta_id": 117632,
      "apelido": "Garro",
      "posicao": "MEI",
      "preco": 12.24,
      "previsto": 8.21,
      "clube": "COR",
      "role": "capitao",
      "media_num": 5.41,
      "jogos_num": 15,
      "variacao_num": 0.1,
      "potential_valorizacao": 0.442,
      "preco_projetado": 12.8,
      "tendencia": "subindo",
      "eficiencia": 0.442
    }
  ],
  "tecnico": { "apelido": "...", "clube": "...", "atleta_id": 123, "preco": 7.6, "previsto": 4.2, ... },
  "reservas": {
    "GOL": { "apelido": "Fintelman", "preco": 6.21, "previsto": 4.12, "luxo": false, ... },
    "LAT": { ... },
    "ZAG": { ... },
    "MEI": { ... },
    "ATA": { ... }
  },
  "comparacao": [
    { "formacao": "4-3-3", "pontos_previstos": 86.2, "orcamento_usado": 99.52 },
    { "formacao": "5-3-2", "pontos_previstos": 85.48, "orcamento_usado": 98.1 }
  ],
  "rodada": 18
}
```

### Enriched fields (per player/tecnico/reserva)

| Field | Type | Description |
|---|---|---|
| `media_num` | float | Average score |
| `jogos_num` | int | Games played |
| `variacao_num` | float | Price variation |
| `potential_valorizacao` | float | Valuation potential (0–1) |
| `preco_projetado` | float | Projected next-round price |
| `tendencia` | string | "subindo", "descendo", "estavel" |
| `eficiencia` | float | media / preco (points per cartoleta) |

## POST /bot/escalar

See `BOTS.md` for full spec. Request includes league context (position, points, modalidade) and `estrategia` (auto or manual with perfil + foco). Response matches the enriched `/otimizar` shape plus `estrategia` (descriptive label).

## POST /projetar shape

Enriches an imported Cartola lineup with projected scores and valuation data.

```json
{
  "atletas": [117632, 123456],
  "tecnico_id": 789012,
  "capitao_id": 117632,
  "rodada": 19,
  "forcar": false,
  "preco_compra": { "117632": 10.5 }
}
```

| Param | Type | Description |
|---|---|---|
| `atletas` | int[] | IDs of field athletes (starters + bench) |
| `tecnico_id` | int | Coach athlete ID (0 if none) |
| `capitao_id` | int | Captain athlete ID |
| `rodada` | int | Current round |
| `forcar` | bool | Ignore cache |
| `preco_compra` | object | Map of athlete_id → purchase price (for valuation calc) |

### Response

Same enriched `OtimizarResponse` shape. Only `jogadores` (starters) and `tecnico` are enriched; `reservas` are not returned by this endpoint.

## Local data model

Store as JSON in AsyncStorage:

- **leagues:** `{ id, nome, rodada_inicial, rodada_final, modalidade: "patrimonio"|"pontuacao", times: Team[], created_at }`
- **lineups:** `{ id, nome, rodada, atribuido_a_team_id?, created_at, params?: OtimizarParams, response: OtimizarResponse, estrategia? }`

### Team interface (within leagues)

```typescript
{
  id: string;
  nome: string;
  proprietario: string;
  time_id?: string;       // Cartola time ID
  slug?: string;           // Cartola slug
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
```

## Features not in spec

### Cartola team import (`mapCartolaToLineup`)
Called from `LeagueDetailScreen`. Converts `CartolaTeamResponse` into a `Lineup`.  
**Fix:** After mapping, `handleImportTeam` now calls `POST /projetar` to enrich the lineup with `preco_projetado`, `potential_valorizacao`, and `valorizacao_total`. Reservas still get the old hardcoded values (they are not enriched by `/projetar`).  
→ See `src/screens/LeagueDetailScreen.tsx:30-123` (base map), `src/screens/LeagueDetailScreen.tsx:241-263` (enrichment flow).

### Bot management
Bots in leagues can be configured with strategy (auto/manual), foco, and perfil. `LeagueDetailScreen` lets you manage bots and escalate them via `POST /bot/escalar`.

### Actual scores in LineupDetail
`LineupDetailScreen` fetches `GET /cartola/pontuados/{rodada}` and `GET /cartola/partidas/{rodada}` in a `useEffect` keyed on `lineup.id` (not `rodada`) to show real vs projected scores and match duels. Prevents stale data when navigating between different lineups for the same round.

### Export JSON
LineupDetailScreen has an "Exportar JSON" button that copies the full lineup as JSON to the clipboard via `expo-clipboard`.

### Athlete justification flow
From any player in a lineup, tapping the "i" button navigates to `JustificarScreen` which calls `GET /justificar` to show deep scout data, recent performance bar chart, next match info, methodology, and per-profile analysis.

### Forçar / Obrigar / Excluir
The `NewLineupScreen` allows forcing specific athletes (`obrigar`) or excluding them (`excluir`) via comma-separated IDs, with a search modal to find athletes by name.

### Refresh projections button
`LineupDetailScreen` has an "Atualizar projeções" button that calls `POST /projetar` with the current starters + coach + captain. Enriches `pontos_previstos`, `valorizacao_total`, `players` (preserving `role`), and `tecnico`. Handles both `jogadores` and `players` field names in the API response. Uses `Number()` coercion on `atleta_id` for safe comparison.

### Substitution preserves enriched fields
When `handleSalvarSubstituicao` promotes a reserva to starter (lines 130-145), it copies all enriched fields (`preco_projetado`, `variacao_num`, `potential_valorizacao`, `media_num`, `jogos_num`, `tendencia`, `eficiencia`) from the reserva object. Previously only 7 basic fields were copied.

### Substitution triggers /projetar enrichment
After saving a substitution (lines 184-210), the code calls `POST /projetar` with the new starter list to update `pontos_previstos`, `valorizacao_total`, `players`, and `tecnico` with fresh projections. Non-fatal — the substitution is already saved if enrichment fails.

### Button layout
Buttons in `LineupDetailScreen` are organized in three groups:
1. **Refinar escalação atual** — "Atualizar projeções" + "Simular substituição" / "Salvar substituição"
2. **Criar/exportar** — "Gerar nova escalação" (primary) → "Exportar JSON" (outline)
3. **Navegação** — "Voltar" + "Excluir escalação" side by side using `bottomButtons` style (flexDirection row, gap)

### State reset on lineup change
`LineupDetailScreen` resets `substituicaoResult`, `pontuadosAtletas`, and `partidasData` via `useEffect` keyed on `lineup.id` instead of `lineup.rodada`. Prevents stale substitution data from a previous lineup when navigating across tabs.

## Development

```bash
npm install
npx expo start              # dev server
npx expo start --tunnel     # if on a different network
npx expo start --web        # web version
npx expo run:android        # build + run on Android
npx expo run:ios            # build + run on iOS
npm run build:web           # export web + copy service worker
```

There are no lint, test, or typecheck commands yet — add them as the project grows.

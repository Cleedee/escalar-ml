# EscalarML — App Mobile

**Nome definitivo:** EscalarML (sem "Cartola" no nome).

Greenfield React Native (Expo) app. No code yet — everything here is from the spec or inferred from the blank repo.

## Quick start

```bash
npx create-expo-app@latest . --template blank-typescript
npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack expo-router
npx expo install expo-secure-store expo-notifications @react-native-async-storage/async-storage
```

**Important:** Current SDK is **54** (Expo Go 54). Do NOT upgrade SDK without updating Expo Go on all test devices first.

## Stack

- **App:** React Native (Expo, TypeScript)
- **Local storage:** AsyncStorage (ligas, times, escalações) — all user data lives on-device only
- **Remote API:** FastAPI backend on Render (no auth, private repo)

## API base URL

```
https://escalar-no-cartola.onrender.com
```

**Important:** all `/cartola/*` endpoints are proxy-only (ephemeral cache). The `/otimizar` endpoint is the computation engine.

## Architecture rules

- **No authentication** — API key is optional, not implemented.
- **All user data is local** — never POST leagues/teams/lineups to the backend. Only `POST /otimizar` goes remote.
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

### Optimization

| Method | Path | Purpose |
|---|---|---|
| POST | `/otimizar` | Generate optimized lineup |

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
  "modo": "max-pontos",
  "incluir_duvidosos": false,
  "reserva_luxo": true
}
```

Response includes `formation`, `pontos_previstos`, `orcamento_usado`, `players[]` (each with `atleta_id`, `apelido`, `posicao`, `preco`, `previsto`, `clube`, `role`), `reservas` (keyed by position), and `comparacao[]` (formation alternatives).

## Local data model (inference — no migrations or schema yet)

Store as JSON in AsyncStorage:

- **leagues:** `{ id, nome, rodada_inicial, rodada_final, modalidade: "patrimonio"|"pontuacao", times: Team[] }`
- **teams:** `{ id, nome, slug?, time_id?, is_user: boolean }`
- **lineups:** `{ id, nome, atribuido_a_team_id?, created_at, response: <POST /otimizar response> }`
- **settings:** `{ meu_time_id?, notifications_enabled: boolean }`

## Development

```bash
npx expo start        # dev server
npx expo start --tunnel  # if on a different network
npx expo run:android  # build + run on Android
npx expo run:ios      # build + run on iOS
```

There are no lint, test, or typecheck commands yet — add them as the project grows.

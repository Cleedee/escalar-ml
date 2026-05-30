# EscalarML

Aplicativo mobile para gerenciar ligas e escalações do Cartola FC com otimização automática de times.

## Stack

- **App:** React Native (Expo, TypeScript)
- **Navegação:** React Navigation (bottom tabs + native stack)
- **Armazenamento:** AsyncStorage (native) / localStorage (web)
- **API:** FastAPI em `https://escalar-no-cartola.onrender.com`

## Funcionalidades

- **Status do mercado** — polling do status da rodada atual
- **Otimização de escalações** — POST `/otimizar` com parâmetros de perfil, foco e formação
- **Ligas** — CRUD de ligas, times (manuais e bots), ranking e patrimônio
- **Bots** — Times automáticos com estratégia ajustável (foco, perfil, risco)
- **Atletas** — Busca, filtro e justificativa de atletas
- **Exportação** — JSON da escalação para a área de transferência

## Pré-requisitos

- Node.js 18+
- Expo CLI (`npx expo`)
- Expo Go 54 (para testar em dispositivo físico)

## Instalação e execução

```bash
npm install
npx expo start          # Dev server multi-plataforma
npx expo start --web    # Desenvolvimento web/PWA
npx expo run:android    # Build Android APK/AAB
npx expo run:ios        # Build iOS IPA
```

## Build e deploy

### PWA (web)

```bash
npm run build:web       # Gera dist/ com index.html + service worker
```

Hospedar em qualquer server estático (Vercel, Netlify, Render).

### Android (Google Play)

```bash
npx expo run:android    # Gera APK
npx eas build --platform android --profile production
```

## Scripts

| Comando | Descrição |
|---|---|
| `npm start` | Inicia servidor de desenvolvimento |
| `npm run android` | Inicia servidor + abre no Android |
| `npm run ios` | Inicia servidor + abre no iOS |
| `npm run web` | Inicia servidor + abre no navegador |
| `npm run build:web` | Exporta PWA para produção (`dist/`) |

## API

Todas as requisições vão para `https://escalar-no-cartola.onrender.com`.

### Endpoints principais

- `GET /cartola/status` — Status do mercado
- `GET /cartola/clubes` — Lista de clubes
- `GET /cartola/mercado` — Atletas disponíveis
- `GET /cartola/pontuados/{rodada}` — Pontuações da rodada
- `GET /cartola/partidas/{rodada}` — Partidas da rodada
- `GET /cartola/times?q={nome}` — Busca time do Cartola
- `GET /justificar/{atleta_id}` — Justificativa detalhada do atleta
- `POST /otimizar` — Gera escalação otimizada
- `POST /bot/escalar` — Gera escalação automática para bot

## Estrutura do projeto

```
src/
├── config.ts              # URL base da API
├── types/index.ts         # Tipos TypeScript
├── services/
│   ├── api.ts             # Cliente HTTP
│   └── storage.ts         # Persistência local
└── screens/
    ├── StatusScreen.tsx       # Status do mercado
    ├── LineupsScreen.tsx      # Lista de escalações
    ├── NewLineupScreen.tsx    # Nova escalação
    ├── LineupDetailScreen.tsx # Detalhe da escalação
    ├── JustificarScreen.tsx   # Justificativa do atleta
    ├── AtletasScreen.tsx      # Busca de atletas
    ├── LeaguesScreen.tsx      # Lista de ligas
    └── LeagueDetailScreen.tsx # Detalhe da liga
```

## Licença

Projeto privado.

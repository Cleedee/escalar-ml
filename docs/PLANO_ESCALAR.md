# Plano: Fluxo de "Escalar o time" (usuário final)

> Documento de planejamento — define o fluxo completo para o usuário montar/escalar o próprio time,
> do desejo à escalação salva. Baseado no estado atual do código (App v1.2.0, SDK 54).

---

## 1. Objetivo

Permitir que o usuário **escalar seu time** de forma rápida, segura e editável:

- Gerar uma escalação otimizada em 1 toque (fluxo atual);
- **Editar** a escalação gerada (trocar jogador, escolher capitão) sem perder o contexto;
- **Montar na mão** (draft manual) quando quiser controle total, com projeção sob demanda;
- Atribuir a escalação a um time da liga quando fizer sentido;
- Funcionar com mercado **aberto ou fechado**: o estado do mercado vira informação (badges e avisos),
  **nunca bloqueio**. O usuário pode montar/editar o time aqui e escalar no app oficial do Cartola FC — ou vice-versa.

---

## 2. Contextos do usuário

| Contexto | Comportamento esperado |
|---|---|
| Mercado aberto, rodada atual | Escalar agora (1 toque ou manual) |
| Mercado aberto, rodada futura | Escalar com antecedência (draft + projetar) |
| Mercado fechado / rodada rolando | **Permitir montar/editar normalmente** — fluxo principal do ajuste pós-escalação no app oficial (ver 2.1). Badges/avisos informativos, sem bloqueio |
| Dentro de uma liga | Atribuir a escalação ao meu time (`atribuido_a_team_id`) |
| Fora de liga | Escalação avulsa (como hoje) |

### 2.1 Caso de uso principal — ajuste pós-escalação no app oficial

> **Justificativa:** o usuário monta/ajusta a escalação no **app oficial do Cartola FC** e depois
> vem ao EscalarML **modificar a escalação que ele fez lá** — trocando jogador, capitão ou reservas,
> e vendo projeções/valorização do time ajustado.
>
> Consequência: **nenhum estado do mercado pode impedir montar/editar**. Os endpoints envolvidos
> nesse fluxo (`GET /cartola/time/id/{id}` para importar, `POST /projetar` para enriquecer e o editor
> manual) funcionam com dados do último snapshot do mercado — que é justamente o estado válido quando
> o mercado está fechado (preços congelados no fechamento).

---

## 3. Estado atual (mapeado no código)

### 3.1 Fluxo principal — Tab "Escalações"

```
LineupsScreen                         → lista por rodada; botão "+ Nova"
  └─ NewLineupScreen                  → formulário (nome, orçamento, formação, perfil, foco,
  │                                     duvidosos, luxo, obrigar/excluir com busca modal)
  │                                     → POST /otimizar → saveLineup → navega
  └─ LineupDetailScreen                → titulares + técnico + reservas; duelo; projeção vs real;
                                        simular/salvar substituição (pós-rodada);
                                        atualizar projeções (/projetar); gerar nova;
                                        exportar JSON; compartilhar texto; excluir
```

### 3.2 Fluxo alternativo — Tab "Ligas" → `LeagueDetailScreen`

```
handleImportTeam   → fetchTeamById + mapCartolaToLineup + POST /projetar (enriquecimento)
handleEscalarBot   → POST /bot/escalar → mapBotResponseToLineup → saveLineup
handleConsolidarRodada → batch: importa/atualiza escalações de todos os times + POST /resultado
```

### 3.3 O que já existe de bom

- **Persistência imediata** pós-`/otimizar` (mitiga race condition do cache efêmero do backend);
- **Enriquecimento** (`media_num`, `preco_projetado`, `tendencia`, `eficiencia`, upside) já exibido;
- **Substituição automática** pós-rodada preserva campos enriquecidos e re-projeta via `/projetar`;
- **Busca de atletas** para obrigar/excluir (modal com `fetchMercado` + `fetchClubes`);
- **Atualizar projeções** em 1 toque.

### 3.4 Lacunas (o que falta)

| # | Lacuna | Impacto |
|---|---|---|
| L1 | **Sem edição manual pós-geração** (trocar titular por outro atleta) | Usuário preso ao resultado do otimizador |
| L2 | **Capitão não é escolhível** | `role: 'capitao'` vem pronto do `/otimizar`; usuário não decide |
| L3 | **Sem ciência do estado do mercado** | `NewLineupScreen` não consulta `fetchStatus`; o usuário não sabe se a geração usa o último snapshot e não há fallback claro para montagem/edição manual |
| L4 | **Sem atribuição a time da liga no fluxo principal** | `atribuido_a_team_id` só é preenchido via import/bot na tela de liga |
| L5 | **Sem draft manual** (montar do zero e projetar depois) | Não atende quem quer controle total |
| L6 | **Form denso sem orientação inline** | 11 chips de foco, 4 de perfil; Help é tela separada |
| L7 | **Sem validação de orçamento vs. mercado** | Não avisa se orçamento < time mínimo ou se obrigar/excluir são inválidos |
| L8 | **Substituição salva é irreversível** | Sem histórico/undo |
| L9 | **Duvidosos não são marcados no resultado** | flag `incluir_duvidosos` no params, mas nenhum badge no detalhe |

---

## 4. Fluxo alvo (user journey)

```
1. Abrir "Escalações" → escolher rodada
2. (novo) Ver badge do mercado: ABERTO ✅ / FECHADO ⛔ / CONCLUÍDA ✅ — informativo, nunca bloqueia
3. "Nova escalação" (disponível com mercado aberto OU fechado):
   a. Rápido: preencher formulário → "Gerar escalação" → POST /otimizar (aviso se dados do último snapshot)
   b. (novo) "Montar na mão": draft manual → POST /projetar
4. (primário com mercado fechado) Importar a escalação feita no app oficial:
   a. Em ligas: import via `time_id` (já existe — `handleImportTeam`)
   b. (novo) Import avulso fora de liga, por slug/ID do time do Cartola
5. LineupDetail (editor — sempre disponível):
   a. Revisar titulares/técnico/reservas (duelos, projeções, valorização, upside)
   b. (novo) Trocar jogador manualmente (tap no atleta → busca no mercado → substitui → re-projeta)
   c. (novo) Trocar capitão (tap na estrela → novo capitão → re-projeta)
   d. (novo) Atribuir a time da liga (modal com ligas/times)
   e. Exportar / compartilhar / excluir (como hoje)
```

---

## 5. Fases de implementação

### Fase 1 — Polimento do fluxo atual (baixo esforço, alto valor)
Corrige L3, L4, L6, L7, L9 sem novas telas.

| Item | Detalhe | Arquivos |
|---|---|---|
| 1.1 Conscientização do estado do mercado (**sem bloqueio**) | `NewLineupScreen` consulta `fetchStatus` ao montar; se `status_mercado` ∈ {2,3,4,5}, exibir banner "Mercado fechado — dados do último snapshot. Você pode montar na mão, importar do Cartola ou editar depois". Botões de geração, draft e import **sempre habilitados** | `NewLineupScreen.tsx` |
| 1.1b Import avulso do Cartola | Botão "Importar do Cartola" na lista de escalações (busca por slug/ID, reusar `fetchTeams`/`fetchTeamById` + `mapCartolaToLineup` + `POST /projetar`, hoje só acessível via liga) | `LineupsScreen.tsx`, extrair `mapCartolaToLineup` para `services/` |
| 1.2 Validação de orçamento | Comparar `orcamento` com a soma do time mais barato possível do mercado (GOL+LAT+ZAG+MEI+ATA mínimos) e com o teto; alerta antes de chamar `/otimizar` | `NewLineupScreen.tsx` |
| 1.3 Validar obrigar/excluir | Conferir se os IDs existem em `fetchMercado`; destacar IDs inválidos no input | `NewLineupScreen.tsx` |
| 1.4 Orientação inline | Tooltip/hint curto ao lado de Foco e Perfil (reutilizar `CONCEITO_FOCO.md`), sem depender só do Help | `NewLineupScreen.tsx`, `Card` |
| 1.5 Atribuir a time da liga | No fluxo principal, abrir modal "Atribuir a…" com ligas × times (`getLeagues`); preencher `atribuido_a_team_id`; mostrar time no card da lista | `NewLineupScreen.tsx`, `LineupsScreen.tsx` |
| 1.6 Badge de mercado na lista | `LineupsScreen` já chama `fetchStatus`; mostrar estado do mercado no header da rodada | `LineupsScreen.tsx` |

### Fase 2 — Editor manual pós-geração (L1, L2)
O coração da funcionalidade: a escalação deixa de ser estática — e é o **fluxo principal quando o
mercado está fechado** (usuário ajusta aqui o que escalou no app oficial).

| Item | Detalhe | Arquivos |
|---|---|---|
| 2.1 Trocar titular manualmente | Tap em "trocar" num titular → modal de busca (reutilizar padrão de busca de `NewLineupScreen`/`LeagueDetailScreen`) filtrado por posição → seleciona substituto → valida orçamento → salva → re-projeta com `POST /projetar` (preservar `role` do substituído) | `LineupDetailScreen.tsx`, novo componente `PlayerSwapModal` |
| 2.2 Trocar capitão | Tap no ⭐ do titular → confirma novo capitão → `POST /projetar` com novo `capitao_id` → atualiza `pontos_previstos` | `LineupDetailScreen.tsx` |
| 2.3 Trocar reserva | Mesmo fluxo de 2.1 para `reservas` (manter `luxo` se aplicável) | `LineupDetailScreen.tsx` |
| 2.4 Histórico de edições | Array `edits: [{ tipo: 'swap'\|'capitao', de, para, ts }]` no `Lineup`; exibir "desfazer" para o último edit; `saveLineup` a cada mudança | `types/index.ts`, `storage.ts`, `LineupDetailScreen.tsx` |
| 2.5 Re-projeção consolidada | Após N edições, botão "Atualizar projeções" já existe; garantir que troca manual também dispare `postProjetar` automaticamente | `LineupDetailScreen.tsx` |
| 2.6 Proveniência + snapshot do mercado | Campos `source: 'otimizar'\|'cartola'\|'draft'` e `mercado_snapshot: { status_mercado, rodada_atual, ts }` gravados no `Lineup` ao salvar; exibidos no detalhe ("Escalado no app oficial" / "Gerado pelo otimizador"). Ajuda o usuário a saber que a escalação importada reflete a edição feita lá | `types/index.ts`, `LeagueDetailScreen.tsx`, `LineupDetailScreen.tsx` |

> **Regra de negócio:** troca manual **não** altera `params.obrigar/excluir`; apenas o time atual. Se o usuário "Gerar nova escalação" com os mesmos params, o otimizador pode voltar ao jogador original — comportamento esperado e documentado no UI ("nova geração ignora edições manuais").

### Fase 3 — Draft manual (L5)
Montar o time na mão e projetar.

| Item | Detalhe | Arquivos |
|---|---|---|
| 3.1 Tela "Montar na mão" | Grid 12 titulares + técnico + 5 reservas; cada slot abre busca filtrada por posição; contador de orçamento em tempo real (C$ usado / C$ disponível); validação: 1 GOL, formação válida (2-5 def, 2-5 mei, 1-4 ata), técnico obrigatório | `DraftScreen.tsx` (nova), `SoccerField.tsx` (reuso) |
| 3.2 Escolher capitão | Seleção visual no draft (⭐ no slot) | `DraftScreen.tsx` |
| 3.3 Projetar | "Projetar escalação" → `POST /projetar` (atletas, técnico, capitão, rodada) → salva como `Lineup` normal (params `{ formacao, perfil: 'neutro', foco: 1.0, ... }` + flag `draft: true`) → navega `LineupDetail` | `DraftScreen.tsx`, `types/index.ts` |
| 3.4 Rascunho offline | Permitir salvar draft local sem projetar (rascunho com `projetado: false`); disponível também com mercado fechado — é a forma de "montar o time" antes de escalá-lo no app oficial | `storage.ts` |

### Fase 4 — Integração com ligas e adversários (L8 + contexto)
Eleva o editor a ferramenta de liga.

| Item | Detalhe | Arquivos |
|---|---|---|
| 4.1 Comparação com adversários | Se a escalação está atribuída a um time de liga, comparar `pontos_previstos` com a escalação do adversário mais próximo (já temos `lineups` + `league.times` em memória na `LeagueDetailScreen`) | `LineupDetailScreen.tsx` |
| 4.2 Guardar histórico de versões | Snapshot do `response` a cada edição relevante (`versions: OtimizarResponse[]`, máx. 10); permitir restaurar | `types/index.ts`, `LineupDetailScreen.tsx` |
| 4.3 Undo de substituição salva | Em vez de reverter pontuações reais (impossível), restaurar o snapshot anterior e marcar a rodada como "editada manualmente" | `LineupDetailScreen.tsx` |

---

## 6. Especificação de interação (detalhes por tela)

### 6.1 `NewLineupScreen` (Fase 1)
- Header: nome + badge de mercado (`STATUS_MAP`, já existe em `types/index.ts`).
- Ao abrir: `fetchStatus()` + `fetchMercado()` + `fetchClubes()` em paralelo.
- Validações na ordem:
  1. nome não vazio;
  2. orçamento > 0;
  3. orçamento ≥ custo do time mínimo do mercado (se mercado disponível);
  4. IDs em obrigar/excluir existem no mercado (senão, alerta com a lista de inválidos).
- **Sem bloqueio por estado do mercado.** Se `status_mercado` ∈ {2,3,4,5}: banner informativo
  "Mercado fechado — projeções usam o último snapshot (preços congelados no fechamento)" e o fluxo
  continua: "Gerar escalação" (com aviso), "Montar na mão" e "Importar do Cartola" todos habilitados.

### 6.2 `LineupDetailScreen` (Fase 2)
- Cada card de titular ganha:
  - botão "⇄" (trocar) → `PlayerSwapModal`;
  - o ⭐ do capitão vira botão de toque (trocar capitão).
- `PlayerSwapModal`:
  - título "Substituir {apelido}";
  - busca por apelido, filtro por `posicao` do titular;
  - mostra preço, média, projeção, valorização projetada e **saldo de orçamento** (C$ atual - C$ preço do substituto);
  - ações: "Trocar" (salva + `postProjetar`) ou "Cancelar".
- Após troca: badge "Editada manualmente" no card principal; item no histórico.

### 6.3 `DraftScreen` (Fase 3, nova)
- Reutilizar `SoccerField` para a composição visual + lista de slots editáveis.
- Barra de orçamento fixa no rodapé: `C$ 87,4 / 100,0` com cor de alerta se estourar.
- Botões: "Projetar escalação" (primário), "Salvar rascunho" (outline).

---

## 7. Regras de negócio e validações

| Regra | Onde | Fonte |
|---|---|---|
| Time = 1 GOL + 2–5 LAT/ZAG + 2–5 MEI + 1–4 ATA + 1 TEC + 5 reservas | Draft + troca manual | Regras do Cartola (`AGENTS.md`) |
| Capitão: 1 titular com `role: 'capitao'`, pontos × 1.5 | Pós-geração e draft | `AGENTS.md` |
| Reserva de luxo: substitui pior titular pós-rodada | `reserva_luxo: true` default | `AGENTS.md` |
| Orçamento: `orcamento_usado ≤ orcamento` | Validação cliente + servidor | `/otimizar` |
| Mercado fechado (status 2–5): **nunca bloquear** montagem/edição; exibir banner com snapshot e permitir importar (via `time_id`), gerar (com aviso de dados do último snapshot), montar na mão e re-projetar | `NewLineupScreen`, `DraftScreen`, `LineupDetailScreen` | `GET /cartola/status` |
| Troca manual não altera `params.obrigar/excluir` | Editor | — |
| `POST /resultado` só após fim da rodada | Consolidar / detalhe | `AGENTS.md` |
| Salvar resposta do `/otimizar` imediatamente (cache efêmero) | `handleGenerate` | `AGENTS.md` |

---

## 8. Integrações com a API (resumo)

| Endpoint | Uso no fluxo |
|---|---|
| `GET /cartola/status` | Bloqueio de mercado (Fase 1) |
| `GET /cartola/mercado` + `/cartola/clubes` | Busca para troca/draft (Fase 2–3) |
| `POST /otimizar` | Geração rápida (existente) |
| `POST /projetar` | Re-projeção após edição manual e draft (Fase 2–3) |
| `POST /resultado` | Pontos reais na consolidação (existente, intocado) |
| `GET /justificar/{id}` | Deep dive do atleta (existente, reutilizar no modal de troca) |

**Sem mudanças no backend** para Fases 1–3. A Fase 4.1 pode usar dados já disponíveis no app.

---

## 9. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Race condition do `/otimizar` (cache efêmero) | Já mitigado: `saveLineup` imediato; manter padrão nas novas telas |
| Backend Render lento (retry 502/503/504) | `fetchWithRetry` já existe; reusar em `postProjetar`? (hoje não tem retry — avaliar) |
| Edição manual divergindo do otimizador | Documentar no UI; "Gerar nova escalação" sempre parte dos `params` originais |
| Complexidade do draft (formações inválidas) | Validação client-side + mensagens claras; não bloquear rascunho offline |
| Undo pós-rodada (pontuações reais) | Snapshot de versões; undo só restaura estrutura, nunca reescreve `/resultado` |
| Tamanho do AsyncStorage (histórico de versões) | Máx. 10 snapshots por escalação; cap de edições por lineup |

---

## 10. Critérios de aceite (Fases 1–2 mínimas para MVP)

1. Usuário consegue gerar uma escalação em ≤ 3 toques com mercado aberto.
2. Com mercado fechado, o usuário **consegue**: (a) importar a escalação feita no app oficial do Cartola, (b) editá-la (trocar jogador/capitão/reservas), (c) re-projetar com `POST /projetar` — tudo sem bloqueios; banners informam que os dados são do último snapshot.
3. Usuário consegue trocar um titular por outro do mesmo `posicao`, com validação de orçamento, e a projeção é atualizada via `/projetar`.
4. Usuário consegue trocar o capitão e ver `pontos_previstos` recalculados.
5. Toda edição persiste em AsyncStorage (`saveLineup`) e sobrevive a reload.
6. Nenhuma alteração nos fluxos de liga/bot/consolidação existentes (regressão zero).

---

## 11. Ordem sugerida de execução

```
Fase 1 (1.1 → 1.6)  — dias 1–2: bloqueio de mercado, validações, atribuição a liga, orientação inline
Fase 2 (2.1 → 2.5)  — dias 3–5: PlayerSwapModal, capitão, histórico, re-projeção
Fase 3 (3.1 → 3.4)  — dias 6–8: DraftScreen, projetar, rascunho offline
Fase 4 (4.1 → 4.3)  — dias 9–10: comparação com adversário, snapshots, undo
```

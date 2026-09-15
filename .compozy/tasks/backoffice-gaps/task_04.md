---
status: completed
title: As quatro leituras órfãs
type: frontend
complexity: medium
---

# Task 4: As quatro leituras órfãs

## Overview

Quatro rotas prontas que nenhuma tela chama. Nenhuma delas justifica uma tela
nova — cada uma completa uma tela que já existe. Estão juntas por isso, e não
por afinidade de domínio.

| Rota | Tela que ela completa | O que falta |
|---|---|---|
| `GET /dashboard/incidents-by-category` | Painel | o gráfico irmão do de despesas |
| `GET /financial/payments` | Financeiro | ver os pagamentos de uma cobrança |
| `GET /visitors/access-code/:code` | Visitantes | achar o visitante pelo código na portaria |
| `GET /announcements/board` | Comunicados | o mural |
| ~~`POST /:id/read`~~ | — | contador de visualizações; pertence ao portal do morador |

<critical>
- ALWAYS READ the TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST tratar as quatro como **acréscimos** às features existentes — `dashboard/`, `financial/`, `visitors/` e `announcements/`. Nenhuma feature nova, nenhuma rota nova, nenhum item de menu.
- MUST **NÃO** reescrever nem reorganizar as telas que recebem o acréscimo. A mudança é aditiva; se ela exigir refatorar a tela, pare e registre o motivo em vez de refatorar.
- MUST manter cada suíte existente verde **sem alterar asserções que já passavam**. Uma asserção que precisa mudar é sinal de regressão, não de evolução.
- Painel: MUST usar a mesma forma visual e a mesma paleta do gráfico de despesas por categoria — os dois são irmãos e devem ler como par.
- Painel: MUST passar `condominiumId`, que a rota exige, e acompanhar o seletor do shell como os demais indicadores.
- Financeiro: MUST mostrar os pagamentos **de uma cobrança**, a partir de `GET /financial/payments`. A rota é paginada e somente leitura — a baixa continua acontecendo por `POST /financial/charges/:id/payments`, e esta task **não** mexe nela.
- Financeiro: MUST deixar claro que a listagem é histórico, e não um lugar de lançar pagamento.
- Visitantes: MUST oferecer a busca por código de acesso como **consulta direta**, distinta do filtro de texto da lista — a rota devolve um visitante, não uma página.
- Visitantes: MUST tratar código não encontrado como resposta legítima da consulta, e não como falha da tela.
- Comunicados: MUST usar `GET /announcements/board` para o mural — é uma leitura diferente da listagem administrativa, e não um filtro dela.
- ~~Comunicados: MUST registrar leitura por `POST /announcements/:id/read`, e refletir o estado sem refetch manual.~~ **Revogado na execução** — o requisito partia de uma premissa falsa. Ver "O que a execução descobriu".
- MUST **NÃO** tocar `frontend/src/routes/app-router.tsx` nem `navigation.ts`.
- MUST usar os tipos já declarados em `types/{financial,visitor,announcement}.ts`; estender, não duplicar.
</requirements>

## Subtasks

- [x] 4.1 Painel: gráfico de ocorrências por categoria, irmão do de despesas.
- [x] 4.2 Financeiro: histórico de pagamentos de uma cobrança.
- [x] 4.3 Visitantes: consulta por código de acesso, com o caso "não encontrado".
- [x] 4.4 Comunicados: mural a partir de `/board`.
- [~] 4.5 ~~Comunicados: registro de leitura.~~ **Não feito, por decisão**: a rota é um contador de visualizações, e chamá-la de um back-office corromperia o dado. Ver abaixo.
- [x] 4.6 Testes dos quatro acréscimos, e não-regressão das quatro suítes.

## Implementation Details

Cada acréscimo tem um irmão já construído na mesma tela. Encontre o irmão antes
de escrever: o gráfico de despesas por categoria, a listagem paginada de
cobranças, o filtro da lista de visitantes, a listagem de comunicados.

O painel usa `useChartColors` (`frontend/src/hooks/use-chart-colors.ts`) para
respeitar o tema — o gráfico novo passa pelo mesmo caminho, e não por cores
escritas à mão.

Antes de assumir a forma de qualquer resposta, leia o serviço:
`dashboardService.incidentsByCategory`, `paymentRepository.findMany`,
`visitorService` (a consulta por código) e `announcementService.board`. O
envelope é o padrão do projeto; o corpo é específico de cada uma.

`/announcements/board` recebe `condominiumId` opcional. Decida — e escreva o
motivo — se o mural segue o seletor do shell ou mostra o tenant inteiro.

### Relevant Files

- `frontend/src/features/dashboard/` — o gráfico de despesas por categoria é o molde direto.
- `frontend/src/hooks/use-chart-colors.ts` — paleta ciente do tema.
- `frontend/src/features/financial/` — a seção de cobranças e o diálogo de baixa.
- `frontend/src/features/visitors/` — a lista e o filtro de texto existentes.
- `frontend/src/features/announcements/` — a listagem administrativa e as ações de publicar/arquivar.
- `frontend/src/features/notifications/notification-hooks.ts` — precedente de "marcar como lido" com invalidação, incluindo o trinco contra duplo clique.
- `backend/src/modules/{dashboard,financial,visitors,announcements}/` — os serviços.

### Dependent Files

- Nenhum. Esta task não cria rota.

### Related ADRs

- [ADR-009](../frontend-cruds/adrs/adr-009.md) — a tabela.
- [ADR-010](../frontend-cruds/adrs/adr-010.md) — testes mockam `@/lib/api`.

## O que a execução descobriu

### `POST /announcements/:id/read` não registra leitura por pessoa

Esta task foi escrita supondo um recibo de leitura. Não é:
`announcementService.markAsRead` chama `incrementReads`, que executa
`reads_count + 1` numa coluna do próprio comunicado. **Não há vínculo com quem
pediu**, nada impede a mesma pessoa de somar duas vezes, e não existe estado
"lido por você" para consultar nem para exibir.

É um **contador de visualizações**, e a consequência é direta: numa tela de
back-office, toda abertura seria de um administrador conferindo o mural. Ligar o
endereço aqui faria o único número de alcance que o produto tem deixar de medir
o que foi construído para medir.

**Decisão: a rota fica sem tela, e o motivo está escrito no código** — no
cabeçalho de `announcement-hooks.ts` e no de `announcement-board.tsx`. Ela
pertence ao portal do morador, que o `_techspec.md` já lista como fora de
escopo. Há um teste afirmando que a tela **nunca** a chama, para que a decisão
não seja desfeita por distração.

O que a tela mostra no lugar: `readsCount` como **visualizações**, e nenhum
marcador de lido/não lido — também com teste.

### O mural ganha o lugar por três regras que nenhum filtro alcança

`listPublished` exclui os **expirados**, ordena os **fixados** primeiro e corta
em vinte. A listagem administrativa filtra por status, mas não tem filtro de
expiração nem ordenação por `pinned` — sem o mural, um comunicado vencido
continuaria parecendo estar no ar.

### Consulta por código: "não encontrado" chega como 409, e não 404

`visitorService.findByAccessCode` lança `BusinessRuleError`, e procura **apenas
entre os `EXPECTED`** — quem já entrou também "não existe" para ela. Os dois
casos são desfechos normais do balcão: aparecem na própria consulta, com
`role="status"`, e não como toast de falha.

A consulta é um `useMutation`, apesar de ser um `GET`: um `useQuery` guardaria
a resposta por chave e responderia a segunda leitura do mesmo código com o
cache — exatamente errado quando o propósito é saber o estado **agora**.

### O gráfico do painel não é testável pelo DOM

O Recharts mede o container para desenhar, e no jsdom a medida é sempre zero:
nenhum rótulo de eixo chega ao DOM. A ordenação, o corte e a tradução — as
decisões que são nossas — saíram para `incident-chart-data.ts` e são testadas
como função; o componente cobre só os estados que renderizam DOM de verdade.

### `/dashboard/incidents-by-category` não devolve um `CategoryTotal`

O irmão financeiro agrupa por uma entidade (id, nome, cor); este agrupa por um
enum de coluna e devolve `{ category, total }` cru. O rótulo legível é do
cliente, e uma categoria que o servidor passe a emitir aparece com o próprio
identificador em vez de sumir do gráfico.

### Um dublê que faltava quebrou duas suítes

`apiGet` sem implementação devolve `undefined`, e o React Query trata resultado
indefinido como **falha** — duas suítes de comunicados passaram a receber um
toast de erro que nada tinha a ver com o caso em teste. O `serveAnnouncements`
passou a servir o mural.

## Verificação da execução

Sequência completa, na ordem do CI, em 2026-09-14:

```
lint       5 avisos, 0 erros   (o teto conhecido, inalterado)
typecheck  zero
test       73 arquivos / 919 casos   (baseline 72 / 893; +26)
build      zero
backend typecheck  zero
backend test       nao executado -- precisa de MySQL e Redis, e o backend nao foi tocado
```

As quatro suítes que receberam acréscimo — `dashboard/`, `financial/`,
`visitors/` e `announcements/` — passam **sem alteração de asserção**. As
únicas mudanças nos arquivos existentes foram nos dublês, para servir as
leituras novas.

## Deliverables

- Três acréscimos entregues (painel, financeiro, portaria) e o mural em comunicados; `POST /announcements/:id/read` deliberadamente sem tela.
- Quatro suítes existentes verdes, sem asserção alterada.
- `app-router.tsx` e `navigation.ts` intocados.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

- [x] Painel: o gráfico pede `/dashboard/incidents-by-category` com o condomínio selecionado.
- [x] Painel: resposta vazia rende estado vazio próprio, e não um gráfico em branco.
- [x] Painel: falha desse indicador não derruba os demais — os outros continuam renderizados.
- [x] Painel: trocar o condomínio no shell refaz a consulta.
- [x] Financeiro: abrir o histórico de uma cobrança pede `/financial/payments` filtrado por ela.
- [x] Financeiro: cobrança sem pagamento rende estado vazio, e não tabela de zero linhas sem explicação.
- [x] Financeiro: a tela do histórico não oferece lançar pagamento.
- [x] Visitantes: consultar um código existente traz o visitante.
- [x] Visitantes: código inexistente rende o estado "não encontrado", sem toast de erro.
- [x] Visitantes: a consulta por código não altera os filtros nem a paginação da lista.
- [x] Comunicados: o mural pede `/announcements/board`, e não a listagem administrativa.
- [~] ~~Comunicados: marcar como lido dispara `POST /announcements/:id/read` e o estado muda sem refetch manual.~~ Substituído por: **a tela nunca chama a rota**, e o contador aparece como visualizações.
- [~] ~~Comunicados: duplo clique em "marcar como lido" dispara uma requisição só.~~ Sem objeto: não há ação de marcar como lido.
- [x] Comunicados: falha ao carregar o mural aparece no próprio painel, e não como aviso global.
- [x] **Não-regressão:** as suítes de `dashboard/`, `financial/`, `visitors/` e `announcements/` passam sem alteração de asserção.

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run lint` continua com **5 avisos e 0 erros**
- `npm --prefix frontend run test` sai zero, incluindo os casos já existentes
- `git diff --name-only` **não** inclui `frontend/src/routes/app-router.tsx` nem `frontend/src/routes/navigation.ts` — esta task não cria rota. `types/api.ts` recebeu `IncidentCategoryTotal`, que é contrato de painel e, pelo cabeçalho do próprio arquivo, mora lá
- Nenhuma dependência de runtime nova
- Nenhuma alteração no backend

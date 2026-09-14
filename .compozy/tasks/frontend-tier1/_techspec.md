# TechSpec: Telas CRUD Tier 1

Seis telas que replicam o padrão já estabelecido e verificado em
[`../frontend-cruds/`](../frontend-cruds/). **Este documento não redesenha nada** —
ele nomeia os seis recursos, seus contratos, e aponta para o desenho existente.

## Herança de desenho

Valem sem alteração, e não devem ser re-decididos:

| ADR | O que fixa |
|---|---|
| [ADR-004](../frontend-cruds/adrs/adr-004.md) | Criar e editar em diálogo sobre a lista; sem rota de detalhe |
| [ADR-006](../frontend-cruds/adrs/adr-006.md) | Registros excluídos visíveis e restauráveis |
| [ADR-008](../frontend-cruds/adrs/adr-008.md) | `lib/crud/` — fábrica de hooks, chaves de query, invalidação |
| [ADR-009](../frontend-cruds/adrs/adr-009.md) | A tabela compartilhada, já reparada |
| [ADR-010](../frontend-cruds/adrs/adr-010.md) | Testes mockam `@/lib/api`; `test/render.tsx` monta com papel e condomínio |
| [ADR-002](../frontend-cruds/adrs/adr-002.md) | Personas de back-office; ações escondidas por permissão |

**Implementação de referência:** `frontend/src/features/residents/`. É a mais
próxima em forma das seis — lista escopada ao condomínio, diálogo, filtros,
exclusão lógica. Copie a estrutura: `<recurso>-page.tsx`, `<recurso>-hooks.ts`,
`<recurso>-schema.ts`, `components/`, sem barrel, kebab-case, export nomeado.

## Os seis recursos

Todos usam o CRUD uniforme (7 rotas), **zero endpoints próprios**, todos
escopados por `condominiumId`.

| Recurso | Rota API | Busca por | Filtros | Ordem padrão |
|---|---|---|---|---|
| Dependentes | `/dependents` | name, document | unitId, residentId, relationship, active | name ASC |
| Funcionários | `/employees` | name, document, position, email | status, department, contractType | name ASC |
| Prestadores | `/service-providers` | companyName, tradeName, document, serviceType, contactName | status, serviceType | companyName ASC |
| Veículos | `/vehicles` | plate, brand, model, parkingSpot | unitId, residentId, type, status | plate ASC |
| Áreas comuns | `/common-areas` | name, description | status, requiresApproval | name ASC |
| Blocos | `/blocks` | — | condominiumId | name ASC |

Relações carregadas pelo servidor: dependentes trazem `resident`, veículos
trazem `unit`. Use-as para exibir nome/número sem segunda requisição, e proteja
o acesso — o relacionado pode ter sido excluído.

## Particularidades por recurso

**Dependentes** — exige `residentId` **e** `unitId`. O seletor de morador deve
ser escopado ao condomínio; ao escolher o morador, a unidade dele é o valor
natural de `unitId`.

**Funcionários** — `salary` é dinheiro (use `CurrencyInput`), `position` é
obrigatório, `admissionDate`/`terminationDate` são datas. Salário é dado
sensível: exiba, mas considere não destacá-lo na listagem.

**Prestadores** — `document` aceita **CPF ou CNPJ** (11 ou 14 dígitos); a
validação e a formatação precisam cobrir os dois. `rating` é 1 a 5.

**Veículos** — `plate` tem schema próprio no backend (`plateSchema`); espelhe-o.
`unitId` e `residentId` são **opcionais** — veículo pode não ter dono cadastrado.

**Áreas comuns** — a mais rica: 17 campos, incluindo os parâmetros que governam
as 9 regras de reserva (`opensAt`, `closesAt`, `availableWeekdays`, `minHours`,
`maxHours`, `advanceBookingDays`, `minIntervalDays`, `capacity`,
`requiresApproval`, `reservationFee`). Duas validações cruzadas: fechamento
depois da abertura, e duração máxima ≥ mínima. `availableWeekdays` é array de
0 a 6 — precisa de um seletor de dias da semana. **Esta tela alimenta o
formulário de Reservas**, então os valores aqui mudam o comportamento de lá.

**Blocos** — a gestão já existe embutida em Unidades
(`frontend/src/features/units/components/block-manager-dialog.tsx`), por ADR-007.
Esta tela é a promoção daquilo a rota própria, reaproveitando os componentes —
não uma reescrita.

## O que NÃO muda

- Nenhuma alteração no backend.
- Nenhuma dependência de runtime nova.
- `lib/crud/`, a tabela, os primitivos de formulário e o harness de teste ficam
  como estão. Se algum precisar mudar, isso é sinal de que a tela está fugindo
  do padrão — pare e reavalie.

## Registro de rotas

**Nenhuma task de tela toca `frontend/src/routes/app-router.tsx`.** As seis
rotas são registradas de uma vez pela última task.

Motivo: na rodada anterior três agentes paralelos editaram esse arquivo
simultaneamente, o merge conflitou, e o resolvedor de conflitos do Compozy
falhou — derrubando a onda inteira e revertendo três tasks concluídas.

---
status: completed
title: "Fechar, reabrir e o congelamento"
type: backend
complexity: critical
---

# Task 3: Fechar, reabrir e o congelamento

## Overview

Transforma o cálculo num ato: fechar o mês grava o documento inteiro, reabrir o
devolve ao estado vivo deixando registro, e a guarda passa a recusar toda escrita
que moveria caixa num mês fechado. É a task de maior risco da esteira — ela
altera `ChargeService` e `ExpenseService` em caminhos já em uso, e dois dos seis
pontos de guarda não passam por hook algum do CRUD base.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- `close` MUST persistir exatamente o objeto que o caminho de recálculo da task_02 produziu, e a leitura de um mês fechado MUST devolver exatamente o que foi persistido. A forma de resposta MUST ser idêntica nos dois modos.
- Fechar um mês que ainda não terminou MUST ser recusado com 409. Congelar um mês que ainda recebe dinheiro transformaria a guarda numa armadilha sobre a escrita mais usada do módulo.
- Fechar um mês já fechado MUST ser recusado com 409, e MUST NOT criar uma segunda linha.
- Fechar um mês cujo anterior nunca foi fechado MUST ser permitido — o saldo de abertura simplesmente resolve por cálculo em vez de herança.
- `reopen` MUST exigir `financial-closing:manage`, estritamente mais forte do que o `financial-closing:create` que fecha.
- `reopen` MUST gravar `reopened_at`, `reopened_by_id`, `reopened_by_name` e incrementar `reopen_count`, e MUST escrever na trilha de auditoria.
- A guarda MUST viver em `closing-guard.ts`, dependendo apenas do repositório de fechamento — nunca de um service. Nenhum service MUST importar outro service por causa dela.
- A guarda MUST ser chamada nos seis pontos listados no ADR-003, **inclusive em `registerPayment`, que escreve direto no repositório, e em `restore`, que não tem hook**. Uma guarda montada só como hook seria uma proteção que parece existir.
- Cobrança MUST continuar livre: criar, editar, excluir, gerar em lote e aplicar encargos sobre mês fechado MUST seguir funcionando, porque nenhum deles altera o documento.
- A guarda MUST derivar o mês a partir do instante recebido, usando `monthRange`, e nenhum ponto de chamada MUST formatar data por conta própria.
- O desserializador do `breakdown` MUST tolerar um documento gravado por uma forma anterior, preenchendo chave ausente com vazio em vez de falhar.
</requirements>

## Subtasks

- [x] 3.1 Escrever `ClosingService.close`: recalcula, valida as três recusas, persiste o documento com autor e data, devolve a forma fechada
- [x] 3.2 Escrever `ClosingService.reopen`: valida, marca `OPEN`, grava autor, data e contagem
- [x] 3.3 Escrever a serialização e a desserialização do `breakdown`, com tolerância a documento de forma anterior
- [x] 3.4 Fazer a leitura de mês fechado servir o gravado, sem tocar em agregação alguma
- [x] 3.5 Escrever `closing-guard.ts` com `assertMonthOpen`, sobre o repositório apenas
- [x] 3.6 Ligar a guarda em `ChargeService.registerPayment`, antes de criar a linha de pagamento
- [x] 3.7 Ligar a guarda nos quatro pontos de `ExpenseService`: `prepareCreate`, `prepareUpdate`, `pay` e `beforeRemove`
- [x] 3.8 Sobrescrever `ExpenseService.restore` só para ligar a guarda, e delegar ao `super`
- [x] 3.9 Acrescentar as duas rotas de escrita, com as permissões assimétricas, e documentá-las no Swagger
- [x] 3.10 Escrever a auditoria de `close` e `reopen`
- [x] 3.11 Escrever os casos atribuídos, inclusive os que provam o que **não** é congelado
- [x] 3.12 Rodar o pipeline do backend e comparar a contagem

## Implementation Details

Criar:

- `backend/src/modules/financial/closing-guard.ts`

Modificar:

- `backend/src/modules/financial/services/closing.service.ts` — `close` e `reopen`, e o modo "servir o gravado" em `statement`
- `backend/src/modules/financial/services/charge.service.ts` — um ponto de guarda dentro de `registerPayment`
- `backend/src/modules/financial/services/expense.service.ts` — quatro pontos, mais o `restore` sobrescrito
- `backend/src/modules/financial/closing.routes.ts` — as duas rotas de escrita
- `backend/src/config/swagger.ts`

`ClosingService` não estende `BaseCrudService`, então não herda `this.audit`: ele
injeta `auditService` por parâmetro com valor padrão no construtor, como
`TenantService`, `AuthService` e `DashboardService` já fazem
(`tenant.service.ts:17`, `auth.service.ts:72`, `dashboard.service.ts:63`). O tipo
do argumento de `record` é `AuditInput` (`audit.service.ts:24-35`), e a chamada
segue a forma escrita à mão em `charge.service.ts:233-245` — `before` e `after`
carregando `status`, `closingBalance` e `reopenCount`.

Ver "API Endpoints", "Monitoring and Observability" e "Known Risks" no
[`_techspec.md`](_techspec.md).

### Relevant Files

- `backend/src/modules/financial/services/charge.service.ts:187-266` — `registerPayment` inteiro; repare em `:223-231`, a escrita direta no repositório que **não** dispara `beforeUpdate`
- `backend/src/shared/services/base-crud.service.ts:89-97` — `restore`, que não tem hook algum; é a razão da sobrescrita
- `backend/src/shared/services/base-crud.service.ts:99-126` — os seis hooks existentes, e quais servem
- `backend/src/shared/services/condominium-scoped.service.ts:48-58` — `prepareCreate`/`prepareUpdate`, os hooks que as subclasses estendem em vez de `beforeCreate`/`beforeUpdate`
- `backend/src/modules/financial/services/expense.service.ts:59-118` — `pay` e `scheduleNextOccurrence`, que cria a despesa da competência seguinte como efeito colateral
- `backend/src/shared/services/reference-guard.ts` — o molde de guarda como função sobre repositório, e não como dependência de service
- `backend/src/modules/audit/audit.service.ts:24-35,82-137` — `AuditInput` e `record`, com o `try/catch` que torna a auditoria fire-and-forget
- `backend/src/modules/tenants/tenant.service.ts:15-18` — injeção de `auditService` num service que não estende o CRUD base
- `backend/src/shared/errors/app-error.ts:58-69` — `BusinessRuleError`, o 409 desta task
- `backend/tests/integration/security.spec.ts` — o molde da matriz de autorização

### Dependent Files

- `backend/tests/integration/financial.spec.ts` — cria e paga despesas e registra pagamentos; se algum caso existente usar uma data dentro de um mês que outro caso fechou, ele passa a receber 409. **A ordem dos casos dentro do arquivo importa a partir desta task.**
- `backend/src/jobs/overdue.job.ts` — marca vencidos por UPDATE cru; não mexe em dinheiro e por isso não ganha guarda. Conferir, não alterar
- `frontend/src/features/financial/` — as ações da tela passam a poder receber 409 com uma mensagem nova; a task_04 é quem a apresenta

### Related ADRs

- [ADR-003: The Freeze Covers Only Writes That Move Cash](adrs/adr-003.md) — a tabela dos seis pontos e o que fica deliberadamente livre
- [ADR-005: A Closed Month Is a Stored Document, Not a Recomputed View](adrs/adr-005.md) — o que é gravado, e por que a ausência de linha e `OPEN` significam a mesma coisa na leitura
- [ADR-001: Cash Basis for the Monthly Statement](adrs/adr-001.md) — por que cobrança não entra na lista de pontos guardados
- [ADR-007: The New Permission Reaches Seeded Roles Through a Data Migration](adrs/adr-007.md) — de onde vem a permissão que os casos de papel afirmam

## Deliverables

- `POST /financial/closings/:referenceMonth/close` e `.../reopen`, com as permissões assimétricas e as recusas documentadas
- Leitura de mês fechado servida do documento gravado, sem agregação
- `closing-guard.ts` ligado nos seis pontos, com mensagem que nomeia o mês e indica a saída
- Auditoria de fechamento e reabertura
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from [`_tests.md`](_tests.md), the test contract — read each ID's
full definition there before writing tests.

- [x] UT-116, UT-117 — desserialização tolerante do `breakdown`
- [x] IT-275, IT-276, IT-277, IT-278, IT-279, IT-280 — fechar: o congelamento, o documento imune a escrita posterior, as três recusas e a permissão
- [x] IT-281, IT-283, IT-284, IT-285, IT-286, IT-287, IT-288 — os seis pontos de guarda, um caso por ponto (a despesa responde em quatro deles)
- [x] IT-282, IT-289, IT-290 — o que **não** é congelado: pagamento em mês aberto, cobrança com competência no mês fechado, e encargos aplicados sem alterar o documento
- [x] IT-291, IT-292, IT-293, IT-294, IT-295 — reabrir: o registro, a escrita liberada, o refechamento sem duplicata, a permissão mais forte e a recusa do nunca fechado
- [x] IT-303, IT-304 — a matriz de papéis: morador recusado, síndico completo sobre as permissões que o seed concede

## Notas de execução

- **IT-276 e IT-290 são as duas canárias da task.** Cada uma deve morder: force o
  caminho de leitura a recalcular em vez de servir o gravado e as duas ficam
  vermelhas. Se passarem com o recálculo ligado, elas não estão provando nada.
- **O seed roda uma vez por arquivo e não há reset entre casos.** Fechar um mês é
  global ao arquivo: escreva os casos do congelamento sobre um condomínio próprio,
  vindo de `registerIsolatedTenant`, ou ordene o arquivo de modo que nenhum caso
  posterior precise daquele mês aberto.
- **`ExpenseService.pay` cria a ocorrência seguinte de despesa recorrente.** Esse
  insert cai num mês posterior, que está aberto, e por isso não é recusado. Não é
  buraco no congelamento; está no ADR-003 para não ser lido como tal.
- A mensagem da recusa precisa nomear o mês e dizer a saída ("reabra o mês para
  lançar"). Uma recusa que não ensina a saída faz a pessoa tentar de novo igual.

## Execução — o que ficou provado

**Três canárias, cada uma mordendo exatamente onde devia:**

| Defeito plantado | Casos que caem |
|---|---|
| a leitura recalcula em vez de servir o gravado | 2 — IT-276 e IT-290, e **só** eles |
| sem a guarda em `registerPayment` e sem o `restore` sobrescrito | 2 — IT-281 e IT-288 |

A segunda é a que importa para o ADR-003: as duas portas sem hook caem juntas, e
os outros quatro pontos continuam verdes — ou seja, os casos cobrem os seis
caminhos separadamente, e não por acidente de um deles cobrir os demais.

**IT-290 tem substância que não é óbvia.** `apply-late-fees` muda `penalty` e
`interest` de cobranças vencidas, o que mudaria a inadimplência do documento se
ela fosse recalculada. Ela está congelada por ter sido **gravada** no
fechamento, e não por bloqueio de escrita — que é exatamente o desenho do
ADR-003, e o caso o prova ao mudar as cobranças e reler o mesmo número.

**`pay` não ganhou chamada própria.** O ADR lista seis pontos e `pay` é um deles,
mas ele roteia por `this.update`, então `prepareUpdate` já o cobre — IT-286
prova. Uma chamada explícita ali seria uma segunda consulta ao banco pelo mesmo
resultado. Os seis pontos continuam guardados; cinco chamadas os cobrem.

**A guarda de mês fechado vem antes da regra de valor** em `prepareUpdate`. As
duas dariam 409, mas a mensagem certa é a do mês fechado: nada de um mês fechado
pode mudar, e uma recusa que fala de outra regra manda a pessoa para o caminho
errado. IT-285 afirma a mensagem, e não só o status.

**`referenceMonthOf` foi acrescentado ao lado de `monthRange`.** O requisito pedia
que a guarda derivasse o mês "usando `monthRange`"; a guarda recebe um instante e
precisa do caminho inverso. As duas funções vivem juntas e documentadas como
inversas, que é o que o requisito protege: uma aritmética de mês só, para que um
pagamento não seja recusado por cair num mês e depois somado em outro.

**IT-276 precisou de uma cobrança real.** `payments.charge_id` é `NOT NULL`, então
a escrita direta que prova o congelamento aponta para a cobrança do próprio mês.

## Success Criteria

- Every assigned test case implemented and passing
- Um mês fechado lido duas vezes, com escrita direta no banco entre as leituras, devolve exatamente o mesmo documento
- Nenhum service importa outro service por causa da guarda; `closing-guard.ts` depende só do repositório
- Cobrança segue livre sobre mês fechado, provado por caso e não por leitura de código
- `npm --prefix backend run typecheck` e `run test` verdes, com a contagem da referência mais os vinte e cinco desta task

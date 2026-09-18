---
schema_version: "compozy.tasks/v2"
workflow: balancete-mensal
graph:
  nodes:
    - id: task_01
      file: task_01.md
    - id: task_02
      file: task_02.md
    - id: task_03
      file: task_03.md
    - id: task_04
      file: task_04.md
    - id: task_05
      file: task_05.md
  edges:
    - from: task_01
      to: task_02
    - from: task_02
      to: task_03
    - from: task_03
      to: task_04
    - from: task_04
      to: task_05
---

# Balancete mensal — lista de tasks

O documento que o síndico presta ao condomínio todo mês: abre com o saldo
anterior, lista o que entrou e o que saiu por categoria, e fecha com o saldo que
passa para o mês seguinte. Contratos em [`_techspec.md`](_techspec.md), os 84
casos em [`_tests.md`](_tests.md), as decisões e o que elas recusaram em
[`adrs/`](adrs/).

| Task | Entrega | Tipo | Complexidade | Casos |
|---|---|---|---|---|
| task_01 | Fundação de dados e o invariante da despesa paga | backend | high | 9 |
| task_02 | O cálculo e as duas rotas de leitura | backend | high | 30 |
| task_03 | Fechar, reabrir e o congelamento | backend | critical | 25 |
| task_04 | A seção Balancete na tela de Financeiro | frontend | high | 14 |
| task_05 | Exportação: impressão e CSV | frontend | medium | 6 |

## As quatro decisões que vieram antes do código

Foram tomadas pelo dono do produto em 2026-09-18 e **não se reabrem durante a
execução**. Cada uma tem o ADR que a registra, com as alternativas que perdeu:

1. **Regime de caixa** ([ADR-001](adrs/adr-001.md)) — entra `payment.paid_at`,
   sai `expense.paid_at`. Nenhum campo de cobrança alimenta o balancete.
2. **Abertura mais herança** ([ADR-002](adrs/adr-002.md)) — saldo digitado uma
   vez por condomínio, e daí em diante cada mês fechado entrega o seu saldo ao
   seguinte.
3. **O mês fechado recusa o que move caixa** ([ADR-003](adrs/adr-003.md)) — e só
   isso; cobrança continua livre, porque não muda número nenhum do documento.
4. **Impressão do navegador e CSV no cliente** ([ADR-006](adrs/adr-006.md)) — sem
   dependência nova e sem rota nova.

## Distribuição dos casos

Os 84 IDs de [`_tests.md`](_tests.md) estão atribuídos a exatamente uma task, sem
órfão e sem duplicata — 24 unitários e 60 de integração:

- **task_01** — UT-101 a UT-104; IT-298 a IT-302
- **task_02** — UT-105 a UT-115; IT-258 a IT-274; IT-296, IT-297
- **task_03** — UT-116, UT-117; IT-275 a IT-295; IT-303, IT-304
- **task_04** — UT-123, UT-124; IT-305 a IT-313; IT-315 a IT-317
- **task_05** — UT-118 a UT-122; IT-314

## Por que o invariante não tem task própria

A guarda `PAID ⇒ paidAt` ([ADR-004](adrs/adr-004.md)) mora na task_01, junto da
fundação. Ela é pré-condição do lado da saída do cálculo: escrever a agregação de
despesas antes de garantir que toda despesa paga tem data seria somar sobre um
conjunto que pode perder linhas em silêncio, e a task_02 nasceria certa por sorte.
São dois arquivos e cinco casos — uma task só para isso pagaria a partida de um
agente inteiro para uma mudança pequena, e deixaria a task_01 entregando um
schema que ninguém exercita.

## Por que a task_03 é `critical`

É a única que altera serviços existentes em caminhos quentes. `registerPayment` é
a escrita mais usada do módulo financeiro, e **dois dos seis pontos de guarda não
passam por hook nenhum** do `BaseCrudService`: a baixa escreve direto no
repositório (`charge.service.ts:223-231`) e `restore` não tem `beforeRestore`
(`base-crud.service.ts:89-97`). Uma guarda escrita só como hook deixaria a porta
principal aberta parecendo fechada — e o teste que provaria isso é justamente o
que não existiria.

## Execução sequencial, e aqui não é só precaução

As arestas formam uma cadeia. Nas esteiras anteriores a sequência foi uma escolha
contra o conflito — duas execuções em ondas paralelas falharam, a primeira no
resolvedor de conflitos e a segunda por timeout com três agentes disputando a
máquina. Aqui a cadeia é estrutural além disso: a guarda precisa do documento
gravado para saber o que está fechado, a tela precisa das rotas, e a exportação
precisa da tela. Não haveria onda paralela a montar mesmo que se quisesse.

## O que nenhuma task cobre com teste, de propósito

- **A migration.** As suítes nunca carregam migrations (`data-source.ts:17-24`):
  o schema vem de `synchronize: true` e os papéis de um seed que roda do zero.
  Tabela, colunas e patch de permissão estarão presentes na suíte esteja a
  migration certa ou errada. A verificação é `npm --prefix backend run
  migration:run` contra MySQL, e é passo de aceite da task_01, não caso de teste.
- **A folha de impressão.** O `jsdom` não calcula layout. O que pode errar de
  forma que importe — o CSV — é testado como função pura ([ADR-006](adrs/adr-006.md)).

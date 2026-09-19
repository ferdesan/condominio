---
schema_version: "compozy.tasks/v2"
workflow: balancete-detalhe
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
  edges:
    - from: task_01
      to: task_02
    - from: task_02
      to: task_03
    - from: task_03
      to: task_04
---

# Balancete detalhado — lista de tasks

O balancete responde hoje *quanto* entrou e saiu, por categoria. Não responde
*quais* pagamentos e *quais* despesas produziram aqueles números. Esta esteira
acrescenta os lançamentos e os põe onde uma prestação de contas pertence: uma
rota própria, com o resumo em cima e a lista embaixo, impressa e exportada como
um documento só.

Estende a esteira [`../balancete-mensal/`](../balancete-mensal/), entregue e
mergeada no PR #3. Contratos em [`_techspec.md`](_techspec.md), os 39 casos em
[`_tests.md`](_tests.md), as decisões em [`adrs/`](adrs/).

| Task | Entrega | Tipo | Complexidade | Casos |
|---|---|---|---|---|
| task_01 | Armazenamento e a escrita atômica do fechamento | backend | critical | 12 |
| task_02 | A leitura dos lançamentos, nos dois modos | backend | high | 11 |
| task_03 | A tela na rota própria | frontend | high | 9 |
| task_04 | A exportação migra para a rota | frontend | medium | 7 |

## As duas decisões que vieram antes do código

Tomadas pelo dono do produto em 2026-09-18, e **não se reabrem**:

1. **Os lançamentos de um mês fechado são congelados**, não recalculados
   ([ADR-002](adrs/adr-002.md)). Uma lista recalculada pode discordar dos totais
   gravados — `balancete-mensal` IT-276 prova que escrita direta no banco depois
   do fechamento não move o total.
2. **O detalhe ganha rota própria** ([ADR-001](adrs/adr-001.md)). Não é a
   primeira exceção a uma regra absoluta: `frontend-cruds` ADR-004 já deu rota de
   detalhe a condomínios, sob o critério de que material de referência ao qual se
   volta é o que merece uma página. Uma prestação de contas cumpre esse critério.

## Distribuição dos casos

Os 39 IDs estão atribuídos a exatamente uma task, sem órfão e sem duplicata —
10 unitários e 29 de integração:

- **task_01** — UT-125 a UT-130; IT-318 a IT-323
- **task_02** — IT-324 a IT-334
- **task_03** — IT-335 a IT-340; IT-342, IT-343, IT-346
- **task_04** — UT-131 a UT-134; IT-341, IT-344, IT-345

## Três recortes que o código sozinho não explicaria

**A montagem do lançamento fica na task_01, junto da escrita.** As mesmas funções
puras servem os dois caminhos — o que grava no fechamento e o que calcula ao vivo
num mês aberto. Quem escreve primeiro é quem fecha; deixá-las na task_02 faria a
leitura herdar código que ninguém exercitou ainda.

**O IT-341 é da task_04, e não da task_03.** Ele afirma duas metades: a seção
oferece o link **e** não oferece mais o `Exportar CSV`. A segunda só é verdade
depois que a exportação migra, e um caso que passa por meia razão não prova nada.

**A task_01 é `critical`.** Ela reescreve `close`, a escrita por onde passa toda
prestação de contas do produto: transação, bypass deliberado do `BaseRepository`
— que não participa de transação (`base.repository.ts:37-40`) — e limpeza
incondicional dos lançamentos anteriores.

## Um caso mudou de esteira

`balancete-mensal` IT-314 afirmava a exportação a partir da seção. O
[ADR-005](adrs/adr-005.md) move a exportação para a rota, e o caso foi com ela:
vira **IT-345** aqui, contra a tela nova. O id antigo está marcado como realocado
no `_tests.md` da esteira anterior e **não é reaproveitado**.

## Uma promessa anterior que deixa de valer, de propósito

A task_04 de `balancete-mensal` garantiu que `AUXILIARY_READS` de
`frontend/src/test/routes.test.tsx` não ganharia entrada nenhuma, e provou isso
com o IT-315: `/financeiro` não lê o balancete na montagem. Continua verdade.

A rota nova é outra superfície: ela **existe para** ler o balancete ao montar. A
task_03 acrescenta as entradas e escreve o porquê no lugar, para que a mudança
não seja lida como regressão daquela garantia.

## Execução sequencial

Cada task consome o que a anterior criou: a leitura precisa da tabela e do que
`close` grava nela, a tela precisa da rota, a exportação precisa da tela. Não
haveria onda paralela a montar mesmo que se quisesse — e o precedente do
repositório é sequencial de qualquer modo.

# Balancete mensal — plano de implementação

Levantamento e proposta para o fechamento de contas mensal do condomínio.
Escrito em 2026-09-17, a partir do código como ele está hoje.

## O problema

O módulo financeiro tem cobranças, pagamentos, despesas e categorias, e sabe
filtrar e somar cada um deles **isoladamente**. O que não existe é o documento
que o síndico presta ao condomínio todo mês: uma folha que abre com o saldo do
mês anterior, lista o que entrou e o que saiu por categoria, e fecha com o saldo
que passa para o mês seguinte.

Hoje, para produzir esse número, alguém precisa abrir três telas, aplicar
filtros equivalentes em cada uma e somar à mão — e não há nada que garanta que
os três recortes falam do mesmo período.

## O que já existe, e serve de base

| Entidade | Campo de período | Campos de valor | Status |
|---|---|---|---|
| `charge` | `referenceMonth` (`YYYY-MM`) e `dueDate` | `amount`, `discount`, `interest`, `penalty` | PENDING · PAID · PARTIAL · OVERDUE · CANCELED |
| `payment` | `paidAt` (data/hora) | `amount` | — (a baixa é feita pela cobrança) |
| `expense` | `competence` (`YYYY-MM`) e `dueDate` | `amount` | PENDING · PAID · OVERDUE · CANCELED |
| `financial_category` | — | — | `kind`: INCOME · EXPENSE |

Endpoints agregadores que já respondem:

- `GET /financial/charges/summary` — faturado, recebido, em atraso e taxa de
  inadimplência, por `referenceMonth`.
- `GET /financial/expenses/summary` — total e quebra por categoria, por
  `competence`.
- `GET /financial/charges/delinquency` — inadimplência por unidade.

São três respostas separadas, cada uma com o seu recorte. Nenhuma delas fecha
conta com a outra.

## As três decisões que precisam vir antes do código

Sem elas o relatório sai, mas sai errado — e errado de um jeito que só aparece
quando alguém confere.

### 1. Regime: caixa ou competência?

Os dados suportam os dois, e hoje o sistema mistura.

- **Caixa** — entra o que foi pago no mês (`payment.paidAt`), sai o que foi pago
  no mês (`expense.paidAt`). É o que bate com o extrato bancário, e é o que a
  maioria dos condomínios usa na prestação de contas.
- **Competência** — entra o que foi faturado para o mês
  (`charge.referenceMonth`), sai o que foi incorrido no mês
  (`expense.competence`). Mostra melhor o custo real de operar o prédio, e não
  bate com o banco.

**Recomendo caixa**, com a inadimplência do mês como quadro auxiliar. É o que o
condômino consegue conferir contra o extrato, e é o que a assembleia cobra.

A consequência prática: o `charges/summary` de hoje soma por `referenceMonth`, e
o balancete de caixa vai precisar somar por `payment.paidAt`. São perguntas
diferentes sobre a mesma tabela.

### 2. De onde vem o saldo anterior?

Não existe conta bancária no modelo, nem saldo em lugar nenhum. Um balancete sem
saldo inicial não fecha.

Três caminhos, do mais barato ao mais correto:

- **(a) Saldo inicial digitado uma vez por condomínio.** Um campo, uma data de
  corte, e daí em diante o saldo de cada mês é calculado. Barato; depende de
  ninguém alterar lançamento anterior ao corte.
- **(b) Saldo herdado do fechamento anterior.** Cada mês fechado grava o seu
  saldo final, e o mês seguinte o lê. Exige o conceito de fechamento (item 3).
- **(c) Entidade de conta/caixa com lançamentos.** O correto de verdade, e um
  módulo inteiro. Fora de escopo para um primeiro balancete.

**Recomendo (a) + (b)**: um saldo de abertura por condomínio, e daí em diante
cada fechamento grava o saldo que o próximo herda.

### 3. O que significa "fechado"?

Um balancete que muda depois de publicado não é prestação de contas. Precisa
existir um ato de fechar o mês, e depois dele:

- lançamento novo com competência/pagamento naquele mês é **recusado**, ou
  aceito e marcado como retificação — decisão de produto;
- o balancete daquele mês passa a ser servido do que foi gravado, e não
  recalculado a cada leitura.

Sem isso, reimprimir o balancete de março em setembro pode dar outro número, e
ninguém vai saber por quê.

## Proposta de implementação

Quatro fatias, cada uma entregável e verificável sozinha.

### Fatia 1 — Fundação de dados

- Entidade `FinancialClosing` (`financial_closings`): `condominiumId`,
  `referenceMonth`, `openingBalance`, `totalIncome`, `totalExpense`,
  `closingBalance`, `status` (OPEN · CLOSED), `closedAt`, `closedById`, com
  índice único em (`tenantId`, `condominiumId`, `referenceMonth`).
- Campo de saldo de abertura do condomínio, com data de corte.
- Migration seguindo o padrão de `1757700000000-LgpdTables.ts`.
- Recurso `financial-closing` no catálogo de permissões, com `read`, `create` e
  `manage` — o síndico fecha, o morador lê.

### Fatia 2 — O cálculo, no servidor

- `GET /financial/closings/:referenceMonth` — devolve o balancete do mês: saldo
  anterior, receitas por categoria, despesas por categoria, resultado do mês e
  saldo final. Recalcula enquanto o mês está aberto; serve o gravado depois de
  fechado.
- `POST /financial/closings/:referenceMonth/close` — congela o mês, grava os
  totais e o saldo final.
- Uma única consulta por lado, agrupando por categoria, e **um só caminho de
  soma** — o número do topo e o da tabela têm que sair da mesma query, ou vão
  divergir.

O ponto de atenção aqui é a categoria nula: cobrança e despesa aceitam
`categoryId` nulo. O balancete precisa de uma linha "Sem categoria" explícita,
nunca descartar o valor — um total que não fecha por causa de linha omitida é
pior do que uma linha feia.

### Fatia 3 — A tela

- Nova aba em `/financeiro`, ao lado de Cobranças, Despesas e Categorias.
- Seletor de mês, o quadro de saldos no topo, duas tabelas por categoria e o
  resultado embaixo.
- Botão de fechar o mês, visível só para quem tem `financial-closing:manage`, e
  com confirmação — é um ato que trava dados.
- Estado vazio honesto para mês sem lançamento: "Nenhum lançamento em março de
  2026", e não um balancete de zeros que parece calculado.

### Fatia 4 — Exportação

Um balancete existe para ser distribuído. PDF é o formato que a assembleia
espera; CSV serve para a contabilidade. O backend já serve arquivo com
autenticação (o módulo de documentos), então o caminho de download existe.

Sugiro deixar esta fatia por último e confirmar o formato antes: gerar PDF no
servidor adiciona dependência, e talvez o que baste seja a impressão do
navegador com uma folha de estilo própria.

## Como verificar

O risco deste módulo não é quebrar — é **fechar errado**. Os casos que importam:

- Um mês com cobrança paga parcialmente entra pelo valor pago, não pelo faturado.
- Cobrança cancelada não entra em lado nenhum.
- Despesa sem categoria aparece na linha "Sem categoria" e o total continua
  fechando.
- Juros, multa e desconto entram no valor recebido, e com o sinal certo.
- Saldo final de um mês é exatamente o saldo inicial do mês seguinte.
- Fechar duas vezes o mesmo mês não duplica nada.
- Um lançamento criado depois do fechamento não altera o balancete já gravado.

Os dois últimos são os que costumam passar despercebidos e são os que destroem a
confiança no relatório.

## O que este plano não resolve

- **Conciliação bancária.** Sem entidade de conta, o saldo é o que o sistema
  calcula, não o que o banco diz. Divergência vai existir e não terá onde ser
  registrada.
- **Rateio e fundo de reserva.** Se o condomínio separa fundo de reserva do
  ordinário, isso é uma dimensão a mais que o modelo atual não tem.
- **Exercício anual.** Um balancete mensal não vira demonstrativo anual por
  soma simples quando há retificação no meio.

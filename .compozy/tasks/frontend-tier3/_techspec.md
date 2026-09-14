# TechSpec: Telas Tier 3 — Financeiro, Assembleias e Documentos

As tres telas que faltavam para o menu ficar completo. Diferente dos tiers
anteriores, este nao passou por decomposicao em tasks: as tres foram construidas
em uma execucao, a pedido direto. Este documento registra o que foi feito e por
que, no mesmo lugar dos demais tiers.

## Por que ficaram para o fim

O `_techspec.md` do [`../frontend-tier2/`](../frontend-tier2/_techspec.md) as
deixou de fora dizendo que sao "genuinamente diferentes". Eram:

- **Financeiro** reune **quatro** recursos num modulo so — cobrancas, despesas,
  plano de contas e pagamentos —, e nenhum cabe sozinho num item de menu.
- **Assembleias** carrega um segundo recurso completo por dentro: votacoes, com
  alternativas, apuracao e voto.
- **Documentos** e o unico com **upload**: a criacao e multipart, nao JSON.

## Heranca de desenho

Valem sem alteracao e nao foram re-decididos: ADR-002 (personas), ADR-004
(dialogo, sem rota de detalhe), ADR-006 (excluidos visiveis e restauraveis),
ADR-008 (`lib/crud/`), ADR-009 (a tabela), ADR-010 (testes mockam `@/lib/api`).
Todos em [`../frontend-cruds/adrs/`](../frontend-cruds/adrs/).

## Os tres recursos

| Tela | Rotas do servidor | O que tem de diferente |
|---|---|---|
| Financeiro | `/financial/{categories,charges,expenses}` + `/payments` | Tres secoes sob uma rota; geracao em lote; baixa de pagamento; encargos em massa |
| Assembleias | `/assemblies` + `/polls` | Ciclo de tres acoes; votacoes em dialogo, com apuracao |
| Documentos | `/documents` | Upload multipart; download autenticado; exclusao definitiva |

## As decisoes que mudaram o padrao

### Financeiro: tres secoes, uma rota

O menu tem um item so, e os tres recursos sao lidos juntos — uma despesa e
classificada pela mesma conta que uma cobranca. Separar em tres itens obrigaria
a navegar entre telas para uma tarefa so. A troca de secao e estado local, sem
rota propria, pelo mesmo motivo que nao ha rota de detalhe (ADR-004).

Os filtros e as acoes de linha de cada secao moram **no arquivo da secao**, e nao
em modulos proprios como nas demais telas: esta e a unica tela com tres secoes, e
espalhar cada uma em quatro arquivos tornaria a feature dificil de percorrer.

### Documentos: exclusao definitiva, contra o ADR-006

`documentService.afterRemove` apaga o arquivo do disco e **nao existe rota de
restauracao** — e a eliminacao do dado que a LGPD exige. Por isso esta e a unica
tela do sistema sem alternador de removidos e sem acao de restaurar, e a
confirmacao diz que nao ha volta. Quem ja usou as outras telas espera o
contrario, e por isso o aviso e explicito.

### Documentos: download pelo cliente, e nao por link

A sessao viaja no cabecalho `Authorization`, e uma navegacao do navegador nao o
carrega — um `<a href>` daria 401. O arquivo vem como `blob` pelo mesmo cliente
das demais requisicoes. O custo: o corpo de erro tambem vem como blob, entao a
mensagem do servidor nao chega e o status e o que sobra.

### Acoes de ciclo por permissao, e nao por status

Assembleias (iniciar/encerrar/cancelar), votacoes (abrir/apurar) e cobrancas
(baixa/cancelar) oferecem a acao a quem tem a permissao, sem olhar a situacao. E
o padrao registrado na memoria do tier 2: a transicao valida e regra do servidor,
e duplica-la na tela cria uma segunda versao que dessincroniza. As recusas
aparecem na propria linha.

A excecao do ciclo linear — usada em Comunicados e Manutencoes — exige que o
requisito peca o recorte na interface. Aqui nenhum pediu.

### Dinheiro como texto, e nao pelo `CurrencyInput`

O controle de moeda guarda `number` e formata no proprio estado, o que quebraria
a convencao de valores em texto dos formularios deste projeto — a mesma escolha
que `unit-schema.ts` ja tinha feito para a taxa mensal. A formatacao acontece na
leitura, em `formatCurrency`.

## O que NAO mudou

- Nenhuma alteracao no backend.
- Nenhuma dependencia de runtime nova.
- `lib/crud/`, a tabela, os primitivos de formulario e o harness ficam como
  estao. O unico arquivo compartilhado tocado foi `test/setup.ts`, que ganhou o
  stub de `window.scrollTo` no tier anterior.

## Resultado

O menu passa a ter **22 de 22** telas. `frontend/src/test/routes.test.tsx` — que
substitui o `tier2-routes.test.tsx` — monta o roteador inteiro e confere que cada
um dos 22 caminhos chega na tela real, que as 21 com permissao negam quem nao a
tem, e que nenhum item leva mais ao `PlaceholderPage`.

Suite do frontend: 68 arquivos / 790 casos. Backend, intocado: 16 suites / 151
casos.

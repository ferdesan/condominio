---
schema_version: "compozy.tasks/v2"
workflow: backend-integration-specs
graph:
  nodes:
    - id: task_01
      file: task_01.md
    - id: task_02
      file: task_02.md
    - id: task_03
      file: task_03.md
  edges:
    - from: task_01
      to: task_02
---

# Backend Integration Specs — Task List

The five modules that the integration suite never touches, plus the two production
defects found while designing their coverage. Contracts in
[`_techspec.md`](_techspec.md); the 48 cases in [`_tests.md`](_tests.md); the
decisions and what they rejected in [`adrs/`](adrs/).

| Task | Entrega | Tipo | Complexidade | Casos |
|---|---|---|---|---|
| task_01 | Fecha o desvio do `/uploads` e o arquivo órfão do upload | bugfix | high | 3 |
| task_02 | `documents.spec.ts` — matriz de visibilidade, upload, download, LGPD | test | high | 25 |
| task_03 | `cadastros.spec.ts` — dependentes, funcionários, prestadores, áreas comuns | test | medium | 20 |

## Por que a correção vem antes dos testes

A matriz de visibilidade de `document.service.ts` é contornável em duas
requisições enquanto `/uploads` servir os mesmos bytes sem autenticação
(ADR-001). Os onze casos que a task_02 escreve descreveriam uma proteção que o
sistema não tem. Por isso a aresta `task_01 → task_02` existe, e por isso a
task_01 é `bugfix` e não `test`.

A task_03 não depende de nenhuma das duas: `cadastros.spec.ts` não toca nenhum
arquivo que as outras tocam, e nenhum dos seus vinte casos passa por
`documents`. Pode correr em paralelo desde o início.

## O contrato entre task_01 e task_02

As duas escrevem no mesmo arquivo, em ordem garantida pela aresta.

A **task_01** cria `backend/tests/integration/documents.spec.ts` com o esqueleto
— `beforeAll` com as personas, o helper de envio multipart, e o `afterAll`
combinado que remove o diretório do tenant antes de derrubar o contexto — e os
três casos que provam as próprias correções: IT-214, IT-234 e IT-235.

A **task_02** estende esse arquivo com os outros vinte e cinco, reusando o
helper como ele ficou. Não recria o esqueleto.

Uma correção que chega sem prova não é uma correção, e um esqueleto construído
duas vezes diverge — daí a divisão ser esta e não "task_01 corrige, task_02
testa tudo".

## Distribuição dos casos

Os 48 IDs de `_tests.md` estão atribuídos a exatamente uma task, sem órfão e sem
duplicata:

- **task_01** — IT-214, IT-234, IT-235
- **task_02** — IT-210 a IT-213, IT-215 a IT-233, IT-236, IT-257
- **task_03** — IT-237 a IT-256

## O que nenhuma task cobre, de propósito

`common-area.beforeRemove` — a guarda que recusa excluir uma área com reserva
futura — fica sem caso. É SQL escrito à mão, os testes rodam em SQLite e a
produção é MySQL; um resultado verde ali não falaria pela produção (ADR-004). As
reservas semeadas que a exercitariam continuam no seed para quando essa decisão
for revista.

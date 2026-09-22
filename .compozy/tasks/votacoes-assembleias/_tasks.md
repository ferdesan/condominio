---
schema_version: "compozy.tasks/v2"
workflow: votacoes-assembleias
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
    - from: task_02
      to: task_03
    - from: task_02
      to: task_04
---

# Votações em Assembleias — lista de tasks

Morador vota em `/votacoes/:pollId`; síndico/admin registra voto por unidade com
lista de status. Contratos em [`_techspec.md`](_techspec.md), os 61 casos em
[`_tests.md`](_tests.md), as decisões em [`adrs/`](adrs/).

| Task | Entrega | Tipo | Complexidade | Casos |
|---|---|---|---|---|
| task_01 | Backend: cleanup, elegibilidade e vote-status | backend | high | 13 |
| task_02 | Frontend base: tipos, hooks, labels e deep-link | frontend | medium | 10 |
| task_03 | VotePage + rota /votacoes/:pollId | frontend | high | 24 |
| task_04 | Deliberações: Votar + gestão por unidade | frontend | high | 14 |

## As decisões que vieram antes do código

Product ADRs (PRD) e técnicos (TechSpec) **não se reabrem** durante a execução:

1. **[ADR-001](adrs/adr-001.md)** — rota `/votacoes/:pollId` é a superfície canônica de voto.
2. **[ADR-002](adrs/adr-002.md)** — identidade gravada só em voto não-secreto; secreto força null.
3. **[ADR-003](adrs/adr-003.md)** — gestão por unidade, status sem revelar opção, `vote:manage`.
4. **[ADR-004](adrs/adr-004.md)** — após votar: confirmação e depois apuração legível.
5. **[ADR-005](adrs/adr-005.md)** — `GET /polls/:id/vote-status` dedicado, seguro para voto secreto.
6. **[ADR-006](adrs/adr-006.md)** — `DETAIL_PREFIXES` preserva o path completo do deep-link.
7. **[ADR-007](adrs/adr-007.md)** — servidor recusa proxy em unidade inelegível em poll OWNERS.

## Distribuição dos casos

Os 61 IDs de [`_tests.md`](_tests.md) estão atribuídos a exatamente uma task
(auditoria: 11 UT-135–UT-145 + 50 IT em 347, 349–397; IT-348 nunca foi definido):

- **task_01** — UT-140; IT-369, IT-370, IT-377, IT-380, IT-385–IT-387, IT-393–IT-397
- **task_02** — UT-135, UT-136, UT-138, UT-139, UT-141–UT-145; IT-388
- **task_03** — UT-137; IT-347, IT-349–IT-357, IT-362–IT-368, IT-371, IT-372, IT-389–IT-392
- **task_04** — IT-358–IT-361, IT-373–IT-376, IT-378, IT-379, IT-381–IT-384

`task_01` e `task_02` não têm arestas de entrada e podem correr em paralelo.
`task_03` e `task_04` só dependem de `task_02` (tipos/hooks) e também podem
correr em paralelo entre si. O contrato de API está congelado no TechSpec —
a UI testa contra transporte simulado (ADR-010), sem esperar o backend.

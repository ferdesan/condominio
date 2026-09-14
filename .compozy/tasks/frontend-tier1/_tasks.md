---
schema_version: "compozy.tasks/v2"
workflow: frontend-tier1
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
      to: task_04
    - from: task_02
      to: task_04
    - from: task_03
      to: task_04
---

# Frontend Tier 1 Task List

Seis telas CRUD que replicam o padrão verificado em `../frontend-cruds/`.
Sem redesenho: ver [`_techspec.md`](_techspec.md).

| Task | Telas | Tipo | Complexidade |
|---|---|---|---|
| task_01 | Dependentes, Funcionários | frontend | medium |
| task_02 | Prestadores, Veículos | frontend | medium |
| task_03 | Áreas comuns, Blocos | frontend | medium |
| task_04 | Registro das 6 rotas e verificação | frontend | low |

## Ondas

1. **task_01, task_02, task_03** — paralelas, diretórios de feature disjuntos.
   **Nenhuma toca o roteador.**
2. **task_04** — registra as seis rotas de uma vez e roda o pipeline.

A separação do roteador é deliberada: na rodada anterior, três agentes
paralelos editando `app-router.tsx` conflitaram e derrubaram a run.

---
schema_version: "compozy.tasks/v2"
workflow: condominio-finalizacao
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
    - id: task_06
      file: task_06.md
  edges:
    - from: task_01
      to: task_02
    - from: task_01
      to: task_04
    - from: task_02
      to: task_03
    - from: task_03
      to: task_06
---

# Condomínio SaaS — Finalização (LGPD + Testes) Task List

## Summary

6 tasks decomposing the LGPD compliance and test coverage PRD into independently implementable slices.

## Task Graph

```
Task 1 (Migration+RBAC)
  ├──→ Task 2 (Backend LGPD) ──→ Task 3 (Frontend LGPD) ──→ Task 6 (Frontend LGPD Tests)
  └──→ Task 4 (Backend Tests 4 módulos)

Task 5 (Frontend Infra Tests) [independente — sem dependências]
```

## Test Distribution

| Task | UT | IT | Total |
|------|----|----|-------|
| task_01 | 0 | 0 | 0 |
| task_02 | 23 | 48 | 71 |
| task_03 | 0 | 4 | 4 |
| task_04 | 0 | 4 | 4 |
| task_05 | 9 | 0 | 9 |
| task_06 | 0 | 1 | 1 |
| **Total** | **32** | **57** | **89** |

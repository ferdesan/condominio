---
schema_version: "compozy.tasks/v2"
workflow: frontend-cruds
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
    - id: task_07
      file: task_07.md
  edges:
    - from: task_01
      to: task_03
    - from: task_02
      to: task_03
    - from: task_03
      to: task_04
    - from: task_03
      to: task_05
    - from: task_03
      to: task_06
    - from: task_04
      to: task_07
    - from: task_05
      to: task_07
    - from: task_06
      to: task_07
---

# Frontend CRUDs Task List

Back-office screens for condominiums, units (with embedded blocks), residents and
reservations, consuming the existing API only, plus repair of the CI pipeline.

Source documents: [`_prd.md`](_prd.md), [`_user_stories.md`](_user_stories.md),
[`_techspec.md`](_techspec.md), [`_tests.md`](_tests.md), [`adrs/`](adrs/).

## Tasks

| Task | Title | Type | Complexity | Tests |
|---|---|---|---|---|
| task_01 | Data foundation and test harness | frontend | high | 37 UT |
| task_02 | Table repair and form primitives | frontend | medium | 21 UT |
| task_03 | Condomínios — reference implementation | frontend | high | 3 UT, 46 IT |
| task_04 | Unidades and embedded block management | frontend | high | 7 UT, 54 IT |
| task_05 | Moradores | frontend | medium | 5 UT, 39 IT |
| task_06 | Reservas | frontend | critical | 27 UT, 53 IT |
| task_07 | Cross-cutting hardening and pipeline gate | frontend | medium | 17 IT |

## Execution Waves

Derived from the graph edges above:

1. **task_01, task_02** — disjoint file sets, run in parallel.
2. **task_03** — establishes the screen, form and permission-gating patterns the rest follow.
3. **task_04, task_05, task_06** — disjoint feature directories, run in parallel.
4. **task_07** — verifies behavior that spans every screen, then the pipeline.

## Test Contract Distribution

All 309 cases from [`_tests.md`](_tests.md) are assigned exactly once:
100 unit cases and 209 integration cases. No end-to-end cases exist — the TechSpec
records the substitution and its reason.

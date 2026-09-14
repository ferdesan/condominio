---
schema_version: "compozy.tasks/v2"
workflow: frontend-tier2
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

# Frontend Tier 2 Task List

Oito telas que reusam o padrão verificado, cada uma com um fluxo de domínio.
Ver [`_techspec.md`](_techspec.md).

| Task | Telas | Fluxo |
|---|---|---|
| task_01 | Visitantes, Correspondências | check-in/out, entrega |
| task_02 | Comunicados, Ocorrências | publicar/arquivar, status/atribuir |
| task_03 | Manutenções, Usuários | iniciar/concluir/cancelar, resetar senha |
| task_04 | Auditoria, Notificações | somente leitura, marcar lidas |
| task_05 | Registro das 8 rotas | verificação do pipeline |

## Execução sequencial, deliberadamente

As arestas formam uma cadeia: cada task espera a anterior. **Isto é
intencional.** As duas execuções anteriores usaram ondas paralelas e as duas
falharam — a primeira no resolvedor de conflitos, a segunda por timeout com
três agentes disputando a máquina durante a verificação.

Sequencial é mais lento no relógio e não falhou nenhuma vez.

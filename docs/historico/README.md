# Histórico de entregas

> **Estes arquivos são registros datados, e não documentação atual.**
> Eles descrevem o estado do projeto no dia em que foram escritos e não são
> atualizados desde então. Para o estado de hoje, veja o
> [README](../../README.md), o [Quick Start](../QUICKSTART.md) e o
> [guia Docker](../DOCKER.md).

O que se busca aqui é o *porquê* de uma decisão antiga, não o *como* do sistema
atual. Quando os dois divergirem, o código está certo e o documento está velho.

## Task 01 — DevOps e ambiente

Cinco documentos cobrem a mesma entrega, em graus de detalhe diferentes. Se for
ler só um, leia o resumo.

| Arquivo | Data | O que é |
|---|---|---|
| [TASK-01-SUMMARY.md](TASK-01-SUMMARY.md) | 2026-09-08 | O resumo da entrega |
| [FASE8-RELATORIO.md](FASE8-RELATORIO.md) | 2026-09-11 | Relatório de execução da fase |
| [00-START-HERE.md](00-START-HERE.md) | 2026-09-12 | Roteiro de leitura da época |
| [DEVOPS-DELIVERABLES.md](DEVOPS-DELIVERABLES.md) | 2026-09-12 | Lista de entregáveis |
| [IMPLEMENTATION-COMPLETE.md](IMPLEMENTATION-COMPLETE.md) | 2026-09-12 | Conclusão da implementação |
| [DEVOPS-VERIFICATION.md](DEVOPS-VERIFICATION.md) | 2026-09-12 | Roteiro de validação do ambiente |

## Task 02 — Componentes base da UI

| Arquivo | Data | O que é |
|---|---|---|
| [TASK-02-SUMMARY.md](TASK-02-SUMMARY.md) | 2026-09-12 | O resumo da entrega |
| [COMPONENTS-IMPLEMENTATION.md](COMPONENTS-IMPLEMENTATION.md) | 2026-09-12 | Detalhamento dos 11 componentes |
| [00-TASK-02-COMPLETE.md](00-TASK-02-COMPLETE.md) | 2026-09-12 | Conclusão da implementação |

A documentação viva desses componentes é a que está em
[`frontend/COMPONENTS.md`](../../frontend/COMPONENTS.md), junto do código.

## Revisão de código

| Arquivo | Data | O que é |
|---|---|---|
| [review-final.md](review-final.md) | 2026-09-12 | Revisão completa de frontend e backend |

**As contagens desta revisão estão vencidas** — ela fala em 42 componentes TSX e
3.221 linhas de frontend, medidos antes de metade das telas existir. As
observações de arquitetura e segurança seguem valendo; os números, não.

## Onde mora o resto

- **Especificação do roadmap:** [`tasks/`](../../tasks/) — o que foi planejado
  fazer, por tarefa.
- **Rastreamento do frontend por tier:** [`.compozy/tasks/`](../../.compozy/tasks/)
  — os task files, as decisões e a memória de cada execução.

# Especificação do roadmap

Esta pasta guarda os **prompts e planos** que originaram o produto — o que se
pediu, não o que se entregou. O resultado de cada um está no código; os
relatórios de entrega estão em [`docs/historico/`](../docs/historico/) e o
rastreamento do frontend por tier, em [`.compozy/tasks/`](../.compozy/tasks/).

> **Quase tudo aqui já foi consumido.** Os arquivos permanecem como registro da
> intenção original. Antes de tratar qualquer um deles como uma lista de
> trabalho, leia a seção "O que ainda está em aberto" — é a única parte desta
> pasta que descreve algo por fazer.

## O que ainda está em aberto

Cinco itens do [`task-imlementacao.md`](task-imlementacao.md) continuam válidos,
verificados contra o código em 2026-09-14:

| Item | Onde estava | Estado |
|---|---|---|
| **Meu perfil** (`/perfil`) — dados da conta e troca de senha | Fase 6 | Ainda é `PlaceholderPage`; `/auth/me` já existe no servidor |
| **Matriz de papéis e permissões** | Fase 6 | Nunca construída. `/roles` hoje só alimenta o seletor da tela de Usuários |
| **Notificações em tempo real** | Fase 6 | A tela existe e o backend emite `notification:new`; nenhuma tela escuta o Socket.IO |
| **Specs de integração ausentes** no backend | Fase 7 | As 8 specs não cobrem `documents`, `dependents`, `employees`, `service-providers` nem `common-areas` |
| **Exportação/anonimização de dados pessoais (LGPD)** | 2.6 | Não existe endpoint. O próprio documento marca como "confirmar com o dono do produto" |

Duas divergências entre o que foi pedido e o que foi entregue, menores mas reais:

- [`06-reservas.md`](06-reservas.md) pede calendário **mensal, semanal e
  diário**. Só o mensal existe
  ([`calendar-grid.ts`](../frontend/src/features/reservations/calendar-grid.ts)).
- [`03-condominios.md`](03-condominios.md) cita um papel `GESTOR` que não existe
  no sistema. Os papéis são `SUPER_ADMIN`, `ADMIN`, `SINDICO`, `STAFF` e
  `RESIDENT`.

## Reutilizável a qualquer momento

| Arquivo | O que é |
|---|---|
| [code-review.md](code-review.md) | Prompt de auditoria de arquitetura, qualidade e segurança. Não é tarefa: pode rodar de novo quando quiser, e grava a saída em `review-final.md` |

Vale rodar: o [review arquivado](../docs/historico/review-final.md) é de
2026-09-12 e conta 42 componentes TSX, medidos antes de metade das telas existir.

## Já consumidos

O trabalho descrito está no código. Servem para responder *por que* algo foi
feito de determinado jeito, não *como* o sistema funciona hoje.

| Arquivo | O que pedia |
|---|---|
| [task-condominio-completo.md](task-condominio-completo.md) | O escopo-mãe: stack, 22 requisitos funcionais, arquitetura, segurança e entregáveis |
| [master-roadmap.md](master-roadmap.md) | A ordem de execução das seis tasks numeradas |
| [01-devops.md](01-devops.md) | Ambiente e ferramental |
| [02-ui-components.md](02-ui-components.md) | Os componentes base da UI |
| [03-condominios.md](03-condominios.md) | Módulo de condomínios |
| [04-moradores.md](04-moradores.md) | Módulo de moradores |
| [05-unidades.md](05-unidades.md) | Módulo de unidades |
| [06-reservas.md](06-reservas.md) | Reservas de áreas comuns |
| [fase8-devops.md](fase8-devops.md) | Docker Compose, Dockerfile do frontend e GitHub Actions |

## Um aviso sobre o `task-imlementacao.md`

Ele é uma análise de lacunas datada de **2026-09-11** e **afirma coisas que hoje
são falsas**: que não existe `docker-compose.yml`, que não existe
`.github/workflows`, que o frontend tem zero arquivos de teste e que 21 itens de
menu renderizam `PlaceholderPage`. Os quatro já foram resolvidos.

O que sobrevive dele é a tabela acima. O resto é fotografia de um dia.

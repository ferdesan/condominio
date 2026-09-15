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

**Nenhuma rota do servidor está sem interface por esquecimento.**

Uma auditoria de **2026-09-14** comparou cada rota de
`backend/src/modules/*/*.routes.ts` com os literais de caminho em `frontend/src`
e encontrou cinco lacunas. As cinco foram fechadas no workflow
[`.compozy/tasks/backoffice-gaps/`](../.compozy/tasks/backoffice-gaps/) — ver
"Já entregue", abaixo. O que sobra desta pasta são **decisões de produto**, e
não trabalho de interface pendente.

A mais consequente das cinco era **Configurações da administradora**:
`charge.service.ts` lê a multa, os juros e a carência de `tenant.settings`, e
não havia onde configurá-los — o botão "aplicar encargos" da tela de Financeiro
usava o valor da semente ou o padrão embutido no código.

### Abertos, e cada um por um motivo diferente

São três naturezas diferentes, e vale não confundi-las:

- **Trabalho por fazer, no backend**: as specs de integração e a exportação LGPD.
- **Outro produto**: o portal do morador — as rotas existem, a interface é de
  outro escopo.
- **Existe e fica sem tela de propósito**: as três últimas. Usá-las deste
  back-office faria dano ou não faria nada, e o motivo está escrito no código.

| Item | Onde estava | Estado |
|---|---|---|
| **Specs de integração ausentes** no backend | Fase 7 | As 8 specs não cobrem `documents`, `dependents`, `employees`, `service-providers` nem `common-areas` |
| **Exportação/anonimização de dados pessoais (LGPD)** | 2.6 | Não existe endpoint. O próprio documento marca como "confirmar com o dono do produto" |
| **Portal do morador** | — | `POST /polls/:id/vote`, `GET /financial/charges/my` e `GET /residents/my-unit` existem no servidor. É outro produto, não uma lacuna deste back-office |
| **Preferências de notificação sem despachante** | — | `users.preferences.emailNotifications` e `pushNotifications` são gravadas e **nenhum código as lê**. A tela de perfil as omite de propósito |
| **Contador de visualizações de comunicado** | — | `POST /announcements/:id/read` soma em `reads_count` sem vínculo com quem leu. Chamá-lo de um back-office corromperia o dado; pertence ao portal do morador |
| **`dashboard:refresh`** | — | Declarado em `RealtimeEvent` e **nunca emitido** por nenhum serviço. Fica sem ouvinte até alguém dispará-lo |

### Já entregue

O workflow `backoffice-gaps` fechou em 2026-09-14, com as seis tasks concluídas.
A suíte do frontend saiu de 69 arquivos / 810 casos para **74 / 945**, sempre com
o mesmo teto de lint (5 avisos, 0 erros).

| Item | Onde estava | Onde está |
|---|---|---|
| **Meu perfil** (`/perfil`) — dados da conta, troca de senha e sessões ativas | Fase 6 | [`frontend/src/features/profile/`](../frontend/src/features/profile/). Era o último `PlaceholderPage` do sistema |
| **Configurações da administradora** (`/configuracoes`) — cadastro e política de encargos | task_02 | [`frontend/src/features/tenant/`](../frontend/src/features/tenant/) |
| **Papéis e permissões** (`/papeis`) — CRUD e a matriz do catálogo | task_03 | [`frontend/src/features/roles/`](../frontend/src/features/roles/) |
| **Recuperação de senha** (`/esqueci-senha`, `/redefinir-senha`) — públicas, com link no login | task_01 | [`frontend/src/features/auth/`](../frontend/src/features/auth/) |
| **Leituras órfãs** — gráfico de ocorrências, histórico de pagamentos, consulta por código, mural | task_04 | acréscimos em `dashboard/`, `financial/`, `visitors/`, `announcements/` |
| **Tempo real** — oito eventos invalidando consultas, com degradação silenciosa | task_05 | [`frontend/src/hooks/use-realtime.ts`](../frontend/src/hooks/use-realtime.ts) |

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

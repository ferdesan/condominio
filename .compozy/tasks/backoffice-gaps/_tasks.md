---
schema_version: "compozy.tasks/v2"
workflow: backoffice-gaps
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
    - from: task_02
      to: task_03
    - from: task_03
      to: task_04
    - from: task_04
      to: task_05
    - from: task_05
      to: task_06
---

# Lacunas do back-office — lista de tasks

As rotas que o servidor expõe e nenhuma tela chama, levantadas pela auditoria de
2026-09-14. Contratos e restrições em [`_techspec.md`](_techspec.md).

| Task | Entrega | Rotas que deixam de ficar ociosas |
|---|---|---|
| task_01 | ✅ Recuperação de senha | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| task_02 | ✅ Configurações da administradora | `GET /tenants/me`, `PATCH /tenants/me` |
| task_03 | ✅ Papéis e permissões | `/roles` CRUD, `GET /roles/permissions` |
| task_04 | ✅ Leituras órfãs | painel, pagamentos, código de acesso, mural (o `POST /:id/read` ficou de fora, com motivo) |
| task_05 | ✅ Tempo real (Socket.IO) | oito eventos ouvidos; o nono nunca é emitido |
| task_06 | ✅ Registro das rotas e do menu | absorvida pelas tasks 01–03 |

## `/perfil` não está aqui

Era o item 1 do inventário e foi entregue antes deste workflow abrir, em
`frontend/src/features/profile/`. Continua citado no `_techspec.md` porque é o
**precedente** de tela que consome `/auth` sem a fábrica de CRUD — task_01 e
task_02 herdam a forma dele.

## Execução sequencial, deliberadamente

As arestas formam uma cadeia: cada task espera a anterior. No `frontend-tier2`
duas execuções em ondas paralelas falharam — a primeira no resolvedor de
conflitos, a segunda por timeout com três agentes disputando a máquina durante a
verificação. Sequencial é mais lento no relógio e não falhou nenhuma vez.

## Estado

**Workflow concluído** em 2026-09-14 — as seis tasks.

- `features/auth/`: `/esqueci-senha` e `/redefinir-senha`, públicas, mais o link
  no login. A moldura das telas públicas virou `components/auth-shell.tsx`.
- `features/tenant/`: `/configuracoes` e item de menu.
- `features/roles/`: `/papeis` e item de menu; `Role` mudou de `types/user.ts`
  para `types/role.ts`.
- Acréscimos em quatro telas existentes: gráfico de ocorrências no painel,
  histórico de pagamentos no financeiro, consulta por código na portaria e o
  mural em comunicados.
- **task_06 não tem mais objeto**: cada task registrou a própria rota, e nem
  task_04 nem task_05 criam rota.

- Canal de tempo real ligado em `hooks/use-realtime.ts`, montado no shell.

Suite em **74 arquivos / 945 casos**, de 69 / 810 na abertura.

**Duas coisas ficaram deliberadamente de fora**, cada uma com o motivo no
arquivo da task e no código:

- `POST /announcements/:id/read` é um contador de visualizações, e não um recibo
  por pessoa — chamá-la de um back-office corromperia o único número de alcance
  do produto (task_04).
- `dashboard:refresh` é declarado pelo servidor e nunca emitido por nenhum
  serviço — mapeá-lo seria manter um caminho que nunca executa (task_05).

## Um único dono para o roteador

`frontend/src/routes/app-router.tsx` e `frontend/src/routes/navigation.ts` são
de **task_06** — **quando as tasks correm em paralelo**, que é o caso contra o
qual a regra foi escrita. Numa execução manual e sequencial ela cobra um preço
sem comprar nada: as três rodaram sozinhas e registraram a própria rota, porque
uma tela inalcançável esperando pela última task da cadeia não é entrega.

De qualquer forma a rede continua a mesma: `src/test/routes.test.tsx` compara a
contagem de rotas registradas com `NAV_ITEMS.length`, então uma rota registrada
sem entrar no menu — ou o contrário — quebra o teste em vez de passar
despercebida.

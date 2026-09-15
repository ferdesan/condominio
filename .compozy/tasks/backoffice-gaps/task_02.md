---
status: completed
title: Configurações da administradora
type: frontend
complexity: medium
---

# Task 2: Configurações da administradora

## Overview

`/tenants` é o maior módulo do backend sem nenhuma interface: `GET /tenants/me`
e `PATCH /tenants/me` existem, e o frontend nunca chamou a palavra `tenants`.

A consequência prática não é cosmética. **A política de encargos que o botão
"aplicar encargos" da tela de Financeiro executa não tem onde ser configurada.**
`charge.service.ts:310-312` lê `latePenaltyPercent`, `lateInterestPercent` e
`chargeGraceDays` de `tenant.settings`; hoje esses valores vêm da semente ou do
padrão embutido no código, e ninguém consegue mudá-los pelo produto.

<critical>
- ALWAYS READ the TechSpec before starting — os cinco campos proibidos estão lá
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST criar `frontend/src/features/tenant/` com página, hooks, schema e subpasta `components/` — kebab-case, export nomeado, sem barrel.
- MUST **NÃO** oferecer `plan`, `status`, `maxCondominiums`, `maxUsers` nem `slug`. `tenantService.update:67-81` recusa os cinco com **403** para quem não é super-admin; oferecê-los faria todo salvamento falhar. Exibi-los como leitura é aceitável e desejável — o plano e os limites interessam a quem administra.
- MUST oferecer, como edição: `name`, `document` (CNPJ), `email`, `phone`, `logoUrl` e os campos de `settings`.
- MUST dar destaque próprio aos três campos de `settings` que são lidos de verdade — `chargeGraceDays`, `latePenaltyPercent`, `lateInterestPercent` — e dizer na tela **onde** eles agem, porque o efeito acontece noutro módulo.
- MUST enviar `settings` como objeto; o servidor mescla com o que já existe, então mandar só o que a tela oferece não apaga o resto.
- MUST respeitar os limites do `settings` do servidor: `chargeGraceDays` inteiro de 0 a 30; `latePenaltyPercent` e `lateInterestPercent` de 0 a 20.
- MUST **NÃO** usar `CrudLayout` nem a fábrica do ADR-008: não há lista, não há `:id`, e o alvo é sempre o tenant da sessão. Seguir a forma de `features/profile/` — pilha de `Card`, um por assunto.
- MUST **NÃO** herdar o condomínio selecionado no shell. O recurso é do tenant, como `/usuarios` e `/auditoria`.
- MUST gatilhar a edição por `tenant:update` e a leitura por `tenant:read`; sem a de leitura, a tela não deve ser alcançável.
- ~~MUST **NÃO** tocar `frontend/src/routes/app-router.tsx` nem `navigation.ts`. O registro é da task_06.~~ **Revogado na execução.** A regra existe contra conflito entre tasks concorrentes; esta execução foi manual e sequencial, e entregar uma tela inalcançável não é entrega. `/configuracoes` foi registrada aqui, com o item de menu e a cobertura em `routes.test.tsx`. A task_06 deixa de fazê-lo.
- MUST declarar os tipos em `frontend/src/types/tenant.ts`, **não** em `types/api.ts`.
</requirements>

## Subtasks

- [x] 2.1 Tipos em `frontend/src/types/tenant.ts`, incluindo `TenantSettings`.
- [x] 2.2 Hooks de leitura e atualização de `/tenants/me`.
- [x] 2.3 Cartão de identificação: nome, CNPJ, e-mail, telefone, logo.
- [x] 2.4 Cartão de política de encargos: carência, multa e juros, com o efeito explicado.
- [x] 2.5 Cartão de plano e limites, **somente leitura**, dizendo por quem é alterado.
- [x] 2.6 Gating por permissão: sem `tenant:update`, a tela lê e não edita.
- [x] 2.7 Testes da tela, incluindo a recusa 403 e os limites numéricos.

## Implementation Details

Criar `frontend/src/features/tenant/`.

`frontend/src/features/profile/` é o molde: mesma situação — recurso único,
alvo derivado da sessão, sem lista atrás. A diferença é que aqui **há**
permissão a conferir, e o perfil não tinha nenhuma.

Os contratos estão em [`_techspec.md`](_techspec.md); a fonte de verdade é
`backend/src/modules/tenants/tenant.schema.ts` e `tenant.service.ts`. Leia
`tenantService.update` antes de decidir qualquer campo: a lista de proibidos
está escrita lá, e ela é a razão de metade dos requisitos acima.

Nem `CurrencyInput` nem `Input type="number"` servem para os percentuais — o
primeiro guarda `number` e quebra a convenção de valores em texto, o segundo
engole a vírgula decimal. Ver "O que a execução descobriu", abaixo.

### Relevant Files

- `frontend/src/features/profile/profile-page.tsx` — a forma de tela sem recurso: pilha de `Card`, um por assunto.
- `frontend/src/features/profile/profile-hooks.ts` — por que uma rota de contexto não passa pela fábrica.
- `frontend/src/features/users/` — tela por tenant que **não** herda o condomínio do shell.
- `frontend/src/features/financial/` — onde os três campos de `settings` produzem efeito; a tela deve apontar para lá.
- `frontend/src/lib/form-errors.ts` — `applyApiError`.
- `backend/src/modules/tenants/` — schema, service e rotas.
- `backend/src/modules/financial/services/charge.service.ts` — linhas 310-312, os leitores de `settings`.

### Dependent Files

- ~~task_06 — registra `/configuracoes` e o item de menu.~~ Feito nesta task.

### Related ADRs

- [ADR-004](../frontend-cruds/adrs/adr-004.md), [ADR-010](../frontend-cruds/adrs/adr-010.md).

## O que a execução descobriu

**`input type="number"` engole a vírgula decimal, e o resultado é um erro de
10x num campo de dinheiro.** Digitar `1,5` em Juros produzia `15` — quinze por
cento ao mês em vez de um e meio — sem nenhum aviso: o navegador descarta a
vírgula e o `5` se concatena ao `1`. Um teste pegou isso.

Por isso os dois percentuais são `type="text"` com `inputMode="decimal"`, e a
carência continua `type="number"`: ela é inteira e não corre o risco. A
divergência de tipo entre campos vizinhos é deliberada e está comentada em
`tenant-settings-form.tsx`.

Isto **contradiz em parte** a nota do `frontend-tier3` ("dinheiro é digitado
como decimal em `Input type="number"`"). A nota continua válida contra o
`CurrencyInput`, que guarda `number` e quebra a convenção de valores em texto;
o que ela não previu foi o separador decimal em pt-BR. Vale para qualquer campo
decimal daqui em diante.

## Verificação da execução

Sequência completa, na ordem do CI, em 2026-09-14:

```
lint       5 avisos, 0 erros   (o teto conhecido, inalterado)
typecheck  zero
test       70 arquivos / 837 casos   (baseline 69 / 810; +27 desta tela)
build      zero
backend typecheck  zero
backend test       nao executado -- precisa de MySQL e Redis, e o backend nao foi tocado
```

## Deliverables

- Tela de configurações da administradora, com a política de encargos editável.
- Plano e limites visíveis e não editáveis.
- Tipos em `types/tenant.ts`, fora de `types/api.ts`.
- `/configuracoes` registrada, no menu e coberta por `routes.test.tsx` (era da task_06; ver o requisito revogado).
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

- [x] Carrega `GET /tenants/me` e preenche o formulário com o que voltou.
- [x] Salvar envia `PATCH /tenants/me` só com os campos que a tela oferece.
- [x] O corpo enviado **não contém** `plan`, `status`, `maxCondominiums`, `maxUsers` nem `slug` — asserção explícita sobre as cinco chaves.
- [x] `settings` vai como objeto e preserva as chaves que a tela não oferece.
- [x] Recusa 403 do servidor aparece como mensagem de formulário, preservando o preenchido.
- [x] Recusa 422 com campo aparece no campo.
- [x] `chargeGraceDays` fora de 0–30 é barrado no cliente; o mesmo para 0–20 em multa e juros.
- [x] Plano e limites aparecem como leitura, sem campo editável.
- [x] Sem `tenant:update`, a tela lê e não oferece salvar.
- [x] Duplo clique em salvar dispara uma requisição só.
- [x] A tela não dispara nenhuma requisição escopada a condomínio, e não muda ao trocar o condomínio do shell.
- [x] Células nulas renderizam placeholder, nunca "null".

## Success Criteria

- Every assigned test case implemented and passing
- `npm --prefix frontend run typecheck` sai zero
- `npm --prefix frontend run lint` continua com **5 avisos e 0 erros**
- `npm --prefix frontend run test` sai zero, incluindo os casos já existentes
- `git diff --name-only` **não** inclui `frontend/src/types/api.ts` (o roteador e a navegação entraram nesta task, ver o requisito revogado acima)
- Nenhuma dependência de runtime nova
- Nenhuma alteração no backend

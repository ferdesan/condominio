---
status: resolved
file: backend/src/modules/assemblies/services/poll.service.ts
line: 157
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: close() allows closing DRAFT or CANCELED polls

## Review Comment

`close()` only rejects when `status === 'CLOSED'`. A `DRAFT` (never opened)
or `CANCELED` poll can be closed: it gets `resultsPublishedAt` and empty
results without ever going through `open()`. State machine is
DRAFT → OPEN → CLOSED; closing should require an open poll (mirror of
`open()` requiring `DRAFT`).

Suggested fix:

```ts
if (poll.status === 'CLOSED') throw new BusinessRuleError('Votacao ja esta encerrada.');
if (poll.status !== 'OPEN') {
  throw new BusinessRuleError('Somente votacoes abertas podem ser encerradas.');
}
```

Cover with an integration test for close-from-DRAFT → 409.

## Triage

- Decision: `VALID`
- Notes: Valid. close() now requires status OPEN (only already-CLOSED kept as separate message).
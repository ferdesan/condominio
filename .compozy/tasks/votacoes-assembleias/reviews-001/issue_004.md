---
status: resolved
file: backend/src/modules/assemblies/services/poll.service.ts
line: 336
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Secret votes persist ipAddress

## Review Comment

`persistVote` always stores `ipAddress: ctx.ipAddress ?? null`, including when
`poll.isSecret` is true. ADR-002 forces `voterId`/`voterName` to null on secret
ballots but leaves the client IP as a quasi-identifier on the same row,
weakening anonymity if the DB is queried or breached.

Suggested fix: null the address on secret polls at write time:

```ts
ipAddress: poll.isSecret ? null : (ctx.ipAddress ?? null),
```

Add/adjust a secret-storage integration assertion that `ip_address` is null.

## Triage

- Decision: `VALID`
- Notes: Valid. persistVote stores ipAddress null when poll.isSecret, aligning with ADR-002 write-time anonymity.
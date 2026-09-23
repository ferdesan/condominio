---
status: resolved
file: frontend/src/features/assemblies/vote-page.tsx
line: 63
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: All 409s treated as already-voted on VotePage

## Review Comment

`onError` maps every `error.status === 409` to the `conflict` phase ("ja
votou"). Backend `BusinessRuleError` is also HTTP 409 for "nao esta aberta",
"ainda nao foi iniciada", and "prazo encerrou" (`poll.service.ts` ~179–184).
If the poll closes mid-flow (or the window ends), the user sees a false
already-voted state instead of the server message.

US-004.EC-1 only requires treating a true conflict as already-voted.

Suggested fix: branch on `error.code` (or only `CONFLICT`) and surface other
409s as `voteError`:

```ts
if (error.status === 409 && error.code === 'CONFLICT') {
  setPhase(...conflict);
  return;
}
setVoteError(error.message);
```

Confirm `ApiError` carries `code` from the backend envelope; if not, extend
the client error type.

## Triage

- Decision: `VALID`
- Notes: Valid. VotePage only maps 409 with code CONFLICT to conflict phase; BUSINESS_RULE_VIOLATION surfaces error.message. ApiError already carries code.
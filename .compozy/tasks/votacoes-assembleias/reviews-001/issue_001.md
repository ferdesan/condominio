---
status: resolved
file: backend/src/modules/assemblies/services/poll.service.ts
line: 113
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Update allows status/voterType/isSecret change after votes

## Review Comment

`prepareUpdate` only blocks `startsAt`/`endsAt`/`weightedByFraction` when the
poll is not `DRAFT`. `updatePollSchema` is `.partial()` and still accepts
`status`, `voterType`, and `isSecret`, so a generic `PATCH /polls/:id` can:

- flip `status` to `OPEN`/`CLOSED`/`DRAFT` bypassing `open()` (no notification)
  and `close()` (no `resultsPublishedAt`);
- change `voterType`/`isSecret` after votes exist, altering eligibility or
  secrecy rules retroactively.

Suggested fix: reject those fields once `current.status !== 'DRAFT'` (or once
votes exist), and leave status transitions to `open()`/`close()` only:

```ts
if (current.status !== 'DRAFT') {
  const forbidden = dto.status ?? dto.voterType ?? dto.isSecret;
  if (dto.status || dto.voterType !== undefined || dto.isSecret !== undefined) {
    throw new BusinessRuleError(
      'Regras da votacao nao podem ser alteradas apos o rascunho.',
    );
  }
}
```

(Align the exact rule with Product if `voterType`/`isSecret` edits while still
`OPEN` with zero votes are intentional — then allow only that case.)

## Triage

- Decision: `VALID`
- Notes: Valid. updatePollSchema now omits status; prepareUpdate allows only DRAFT->OPEN and OPEN->CLOSED and rejects voterType/isSecret changes after DRAFT or when totalVotes>0. Frontend disables rule fields when rulesLocked.
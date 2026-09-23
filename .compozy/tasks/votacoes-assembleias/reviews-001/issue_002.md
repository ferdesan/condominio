---
status: resolved
file: backend/src/modules/assemblies/services/poll.service.ts
line: 197
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Self-vote OWNERS check diverges from unitIsEligible

## Review Comment

`castVoteOnBehalf` and `voteStatus` share `unitIsEligible` +
`loadOwnerUnitIds` (active OWNER residents only). `castVote` uses
`residents.findByUser` and only checks `resident.type !== 'OWNER'`:

- no `status === 'ACTIVE'` filter (inactive owners can self-vote);
- no unit match (`resident.unitId` may differ from `ctx.actor.unitId`);
- ignores the shared helper ADR-007 requires as the single definition.

An inactive OWNER, or an OWNER of unit A whose session unit is B, can vote on
an OWNERS poll while the status list shows `NOT_ELIGIBLE`.

Suggested fix: reuse the shared rule on the session unit:

```ts
if (poll.voterType === 'OWNERS') {
  const ownerUnitIds = await this.loadOwnerUnitIds(ctx.scope, poll.condominiumId);
  if (!unitIsEligible(poll.voterType, unitId, ownerUnitIds)) {
    throw new ForbiddenError('Esta deliberacao e restrita aos proprietarios.');
  }
}
```

## Triage

- Decision: `VALID`
- Notes: Valid. castVote OWNERS now uses loadOwnerUnitIds + unitIsEligible (ACTIVE owner on session unit), same definition as proxy and vote-status (ADR-007).
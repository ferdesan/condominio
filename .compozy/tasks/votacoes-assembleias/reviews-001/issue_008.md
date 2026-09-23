---
status: resolved
file: backend/src/modules/assemblies/services/poll.service.ts
line: 136
severity: low
author: claude-code
provider_ref:
---

# Issue 008: open() notifies all residents, not eligible voters

## Review Comment

On `open()`, notification `userIds` come from
`recipients.usersOfCondominium` with no filter by `voterType` or unit
eligibility. On an OWNERS poll, renters and non-owner units receive "Nova
votacao aberta" and a deep link that will reject them (`vote:read`/eligibility
403), producing noise and a confusing dead-end.

Suggested fix: when `poll.voterType === 'OWNERS'`, restrict recipients to
users linked to units that have an active OWNER (reuse
`loadOwnerUnitIds` / the same eligibility set as ADR-007), or skip
notification for ineligible units.

## Triage

- Decision: `VALID`
- Notes: Valid. open() uses openPollRecipients: ALL_RESIDENTS keeps usersOfCondominium; OWNERS notifies users of units with active OWNER only.
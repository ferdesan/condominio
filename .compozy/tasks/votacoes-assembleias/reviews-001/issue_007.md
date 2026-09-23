---
status: resolved
file: backend/src/modules/assemblies/schemas/assembly.schema.ts
line: 41
severity: low
author: claude-code
provider_ref:
---

# Issue 007: allowMultiple accepted but never enforced

## Review Comment

`allowMultiple` is part of `createPollSchema` / `updatePollSchema` and the
`Poll` entity, but `castVote` / `castVoteOnBehalf` never read it — every
poll is single-vote per unit. API clients can send the flag and get a silent
false promise; dead field also confuses maintenance.

Suggested fix (pick one): remove the field from schema/entity until the
feature exists, or enforce it in `hasVoted` / unique-index logic and document
it in the TechSpec. Prefer removal while the product still has no UI for it.

## Triage

- Decision: `INVALID`
- Notes: Out of scope: allowMultiple predates this PRD (initial platform commit) and is not part of the voting feature delta. Not introduced or modified by this workflow; left as-is to avoid unrelated entity/schema migration.
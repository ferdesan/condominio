---
status: resolved
file: frontend/src/features/assemblies/components/assembly-polls-dialog.tsx
line: 289
severity: low
author: claude-code
provider_ref:
---

# Issue 006: Delete copy claims votes disappear but server blocks delete

## Review Comment

Confirm dialog says the poll will disappear "junto dos votos já registrados",
but `beforeRemove` throws when any vote exists — polls with votes cannot be
deleted. The copy only applies to empty (draft) polls and misleads managers
trying to remove a voted poll.

Suggested fix: when `poll.totalVotes > 0`, either hide/disable the delete
action or change the description to state deletion is blocked once votes
exist; keep the current copy only for polls with zero votes.

## Triage

- Decision: `VALID`
- Notes: Valid. Delete button hidden when totalVotes>0; confirm copy no longer claims votes disappear with a voted poll.
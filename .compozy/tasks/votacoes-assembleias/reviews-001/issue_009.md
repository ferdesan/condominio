---
status: resolved
file: backend/src/config/swagger.ts
line: 354
severity: low
author: claude-code
provider_ref:
---

# Issue 009: Swagger omits GET on /polls/{id}/votes (listVotes)

## Review Comment

Route registers both `GET /:id/votes` (`listVotes`, permission `vote:read`)
and `POST /:id/votes` (`castVoteOnBehalf`, `vote:manage`). Swagger entry uses
`action(...)`, which only emits a `post` operation — the documented contract
for that path is incomplete and hides the read endpoint used by the
management dialog.

Suggested fix: expand the path object to include a `get` with summary like
"Lista votos da votacao" (and 403 note for secret polls), similar to the
`/polls/{id}/my-vote` style entries next to it.

## Triage

- Decision: `VALID`
- Notes: Valid. Swagger /polls/{id}/votes now documents GET listVotes and POST castVoteOnBehalf.
---
status: pending
title: "`documents.spec.ts` — matriz de visibilidade, upload, download e LGPD"
type: test
complexity: high
---

# Task 2: `documents.spec.ts` — matriz de visibilidade, upload, download e LGPD

## Overview

Cobre o módulo de documentos, que é o mais diferente da suíte: a única rota multipart, a única que toca o sistema de arquivos, e a única com uma matriz de autorização própria. Estende o arquivo que a task_01 criou, com vinte e cinco casos — onze deles pinçando cada combinação de visibilidade e persona.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST extend `backend/tests/integration/documents.spec.ts` as task_01 left it, reusing its `beforeAll`, its multipart helper and its `afterAll` cleanup. MUST NOT rebuild the skeleton or introduce a second helper.
- The visibility matrix MUST be written as a single `it.each` table carrying all ten persona/visibility outcomes, so a new visibility level on the server breaks the table instead of slipping through (ADR-003).
- MUST upload one document per visibility in `beforeAll` and reuse each across both personas, rather than uploading per case.
- Attachments MUST come from in-memory buffers via `.attach('file', Buffer.from(...), { filename, contentType })`. MUST NOT add a fixture directory — this repository has none and this work does not create one.
- Every case MUST assert `response.status` first, and then either `error.code` or the message with a case-insensitive regex — never both, following the eight existing specs.
- Case names MUST carry the `IT-NNN` id, as the frontend suite does; this diverges from the existing backend specs and is argued in the TechSpec's Testing Approach.
- Cases MUST NOT assume an empty table: the seed runs once per file, there is no `beforeEach` reset, and task_01's cases already created rows. Read back by an identifier the case created.
- MUST NOT assert anything about whether a `RESIDENT` may list or show an `ADMIN`-visibility document. That split is an open question in the TechSpec, not a settled rule.
- Every file this spec uploads MUST be removed by the `afterAll` task_01 wrote; the run MUST leave `backend/uploads-test/` empty.
</requirements>

## Subtasks

- [ ] 2.1 Read `_tests.md` for all twenty-five assigned ids before writing anything.
- [ ] 2.2 Extend `beforeAll` to upload one document per visibility level, keeping their ids for the matrix table.
- [ ] 2.3 Write the upload cases: the happy path with its metadata defaults, the missing file part, the rejected mime type, the size ceiling, the tag string that becomes an array, and the permission denial that precedes the write.
- [ ] 2.4 Write the visibility matrix as one `it.each` table, ten rows.
- [ ] 2.5 Write the `document:manage` shortcut case.
- [ ] 2.6 Write the download mechanics: the counter, the headers naming the original filename, the byte-for-byte comparison, and the seeded document whose file was never written.
- [ ] 2.7 Write the listing cases: the whitelisted filter, the silently ignored one, and the pagination meta.
- [ ] 2.8 Write the update case, proving a metadata change leaves the stored bytes alone.
- [ ] 2.9 Write the deletion case, asserting the row is gone **and** the file left the disk.
- [ ] 2.10 Run the backend suite and confirm the upload directory is empty afterwards.

## Implementation Details

The module surface and the exact rules are in the TechSpec's "API Endpoints" and in `document.service.ts`. Three things shape how the cases are written.

**The matrix discriminates on only two personas.** `admin`, `sindico` and `superAdmin` all hold `document:manage` and return before the rule is consulted, so the meaningful space is five visibilities against `porteiro` (`STAFF`) and `morador` (`RESIDENT`). The rule keys off `roleName` and never looks at `Resident.type`, so a `TENANT` resident passes an `OWNERS` document — IT-221 says so in its name.

**Two cases guard task_01's riskiest edit.** IT-229 compares the downloaded bytes with what was uploaded, and IT-233 checks the filesystem after the delete. Both fail if `filePath` resolves to `undefined` after being hidden — which is exactly the failure that returns a cheerful 204 while the file stays on disk. If either goes red, the cause is in task_01, not here.

**The seeded documents are useful for exactly one case.** `runSeeds` creates two document rows whose `filePath` points at files that were never written. That makes them the natural subject of IT-230, the "arquivo indisponivel" path, and useless for anything that needs real bytes.

The upload ceiling is 10 MB with at most 5 files, and ten mime types are allowed; anything else is a 400 from the middleware, before the route body runs.

### Relevant Files

- `backend/tests/integration/documents.spec.ts` — created by task_01; this task extends it.
- `backend/src/modules/documents/document.service.ts` — `assertVisibility`, `prepareDownload`, `upload`.
- `backend/src/modules/documents/document.routes.ts` — the six routes and their permissions.
- `backend/src/modules/documents/document.schema.ts` — what the multipart body accepts, including the tags field that takes a comma-separated string.
- `backend/src/middlewares/upload.middleware.ts` — the size ceiling, the mime allow-list, and where files land.
- `backend/src/shared/constants/roles.ts` — which permissions each seeded persona holds.
- `backend/src/database/seeds/seed.ts` — the two seeded documents and their non-existent files.
- `backend/tests/integration/operations.spec.ts` — the conventions to follow: nesting, assertion order, naming, how ids flow between cases.

### Dependent Files

- None. This task adds cases to one file and changes no production code.

### Related ADRs

- [ADR-003: Pin the visibility matrix exhaustively, table-driven](adrs/adr-003.md) — why ten rows and not four.
- [ADR-001: Close the unauthenticated file path before pinning the visibility matrix](adrs/adr-001.md) — why this task waits for task_01.
- [ADR-002: Two thematic spec files, not one per module](adrs/adr-002.md) — why documents gets its own file.

## Deliverables

- `documents.spec.ts` covering upload, the full visibility matrix, download mechanics, listing, update and deletion.
- The matrix expressed as a table a reader can check against `assertVisibility` line by line.
- A run that leaves no file behind in `backend/uploads-test/`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] IT-210, IT-211, IT-212, IT-213, IT-215, IT-236 — upload: happy path, missing file part, rejected type, size ceiling, tag coercion, permission denial before the write.
- [ ] IT-216, IT-217, IT-218, IT-219, IT-220, IT-221, IT-222, IT-223, IT-224, IT-225 — the ten persona/visibility outcomes.
- [ ] IT-226 — `document:manage` bypasses the matrix.
- [ ] IT-227, IT-228, IT-229, IT-230 — download counter, headers, byte fidelity, missing stored file.
- [ ] IT-231, IT-232 — filters honoured and silently ignored; pagination meta.
- [ ] IT-257 — metadata update leaves the stored file untouched.
- [ ] IT-233 — deletion removes the row and the file.

## Success Criteria

- Every assigned test case implemented and passing.
- The ten matrix rows live in one table, not ten hand-written cases.
- `npm --prefix backend run test` green, with the file count up by one and the case count up by 25 over what task_01 left.
- `backend/uploads-test/` is empty after a full run.
- `npm --prefix backend run lint` and `npm --prefix backend run typecheck` clean.

---
status: pending
title: "Fecha o desvio do `/uploads` e o arquivo órfão do upload"
type: bugfix
complexity: high
---

# Task 1: Fecha o desvio do `/uploads` e o arquivo órfão do upload

## Overview

Fecha os dois defeitos que a auditoria encontrou nos documentos: um arquivo guardado é servido a qualquer um, sem autenticação, por um mount estático que ignora a matriz de visibilidade; e todo upload que falha na validação do corpo deixa o arquivo no disco para sempre. Esta task é pré-requisito da task_02 — os onze casos da matriz de visibilidade descreveriam uma proteção inexistente enquanto a porta lateral estiver aberta.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST remove the `/uploads` static mount from `backend/src/app.ts:80-88`. `GET /uploads/...` MUST return 404 for every path, with or without credentials.
- MUST remove imports that the mount alone justified (`path`, `env.UPLOAD_DIR`) only after confirming nothing else in `app.ts` uses them — an unused import fails `npm --prefix backend run lint`.
- MUST mark `filePath` as `select: false` on `backend/src/modules/documents/document.entity.ts:42`, so the stored layout — which embeds the tenant id — never reaches a client.
- MUST re-select the column for the two internal reads through a dedicated method on `DocumentRepository`, following the existing precedent for `passwordHash` in `UserRepository`. MUST NOT add the column to `BaseRepository.baseQuery`, which would serve it to every read and undo the change.
- The removal path MUST fetch the stored path with `withDeleted` semantics: `BaseCrudService.remove` hands `afterRemove` the entity it read *before* the soft delete, and a plain re-read after the fact finds nothing.
- MUST unlink `req.file.path` whenever `POST /documents` fails after multer has written, covering the whole handler body and not only the schema parse — `documentService.upload` can also throw, through `assertCondominiumAccess`.
- Unlink failures MUST be swallowed: the client MUST still receive the original 422, 400 or 403, with the body unchanged.
- MUST remove `filePath` from `frontend/src/types/document.ts` and from the fixture in `frontend/src/features/documents/test-utils.ts` **in the same change** — `makeDocument` carries an explicit return annotation, so a leftover property is a typecheck error.
- MUST add `uploads-test/` to `.gitignore`; no existing pattern matches it, so a leaked upload shows up as untracked.
- The existing suites MUST stay green and MUST NOT lose cases: backend at 16 suites / 151 cases, frontend at 74 files / 947 cases.
</requirements>

## Subtasks

- [ ] 1.1 Remove the static mount and verify the file has no dangling imports afterwards.
- [ ] 1.2 Hide `filePath` on the entity.
- [ ] 1.3 Add the repository method that re-selects the column, mirroring the `passwordHash` precedent, and make it able to read a soft-deleted row.
- [ ] 1.4 Point `prepareDownload` at that method.
- [ ] 1.5 Make the removal path obtain the stored path before or despite the soft delete, so the file is actually unlinked.
- [ ] 1.6 Wrap the `POST /documents` handler so a failure after the write unlinks the orphan and rethrows the original error.
- [ ] 1.7 Drop `filePath` from the frontend type and its fixture together.
- [ ] 1.8 Add the `uploads-test/` ignore line.
- [ ] 1.9 Create `backend/tests/integration/documents.spec.ts` with the shared skeleton: personas in `beforeAll`, the multipart upload helper described in the TechSpec's Core Interfaces, and an `afterAll` that removes the tenant upload directory **before** tearing the context down.
- [ ] 1.10 Write the three assigned cases against that skeleton.
- [ ] 1.11 Run the full pipeline on both sides and confirm the case counts did not drop.

## Implementation Details

Two production defects, one shared consequence: both are invisible from the API surface, which is why ADR-004 lets a test workflow change production code here and nowhere else.

**The bypass.** `app.use('/uploads', express.static(...))` sits outside `env.API_PREFIX`, while `authenticate` is installed inside `apiRouter`. Combined with `filePath` being returned in every document payload, a `RESIDENT` — who holds `document:read` — can list documents, read the path of an `ADMIN`-visibility record and fetch the bytes with no token at all.

**The trap in hiding `filePath`.** `BaseRepository` builds every read through `baseQuery` + `getOne`/`getMany`, so an unselected column comes back as `undefined` rather than raising. Two call sites read it, and the second is the dangerous one:

- `document.service.ts:72`, inside `prepareDownload`, whose entity comes from `findById`.
- `document.service.ts:87`, inside `afterRemove`, whose entity comes from `BaseCrudService.remove:78` — a `findById` performed **before** `softDelete`. With the column hidden, `resolveStoredPath(undefined)` throws a `TypeError`, the `try/catch` at `document.service.ts:86-90` swallows it, and the DELETE returns **204 with the file still on disk**. Nothing in the response says so; only IT-233, which checks the filesystem, catches it.

Note `DocumentRepository.incrementDownloads` is a raw update query builder that never SELECTs, so it is unaffected. `BaseRepository.create` re-reads through `findById`, so the 201 body loses `filePath` on its own. `BaseRepository.update` merges and saves, and TypeORM skips `undefined` properties, so the column is not nulled — IT-257 in task_02 is what proves that, by downloading after a PATCH.

Side effect worth knowing: `BaseCrudService.toAuditSnapshot` copies scalar properties, so audit records for documents stop carrying `filePath`. No spec depends on it today.

**The orphan.** In `document.routes.ts`, `upload.single('file')` writes the file before `uploadDocumentSchema.parse(req.body)` runs, and the existing `catch` only forwards the error. The absolute path to unlink is multer's own `req.file.path`; `toStoredPath` is the relative form used for persistence.

### Relevant Files

- `backend/src/app.ts` — the static mount to remove, at the end of the middleware chain, before the API router is installed.
- `backend/src/modules/documents/document.entity.ts` — `filePath` at line 42.
- `backend/src/modules/documents/document.repository.ts` — where the re-selecting method belongs; today it declares only config plus `incrementDownloads`.
- `backend/src/modules/documents/document.service.ts` — `prepareDownload` and `afterRemove`, the two reads.
- `backend/src/modules/documents/document.routes.ts` — the POST handler and its catch.
- `backend/src/modules/users/user.repository.ts` — the precedent to copy: two methods that `addSelect` a `select: false` column onto a hand-built query builder.
- `backend/src/shared/repositories/base.repository.ts` — `baseQuery` and the public `query()` escape hatch; read before choosing where the `addSelect` goes.
- `backend/src/shared/services/base-crud.service.ts` — `remove`, to see which entity reaches `afterRemove`.
- `backend/src/middlewares/upload.middleware.ts` — `uploadRoot`, `toStoredPath`, `resolveStoredPath`.
- `backend/tests/helpers/test-context.ts` — the harness the new spec file builds on.

### Dependent Files

- `frontend/src/types/document.ts` — declares `filePath`; the field goes when the response stops carrying it.
- `frontend/src/features/documents/test-utils.ts` — the fixture value, which must go in the same change or typecheck fails.
- `.gitignore` — `uploads-test/` matches no existing pattern.
- `backend/tests/integration/documents.spec.ts` — created here, extended by task_02.

### Related ADRs

- [ADR-001: Close the unauthenticated file path before pinning the visibility matrix](adrs/adr-001.md) — the whole of this task, and the reason it precedes task_02.
- [ADR-004: Where a test workflow is allowed to change production code](adrs/adr-004.md) — why these two defects are fixed while the other two findings are only documented.

## Deliverables

- `GET /uploads/*` returns 404; the only path to a stored file is `GET /documents/:id/download`, under `assertVisibility`.
- No document response — list, show, create or update — carries `filePath`.
- Download and deletion keep working with the column hidden, deletion still removing the file from disk.
- A failed upload leaves nothing behind in the upload directory.
- `backend/tests/integration/documents.spec.ts` exists with the shared skeleton task_02 will extend.
- `uploads-test/` is ignored.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [ ] IT-214 — a failed multipart body returns 422 and leaves no file in the tenant upload directory.
- [ ] IT-234 — a real uploaded file is unreachable at `/uploads/<tenantId>/<storedName>` with no `Authorization` header.
- [ ] IT-235 — no document response carries a `filePath` field.

## Success Criteria

- Every assigned test case implemented and passing.
- `npm --prefix backend run test` green at **16 suites / 151 cases plus the new file**, with no case lost.
- `npm --prefix frontend run test` green at **74 files / 947 cases** — the frontend type change moves neither number.
- `npm --prefix backend run typecheck`, `npm --prefix backend run lint`, `npm --prefix frontend run typecheck` and `npm --prefix frontend run lint` clean, the frontend lint holding at its 5 known warnings and 0 errors.
- Deleting a document removes both the row and the file, proven against the filesystem and not against the 204.

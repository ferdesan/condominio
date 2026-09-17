# TechSpec: Backend Integration Specs for the Five Uncovered Modules

## Executive Summary

No PRD precedes this document. It was opened from an audit of `backend/tests/integration/` against `backend/src/modules/`: `documents`, `dependents`, `employees` and `service-providers` appear in no line of the integration suite, and `common-areas` appears once, as setup in `reservations.spec.ts:30`. Between them these modules hold a five-level authorization matrix, the only multipart route in the system, the only code that deletes a file from disk, and three validation rules that reject with 409 rather than 422.

Two spec files are added (ADR-002) and two production defects are closed first (ADR-004). The defects come first because one of them — an unauthenticated static mount that serves every stored file — makes the authorization matrix bypassable, so testing the matrix before closing it would certify a guarantee the system does not offer (ADR-001). The second is a file leaked on every failed upload, invisible to any API assertion.

The principal trade-off is deliberate under-coverage in one place: `common-areas.beforeRemove` is hand-written SQL, tests run on in-memory SQLite and production on MySQL, and the product owner chose to leave that guard untested rather than cover it with evidence that cannot speak for production (ADR-004).

## System Architecture

### Component Overview

Nothing new is built. The work attaches to an existing harness and changes three files in `backend/src`.

```text
backend/
  src/
    app.ts                                   MODIFIED  drops the /uploads static mount
    modules/documents/
      document.routes.ts                     MODIFIED  unlinks the file when the body fails
      document.entity.ts                     MODIFIED  filePath becomes select: false
  tests/
    helpers/test-context.ts                  unchanged, reused as-is
    integration/
      documents.spec.ts                      NEW
      cadastros.spec.ts                      NEW
      reservations.spec.ts                   unchanged
```

### Harness, as it already exists

`setupTestContext()` returns `{ app, seed, api }`: an in-memory SQLite database (`sqljs`, `dropSchema: true`, `synchronize: true`), the real Express application from `createApp()` without a listener or sockets, and the full seed. `tests/setup.ts` forces `NODE_ENV=test`, disables Redis, disables rate limiting, and points `UPLOAD_DIR` at `uploads-test`.

The reset unit is the **spec file**, not the test. Jest gives each file a fresh module registry, so `AppDataSource` and the cached context are new per file; there is no `beforeEach` anywhere in this suite, so rows created by one `it` are visible to the next. Both new specs are written to that model: each sub-describe reads rows back by an identifier it created rather than assuming an empty table.

Personas come from `login(ctx, seedUsers.<persona>)`, which returns an agent with `get`, `post`, `patch` and `delete` already carrying the bearer and the `/api/v1` prefix. There is no `put`; the CRUD factory registers one and no case here needs it.

### Data flow for the multipart route

```text
request → authenticate → authorize('document:create') → multer writes to disk
        → uploadDocumentSchema.parse(req.body) → documentService.upload → 201
                     │
                     └── on failure: unlink req.file.path, then rethrow   (NEW)
```

The order is the reason for the fix: a 403 short-circuits before multer writes anything, while a 422 today happens after the write.

## Implementation Design

### Core Interfaces

The only new interface is the upload helper each documents case uses. It exists because `AuthenticatedAgent.post` returns a `request.Test`, so `.field()` and `.attach()` chain onto it directly.

```ts
type UploadOverrides = Partial<{
  title: string;
  visibility: string;
  filename: string;
  contentType: string;
  content: Buffer;
}>;

/** Um envio multipart completo; cada campo tem um padrao valido. */
function upload(agent: AuthenticatedAgent, overrides: UploadOverrides = {}) {
  return agent
    .post('/documents')
    .field('condominiumId', ctx.seed.condominiumId)
    .field('title', overrides.title ?? 'Ata da assembleia de marco')
    .field('category', 'MINUTES')
    .field('visibility', overrides.visibility ?? 'RESIDENTS')
    .attach('file', overrides.content ?? Buffer.from('conteudo'), {
      filename: overrides.filename ?? 'ata.pdf',
      contentType: overrides.contentType ?? 'application/pdf',
    });
}
```

Buffers, not fixture files: this repository has no test-fixtures directory and this work does not add one.

### Data Models

No schema changes. Two changes to what leaves the server:

| Change | File | Effect on the response |
|---|---|---|
| `filePath` becomes `select: false` | `document.entity.ts:42` | The field leaves every document payload. `frontend/src/types/document.ts:51` declares it and never reads it; the declaration goes with it. |
| `/uploads` static mount removed | `app.ts:81-88` | `GET /uploads/...` returns 404. No consumer exists: nothing in `frontend/src` builds such a URL. |

`document.service.ts` reads `filePath` internally in `prepareDownload` and `afterRemove`. With `select: false`, both paths must request the column explicitly — an `addSelect`, or an explicit select list — or both break silently. This is the highest-risk edit in the workflow, and the reason IT-233 asserts the file actually leaves the disk rather than trusting the 204.

### API Endpoints

The surface does not change except for the removed mount.

**`documents`** — hand-written router, six routes, no `PUT` and no `restore`:

| Route | Permission | Covered by |
|---|---|---|
| `GET /documents` | `document:read` | IT-231, IT-232, IT-235 |
| `POST /documents` | `document:create` | IT-210 – IT-215, IT-236 |
| `GET /documents/:id` | `document:read` | IT-227, IT-233 |
| `GET /documents/:id/download` | `document:read` + `assertVisibility` | IT-216 – IT-230 |
| `PATCH /documents/:id` | `document:update` | IT-257 |
| `DELETE /documents/:id` | `document:delete` | IT-233 |

**`dependents`, `employees`, `service-providers`, `common-areas`** — all four are `createCrudRouter` modules emitting the same seven endpoints (`GET /`, `POST /`, `GET /:id`, `PATCH|PUT /:id`, `DELETE /:id`, `POST /:id/restore`), each gated by `<resource>:<action>`, with `<resource>:manage` acting as a wildcard.

Status vocabulary the cases assert, which is the suite's existing vocabulary: `201` create, `200` read and update, `204` delete, `401` unauthenticated, `403` permission and ownership denial, `404` not found and cross-tenant, `409` business rule and conflict, `422` schema validation. Errors carry `{ success: false, error: { code, message, details?, requestId, timestamp } }`; a case asserts either `error.code` or the message with a case-insensitive regex, not both.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `backend/src/app.ts` | modified | Static mount removed. **Low** — no in-repo consumer; risk limited to clients outside version control. | Remove the mount; assert 404 in IT-234. |
| `document.entity.ts` | modified | `filePath` hidden. **High** — `prepareDownload` and `afterRemove` read it; TypeORM yields `undefined` rather than failing. | Make both reads request the column explicitly; IT-229 and IT-233 fail on an undefined path. |
| `document.routes.ts` | modified | Failed parse unlinks the file. **Low** — failure path only; the 422 body is unchanged. | Swallow unlink errors so cleanup never replaces the client's error. |
| `frontend/src/types/document.ts` | modified | `filePath` removed from the type, and from the fixture in `features/documents/test-utils.ts`. **Low** — declared, never read. | Remove both; the frontend suite must stay at 74 files / 947 cases. |
| `backend/tests/integration/` | new | Two spec files, two additional seeds. **Low** — adds roughly 20 s to a serial suite. | — |
| `.gitignore` | modified | `uploads-test/` is not ignored today, so a leaked file shows as untracked. **Low**. | Add the directory. |
| `common-area.service.ts` | untouched | `beforeRemove` stays uncovered. **Accepted** — ADR-004. | None. |

## Testing Approach

Strategy only; every case lives in `_tests.md`.

- **Framework and harness:** Jest with `ts-jest`, `testEnvironment: node`, `--runInBand`, 30 s timeout. Requests go through `supertest` against the real Express app. No mocks, no stubs, no fakes: the database is real (in-memory SQLite), the services are real, the filesystem is real. This suite has no fake at any boundary and this work introduces none.
- **What the level covers:** everything here is integration. There are no unit cases, because none of the behavior at issue is a pure function — each rule is reached through routing, authentication, permission, validation and persistence.
- **Fixtures:** the seed supplies the tenant, condominium, 32 units, ~30 residents, 2 employees, 2 service providers and 3 common areas. Two gaps are filled by the specs themselves: the seed creates **zero dependents**, and its two documents point at files that do not exist on disk — useful as the "arquivo indisponivel" case, useless for a real download.
- **Data dependencies:** none external. No MySQL, no Redis, no Docker, no network.
- **Filesystem:** `documents.spec.ts` writes real files to `backend/uploads-test/<tenantId>/`, where the tenant id is a fresh UUID per run. Its `afterAll` removes that directory and then tears the context down, in that order.
- **Conventions, inherited:** Portuguese `describe` and `it` names, third person, no accents, no "should" and no "deve"; `expect(response.status).toBe(n)` first in every case; ids re-queried through the API rather than threaded through module variables wherever a filter can find the row; the allowed-and-denied pair in a single case where a persona's boundary is the subject.
- **One divergence, deliberate:** cases carry their `IT-NNN` id in the `it` name, as the frontend suite does (`IT-189: a suite roda ate o fim`) and as no backend spec does today. `_tests.md` is the contract a review round checks the shipped suite against, and an id that lives only in the document cannot be traced to the assertion that honours it. The eight existing backend specs are left alone.

## Development Sequencing

### Build Order

1. **Close the two defects** — `app.ts`, `document.entity.ts`, `document.routes.ts`, plus the frontend type, the fixture line and the `.gitignore` entry. No new spec file yet: the existing suite must stay green, which is what proves the `filePath` change did not break download or deletion. Depends on nothing.
2. **`documents.spec.ts`** — the matrix, upload, download, listing and deletion. Depends on step 1; eleven of its cases are meaningless until the static mount is gone.
3. **`cadastros.spec.ts`** — the four registry modules. Depends on nothing in steps 1–2 and may run in parallel with step 2 under a separate agent; the files do not overlap.

### Technical Dependencies

None external. The whole suite runs on `npm --prefix backend run test` with no infrastructure.

## Monitoring and Observability

Not applicable: this work adds no runtime behavior. The one operational signal it changes is negative — after step 1, requests to `/uploads/*` return 404, and a spike there would mean a consumer outside this repository existed after all.

## Technical Considerations

### Key Decisions

- **Defects before tests** (ADR-001). Rationale: eleven cases pinning an authorization matrix are worth nothing while the same bytes are served without credentials. Trade-off: production changes ship in a workflow named for tests. Rejected: characterizing the bypass as known behavior.
- **Two thematic files** (ADR-002). Rationale: matches all eight existing specs, and the seed runs once per file on a serial suite. Trade-off: `cadastros.spec.ts` holds four unrelated domains. Rejected: one file per module (five seeds); three files (a third seed for four assertions).
- **Exhaustive matrix** (ADR-003). Rationale: the untested half of a boundaries-only table is the half that grants access, and widening is the direction that leaks. Trade-off: the densest coverage in the backend suite. Rejected: boundaries only; one persona per visibility.
- **A rule for touching production** (ADR-004): change it only where no test could assert the correct behavior against the code as it stands. Consequence: the `PATCH` asymmetry in `common-areas` is covered as-is rather than fixed, and the delete guard is left alone entirely.

### Known Risks

- **`filePath` as `select: false` is the sharp edge.** Two internal reads depend on the column, and TypeORM returns `undefined` rather than failing. A missed `addSelect` produces a download that resolves the wrong path and a deletion that silently keeps the file. Likelihood: moderate. Mitigation: IT-229 asserts the downloaded bytes match what was uploaded, and IT-233 asserts the file is gone from disk; neither passes on an undefined path.
- **SQLite is not MySQL.** Every case here runs on `sqljs`. Portable operations only — `COUNT`, `IN`, `IS NULL`, date comparison — but no case proves MySQL behavior. This is pre-existing for all 151 backend cases; it is stated because ADR-004 turned on it.
- **Visibility gates download, not listing.** A `RESIDENT` may list and show an `ADMIN`-visibility document and read its title and description; only the bytes are withheld. This may be the intended product rule. It is left as an open question rather than a change, and no case asserts it either way.
- **The orphan-file fix runs on a failure path.** If the unlink throws — a locked file on Windows, for instance — the client must still receive its 422. The catch swallows.

## Architecture Decision Records

- [ADR-001: Close the unauthenticated file path before pinning the visibility matrix](adrs/adr-001.md) — remove the `/uploads` static mount and hide `filePath`, as the first task, because the matrix is otherwise bypassable in two requests.
- [ADR-002: Two thematic spec files, not one per module](adrs/adr-002.md) — `documents.spec.ts` and `cadastros.spec.ts`, following the convention of all eight existing specs and paying two seeds instead of five.
- [ADR-003: Pin the visibility matrix exhaustively, table-driven](adrs/adr-003.md) — all ten persona and visibility combinations plus the `document:manage` shortcut, because a boundaries-only table leaves the granting half untested.
- [ADR-004: Where a test workflow is allowed to change production code](adrs/adr-004.md) — only where the defect has no observable API surface; the `PATCH` asymmetry is documented by test, the raw-SQL delete guard is left uncovered.

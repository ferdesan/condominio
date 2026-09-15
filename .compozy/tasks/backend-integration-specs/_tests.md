# Test Specification: Backend Integration Specs for the Five Uncovered Modules

Canonical test contract. Companion to `_techspec.md`.
No `_user_stories.md` exists — this workflow was opened from a coverage audit, not from a PRD — so behavior rows below are derived from the service rules and route surface named in `_techspec.md` rather than from stories. The coverage matrix is organised by module and rule for that reason.

## Strategy

- **Frameworks and harnesses:** Jest with `ts-jest`, `testEnvironment: node`, `--runInBand`, 30 s timeout. `supertest` against the real Express app from `createApp()`. **No fake at any boundary**: in-memory SQLite (`sqljs`), real services, real filesystem. The harness is `tests/helpers/test-context.ts` exactly as it stands — `setupTestContext`, `login`, `seedUsers`, `teardownTestContext`.
- **Execution:** `npm --prefix backend run test`. No MySQL, no Redis, no Docker, no network.
- **Conventions:** Portuguese case names, third person, no accents, no "should" or "deve"; `expect(response.status).toBe(n)` first; `error.code` **or** a case-insensitive message regex, never both; ids re-queried through the API where a filter can find the row. Each case name is prefixed with its `IT-NNN` id — a divergence from the eight existing backend specs, argued in `_techspec.md`, "Testing Approach".
- **State model:** the seed runs once per **file** and there is no `beforeEach` reset. Cases within a file share rows, so each sub-describe reads back by an identifier it created.
- **Numbering:** `IT-210` continues the repository's sequence; `IT-209` is the highest id in use. No `UT-NNN` case appears here — nothing in scope is a pure function.

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|---|---|---|---|---|
| ADR-001 | `/uploads` no longer serves stored files | — | IT-234 | — |
| ADR-001 | `filePath` absent from responses | — | IT-235 | — |
| ADR-004 | failed upload leaves no orphan file | — | IT-214 | — |
| `POST /documents` | happy path, metadata and defaults | — | IT-210, IT-215 | — |
| `POST /documents` | missing file, rejected type, size ceiling | — | IT-211, IT-212, IT-213 | — |
| `POST /documents` | permission denial precedes the write | — | IT-236 | — |
| `assertVisibility` | all 10 persona/visibility outcomes | — | IT-216 – IT-225 | — |
| `assertVisibility` | `document:manage` bypasses the matrix | — | IT-226 | — |
| `prepareDownload` | download counter, headers, bytes | — | IT-227, IT-228, IT-229 | — |
| `prepareDownload` | stored file missing from disk | — | IT-230 | — |
| `GET /documents` | tenant scope, pagination meta, filters | — | IT-231, IT-232 | — |
| `PATCH /documents/:id` | metadata changes, stored file untouched | — | IT-257 | — |
| `afterRemove` | record and file both deleted (LGPD) | — | IT-233 | — |
| `dependents` | inherits the holder's unit and condominium | — | IT-237, IT-238, IT-239 | — |
| `dependents` | update path that escapes the check | — | IT-240 | — |
| `dependents` | resident relation embedded; persona boundary | — | IT-241, IT-242 | — |
| `employees` | CPF checksum, contract dates, auto-termination | — | IT-243, IT-244, IT-245 | — |
| `employees` | numeric salary; persona boundary | — | IT-246, IT-247 | — |
| `service-providers` | CPF/CNPJ at both layers, contract period | — | IT-248, IT-249, IT-250 | — |
| `service-providers` | rating bounds | — | IT-251 | — |
| `common-areas` | create refinements enforced | — | IT-252, IT-254 | — |
| `common-areas` | update bypasses both refinements | — | IT-253, IT-255 | — |
| `common-areas` | persona boundary | — | IT-256 | — |
| `common-area.beforeRemove` | future-reservation guard | — | **none — ADR-004** | — |

No E2E column is populated: this repository has no browser-driving harness, and these routes have no UI surface of their own beyond the frontend screens, which are covered by the frontend suite against a doubled transport.

## Integration Tests

### `documents.spec.ts` — upload (TechSpec: API Endpoints)

- **IT-210**: `admin` posts a valid multipart document — 201; body carries `title`, `category: 'MINUTES'`, `visibility`, `uploadedById` equal to the admin's id, `version: 1` and `downloadsCount: 0`.
- **IT-211**: `admin` posts with every text field but no `file` part — 400, message matches `/envie o arquivo no campo/i`.
- **IT-212**: `admin` attaches `application/zip` — 400, message matches `/tipo de arquivo nao permitido/i`.
- **IT-213** (boundary): `admin` attaches a buffer of `10 * 1024 * 1024 + 1` bytes — 400 with code `UPLOAD_LIMIT_FILE_SIZE`.
- **IT-214**: `admin` attaches a valid PDF with `title` of one character — 422 with code `VALIDATION_ERROR`, **and** the tenant upload directory holds no file afterwards. This is the assertion the ADR-004 fix exists for; before it, the directory held one.
- **IT-215**: `admin` posts `tags` as the comma-separated string `'assembleia, 2026'` — 201 and the stored `tags` is the array `['assembleia', '2026']`.
- **IT-236**: `porteiro`, who has `document:read` but not `document:create`, posts a valid multipart — 403 with code `FORBIDDEN`, and the tenant upload directory is unchanged, because `authorize` short-circuits before multer writes.

### `documents.spec.ts` — the visibility matrix (TechSpec: ADR-003)

One document is uploaded per visibility in `beforeAll`, by `admin`. Each case downloads one of them as one persona and asserts the status. Written as a single `it.each` table.

- **IT-216**: `PUBLIC` downloaded by `porteiro` — 200.
- **IT-217**: `PUBLIC` downloaded by `morador` — 200.
- **IT-218**: `RESIDENTS` downloaded by `porteiro` — 200.
- **IT-219**: `RESIDENTS` downloaded by `morador` — 200.
- **IT-220**: `OWNERS` downloaded by `porteiro` — 403, message matches `/nao esta disponivel para o seu perfil/i`.
- **IT-221**: `OWNERS` downloaded by `morador` — 200. The rule keys off `roleName`, so a `TENANT` resident passes too; the case name says so.
- **IT-222**: `STAFF` downloaded by `porteiro` — 200.
- **IT-223**: `STAFF` downloaded by `morador` — 403.
- **IT-224**: `ADMIN` downloaded by `porteiro` — 403.
- **IT-225**: `ADMIN` downloaded by `morador` — 403.
- **IT-226**: `ADMIN` downloaded by `sindico`, who holds `document:manage` — 200. The shortcut returns before the matrix is consulted.

### `documents.spec.ts` — download mechanics (TechSpec: Core Interfaces)

- **IT-227**: downloading twice raises `downloadsCount` from 0 to 2, read back through `GET /documents/:id`.
- **IT-228**: the response carries `Content-Type: application/pdf` and a `Content-Disposition` naming the **original** filename, not the stored UUID.
- **IT-229**: the downloaded body equals the buffer that was uploaded, byte for byte. Fails if `filePath` resolves to the wrong file after the `select: false` change.
- **IT-230**: downloading one of the two seeded documents, whose `filePath` points at a file that was never written — 400, message matches `/arquivo indisponivel/i`.

### `documents.spec.ts` — listing, update and deletion (TechSpec: API Endpoints)

- **IT-231**: `GET /documents?category=MINUTES` returns only the matching rows; `GET /documents?downloadsCount=0`, a field outside `filterableFields`, is ignored in silence and returns the unfiltered page.
- **IT-232**: `GET /documents?perPage=2` returns `meta` matching `{ page: 1, perPage: 2, hasPrevious: false }` and at most two rows.
- **IT-233**: `admin` deletes an uploaded document — 204; `GET /documents/:id` then returns 404, **and** the file is gone from the tenant upload directory. The LGPD elimination is the filesystem half; the 204 alone does not show it.
- **IT-234**: `GET /uploads/<tenantId>/<storedName>` with no `Authorization` header — 404. The path is taken from the upload made in `beforeAll`, so the case proves a real file is unreachable, not that an arbitrary URL is missing.
- **IT-235**: no document response — list, show or create — carries a `filePath` field.
- **IT-257**: `admin` patches `title` and `visibility` of an uploaded document — 200 with the new values; downloading it afterwards still returns the original bytes. There is no route that replaces the file, so an update must never touch storage.

### `cadastros.spec.ts` — dependentes (TechSpec: API Endpoints)

The seed creates zero dependents; each case builds what it needs. The holder's `residentId` comes from `GET /residents?unitId=<morador's unit>`.

- **IT-237**: `morador` creates a dependent on their own unit, with the matching `residentId` — 201.
- **IT-238**: `morador` creates a dependent whose `residentId` belongs to a resident of another unit — 409 with code `BUSINESS_RULE_VIOLATION`, message matches `/mesma unidade do morador titular/i`.
- **IT-239**: creation with a `residentId` that exists in no tenant — 404, message matches `/morador/i`.
- **IT-240**: `PATCH` changing only `unitId`, leaving `residentId` untouched, is accepted with 200 even though the dependent now points at a unit the holder does not occupy. Documents the gap in `prepareUpdate`, which re-checks only when `residentId` is present **and** different.
- **IT-241**: the create response embeds the `resident` object, because the repository declares the relation eager.
- **IT-242**: `morador` patches their own dependent — 200; `morador` deletes the same dependent — 403. The pair in one case: `dependent:update` is granted to `RESIDENT`, `dependent:delete` is not.

### `cadastros.spec.ts` — funcionarios (TechSpec: API Endpoints)

- **IT-243**: `admin` creates an employee with `document: '11111111111'`, eleven digits that fail the checksum — 409, message matches `/cpf informado e invalido/i`. The schema passes it; the service rejects it, which is why this is 409 and not 422.
- **IT-244**: `terminationDate` earlier than `admissionDate` — 409, message matches `/desligamento nao pode ser anterior/i`.
- **IT-245** (state): `PATCH { status: 'TERMINATED' }` on an employee with no termination date — 200 and `terminationDate` is filled with today's date by `prepareUpdate`.
- **IT-246**: `salary` sent as `3500.5` comes back as the number `3500.5`, not a string, through `numericTransformer`.
- **IT-247**: `morador` requests `GET /employees` — 403. `RESIDENT` holds no `employee` permission at all.

### `cadastros.spec.ts` — prestadores (TechSpec: API Endpoints)

- **IT-248**: `document` with 12 digits — 422 with code `VALIDATION_ERROR`, message matches `/cpf ou cnpj valido/i`. Rejected by the schema refinement, before the service.
- **IT-249**: `document` with 14 digits that fail the CNPJ checksum — 409, message matches `/documento informado e invalido/i`. Passes the schema, rejected by the service. The pair with IT-248 is the point: same field, two layers, two status codes.
- **IT-250**: `contractEnd` earlier than `contractStart` — 409, message matches `/termino do contrato nao pode ser anterior/i`.
- **IT-251** (boundary): `rating: 6` — 422; `rating: 5` — 201.

### `cadastros.spec.ts` — areas comuns (TechSpec: ADR-004)

- **IT-252**: `POST /common-areas` with `opensAt: '10:00'` and `closesAt: '09:00'` — 422, with `details` pointing at path `closesAt`.
- **IT-253**: `PATCH` on an existing area setting `closesAt: '09:00'` against a stored `opensAt: '10:00'` — **200**. `updateCommonAreaSchema` is `commonAreaBaseSchema.partial()`, built from the un-refined base, so neither refinement applies on update. Documented, not fixed (ADR-004).
- **IT-254**: `POST` with `minHours: 6` and `maxHours: 2` — 422, with `details` pointing at path `maxHours`.
- **IT-255**: `PATCH` setting `maxHours: 2` on an area whose stored `minHours` is 6 — **200**. Same asymmetry, second refinement.
- **IT-256**: `porteiro` posts a common area — 403; `porteiro` gets `GET /common-areas` — 200. The allowed-and-denied pair: `STAFF` holds `common-area:read` and nothing else on the resource.

## Notes on cases deliberately absent

- **`common-area.beforeRemove`** — the future-reservation guard has no case. Excluded by ADR-004: the guard is hand-written SQL, every case here runs on SQLite, and a green result would not speak for the MySQL behavior that matters. The seeded reservations that would exercise it (PENDING at +7 days on Salao de Festas, CONFIRMED at +2 days on Churrasqueira) remain available whenever that decision is revisited.
- **`assertVisibility` on list and show** — no case asserts whether a `RESIDENT` may see the metadata of an `ADMIN` document, because the current split may be the intended product rule. Recorded as an open question in `_techspec.md`, "Known Risks".
- **Cross-tenant isolation and `PERMISSION_DENIED` auditing** — already covered for every module by `security.spec.ts:126-177`; not repeated here.

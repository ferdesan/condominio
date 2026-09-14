# Test Specification: Back-Office Screens for Condominiums, Units, Residents and Reservations

Canonical test contract. Companion to `_techspec.md`.
Derived from `_user_stories.md` (behavior) and `_techspec.md` (components).

## Strategy

- **Frameworks and harnesses:** Vitest with globals enabled in a jsdom environment; Testing Library for rendering and interaction; the existing setup file extended with the layout observer, intersection observer, scroll-into-view and pointer-capture APIs that Radix requires. Tests live beside the code they cover, inside `src/`, so the type checker includes them.
- **Fakes at one boundary only:** the transport module `@/lib/api` (ADR-010). Screen tests replace it with a typed double and supply typed fixtures from `test/fixtures.ts`; failures are constructed as the real `ApiError` with a status, code and optional field details. The query client, router, providers and all components are real, mounted through `test/render.tsx`, which accepts the role and the selected condominium. Cache isolation is inherent — the query client is constructed per mount.
- **Execution:** `npm --prefix frontend run test` runs everything; the pipeline's test job invokes exactly this. No database, network or service container is required.
- **Conventions:** one observable behavior per case; table-driven style where a rule is parameterised (the reservation rules and the parameter builder both qualify); queries by accessible role and name rather than by test id; `userEvent` over `fireEvent`.
- **On end-to-end:** no browser-driving harness exists in this repository and ADR-001 excludes introducing one. Every user journey is therefore covered start to finish as an integration case at the screen level, marked **(journey)** in the listings below, and the backend integration suite already covers the server half of each. The E2E column is intentionally empty throughout; this substitution is the reason.

## Coverage Matrix

### Stories and edge cases

| Source | Behavior | Unit | Integration | E2E |
|---|---|---|---|---|
| US-001 | List, search and sort condominiums | UT-016, UT-019 | IT-001 (journey) | — |
| US-001.EC-1 | No condominiums registered | — | IT-002 | — |
| US-001.EC-2 | Search matching nothing | — | IT-003 | — |
| US-001.EC-3 | Search debounced, not per keystroke | UT-017 | IT-004 | — |
| US-001.EC-4 | Unsortable column not offered | UT-001 | IT-005 | — |
| US-001.EC-5 | Page size matches rows rendered | UT-091 | IT-006 | — |
| US-001.EC-6 | Page beyond the last | UT-018 | IT-007 | — |
| US-001.EC-7 | Session expiry while listing | UT-046 | IT-008 | — |
| US-001.EC-8 | Null fields render as placeholder | UT-086, UT-092 | IT-009 | — |
| US-002 | Register a condominium | — | IT-010 (journey) | — |
| US-002.EC-1 | Duplicate document | UT-053 | IT-011 | — |
| US-002.EC-2 | Document of a deleted record | — | IT-012 | — |
| US-002.EC-3 | Plan limit reached | — | IT-013 | — |
| US-002.EC-4 | Name too short, due day out of range | UT-002 | IT-014 | — |
| US-002.EC-5 | Malformed document or postal code | UT-003 | IT-015 | — |
| US-002.EC-6 | Double submit | — | IT-016 | — |
| US-002.EC-7 | Dismiss dirty form | — | IT-017 | — |
| US-002.EC-8 | Connection lost mid-submission | — | IT-018 | — |
| US-002.EC-9 | Lower-case state accepted | UT-004 | IT-019 | — |
| US-003 | Edit a condominium | — | IT-020 (journey) | — |
| US-003.EC-1 | Document conflict on edit | — | IT-021 | — |
| US-003.EC-2 | Record deleted while dialog open | — | IT-022 | — |
| US-003.EC-3 | Concurrent edit, last write wins | — | IT-023 | — |
| US-003.EC-4 | Clearing an optional field | UT-005 | IT-024 | — |
| US-003.EC-5 | Edit via link to a missing record | — | IT-025 | — |
| US-004 | Condominium detail and indicators | — | IT-026 (journey) | — |
| US-004.EC-1 | Identifier missing or deleted | — | IT-027 | — |
| US-004.EC-2 | Malformed identifier | UT-041 | IT-028 | — |
| US-004.EC-3 | All indicators zero | — | IT-029 | — |
| US-004.EC-4 | Record loads, indicators fail | — | IT-030 | — |
| US-004.EC-5 | Condominium outside scope | — | IT-031 | — |
| US-005 | Delete a condominium | — | IT-032 (journey) | — |
| US-005.EC-1 | Blocked by existing units | — | IT-033 | — |
| US-005.EC-2 | Deleted record was the selected one | — | IT-034 | — |
| US-005.EC-3 | Last condominium deleted | — | IT-035 | — |
| US-005.EC-4 | Already deleted elsewhere | — | IT-036 | — |
| US-005.EC-5 | Confirmation dismissed | — | IT-037 | — |
| US-005.EC-6 | Confirmation triggered twice | — | IT-038 | — |
| US-006 | Restore a condominium | UT-020 | IT-039 (journey) | — |
| US-006.EC-1 | Deleted included, none exist | — | IT-040 | — |
| US-006.EC-2 | Deleted and live rows of one name | — | IT-041 | — |
| US-006.EC-3 | Restore conflicts on document | — | IT-042 | — |
| US-006.EC-4 | Inclusion persists across pages | UT-021 | IT-043 | — |
| US-007 | List and filter units | UT-006 | IT-044 (journey) | — |
| US-007.EC-1 | No condominium selected | — | IT-045 | — |
| US-007.EC-2 | Condominium with no units | — | IT-046 | — |
| US-007.EC-3 | Filters matching nothing | — | IT-047 | — |
| US-007.EC-4 | Condominium switched, stale filters cleared | UT-022 | IT-048 | — |
| US-007.EC-5 | Several hundred units | UT-007 | IT-049 | — |
| US-007.EC-6 | Number prefix matching many | — | IT-050 | — |
| US-007.EC-7 | Absent numeric fields | UT-093 | IT-051 | — |
| US-008 | Register a single unit | — | IT-052 (journey) | — |
| US-008.EC-1 | Duplicate number in block | — | IT-053 | — |
| US-008.EC-2 | Block of another condominium | UT-008 | IT-054, IT-055 | — |
| US-008.EC-3 | No blocks — inline creation offered | — | IT-059 | — |
| US-008.EC-4 | Floor or fraction out of range | UT-009 | IT-056 | — |
| US-008.EC-5 | Double submit | — | IT-057 | — |
| US-008.EC-6 | Number matching a deleted unit | — | IT-058 | — |
| US-009 | Bulk generation | UT-010 | IT-060 (journey) | — |
| US-009.EC-1 | Every number already exists | — | IT-061 | — |
| US-009.EC-2 | Floors or per-floor out of range | UT-011 | IT-062 | — |
| US-009.EC-3 | Generating into a populated block | — | IT-063 | — |
| US-009.EC-4 | Maximum-size grid | UT-012 | IT-064 | — |
| US-009.EC-5 | Confirm pressed twice | — | IT-065 | — |
| US-009.EC-6 | Connection lost mid-generation | — | IT-066 | — |
| US-009.EC-7 | Pattern producing over-long numbers | UT-013 | IT-067 | — |
| US-010 | Edit a unit | — | IT-068 (journey) | — |
| US-010.EC-1 | Number collision on edit | — | IT-069 | — |
| US-010.EC-2 | Occupied set with no residents | — | IT-070 | — |
| US-010.EC-3 | Renovation and blocked persist | — | IT-071 | — |
| US-010.EC-4 | Moving a unit between blocks | — | IT-072 | — |
| US-010.EC-5 | Unit deleted while dialog open | — | IT-073 | — |
| US-011 | Delete and restore a unit | — | IT-074 (journey) | — |
| US-011.EC-1 | Blocked by active residents | — | IT-075 | — |
| US-011.EC-2 | Blocked by open charges | — | IT-076 | — |
| US-011.EC-3 | Both blockers, sequential | — | IT-077 | — |
| US-011.EC-4 | Restore with reused number | — | IT-078 | — |
| US-011.EC-5 | Last unit deleted unblocks condominium | — | IT-079 | — |
| US-012 | Occupancy indicators | UT-029 | IT-080 (journey) | — |
| US-012.EC-1 | Condominium with no units | — | IT-081 | — |
| US-012.EC-2 | Renovation and blocked reconcile | UT-030 | IT-082 | — |
| US-012.EC-3 | Indicators fail, list survives | — | IT-083 | — |
| US-012.EC-4 | Indicator scope unambiguous under filters | — | IT-084 | — |
| US-013 | List and search residents | UT-014 | IT-085 (journey) | — |
| US-013.EC-1 | Null document or phone | UT-087 | IT-086 | — |
| US-013.EC-2 | Punctuated document search | UT-015 | IT-087 | — |
| US-013.EC-3 | No residents | — | IT-088 | — |
| US-013.EC-4 | Resident whose unit was deleted | — | IT-089 | — |
| US-013.EC-5 | Several hundred residents | — | IT-090 | — |
| US-014 | Register a resident | — | IT-091 (journey) | — |
| US-014.EC-1 | Invalid check digits | — | IT-092 | — |
| US-014.EC-2 | Document already registered | — | IT-093 | — |
| US-014.EC-3 | Unit of another condominium | — | IT-094 | — |
| US-014.EC-4 | Name too short | UT-023 | IT-095 | — |
| US-014.EC-5 | Neither document nor email | — | IT-096 | — |
| US-014.EC-6 | Move-out before move-in | UT-024 | IT-097 | — |
| US-014.EC-7 | Birth date in the future | UT-025 | IT-098 | — |
| US-014.EC-8 | Double submit | — | IT-099 | — |
| US-014.EC-9 | Condominium with no units | — | IT-100 | — |
| US-015 | Edit a resident | — | IT-101 (journey) | — |
| US-015.EC-1 | Last active resident moves out | — | IT-102 | — |
| US-015.EC-2 | Unit in another condominium | — | IT-103 | — |
| US-015.EC-3 | Document conflict on edit | — | IT-104 | — |
| US-015.EC-4 | Resident deleted elsewhere | — | IT-105 | — |
| US-015.EC-5 | Clearing move-out on a moved-out resident | — | IT-106 | — |
| US-016 | Designate the primary resident | — | IT-107 (journey) | — |
| US-016.EC-1 | Previous primary demoted | — | IT-108 | — |
| US-016.EC-2 | Unit with no primary | — | IT-109 | — |
| US-016.EC-3 | Two designations in flight | — | IT-110 | — |
| US-016.EC-4 | Primary resident deleted | — | IT-111 | — |
| US-016.EC-5 | Inactive resident designated primary | — | IT-112 | — |
| US-017 | Delete and restore a resident | — | IT-113 (journey) | — |
| US-017.EC-1 | Only active resident deleted | — | IT-114 | — |
| US-017.EC-2 | Primary resident deleted | — | IT-115 | — |
| US-017.EC-3 | Restore with a deleted unit | — | IT-116 | — |
| US-017.EC-4 | Restore with document conflict | — | IT-117 | — |
| US-017.EC-5 | Reservations retain requester | — | IT-118 | — |
| US-018 | Filter residents | UT-026 | IT-119 (journey) | — |
| US-018.EC-1 | Filters matching nothing | — | IT-120 | — |
| US-018.EC-2 | Filtered unit then deleted | — | IT-121 | — |
| US-018.EC-3 | Condominium switched clears unit filter | UT-027 | IT-122 | — |
| US-018.EC-4 | Unsupported filter not offered | UT-031 | IT-123 | — |
| US-019 | List and filter reservations | UT-032 | IT-124 (journey) | — |
| US-019.EC-1 | No reservations | — | IT-125 | — |
| US-019.EC-2 | Pending count of zero shown | — | IT-126 | — |
| US-019.EC-3 | Deleted common area | — | IT-127 | — |
| US-019.EC-4 | Deleted unit, requester preserved | — | IT-128 | — |
| US-019.EC-5 | Condominium switch clears filters | — | IT-129 | — |
| US-020 | Monthly calendar | UT-076 | IT-130 (journey) | — |
| US-020.EC-1 | Month with no reservations | UT-077 | IT-131 | — |
| US-020.EC-2 | Day overflowing its cell | UT-078 | IT-132 | — |
| US-020.EC-3 | Reservation spanning midnight | UT-079 | IT-133 | — |
| US-020.EC-4 | 28 to 31 day months, adjacent days | UT-080 | IT-134 | — |
| US-020.EC-5 | Rapid month paging, stale response | — | IT-135 | — |
| US-020.EC-6 | Only pending and confirmed shown | UT-081 | IT-136 | — |
| US-020.EC-7 | No condominium selected | — | IT-137 | — |
| US-021 | Book a common area | UT-059 | IT-138 (journey) | — |
| US-021.EC-1 | End at or before start | UT-060 | IT-139 | — |
| US-021.EC-2 | Start in the past | UT-061 | IT-140 | — |
| US-021.EC-3 | Beyond advance limit | UT-062 | IT-141 | — |
| US-021.EC-4 | Duration outside bounds | UT-063, UT-064 | IT-142 | — |
| US-021.EC-5 | Weekday not permitted | UT-065 | IT-143 | — |
| US-021.EC-6 | Outside opening hours | UT-066 | IT-144 | — |
| US-021.EC-7 | Overlapping booking | — | IT-145 | — |
| US-021.EC-8 | Minimum interval for the unit | — | IT-146 | — |
| US-021.EC-9 | Guests over capacity | UT-067 | IT-147 | — |
| US-021.EC-10 | Unavailable area not offered | — | IT-148 | — |
| US-021.EC-11 | Field errors versus form errors | UT-054, UT-055 | IT-149 | — |
| US-021.EC-12 | Two submissions for one slot | — | IT-150 | — |
| US-021.EC-13 | Double submit on one form | — | IT-151 | — |
| US-021.EC-14 | No common areas registered | — | IT-152 | — |
| US-022 | Approve a reservation | — | IT-153 (journey) | — |
| US-022.EC-1 | Slot taken before approval | — | IT-154 | — |
| US-022.EC-2 | No longer pending | — | IT-155 | — |
| US-022.EC-3 | Approve pressed twice | — | IT-156 | — |
| US-022.EC-4 | Two administrators deciding | — | IT-157 | — |
| US-022.EC-5 | Operator cannot approve | — | IT-158 | — |
| US-022.EC-6 | Approving a past reservation | — | IT-159 | — |
| US-023 | Reject a reservation | — | IT-160 (journey) | — |
| US-023.EC-1 | Already decided | — | IT-161 | — |
| US-023.EC-2 | Rejection without a reason | — | IT-162 | — |
| US-023.EC-3 | Reason too long | UT-068 | IT-163 | — |
| US-023.EC-4 | Approve after reject | — | IT-164 | — |
| US-024 | Cancel a reservation | — | IT-165 (journey) | — |
| US-024.EC-1 | Started reservation, operator refused | — | IT-166 | — |
| US-024.EC-2 | Already canceled | — | IT-167 | — |
| US-024.EC-3 | Completed reservation | — | IT-168 | — |
| US-024.EC-4 | Cancel pressed twice | — | IT-169 | — |
| US-024.EC-5 | Cancelling a pending reservation | — | IT-170 | — |
| US-025 | Reservation indicators | UT-033 | IT-171 (journey) | — |
| US-025.EC-1 | Month with no reservations | — | IT-172 | — |
| US-025.EC-2 | No common areas | — | IT-173 | — |
| US-025.EC-3 | Indicators fail, list survives | — | IT-174 | — |
| US-025.EC-4 | Many common areas | — | IT-175 | — |
| US-025.EC-5 | Indicator scope under filters | — | IT-176 | — |
| US-026 | Role-driven visibility | UT-034 | IT-177 (journey) | — |
| US-026.EC-1 | Server refuses an offered action | — | IT-178 | — |
| US-026.EC-2 | Session expiry mid-action | UT-047 | IT-179 | — |
| US-026.EC-3 | Permissions change between loads | — | IT-180 | — |
| US-026.EC-4 | Out-of-scope record by direct link | — | IT-181 | — |
| US-027 | Condominium scoping | UT-035 | IT-182 (journey) | — |
| US-027.EC-1 | Exactly one condominium | — | IT-183 | — |
| US-027.EC-2 | Selected condominium inaccessible | — | IT-184 | — |
| US-027.EC-3 | Switch mid-edit | — | IT-185 | — |
| US-027.EC-4 | New condominium becomes selectable | UT-036 | IT-186 | — |
| US-027.EC-5 | Selected condominium deleted | — | IT-187 | — |
| US-028 | Pipeline passes | — | IT-188 (journey) | — |
| US-028.EC-1 | Empty suite neither fails nor suffices | — | IT-189 | — |
| US-028.EC-2 | A failing test fails the job | — | IT-190 | — |
| US-028.EC-3 | Coverage command works | — | IT-191 | — |
| US-028.EC-4 | Browser APIs absent from jsdom | — | IT-192 | — |
| US-028.EC-5 | State leaking between tests | — | IT-193 | — |
| US-029 | Create a block inline | — | IT-194 (journey) | — |
| US-029.EC-1 | Duplicate block name | — | IT-195 | — |
| US-029.EC-2 | Inline creation cancelled | — | IT-196 | — |
| US-029.EC-3 | Block created, unit creation fails | — | IT-197 | — |
| US-029.EC-4 | No permission to create blocks | — | IT-198 | — |
| US-029.EC-5 | Floors out of range | UT-028 | IT-199 | — |
| US-030 | Manage blocks | — | IT-200 (journey) | — |
| US-030.EC-1 | Block with units cannot be deleted | — | IT-201 | — |
| US-030.EC-2 | No blocks registered | — | IT-202 | — |
| US-030.EC-3 | Rename collision | — | IT-203 | — |
| US-030.EC-4 | Block deleted while selected | — | IT-204 | — |
| US-030.EC-5 | Condominium switched | — | IT-205 | — |
| US-030.EC-6 | Floor count changed after units exist | — | IT-206 | — |

### Components and endpoints

| Source | Responsibility | Unit | Integration | E2E |
|---|---|---|---|---|
| `query-params.ts` | Reserved params, filters, sort translation | UT-001–UT-015 | — | — |
| `list-state.ts` | View state and page-reset rules | UT-016–UT-028 | — | — |
| `resource-hooks.ts` | Query keys, invalidation, enabled guard | UT-029–UT-040 | IT-207, IT-208 | — |
| `api.ts` (transport) | Envelope, error normalisation, refresh | UT-041–UT-052 | — | — |
| `applyApiError` | 422 to fields, 409 to form | UT-053–UT-058 | — | — |
| Reservation local rules | Eight rules derived from the area | UT-059–UT-075 | — | — |
| Calendar composition | Month grid from availability entries | UT-076–UT-085 | — | — |
| `format.ts` | Null-safe display helpers | UT-086–UT-090 | — | — |
| `data-table.tsx` (repaired) | Slice, controlled search, key, keyboard | UT-091–UT-100 | IT-209 | — |
| `GET /{resource}` | Paged list, meta, filters | UT-037 | IT-001, IT-044, IT-085, IT-124 | — |
| `POST /{resource}` | 201; 422 field; 409 conflict | UT-056 | IT-010, IT-052, IT-091, IT-138 | — |
| `PATCH /{resource}/:id` | 200; 404 gone; 409 conflict | — | IT-020, IT-068, IT-101 | — |
| `DELETE /{resource}/:id` | 204 no body; 409 blocked | UT-042 | IT-032, IT-074, IT-113 | — |
| `POST /{resource}/:id/restore` | 200; 409 conflict | — | IT-039, IT-078, IT-117 | — |
| `GET /condominiums/:id/stats` | Seven counters; failure isolated | — | IT-026, IT-030 | — |
| `POST /units/bulk` | `{created}`; 409 all-exist | — | IT-060, IT-061 | — |
| `GET /reservations/availability` | Flat array, distinct shape | UT-082 | IT-130 | — |
| `POST /reservations/:id/approve` | 200; 409 conflict; 409 not pending; 403 | — | IT-153, IT-154, IT-155, IT-158 | — |
| `POST /reservations/:id/reject` | 200; 409 not pending | — | IT-160, IT-161 | — |
| `POST /reservations/:id/cancel` | 200; 409 started/completed | — | IT-165, IT-166, IT-168 | — |
| `GET /common-areas` | Supplies form rules | — | IT-138, IT-152 | — |
| Indicator counts via `meta.total` | `perPage=1` plus filters | UT-038, UT-039 | IT-080, IT-171 | — |

## Unit Tests

### `query-params.ts` (TechSpec: Core Interfaces)

- **UT-001** (happy): `toQueryParams` — given `{page:2, perPage:20, sortBy:'name', sortOrder:'ASC'}`, produces exactly those four keys and no others.
- **UT-002** (error): `condominiumSchema` — a name of two characters fails with the message `Informe o nome do condominio.` on path `name`.
- **UT-003** (error): `condominiumSchema` — a document of 13 digits fails on path `document`; 14 digits passes.
- **UT-004** (happy): `condominiumSchema` — `state: 'sp'` parses to `'SP'`.
- **UT-005** (boundary): `toQueryParams` — a filter whose value is `''` is omitted; a filter whose value is `'0'` is kept.
- **UT-006** (happy): `toQueryParams` — `filters: {status:['VACANT','OCCUPIED']}` serialises to `status=VACANT,OCCUPIED`.
- **UT-007** (boundary): `toQueryParams` — `perPage: 500` is clamped to 200, the server maximum.
- **UT-008** (happy): `unitFilters` — the whitelist is exactly `condominiumId, blockId, status, type, floor`; a key outside it is dropped.
- **UT-009** (error): `unitSchema` — `floor: 201` and `idealFraction: 1.5` each fail on their own path.
- **UT-010** (happy): `bulkGenerateSchema` — `{floors:3, unitsPerFloor:4}` yields a projected count of 12.
- **UT-011** (boundary): `bulkGenerateSchema` — `floors: 0` and `floors: 101` both fail; `1` and `100` both pass.
- **UT-012** (boundary): `bulkGenerateSchema` — `{floors:100, unitsPerFloor:50}` projects 5000 and passes validation.
- **UT-013** (error): `bulkGenerateSchema` — a pattern producing a number over 20 characters fails before submission.
- **UT-014** (happy): `residentFilters` — the whitelist is exactly `condominiumId, unitId, type, status, userId`.
- **UT-015** (happy): `normaliseDocument` — `'123.456.789-09'` becomes `'12345678909'` before being sent as a search term.

### `list-state.ts` (TechSpec: Core Interfaces)

- **UT-016** (happy): `useListState` — initial state is page 1, empty search, no sort, no filters, deleted excluded.
- **UT-017** (state): `setSearch` — `searchInput` updates immediately; `search` updates only after the debounce interval elapses.
- **UT-018** (boundary): `setPage(0)` and `setPage(-1)` clamp to 1.
- **UT-019** (state): `setSort('name','asc')` then `setSort('name','asc')` again keeps the same column and direction — the hook stores what the table reports and does not toggle on its own.
- **UT-020** (state): `setIncludeDeleted(true)` resets page to 1.
- **UT-021** (state): `setIncludeDeleted(true)` then `setPage(3)` keeps deleted included — paging does not clear the toggle.
- **UT-022** (state): `clearFilters` empties filters and resets page to 1.
- **UT-023** (error): `residentSchema` — a name of two characters fails on path `name`.
- **UT-024** (error): `residentSchema` — `moveOutDate` earlier than `moveInDate` fails on path `moveOutDate`.
- **UT-025** (error): `residentSchema` — a `birthDate` in the future fails on path `birthDate`.
- **UT-026** (happy): `setFilter('status','ACTIVE')` then `setFilter('type','OWNER')` produces both filters and page 1.
- **UT-027** (state): `setFilter('unitId', undefined)` removes the key entirely rather than sending an empty value.
- **UT-028** (error): `blockSchema` — `floors: 0` fails; `floors: 1` passes.

### `resource-hooks.ts` (TechSpec: Core Interfaces)

- **UT-029** (happy): `useList` — builds query key `['units','list',params]` and calls `apiGetPaginated('/units', {params})` once.
- **UT-030** (happy): `useList` — returns `data` and `meta` unchanged from the transport helper.
- **UT-031** (state): `useList` with `enabled: false` issues no request.
- **UT-032** (happy): `useOne(id)` — query key `['reservations','detail',id]`; with `id` null, no request is issued.
- **UT-033** (happy): `useCreate` — on success invalidates `['reservations']` exactly once.
- **UT-034** (happy): `useUpdate` — calls `apiPatch('/units/:id', data)` with the identifier interpolated, not passed as a parameter.
- **UT-035** (happy): `useRemove` — calls `apiDelete` and resolves to `undefined`, not to a parsed body.
- **UT-036** (happy): `createResourceHooks('condominiums', {extraInvalidate:[['condominiums','options']]})` — a create invalidates both `['condominiums']` and `['condominiums','options']`.
- **UT-037** (error): `useList` — a rejected request surfaces the `ApiError` unchanged in `error`, preserving `status` and `code`.
- **UT-038** (happy): `useCount` — requests `perPage: 1` with the supplied filters and returns `meta.total`.
- **UT-039** (boundary): `useCount` — a response whose `meta.total` is 0 returns 0, distinguishable from `undefined` while loading.
- **UT-040** (error): `useRestore` — a 409 rejection leaves the cache untouched and does not invalidate.

### `api.ts` transport (TechSpec: Integration Points)

- **UT-041** (error): a 422 response produces an `ApiError` with `status 422`, `code 'VALIDATION_ERROR'` and `details` preserved.
- **UT-042** (happy): `apiDelete` on a 204 with no body resolves without attempting to parse a payload.
- **UT-043** (happy): `apiGet` unwraps `{success:true,data:X}` and returns `X`.
- **UT-044** (happy): `apiGetPaginated` returns `{data, meta}` and supplies default meta when the server omits it.
- **UT-045** (error): a 409 response produces an `ApiError` with `status 409` and `details` undefined.
- **UT-046** (state): a 401 outside the sign-in and refresh routes triggers exactly one refresh for a burst of three concurrent failures.
- **UT-047** (state): a failed refresh dispatches the `auth:session-expired` event exactly once.
- **UT-048** (happy): a request carries the bearer token from storage in its authorization header.
- **UT-049** (error): a network failure with no response produces an `ApiError` with a non-HTTP status rather than an unhandled rejection.
- **UT-050** (error): a 500 response produces an `ApiError` whose message is the server's, not a generic string.
- **UT-051** (idempotency): a replayed request after refresh is issued once, not twice.
- **UT-052** (happy): `apiPost` returns the created entity from `data`, and a 201 is not treated as an error.

### `applyApiError` (TechSpec: Core Interfaces)

- **UT-053** (happy): an `ApiError` with `details:[{field:'document',message:'...'}]` calls `setError('document', ...)` and leaves the form-level message null.
- **UT-054** (happy): an `ApiError` with status 409 and no details sets the form-level message to `error.message` and calls `setError` never.
- **UT-055** (boundary): an `ApiError` with status 422 but an empty `details` array falls through to the form-level message.
- **UT-056** (state): `details` naming a field the form does not own falls through to the form-level message rather than being discarded.
- **UT-057** (happy): a nested field path such as `address.city` is passed through unchanged to `setError`.
- **UT-058** (error): a non-`ApiError` rejection produces the generic fallback message, not an empty string.

### Reservation local rules (TechSpec: Core Interfaces; ADR-011)

- **UT-059** (happy): a booking inside every area constraint passes local validation with no issues.
- **UT-060** (boundary): `endsAt` exactly equal to `startsAt` fails on path `endsAt`; one minute later passes.
- **UT-061** (boundary): `startsAt` one minute in the past fails; one minute ahead passes.
- **UT-062** (boundary): with `advanceBookingDays: 30`, a start exactly 30 days ahead passes and 31 days fails.
- **UT-063** (boundary): with `minHours: 2`, a duration of exactly 2 hours passes and 1h59 fails.
- **UT-064** (boundary): with `maxHours: 6`, exactly 6 hours passes and 6h01 fails.
- **UT-065** (happy): with `availableWeekdays: [0,6]`, a Saturday booking passes and a Wednesday fails.
- **UT-066** (boundary): with `opensAt '08:00'` and `closesAt '22:00'`, a booking from 08:00 to 22:00 passes; 07:59 and 22:01 each fail.
- **UT-067** (boundary): with `capacity: 50`, `guestsCount: 50` passes and 51 fails; with `capacity: 0`, any count passes.
- **UT-068** (boundary): a decision reason of 255 characters passes and 256 fails.
- **UT-069** (state): `closesAt '00:00'` is treated as end-of-day, so a booking ending at 23:59 passes.
- **UT-070** (state): with no area chosen, only required fields and end-after-start are validated; area rules are absent.
- **UT-071** (state): changing the chosen area re-derives the rules, so a booking valid for the previous area is re-evaluated.
- **UT-072** (boundary): `availableWeekdays: null` permits every weekday.
- **UT-073** (boundary): `minHours: 0` and `maxHours: 0` impose no duration bound.
- **UT-074** (state): overlap and minimum-interval are **not** evaluated locally — a booking conflicting with a known reservation still passes local validation.
- **UT-075** (boundary): a booking crossing midnight is evaluated against the weekday and opening hours of its start.

### Calendar composition (TechSpec: Component Overview; ADR-003)

- **UT-076** (happy): `buildMonthGrid` for a month starting on a Wednesday produces 6 weeks × 7 days with the correct leading and trailing days marked as outside the month.
- **UT-077** (boundary): a month with no entries produces a full grid with every day empty.
- **UT-078** (boundary): a day with more entries than the display cap reports the cap plus the residual count.
- **UT-079** (state): an entry from 23:00 to 01:00 the next day appears on both days.
- **UT-080** (boundary): February in a leap year yields 29 days; a 31-day month starting on Sunday yields exactly 5 weeks.
- **UT-081** (happy): entries are grouped by day preserving start-time order within each day.
- **UT-082** (happy): `AvailabilityEntry` items are mapped to grid entries carrying area name, unit number, time range and status.
- **UT-083** (boundary): an entry whose `commonAreaName` is null renders a fallback label rather than the word null.
- **UT-084** (happy): `monthRange` produces `from` at the first instant of the month and `to` at the last, for the availability request.
- **UT-085** (state): a grid built for March is unaffected by entries belonging to April.

### `format.ts` null-safety (TechSpec: Component Overview)

- **UT-086** (boundary): `formatDocument(null)` returns the placeholder, not `'null'`.
- **UT-087** (boundary): `formatPhone(null)` and `formatPhone('')` both return the placeholder.
- **UT-088** (happy): `formatDocument` formats 11 digits as a personal document and 14 as a company one.
- **UT-089** (boundary): `formatCurrency(0)` returns a formatted zero, not the placeholder.
- **UT-090** (boundary): `formatDate` on an invalid date string returns the placeholder rather than throwing.

### `data-table.tsx` repairs (TechSpec: Impact Analysis; ADR-009)

- **UT-091** (happy): with `pageable` and server-side data, all 20 supplied rows render when `pageSize` is 20.
- **UT-092** (boundary): a column without a renderer whose value is null renders the placeholder, not `'null'`.
- **UT-093** (boundary): a column without a renderer whose value is `0` renders `0`, not the placeholder.
- **UT-094** (happy): the search input reflects the controlled value supplied by the caller.
- **UT-095** (state): clearing the controlled search value empties the input.
- **UT-096** (happy): a column keyed by a free identifier with a renderer type-checks and renders.
- **UT-097** (happy): pressing Enter on a focused clickable row invokes the row handler.
- **UT-098** (happy): a clickable row is reachable by keyboard and exposes an activatable role.
- **UT-099** (boundary): with `totalPages` of 1, pagination controls are absent; with 2, they are present.
- **UT-100** (happy): `aria-sort` is present on the header cell and reflects the active column's direction.

## Integration Tests

Every case mounts the screen through `test/render.tsx` with the transport module doubled, a role, and a selected condominium. Cases marked **(journey)** follow a user story start to finish and stand in for end-to-end coverage.

### Condomínios (US-001 – US-006)

- **IT-001** (journey): render the list with 25 records over 2 pages; search, sort by name, page forward; expect the request parameters to carry the search term, `sortBy=name`, `sortOrder=ASC` and `page=2`, and the rendered rows to match the second page.
- **IT-002**: an empty list renders the no-records empty state with the register action, not the no-results one.
- **IT-003**: a search returning nothing renders the no-results empty state with a clear-search action.
- **IT-004**: typing five characters issues one list request after the debounce, not five.
- **IT-005**: a column outside the server's sortable set renders without a sort control.
- **IT-006**: a 20-record page with `perPage` 20 renders 20 rows.
- **IT-007**: requesting a page past the last returns to the last valid page rather than rendering empty.
- **IT-008**: a 401 during the list does not raise a toast; the session-expired path handles it.
- **IT-009**: a record with null document, city and síndico renders placeholders in those cells.
- **IT-010** (journey): open the dialog, fill name and document, submit; expect `POST /condominiums` once, the dialog closed, and the list refreshed.
- **IT-011**: a 409 naming a duplicate document renders the server message at form level, with no field highlighted.
- **IT-012**: a 409 for a document belonging to a deleted record renders the message and the form stays open with its values.
- **IT-013**: a 409 carrying the plan-limit message renders that message verbatim.
- **IT-014**: a two-character name and a due day of 29 are each rejected inline, and no request is issued.
- **IT-015**: a 13-digit document is rejected inline on the document field.
- **IT-016**: two rapid submits issue one request; the submit control is disabled while in flight.
- **IT-017**: dismissing a dirty dialog asks for confirmation; dismissing a pristine one does not.
- **IT-018**: a network failure leaves the entered values in the form and shows the failure.
- **IT-019**: submitting `state: 'sp'` sends `'SP'`.
- **IT-020** (journey): open edit on an existing record, change the phone, submit; expect `PATCH` with the changed field and the list updated.
- **IT-021**: a 409 on edit keeps the dialog open with the entered values.
- **IT-022**: a 404 on edit closes the dialog and refreshes the list.
- **IT-023**: a second edit over a stale form succeeds and the refreshed list shows the server's values.
- **IT-024**: clearing an optional field sends it as empty rather than omitting it.
- **IT-025**: the detail route for a missing identifier renders the not-found state with a link back.
- **IT-026** (journey): open the detail page; expect the record and all seven indicators rendered from `/stats`.
- **IT-027**: a deleted condominium's detail route renders not-found.
- **IT-028**: a malformed identifier renders not-found rather than an unhandled failure.
- **IT-029**: all-zero indicators render zeros, distinguishable from the loading placeholders.
- **IT-030**: the record request succeeding while `/stats` fails renders the record with an indicator-level error and a retry.
- **IT-031**: a 403 on the detail route renders the forbidden state.
- **IT-032** (journey): delete a record; expect the confirmation naming it, one `DELETE`, and removal from both the list and the shell selector.
- **IT-033**: a 409 blocked by units renders the server message and keeps the record listed.
- **IT-034**: deleting the currently selected condominium moves the selection to another.
- **IT-035**: deleting the last condominium renders the application's no-condominium state.
- **IT-036**: a 404 on delete refreshes the list.
- **IT-037**: dismissing the confirmation issues no request.
- **IT-038**: two rapid confirmations issue one `DELETE`.
- **IT-039** (journey): enable the deleted toggle, restore a record; expect `includeDeleted=true` on the list request, then one restore call and the record back in the normal list.
- **IT-040**: the toggle on with no deleted records leaves the list unchanged and the toggle visibly active.
- **IT-041**: a deleted row is visually marked distinctly from a live row of the same name.
- **IT-042**: a 409 on restore renders the message and leaves the record deleted.
- **IT-043**: paging with the toggle on keeps `includeDeleted=true` on every request.

### Unidades e Blocos (US-007 – US-012, US-029 – US-030)

- **IT-044** (journey): list units, filter by block and status, sort by number, page; expect the request to carry `condominiumId`, `blockId`, `status` and `sortBy=number`.
- **IT-045**: with no condominium selected, the screen renders the selection-required state and issues no request.
- **IT-046**: a condominium with no units offers both single registration and bulk generation.
- **IT-047**: filters matching nothing render the no-results state with a clear action.
- **IT-048**: switching condominium clears a block filter belonging to the previous one.
- **IT-049**: a 200-unit condominium pages without the row count degrading.
- **IT-050**: searching `'10'` lists every matching number, paginated.
- **IT-051**: a unit with null area and fraction renders placeholders, while `parkingSpots: 0` renders `0`.
- **IT-052** (journey): register a unit; expect the condominium bound from the shell, the block list scoped to it, one `POST`, and the list refreshed.
- **IT-053**: a 409 on a duplicate number renders at form level with the entry preserved.
- **IT-054**: the block selector offers only the selected condominium's blocks.
- **IT-055**: a 409 reporting a block from another condominium renders verbatim.
- **IT-056**: `floor: 201` and `idealFraction: 1.5` are rejected inline with no request.
- **IT-057**: two rapid submits issue one `POST`.
- **IT-058**: a 409 for a number matching a deleted unit renders the server message.
- **IT-059**: with no blocks, the selector offers inline block creation.
- **IT-060** (journey): generate 3 floors × 4 units; expect the projected count of 12 shown before confirming, one `POST /units/bulk`, the reported created count surfaced, and the list refreshed.
- **IT-061**: a 409 reporting every number already exists renders as an outcome message, not a failure state.
- **IT-062**: `floors: 0` is rejected inline with no request.
- **IT-063**: generating into a populated block warns about the overlap before confirming.
- **IT-064**: a 100 × 50 grid submits and shows progress rather than appearing frozen.
- **IT-065**: two rapid confirmations issue one bulk request.
- **IT-066**: a network failure during generation refreshes the list on return rather than assuming an outcome.
- **IT-067**: a pattern yielding a 21-character number is rejected inline.
- **IT-068** (journey): edit a unit's number and fee; expect one `PATCH` and the updated row.
- **IT-069**: a 409 on a colliding number keeps the dialog open.
- **IT-070**: submitting `status: 'OCCUPIED'` on a unit with no residents renders the server's returned status, not the submitted one.
- **IT-071**: submitting `status: 'RENOVATION'` renders as renovation after save.
- **IT-072**: the block field on edit is either absent or validated against the target condominium — never offered and ignored.
- **IT-073**: a 404 on edit closes the dialog and refreshes.
- **IT-074** (journey): delete a unit with no dependents; expect removal and the condominium's unit total reflecting it.
- **IT-075**: a 409 citing active residents renders verbatim and keeps the unit.
- **IT-076**: a 409 citing open charges renders verbatim.
- **IT-077**: after the residents blocker clears, a retry surfaces the charges blocker; neither deletion succeeds.
- **IT-078**: a 409 on restore for a reused number renders the message and leaves the unit deleted.
- **IT-079**: deleting the last unit leaves the condominium deletable.
- **IT-080** (journey): render occupancy indicators; expect total, occupied and available derived from the count requests.
- **IT-081**: a condominium with no units renders zeros, distinct from loading.
- **IT-082**: renovation and blocked units are counted in the total and the three figures reconcile.
- **IT-083**: failing indicators leave the list usable with an indicator-level error.
- **IT-084**: with list filters active, the indicators are labelled with the scope they describe.
- **IT-194** (journey): from the unit form with no blocks, create a block inline; expect the unit data preserved, the block created, and it selected for the unit.
- **IT-195**: a 409 on a duplicate block name preserves the unit data already entered.
- **IT-196**: cancelling inline creation returns to the unit form with no block selected.
- **IT-197**: a block created followed by a failed unit creation leaves the block present and says so.
- **IT-198**: without block-create permission, inline creation is absent and only existing blocks are listed.
- **IT-199**: `floors: 0` in inline creation is rejected with no request.
- **IT-200** (journey): open block management, edit a block's name, delete an empty one; expect the unit list to reflect the new name.
- **IT-201**: a 409 on deleting a block with units renders verbatim and keeps the block.
- **IT-202**: no blocks renders an empty state offering the first one.
- **IT-203**: a 409 on rename renders as a conflict.
- **IT-204**: deleting a block selected in an open unit form surfaces the failure on submission.
- **IT-205**: switching condominium reloads block management for the new one.
- **IT-206**: changing a block's floor count after units exist succeeds and leaves units unchanged.

### Moradores (US-013 – US-018)

- **IT-085** (journey): list residents, search by name, filter by unit and status; expect the parameters to carry the search term, `unitId` and `status`.
- **IT-086**: a resident with null document and phone renders placeholders.
- **IT-087**: searching a punctuated document sends the digits only.
- **IT-088**: an empty list offers registration.
- **IT-089**: a resident whose unit is absent renders the row with the missing unit shown explicitly.
- **IT-090**: 300 residents page correctly at the requested page size.
- **IT-091** (journey): register a resident against a unit; expect the condominium bound, the unit list scoped, one `POST`, and the list refreshed.
- **IT-092**: a 409 for invalid check digits renders at form level with the entry preserved.
- **IT-093**: a 409 for a duplicate document renders verbatim.
- **IT-094**: the unit selector offers only the selected condominium's units.
- **IT-095**: a two-character name is rejected inline.
- **IT-096**: submitting with neither document nor email succeeds and no consent timestamp is claimed in the interface.
- **IT-097**: a move-out earlier than move-in is rejected inline on the move-out field.
- **IT-098**: a future birth date is rejected inline.
- **IT-099**: two rapid submits issue one `POST`.
- **IT-100**: a condominium with no units explains that a unit is required first.
- **IT-101** (journey): edit a resident's unit and status; expect one `PATCH` and the updated row.
- **IT-102**: setting the last active resident to moved out refreshes the unit list, which shows the unit vacant.
- **IT-103**: a 409 for a cross-condominium unit renders verbatim.
- **IT-104**: a 409 for a document conflict keeps the dialog open.
- **IT-105**: a 404 on edit closes the dialog and refreshes.
- **IT-106**: clearing move-out on a moved-out resident produces a coherent saved state or an inline objection.
- **IT-107** (journey): mark a resident primary on a unit that has another; expect one request and the list showing exactly one primary.
- **IT-108**: after designation, the previously primary resident is no longer marked in the refreshed list.
- **IT-109**: a unit with no primary renders no marker and raises no objection.
- **IT-110**: two designations in quick succession settle on one primary after refresh.
- **IT-111**: deleting the primary leaves the unit with none, shown explicitly.
- **IT-112**: designating an inactive resident is either prevented inline or surfaces the server's objection.
- **IT-113** (journey): delete a resident; expect removal and the unit's occupancy refreshed.
- **IT-114**: deleting the only active resident shows the unit vacant in the units list.
- **IT-115**: deleting the primary leaves no primary marker.
- **IT-116**: restoring a resident whose unit is gone surfaces the outcome rather than rendering a detached record silently.
- **IT-117**: a 409 on restore renders and leaves the record deleted.
- **IT-118**: a reservation requested by a deleted resident still shows the requester's name.
- **IT-119** (journey): filter by unit, then type, then status; expect all three parameters and removable chips for each.
- **IT-120**: a filter combination matching nothing offers to clear.
- **IT-121**: a filter on a since-deleted unit refreshes and clears or marks the stale filter.
- **IT-122**: switching condominium clears the unit filter.
- **IT-123**: no control is offered for a filter outside the server's whitelist.

### Reservas (US-019 – US-025)

- **IT-124** (journey): list reservations, filter by area and status, read the pending count, select it; expect `status=PENDING` applied in one interaction.
- **IT-125**: an empty list offers creating a reservation.
- **IT-126**: a pending count of zero renders as zero rather than being hidden.
- **IT-127**: a reservation whose area is absent renders with an unavailable-area label.
- **IT-128**: a reservation whose unit is absent still renders the requester's name.
- **IT-129**: switching condominium clears area and unit filters.
- **IT-130** (journey): switch to the calendar, page to the next month, filter by area; expect one availability request per month with `from`, `to` and `commonAreaId`, and the grid reflecting the response.
- **IT-131**: a month with no entries renders a full grid of empty days.
- **IT-132**: a day exceeding the display cap shows the cap plus a residual indicator.
- **IT-133**: an entry crossing midnight appears on both days.
- **IT-134**: February of a leap year renders 29 days with adjacent-month days marked.
- **IT-135**: paging forward twice quickly renders the month matching the latest response, not an earlier one arriving late.
- **IT-136**: rejected, canceled and completed reservations are absent from the calendar while present in the list.
- **IT-137**: with no condominium selected, the calendar explains the requirement.
- **IT-138** (journey): choose an area, see its constraints rendered, enter a valid range, submit; expect one `POST /reservations` and the booking in both views.
- **IT-139**: an end equal to the start is rejected inline on the end field with no request.
- **IT-140**: a past start is rejected inline.
- **IT-141**: a start beyond the advance limit is rejected inline, stating the limit.
- **IT-142**: durations below the minimum and above the maximum are each rejected inline.
- **IT-143**: a weekday the area excludes is rejected inline.
- **IT-144**: a range outside opening hours is rejected inline, stating the window.
- **IT-145**: a 409 reporting an overlap renders at form level with the entry preserved.
- **IT-146**: a 409 reporting the minimum interval renders verbatim.
- **IT-147**: guests above capacity are rejected inline.
- **IT-148**: an unavailable area is absent from the selector.
- **IT-149**: a 422 on a field renders inline with no toast; a 409 renders at form level with no toast.
- **IT-150**: two submissions for one slot yield one success and one conflict message.
- **IT-151**: two rapid submits on one form issue one `POST`.
- **IT-152**: a condominium with no areas explains that an area is required first.
- **IT-153** (journey): approve a pending reservation with a reason; expect one approve call, the status confirmed, and the pending count decreased.
- **IT-154**: a 409 reporting a confirmed booking for the slot renders verbatim and leaves the reservation pending.
- **IT-155**: a 409 reporting the reservation is no longer pending refreshes the list.
- **IT-156**: two rapid approvals issue one call.
- **IT-157**: a concurrent decision by another administrator surfaces the not-pending message after refresh.
- **IT-158**: rendered as an operator, approve and reject controls are absent while cancel is present.
- **IT-159**: approving a past-start reservation renders the status the server returns.
- **IT-160** (journey): reject with a reason; expect the status rejected, the reason visible, and the pending count decreased.
- **IT-161**: a 409 on an already-decided reservation renders and refreshes.
- **IT-162**: rejecting with no reason succeeds.
- **IT-163**: a 256-character reason is rejected inline.
- **IT-164**: approving after rejecting surfaces the not-pending message.
- **IT-165** (journey): cancel a future reservation with a reason; expect it canceled and absent from the calendar.
- **IT-166**: as an operator, cancelling a started reservation renders the administration-only message.
- **IT-167**: a 409 for an already-canceled reservation renders verbatim.
- **IT-168**: a 409 for a completed reservation renders verbatim.
- **IT-169**: two rapid cancellations issue one call.
- **IT-170**: cancelling a pending reservation decreases the pending count without recording a decision.
- **IT-171** (journey): render the month's indicators; expect the month count, the per-area breakdown and the cancellation count from count requests carrying the month range.
- **IT-172**: a month with no reservations renders zeros.
- **IT-173**: a condominium with no areas renders an empty breakdown with an explanation.
- **IT-174**: failing indicators leave the list usable.
- **IT-175**: twelve areas render a readable breakdown without overflow.
- **IT-176**: with list filters active, indicators are labelled with their scope.

### Transversal (US-026 – US-028)

- **IT-177** (journey): render each screen as an operator; expect create, edit, delete and restore absent everywhere, and read paths fully usable.
- **IT-178**: a 403 on an action the interface offered surfaces the refusal rather than failing silently.
- **IT-179**: a 401 mid-action routes to sign-in without an error toast.
- **IT-180**: a remount with a reduced permission set renders the reduced interface.
- **IT-181**: a 403 on a direct detail link renders the forbidden state with nothing partially rendered.
- **IT-182** (journey): with a condominium selected, open units, residents and reservations; expect every request to carry that `condominiumId`.
- **IT-183**: a user with exactly one condominium has it selected automatically and screens work with no manual step.
- **IT-184**: a stored selection no longer in the accessible list falls back to the first available.
- **IT-185**: switching condominium with a dialog open either closes it with confirmation or completes against the condominium it was opened for.
- **IT-186**: creating a condominium makes it selectable without a reload.
- **IT-187**: deleting the selected condominium moves the selection and dependent screens recover.
- **IT-188** (journey): the full suite runs to completion and exits zero.
- **IT-189**: the suite is non-empty; the runner reports the number of files and cases it executed.
- **IT-190**: a deliberately failing case causes a non-zero exit.
- **IT-191**: the coverage command completes and writes the coverage report the pipeline references.
- **IT-192**: a test opening a select and a test opening a dialog both run without failing on absent browser APIs.
- **IT-193**: stored session state written by one case is absent in the next.

### Data layer boundary (TechSpec: Core Interfaces)

- **IT-207**: a create through the hook factory refreshes an already-rendered list without a manual refetch.
- **IT-208**: a condominium create refreshes both the list and the shell's selector.
- **IT-209**: the repaired table wired to the data layer renders a full page, requests the next page with the same page size, and translates sort direction to upper case in the request.

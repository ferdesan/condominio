# PRD: Back-Office Screens for Condominiums, Units, Residents and Reservations

## Overview

This platform is a multi-tenant SaaS for condominium management. Its backend is complete: 27 REST modules are registered and tested, covering condominiums, blocks, units, residents, common areas, reservations, finance, assemblies and operations. Its frontend is not. Exactly one screen exists — the dashboard. Every other entry in the navigation resolves to a placeholder reading "module under construction", because the router activates only the dashboard route and generates placeholders for the rest.

The product is therefore unusable for its core purpose. An administrator cannot register a condominium, a síndico cannot record a unit or a resident, and no one can book a common area. The data model, the business rules and the permission system all work; there is no way to reach them.

This effort delivers the four screens that make the cadastre operational: **Condomínios**, **Unidades**, **Moradores** and **Reservas**. They serve back-office personas — administrator, síndico, and porteiro in a read-mostly capacity. It also repairs the continuous integration pipeline, which currently fails on a test job that runs a test runner against zero test files, blocking every job that depends on it.

The value is immediate and structural: it converts a well-built backend into a usable product, and it establishes the interaction patterns that the remaining seventeen modules will follow.

## Goals

After this ships:

- An administrator can register, edit, consult and remove condominiums, and see each one's operational totals on a single page.
- A síndico can take a newly registered condominium from empty to fully structured — creating blocks, generating a building's units in one operation, and registering residents against those units.
- A síndico can book a common area on behalf of a resident, see a month's bookings laid out by day, and dispatch pending requests by approving or rejecting them from the list.
- A porteiro can consult all four cadastres and cancel a reservation, without being offered actions their role will refuse.
- A record deleted by mistake can be found and restored through the interface, rather than requiring database access.
- Every screen acts only on the condominium selected in the application shell, so acting on the wrong building's data becomes impossible rather than merely unlikely.
- The continuous integration pipeline passes on a healthy branch, so a red build indicates a real defect.

## User Stories

Full catalog: [User stories](_user_stories.md)

- **US-001 – US-006** — Condomínios: listing with search and sort, registration, editing, the detail page with operational indicators, deletion, and restoration.
- **US-007 – US-012, US-029 – US-030** — Unidades: listing with filters, single registration, bulk generation of a building, editing, deletion and restoration, occupancy indicators, and the embedded block management that unit registration depends on.
- **US-013 – US-018** — Moradores: listing and search, registration against a unit, editing, primary-resident designation, deletion and restoration, and filtering by unit, type and status.
- **US-019 – US-025** — Reservas: the filterable list, the monthly calendar, booking on behalf of a resident, approval, rejection, cancellation, and the month's indicators.
- **US-026 – US-028** — Transversal: role-driven visibility, condominium scoping across all screens, and the pipeline gate.

## Core Features

### Condomínios

The entry point of the cadastre. A paginated list shows name, document, síndico, city and status, searchable by name, document, city or district, sortable, and filterable by status and type.

Registration and editing happen in a dialog over the list, covering the full record: identification, address, contact, síndico data and the charge due day. A detail page at its own route presents the complete record alongside the operational totals the backend computes — units, occupied units, residents, vehicles, open incidents, pending charges and pending reservations.

This module interacts with the rest of the application more than any other: the condominium selector in the application shell reads the same collection, so every mutation here must be reflected there.

### Unidades

Scoped to the selected condominium. The list shows block, number, floor, type and status, searchable by number and filterable by block, status, type and floor, with occupancy indicators above it.

Two registration paths exist. Single registration covers corrections and additions. **Bulk generation** creates a whole block's units in one operation from a floor count, units per floor, a starting floor and a numbering pattern, skipping numbers that already exist — this is the onboarding path, and without it registering a 120-unit building means 120 dialog submissions.

Because a unit cannot exist without a block and blocks have no screen of their own, **block management is embedded here**: the block selector creates blocks in place, and the screen manages the condominium's blocks directly.

### Moradores

Scoped to the selected condominium. The list shows name, document, unit, condominium, phone and status, searchable by name, email, document or phone, and filterable by unit, type and status.

Registration binds a resident to a unit and captures personal data, contact details, the tenure dates and an emergency contact. One resident per unit may be designated primary, and the designation is exclusive — promoting one demotes any other.

This module drives unit occupancy: attaching or detaching active residents changes the unit's status, so the two screens are coupled in a way the interface must make legible rather than surprising.

### Reservas

The most complex module, and the only one with a review workflow. It presents two views over the same data: a **filterable list** ordered by start time, and a **monthly calendar** showing each day's pending and confirmed bookings, filterable by common area and navigable month to month.

Booking on behalf of a resident requires a common area, a unit and a time range. The chosen area carries its own rules — opening hours, permitted weekdays, duration bounds, advance limit, capacity and the minimum interval between bookings by one unit — and the form surfaces them before submission, though the server remains the authority.

Areas may require approval. Those bookings start pending, and the screen leads with the count of pending requests, which applies the pending filter in one interaction. Approval and rejection are inline row actions available only to roles holding the manage permission. Cancellation is available more broadly.

### Pipeline repair

The test job runs the frontend test command, which invokes a test runner that exits non-zero when it finds no test files. Since the job has no failure tolerance, it fails, and the build and gate jobs that depend on it never run. The pipeline must pass on a healthy branch, and the screens delivered here must be exercised by the suite rather than the suite passing on emptiness.

## Business Rules

### Scoping and visibility

- Every record belongs to exactly one tenant, enforced server-side on every query. Units, residents and reservations additionally belong to exactly one condominium.
- Units, Moradores and Reservas act only on the condominium selected in the application shell. Condomínios is the exception: it lists every condominium the user may see.
- A user whose access is limited to specific condominiums sees only those. Administrative roles carry no such limit and see all.
- A block belongs to one condominium. A unit's block must belong to the unit's condominium. A resident's unit must belong to the resident's condominium. A reservation's area and unit must belong to its condominium. Each mismatch is refused.

### Permissions

| Role | Condomínios | Unidades | Moradores | Reservas |
|---|---|---|---|---|
| SUPER_ADMIN | full | full | full | full |
| ADMIN | full | full | full | full, including approve and reject |
| SINDICO | full | full | full | full, including approve and reject |
| STAFF | read | read | read | read and update — may cancel, may not approve or reject |
| RESIDENT | read | read | read | create, read, update, delete for their own unit only |

- Restoring a deleted record requires the update permission, not the delete permission.
- Approval and rejection require the manage action on reservations.
- An action the role does not permit is not offered in the interface, and is refused by the server if attempted regardless.
- RESIDENT capability is listed for completeness; no resident-facing screen is in scope (ADR-002).

### Validation and error presentation

- Schema violations arrive with a field path and are shown against that field.
- Business-rule violations and uniqueness conflicts arrive **without** a field path and must be shown as a general message on the form or the row, never silently discarded.
- Deletion returns no content. A deletion blocked by dependent data is refused with a message naming the blocking relationship, which is specific enough to show directly.

### Condomínios

- Name is required, minimum three characters, maximum 150.
- Document must be a valid 14-digit company registration number and is unique within the tenant. **Uniqueness considers deleted records**: a document matching a deleted condominium conflicts, and restoration is the remedy rather than re-creation.
- Type defaults to residential; status defaults to active; the charge due day defaults to 10 and must fall between 1 and 28.
- State is stored as two upper-case characters regardless of how it is entered.
- Creating a condominium beyond the tenant's plan limit is refused with a message naming the plan and its limit.
- A condominium with units cannot be deleted until they are removed or transferred.

### Unidades

- Condominium, block and number are required. Number is unique within its block.
- Floor defaults to 0 and ranges from -10 to 200. Type defaults to apartment; status defaults to vacant. Ideal fraction ranges from 0 to 1; monthly fee, bedrooms and parking spots default to 0; pets are allowed by default.
- **Status is partly derived, not freely set.** A unit with at least one active resident becomes occupied; with none, vacant. This recalculation runs whenever residents change, and it overrides a manually chosen occupied or vacant value. It does **not** override renovation or blocked, which persist until changed directly.
- Bulk generation accepts 1 to 100 floors and 1 to 50 units per floor, applies shared defaults to every unit created, skips numbers already present, and reports how many it created. If every number already exists it is refused with that explanation rather than reporting zero.
- A unit with active residents cannot be deleted. A unit with pending, overdue or partially paid charges cannot be deleted.
- Creating or deleting a unit adjusts its condominium's unit total.

### Blocos

- A block belongs to one condominium and carries a name, a type — block, tower, wing or street — a floor count, units per floor, and elevator presence.
- Floors and units per floor serve as defaults for bulk generation, describing the same geometry.
- A block with units cannot be deleted.

### Moradores

- Condominium, unit and name are required; name is minimum three characters.
- Document must pass its check-digit validation and is unique within the tenant. An invalid document and an already-registered one are both refused, each with its own message.
- Type defaults to owner; status defaults to active. Types are owner, tenant and occupant; statuses are active, inactive and moved out.
- **Primary designation is exclusive per unit.** Marking a resident primary clears the flag on every other resident of that unit, as a single server-side operation. The list must reflect both changes.
- A data-protection consent timestamp is recorded automatically at creation when a document or an email is supplied, and not otherwise. It is not user-editable.
- Creating, updating or deleting a resident recalculates the unit's status per the rule above.

### Reservas

- Condominium, common area, unit, start and end are required. Guests default to 0.
- **Nine slot rules are enforced on creation**, each refusing with its own message and none carrying a field path:
  1. End must be later than start.
  2. Start must not be in the past.
  3. Start must fall within the area's advance-booking limit, expressed in days.
  4. Duration must meet the area's minimum hours.
  5. Duration must not exceed the area's maximum hours.
  6. The weekday must be one the area permits.
  7. The time range must fall within the area's opening and closing hours.
  8. The range must not overlap a pending or confirmed booking of the same area.
  9. The same unit must respect the area's minimum interval between bookings, in days.
- Guests may not exceed the area's capacity when a capacity is set. An area not currently available cannot be booked.
- The requester's identity and the area's fee are recorded on the reservation at creation and are not user-supplied.
- States are pending, confirmed, rejected, canceled and completed. An area requiring approval produces a pending reservation; otherwise it is confirmed immediately.
- Only pending reservations may be approved or rejected. **Approval re-validates the slot** and fails if a confirmed booking has taken it meanwhile — the reservation stays pending.
- Completed and canceled reservations cannot be altered. A reservation that has already started may be cancelled only by administration.
- The backend notifies approvers when a pending reservation is created, and the requester when it is decided.

## User Experience

### Personas and goals

- **Administrador** — works across condominiums; registers them and oversees the tenant. Uses the condominium list and detail page most.
- **Síndico** — the highest-volume user. Onboards a building, keeps the cadastre current, and dispatches reservation requests.
- **Operador de portaria** — consults records and cancels bookings. Every screen must remain coherent in read-mostly mode rather than appearing broken.

### Primary flows

**Onboarding a building.** The administrator registers the condominium and it becomes selectable in the shell immediately. The síndico selects it, opens Unidades, creates the first block in place, and generates the building's units in one operation, learning exactly how many were created. They then register residents against those units; each first active resident flips its unit to occupied, and the occupancy indicators move accordingly.

**Daily cadastre maintenance.** The síndico searches for a record, edits it in a dialog over the list, and returns to exactly the filters, search term and page they had. Sequential registration never costs them their place.

**Dispatching reservations.** The síndico opens Reservas and sees the pending count. One interaction filters to those requests. Each is approved or rejected inline with an optional reason, and the count falls as they work. If a slot was taken meanwhile, approval is refused with that explanation and the request stays pending.

**Checking availability.** The síndico switches to the calendar, filters to one common area, and reads the month. Pending and confirmed bookings are visually distinct.

**Recovering a mistake.** A record deleted in error is found by including deleted records in the list, where it is clearly marked, and restored in one action.

### Interface considerations

- Creating and editing happen in dialogs over the list, so list context survives. Condomínios additionally has a detail route.
- A dialog holding unsaved changes asks before discarding them.
- Loading states hold their layout position rather than letting content shift when data arrives.
- Empty states distinguish "nothing registered yet" from "no results for these filters", and each offers the corresponding next action.
- Absent optional values render as a neutral placeholder, never as literal null or undefined text.
- Documents, phones, currency and dates are displayed formatted and submitted in the format the server expects.
- Search input settles before querying rather than issuing a request per keystroke.
- Accessibility follows what the existing components establish: labelled controls, invalid fields marked as such and linked to their messages, error text announced, dialogs dismissible by keyboard with focus trapped, and sortable headers conveying their state. Colour is never the only carrier of meaning — reservation status and deleted rows must be distinguishable without it.
- Every screen works at phone width; tables may scroll horizontally within their own container rather than forcing the page to.

### Discoverability

All four navigation entries already exist and currently lead to placeholders, so the product map is familiar; these screens fill in what the menu already promises. Block management is the exception — it lives inside Unidades and is not where a user would first look, so it must be evident from the block selector itself rather than only from a secondary control.

## High-Level Technical Constraints

- **Consumes the existing API only.** Every requirement here is satisfiable by an endpoint that exists today. No backend change is in scope (ADR-001).
- **Backend integration tests are the authoritative contract.** They cover all four domains, including permission enforcement and every reservation rule, and they define the behavior the interface must accommodate.
- **Uniform API surface.** All four modules derive from one shared CRUD router, so response envelope, pagination metadata, filter parsing, sorting and error codes are identical across them.
- **Server-side pagination throughout.** Page size defaults to 20 and is capped at 200. The rows rendered must match the page size requested, with none dropped client-side.
- **Filter and sort are whitelisted server-side.** Unsupported filters and sort columns are ignored silently rather than refused, so the interface must offer only supported ones — an unsupported control appears to work while doing nothing.
- **Permissions are enforced server-side and mirrored client-side.** The client-side check governs what is shown; the server governs what happens. Both must agree.
- **Data protection.** Resident records carry personal data. The consent timestamp is recorded by the server and is not editable. Deletion is logical throughout, so history and audit trails survive — which is also what the data-protection posture for resident records requires. Collect no field the API does not already define.
- **Session handling already exists.** Expiry is handled globally, including token refresh and redirection to sign-in; screens must not treat an expired session as a request failure.
- **Performance from the user's standpoint.** A listing page, a month of calendar data, or a detail page with its indicators should render without a perceptible stall at realistic volumes — several hundred units and residents per condominium. Bulk generation at maximum size must show progress rather than appearing frozen.

## Non-Goals (Out of Scope)

- **Spreadsheet import of units or residents.** Market research identified this as the sector's dominant onboarding complaint and competitors advertise it, one with assisted column mapping. It requires backend surface that does not exist — staging, column mapping and a preview before commit — and ADR-001 confines this effort to the frontend. Bulk unit generation (ADR-005) partially covers the same need for units; residents remain one at a time. Deferred, not rejected.
- **Exporting the filtered grid.** Expected for accountability reporting and a common reason administrators leave a product for a spreadsheet. Requires a backend endpoint; deferred on the same grounds.
- **Reservation waiting lists, lotteries, guest check-in and post-use inspection.** Found in the market scan as differentiators rather than table stakes, and none is supported by the current API.
- **Resident self-service.** The backend supports a resident booking for their own unit, with ownership enforcement already tested. Building it means extending the session payload and designing a second reservation interface (ADR-002). Deferred as a coherent follow-on effort.
- **Weekly and daily calendar views.** Requested in the source specification, excluded in ADR-003: the hour-grid layout would be the single most expensive component in the effort, with no calendar library present, while three modules have no interface at all.
- **A dedicated blocks module.** Block management is embedded in Unidades to satisfy a hard dependency (ADR-007). The reserved route stays a placeholder.
- **The other seventeen modules.** Dependents, employees, service providers, visitors, vehicles, correspondence, common areas, assemblies, announcements, finance, incidents, maintenance, documents, notifications, users and audit all keep their placeholders. Common areas are consumed read-only by the reservation form but get no management screen.
- **Real-time updates.** The backend emits reservation events and a socket client is installed but unused. Live refresh is not in scope; see Open Questions.
- **Payment collection for reservation fees.** Market practice in this sector posts the fee to the following month's charge rather than collecting at booking, so no checkout is warranted. The fee is recorded and displayed only.

## Architecture Decision Records

- [ADR-001: Frontend-Only Scope Over the Existing API Contract](adrs/adr-001.md) — every requirement must be satisfiable by an endpoint that exists today; the CI pipeline repair is in scope.
- [ADR-002: Back-Office Personas Only for the Initial Release](adrs/adr-002.md) — the screens serve administrator, síndico and porteiro; resident self-service is deferred.
- [ADR-003: Monthly Calendar With Filterable List and an Inline Approval Queue](adrs/adr-003.md) — a month grid plus the list; weekly and daily views excluded; approval happens on the row.
- [ADR-004: Dialog-Based Create and Edit, With a Detail Route Only for Condominiums](adrs/adr-004.md) — list context survives every action; only condominiums earn a page.
- [ADR-005: Bulk Unit Generation as the Onboarding Path](adrs/adr-005.md) — the existing generation endpoint answers the onboarding need that import would otherwise serve.
- [ADR-006: Soft-Deleted Records Remain Reachable and Restorable](adrs/adr-006.md) — accidental deletion is self-service to undo.
- [ADR-007: Block Management Embedded in the Units Screen](adrs/adr-007.md) — resolves the mandatory block dependency without adding a fifth module.

## Open Questions

Resolved during implementation, recorded here so the decision is not lost against
shipped behavior. Task 7 audited each against what tasks 3 to 6 actually built.

- **Should the auto-managed unit statuses be selectable?** **Resolved: all four are
  offered.** The form keeps the API's enum intact and explains the interaction instead
  of hiding half of it — occupied and vacant are recalculated from residents and
  replace a typed value, renovation and blocked persist. What the listing shows after
  a save is always what the server returned, so the recalculation is visible rather
  than silent. Offering only the two that persist would have made the form disagree
  with the enum it posts to. Delivered in task 4 (`unit-form-dialog.tsx`).
- **Do reservation indicators describe the month or the filtered list?** **Resolved:
  the month shown on the calendar, independent of list filters,** labelled in the
  panel itself ("Numeros do mes inteiro, independentes dos filtros aplicados na
  lista"). Filtering the list does not move the numbers. Delivered in task 6 and
  pinned by IT-176.
- **How should a block's floor count relate to its units after generation?**
  **Resolved: it governs future generation only.** Changing the count on a block that
  already has units is accepted and leaves those units untouched — the count describes
  what bulk generation will produce next, not a structural constraint on what exists.
  Delivered in task 4 and pinned by IT-206.
- **Is the STAFF role expected to cancel reservations in practice?** **Resolved for
  the interface: yes, and it may not decide.** The interface follows the permission
  set exactly — cancel comes from `reservation:update`, approve and reject from
  `reservation:manage`, which STAFF does not hold. Whether porteiros should hold
  `reservation:update` at all is a backend permission question, out of scope by
  ADR-001. Pinned by IT-177.

Still open:

- **Reservation notifications point at a route that will not exist.** The backend sets
  a notification action link of the form `/reservas/{id}`, but ADR-004 gives
  reservations no detail route, and task 6 shipped without one. **Deliberately left
  open:** no notifications screen exists yet to follow the link, so nothing in this
  release can reach the broken target. The decision — highlight the reservation in the
  list, add a detail route, or change the link — belongs with whoever builds the
  notifications screen, and should be made then rather than guessed now.

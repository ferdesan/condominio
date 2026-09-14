# User Stories: Back-Office Screens for Condominiums, Units, Residents and Reservations

Canonical behavior catalog for the four administrative modules. Companion to `_prd.md`;
consumed by `_techspec.md` (component mapping) and `_tests.md` (coverage matrix).

All four domains are fully implemented server-side. Every story below describes behavior
observable in the interface; the server rules they must respect are stated as expected
outcomes, not as implementation instructions.

## Personas

- **Administrador (ADMIN)** — manages the tenant across all condominiums. Registers new condominiums, holds full management rights on all four resources, and is the only persona besides the síndico who can approve reservations.
- **Síndico (SINDICO)** — manages one condominium day to day. Registers units and residents, books common areas on behalf of residents, and dispatches pending reservation requests. The highest-volume user of these screens.
- **Operador de portaria (STAFF)** — reads all four resources and may cancel a reservation, but cannot create, edit or delete cadastral records and cannot approve or reject reservations. Every screen must remain usable in this read-mostly mode.
- **Desenvolvedor da plataforma** — secondary persona. Depends on the continuous integration pipeline to gate merges; currently blocked by a failing test job.

## Story Index

| ID     | Feature Area  | Persona            | Story                                                        |
|--------|---------------|--------------------|--------------------------------------------------------------|
| US-001 | Condomínios   | Administrador      | List, search and sort condominiums                           |
| US-002 | Condomínios   | Administrador      | Register a condominium                                       |
| US-003 | Condomínios   | Administrador      | Edit a condominium                                           |
| US-004 | Condomínios   | Síndico            | Consult a condominium's full record and indicators           |
| US-005 | Condomínios   | Administrador      | Delete a condominium                                         |
| US-006 | Condomínios   | Administrador      | Restore a deleted condominium                                |
| US-007 | Unidades      | Síndico            | List, filter and sort units                                  |
| US-008 | Unidades      | Síndico            | Register a single unit                                       |
| US-009 | Unidades      | Síndico            | Generate a building's units in bulk                          |
| US-010 | Unidades      | Síndico            | Edit a unit                                                  |
| US-011 | Unidades      | Síndico            | Delete and restore a unit                                    |
| US-012 | Unidades      | Síndico            | Read occupancy indicators                                    |
| US-029 | Unidades      | Síndico            | Create a block while registering units                       |
| US-030 | Unidades      | Síndico            | Manage the condominium's blocks                              |
| US-013 | Moradores     | Síndico            | List and search residents                                    |
| US-014 | Moradores     | Síndico            | Register a resident against a unit                           |
| US-015 | Moradores     | Síndico            | Edit a resident                                              |
| US-016 | Moradores     | Síndico            | Designate the primary resident of a unit                     |
| US-017 | Moradores     | Síndico            | Delete and restore a resident                                |
| US-018 | Moradores     | Operador           | Filter residents by unit, type and status                    |
| US-019 | Reservas      | Síndico            | List and filter reservations                                 |
| US-020 | Reservas      | Síndico            | Read a month's bookings on a calendar                        |
| US-021 | Reservas      | Síndico            | Book a common area on behalf of a resident                   |
| US-022 | Reservas      | Síndico            | Approve a pending reservation                                |
| US-023 | Reservas      | Síndico            | Reject a pending reservation                                 |
| US-024 | Reservas      | Operador           | Cancel a reservation                                         |
| US-025 | Reservas      | Síndico            | Read reservation indicators for the month                    |
| US-026 | Transversal   | Operador           | See only what the role permits                               |
| US-027 | Transversal   | Síndico            | Work within the selected condominium                         |
| US-028 | Transversal   | Desenvolvedor      | Merge against a passing pipeline                             |

---

## Condomínios

### US-001: List, search and sort condominiums

**As an** administrador, **I want** to see every condominium I manage in one list with search and sorting, **so that** I can locate one without scanning pages.

Acceptance criteria:

- AC-1: Given condominiums exist, when I open the screen, then I see a paginated table with name, document, síndico, city and status.
- AC-2: Given the list is displayed, when I type a term in the search field, then the list narrows to records matching name, document, city or district.
- AC-3: Given the list is displayed, when I click a sortable column header, then the list reorders by that column and the direction toggles on a second click.
- AC-4: Given more records exist than fit one page, when I navigate pages, then the active search term, sort and filters are preserved.
- AC-5: Given I filter by status or type, when the filter applies, then the active filter is shown as a removable chip and a control clears all filters at once.

Edge cases:

- EC-1: No condominiums registered → an empty state explaining the list is empty, with the action to register the first one.
- EC-2: A search matching nothing → an empty state distinguishing "no results for this search" from "nothing registered", offering to clear the search.
- EC-3: Search typed character by character → the list does not issue a request per keystroke; input is settled before querying.
- EC-4: A column that the server cannot sort by → that column is not offered as sortable, rather than appearing sortable and silently ignoring the request.
- EC-5: Page size and the rows rendered disagree → the table shows exactly the page size requested from the server, with no rows dropped.
- EC-6: Requesting a page beyond the last → the list returns to a valid page rather than rendering empty.
- EC-7: The session expires while listing → the user is returned to sign-in without an error toast about the failed request.
- EC-8: A record has no document, city or síndico recorded → the cell shows a neutral placeholder, never the literal text "null" or "undefined".

### US-002: Register a condominium

**As an** administrador, **I want** to register a condominium with its address, contact and síndico data, **so that** units and residents can be attached to it.

Acceptance criteria:

- AC-1: Given I open the registration dialog, when I submit a name of at least three characters, then the condominium is created and appears in the list without a page reload.
- AC-2: Given the form is open, when I fill document, postal code, phone and monetary fields, then each is formatted as I type and submitted in the format the server accepts.
- AC-3: Given the server rejects a field, when the response identifies that field, then the message is shown against that field rather than as a general alert.
- AC-4: Given creation succeeds, when the dialog closes, then the condominium selector in the application shell also reflects the new record.
- AC-5: Given the type, status and due-day fields are left untouched, when I submit, then the record is created with the documented defaults rather than empty values.

Edge cases:

- EC-1: A document already used by another condominium → a message stating the document is already registered, shown as a general alert since the server reports no specific field.
- EC-2: The document belongs to a deleted condominium → the same conflict is reported, and the user is directed to restore the existing record instead of creating a duplicate.
- EC-3: The tenant's plan limit is reached → the creation is refused with the server's message naming the plan and its limit; the message is shown rather than a generic failure.
- EC-4: A name shorter than three characters, or a due day outside 1 to 28 → rejected inline against the field before any request is sent.
- EC-5: A malformed document or postal code → rejected against the field, with the expected length stated.
- EC-6: Submit pressed twice in quick succession → only one condominium is created; the control is unavailable while the request is in flight.
- EC-7: The dialog dismissed with unsaved changes → confirmation is requested before the data is discarded.
- EC-8: Connection lost mid-submission → the failure is reported and the entered data remains in the form for retry.
- EC-9: A two-letter state entered in lower case → accepted and stored upper case, matching how the server normalises it.

### US-003: Edit a condominium

**As an** administrador, **I want** to change any field of a registered condominium, **so that** its record stays accurate as the síndico's term and contacts change.

Acceptance criteria:

- AC-1: Given I choose to edit a record, when the dialog opens, then every field is pre-filled with the current values.
- AC-2: Given I change one field and submit, when the update succeeds, then the list reflects the change and the dialog closes.
- AC-3: Given I change nothing and submit, when the request completes, then the record is unchanged and no error is shown.

Edge cases:

- EC-1: Changing the document to one already used → conflict reported as a general message, form stays open with the entry intact.
- EC-2: The record was deleted by another user while the dialog was open → the update fails as not found, and the list refreshes to reflect reality.
- EC-3: Two users editing the same record → the last write wins; the losing user sees current values on their next read rather than a stale form silently persisting.
- EC-4: Clearing an optional field that previously had a value → the field is stored as empty rather than being ignored.
- EC-5: Editing a record reached by a direct link that no longer exists → a not-found state rather than an empty form.

### US-004: Consult a condominium's full record and indicators

**As a** síndico, **I want** a page showing everything recorded about a condominium plus its current totals, **so that** I can answer questions without opening several screens.

Acceptance criteria:

- AC-1: Given I open a condominium's detail page, when it loads, then I see the complete record including address, contacts, síndico data and notes.
- AC-2: Given the detail page is open, when the indicators load, then I see unit count, occupied units, residents, vehicles, open incidents, pending charges and pending reservations.
- AC-3: Given I am on the detail page, when I choose to edit, then the same dialog used in the list opens, and saving updates the page in place.
- AC-4: Given indicators are still loading, when the page renders, then placeholders occupy their position rather than the page shifting when data arrives.

Edge cases:

- EC-1: The identifier in the URL does not exist or was deleted → a not-found state offering return to the list, not a blank page.
- EC-2: The identifier is not a valid identifier format → treated as not found from the user's standpoint, never as an unexplained failure.
- EC-3: A condominium with no units, residents or activity → indicators show zero, distinct from a loading state.
- EC-4: The record loads but indicators fail → the record is still shown, with the indicator area reporting its own failure and offering a retry.
- EC-5: A síndico opening a condominium outside their scope → access is refused rather than partial data being shown.

### US-005: Delete a condominium

**As an** administrador, **I want** to remove a condominium that is no longer managed, **so that** it stops appearing in listings and selectors.

Acceptance criteria:

- AC-1: Given I choose to delete, when the confirmation appears, then it names the condominium being deleted.
- AC-2: Given I confirm, when the deletion succeeds, then the record leaves the list and the shell's condominium selector.
- AC-3: Given deletion is refused because units exist, when the response arrives, then the server's explanation is shown and the record remains.

Edge cases:

- EC-1: The condominium has units → refused with the message stating units must be removed or transferred first; the confirmation closes without implying success.
- EC-2: The deleted condominium was the one selected in the shell → the selector moves to another available condominium rather than leaving the application without context.
- EC-3: The last remaining condominium is deleted → the application presents its no-condominium state rather than breaking dependent screens.
- EC-4: Deleting a record already deleted in another session → reported as not found, and the list refreshes.
- EC-5: Confirmation dismissed without confirming → nothing is deleted.
- EC-6: Confirmation triggered twice → the delete is issued once; the control is unavailable while in flight.

### US-006: Restore a deleted condominium

**As an** administrador, **I want** to bring back a condominium deleted by mistake, **so that** recovery does not require a support request.

Acceptance criteria:

- AC-1: Given the list is displayed, when I enable the control that includes deleted records, then deleted condominiums appear, visually distinguished from live ones.
- AC-2: Given a deleted record is visible, when I restore it, then it returns to the normal list and the shell's selector.
- AC-3: Given I lack permission to edit condominiums, when deleted records are shown, then no restore action is offered.

Edge cases:

- EC-1: Deleted records included but none exist → the list is unchanged and the control's state remains visibly active, so the absence is explained.
- EC-2: A deleted row and a live row of the same name → the deleted one is unambiguously marked.
- EC-3: Restoring a record whose document now conflicts with a live one → the conflict message is shown and the record stays deleted.
- EC-4: Deleted records left included while paginating or searching → the inclusion persists across pages and is visibly indicated, so results are never misread as live records.

---

## Unidades

### US-007: List, filter and sort units

**As a** síndico, **I want** to see the units of the selected condominium with filters for block, status, type and floor, **so that** I can find a unit or assess a block quickly.

Acceptance criteria:

- AC-1: Given units exist, when I open the screen, then I see a paginated table with block, number, floor, type, status and the residents' reference.
- AC-2: Given the list is displayed, when I search, then it narrows by unit number.
- AC-3: Given I filter by block, status, type or floor, when the filter applies, then it appears as a removable chip and can be cleared with the others at once.
- AC-4: Given I select more than one status, when the filter applies, then units in any of the selected statuses are shown.
- AC-5: Given a unit belongs to a block, when the row renders, then the block name is shown rather than an internal identifier.

Edge cases:

- EC-1: No condominium selected in the shell → the screen explains a condominium must be selected instead of listing nothing.
- EC-2: The selected condominium has no units → an empty state offering both single registration and bulk generation.
- EC-3: A filter combination matching nothing → an empty state offering to clear filters, distinct from having no units at all.
- EC-4: The condominium is switched in the shell while filters are active → the list reloads for the new condominium and filters that no longer apply, such as a block from the previous condominium, are cleared rather than silently returning nothing.
- EC-5: A building with several hundred units → paging stays responsive and the requested page size is honored exactly.
- EC-6: Searching by a number that is a prefix of many others → all matches are listed, paginated.
- EC-7: Optional numeric fields absent → shown as a neutral placeholder rather than zero, where zero would be misleading.

### US-008: Register a single unit

**As a** síndico, **I want** to register one unit against a block, **so that** I can add a unit that bulk generation did not produce.

Acceptance criteria:

- AC-1: Given I open the registration dialog, when it loads, then the condominium is already bound to the one selected in the shell and the block list offers only that condominium's blocks.
- AC-2: Given I supply a block and a number, when I submit, then the unit is created and appears in the list.
- AC-3: Given I leave type, status, floor and the numeric fields untouched, when I submit, then the documented defaults apply.
- AC-4: Given the server rejects a field, when the response identifies it, then the message appears against that field.

Edge cases:

- EC-1: A number already used in that block → refused with the message that the number exists in the block; the entry stays for correction.
- EC-2: A block belonging to another condominium → refused; the situation is prevented by offering only valid blocks.
- EC-3: The condominium has no blocks registered → the selector offers block creation in place (US-029) rather than presenting an empty list with no way forward.
- EC-4: A floor outside the permitted range, or a fraction outside zero to one → rejected inline before submission.
- EC-5: Submit pressed twice → one unit is created.
- EC-6: A number matching a soft-deleted unit → the server's response is surfaced as-is rather than being presented as an unexplained failure.

### US-009: Generate a building's units in bulk

**As a** síndico, **I want** to generate every unit of a block in one operation, **so that** onboarding a building does not mean hundreds of individual entries.

Acceptance criteria:

- AC-1: Given I open the generation flow, when I supply a block, a floor count, units per floor, a starting floor and a numbering pattern, then I see how many units will be produced before confirming.
- AC-2: Given I confirm, when generation succeeds, then I am told exactly how many units were created and the list refreshes to include them.
- AC-3: Given I supply shared defaults for type, monthly fee and area, when generation runs, then every created unit carries them.
- AC-4: Given some numbers already exist in the block, when generation runs, then existing units are left untouched and the reported count reflects only what was created.

Edge cases:

- EC-1: Every number to be generated already exists → the operation reports that no new unit was generated because all numbers exist; this is presented as an outcome, not as a system error.
- EC-2: Floors or units per floor outside the permitted range → rejected before submission, with the permitted range stated.
- EC-3: Generation against a block that already has units → allowed, with the overlap explained before confirming.
- EC-4: A large grid, at the maximum permitted floors and units per floor → the operation completes and the interface indicates progress rather than appearing frozen.
- EC-5: Confirmation pressed twice → generation runs once; a repeat would in any case create nothing, since existing numbers are skipped.
- EC-6: Connection lost mid-generation → the outcome is uncertain to the user, so the list is refreshed on return and the actual state is shown rather than an assumed one.
- EC-7: A numbering pattern producing numbers longer than permitted → refused with the constraint explained.

### US-010: Edit a unit

**As a** síndico, **I want** to change a unit's attributes, **so that** its record reflects renovations, fee changes and corrections.

Acceptance criteria:

- AC-1: Given I edit a unit, when the dialog opens, then current values are pre-filled, including block and condominium.
- AC-2: Given I change the number and submit, when it does not collide, then the change is saved.
- AC-3: Given a unit's status is derived from its residents, when I view the status field, then the interaction is explained rather than the field appearing freely editable with no effect.

Edge cases:

- EC-1: Changing to a number already used in the block → refused with the conflict message.
- EC-2: Setting status to occupied on a unit with no active residents → the resident-driven rule governs, and the observed status after saving is what the server determined, not what was typed.
- EC-3: Setting status to renovation or blocked → preserved, since the resident-driven rule does not override those two.
- EC-4: Moving a unit to a different block → either supported and validated against the target block, or not offered; it is never offered and then silently ignored.
- EC-5: The unit was deleted elsewhere while the dialog was open → the update fails as not found and the list refreshes.

### US-011: Delete and restore a unit

**As a** síndico, **I want** to remove a unit and recover it if removed by mistake, **so that** the cadastre stays correct without risking permanent loss.

Acceptance criteria:

- AC-1: Given I delete a unit with no dependents, when I confirm, then it leaves the list and the condominium's unit total reflects the removal.
- AC-2: Given deletion is refused, when the response arrives, then the reason — active residents or open charges — is shown as given.
- AC-3: Given deleted units are included in the list, when I restore one, then it returns to the normal list.

Edge cases:

- EC-1: The unit has active residents → refused, stating residents must be handled first.
- EC-2: The unit has pending, overdue or partially paid charges → refused, stating charges are open.
- EC-3: A unit with both blockers → the first reported reason is shown; resolving it and retrying reveals the second, and neither deletion succeeds until both are clear.
- EC-4: Restoring a unit whose number was reused meanwhile → the conflict is reported and the unit stays deleted.
- EC-5: Deleting the last unit of a condominium → succeeds, and the condominium then permits its own deletion.

### US-012: Read occupancy indicators

**As a** síndico, **I want** to see how many units exist, how many are occupied and how many are available, **so that** I can report occupancy without counting rows.

Acceptance criteria:

- AC-1: Given the units screen is open for a condominium, when indicators load, then I see total units, occupied units and available units.
- AC-2: Given a unit's occupancy changes because a resident was added or removed, when I return to the screen, then the indicators reflect the change.
- AC-3: Given indicators are loading, when the screen renders, then placeholders hold their position.

Edge cases:

- EC-1: A condominium with no units → all indicators show zero, distinguishable from a loading state.
- EC-2: Units in renovation or blocked status → counted in the total and presented so that occupied, available and the total reconcile without implying a unit is both.
- EC-3: Indicators fail while the list loads → the list remains usable and the indicator area reports its own failure.
- EC-4: Filters applied to the list → it is unambiguous whether indicators describe the whole condominium or the filtered subset.

### US-029: Create a block while registering units

**As a** síndico, **I want** to create a block without leaving unit registration, **so that** a newly registered condominium does not dead-end before its first unit.

Acceptance criteria:

- AC-1: Given I am registering a unit and the block I need does not exist, when I choose to create one, then I supply its name and attributes without losing the unit data already entered.
- AC-2: Given I create a block this way, when creation succeeds, then it is selected for the unit I was registering.
- AC-3: Given the condominium has no blocks at all, when I open unit registration, then creating the first block is offered directly rather than presenting an empty selector.
- AC-4: Given a block is created, when I open bulk generation, then it is available there too.

Edge cases:

- EC-1: A block name already used in the condominium → refused with the server's message; the unit data already entered is preserved.
- EC-2: Block creation cancelled midway → the unit form returns intact with no block selected.
- EC-3: Block creation succeeds but unit creation then fails → the block remains created, and this is evident rather than leaving the user unsure what was saved.
- EC-4: I lack permission to create blocks → the inline creation is not offered, and the selector lists only existing blocks.
- EC-5: A floor count or units-per-floor outside the permitted range → rejected against the field before submission.

### US-030: Manage the condominium's blocks

**As a** síndico, **I want** to review and adjust the blocks of the selected condominium, **so that** the building's structure stays correct as it is documented.

Acceptance criteria:

- AC-1: Given the units screen is open, when I open block management, then I see the selected condominium's blocks with their name, type, floors and units per floor.
- AC-2: Given a block is listed, when I edit it, then the change is saved and the unit list reflects the new name where it is shown.
- AC-3: Given a block has no units, when I delete it, then it is removed from the list and from the selectors.
- AC-4: Given I hold read access only, when block management renders, then no create, edit or delete action is offered.

Edge cases:

- EC-1: Deleting a block that still has units → refused with the server's explanation; the block remains.
- EC-2: The condominium has no blocks → an empty state offering to create the first one.
- EC-3: Renaming a block to a name already in use → refused as a conflict.
- EC-4: A block deleted while a unit form has it selected → the unit submission fails and the reason is shown, rather than saving against a block that no longer exists.
- EC-5: The condominium is switched while block management is open → it reloads for the newly selected condominium.
- EC-6: Changing a block's floor count after units exist → permitted; existing units are unaffected, and the value serves only as a default for future generation.

---

## Moradores

### US-013: List and search residents

**As a** síndico, **I want** to find a resident by name, document, phone or unit, **so that** I can reach the right person quickly.

Acceptance criteria:

- AC-1: Given residents exist, when I open the screen, then I see a paginated table with name, document, unit, condominium, phone and status.
- AC-2: Given the list is displayed, when I search, then it narrows by name, email, document or phone.
- AC-3: Given a resident is attached to a unit, when the row renders, then the unit number is shown rather than an internal identifier.
- AC-4: Given documents and phones are stored unformatted, when rows render, then both are displayed formatted.

Edge cases:

- EC-1: A resident with no document or phone recorded → neutral placeholders, never "null".
- EC-2: Searching by a document typed with punctuation → matches the stored unpunctuated value, rather than returning nothing.
- EC-3: No residents in the selected condominium → an empty state offering registration.
- EC-4: A resident whose unit was deleted → the row still renders and the missing unit is shown explicitly rather than breaking the row.
- EC-5: Several hundred residents → paging honors the requested size and stays responsive.

### US-014: Register a resident against a unit

**As a** síndico, **I want** to register a resident with their personal data and unit, **so that** the condominium knows who occupies each unit.

Acceptance criteria:

- AC-1: Given I open registration, when it loads, then the condominium is bound to the shell selection and the unit selector offers only that condominium's units.
- AC-2: Given I supply a name and a unit, when I submit, then the resident is created and appears in the list.
- AC-3: Given I supply a document, birth date, move-in date, phone and emergency contact, when I submit, then each is sent in the format the server accepts.
- AC-4: Given I register the first active resident of a vacant unit, when creation succeeds, then that unit's status reflects occupancy on the units screen.
- AC-5: Given type and status are untouched, when I submit, then the documented defaults apply.

Edge cases:

- EC-1: A document failing its check digits → refused with the message that the document is invalid; the entry stays for correction.
- EC-2: A document already registered for another resident → refused as already registered.
- EC-3: A unit belonging to a different condominium → prevented by the selector, and refused by the server if it still occurs.
- EC-4: A name shorter than three characters → rejected inline.
- EC-5: A resident registered with neither document nor email → accepted, and no data-protection consent timestamp is recorded, since none was collected.
- EC-6: A move-out date earlier than the move-in date → the inconsistency is surfaced rather than silently stored.
- EC-7: A birth date in the future → rejected with the expectation stated.
- EC-8: Submit pressed twice → one resident is created.
- EC-9: The condominium has no units → registration explains a unit is required first.

### US-015: Edit a resident

**As a** síndico, **I want** to update a resident's data, **so that** contacts, status and unit stay current as people move.

Acceptance criteria:

- AC-1: Given I edit a resident, when the dialog opens, then current values are pre-filled.
- AC-2: Given I change the unit and submit, when the new unit belongs to the same condominium, then the change is saved.
- AC-3: Given I set a resident to inactive or moved out, when the change is saved, then the affected units' occupancy reflects it.

Edge cases:

- EC-1: Moving the last active resident out of a unit → that unit becomes vacant unless it is in renovation or blocked.
- EC-2: Moving a resident to a unit in a different condominium → refused with the mismatch explained.
- EC-3: Changing the document to one already registered → refused as a conflict.
- EC-4: The resident was deleted elsewhere → the update fails as not found and the list refreshes.
- EC-5: Clearing the move-out date on a resident marked as moved out → the resulting state is coherent, or the inconsistency is surfaced.

### US-016: Designate the primary resident of a unit

**As a** síndico, **I want** to mark which resident is the unit's primary contact, **so that** correspondence and notices reach one responsible person.

Acceptance criteria:

- AC-1: Given a unit has several residents, when I mark one as primary, then that resident is shown as primary.
- AC-2: Given another resident of that unit was previously primary, when the new designation is saved, then only the newly designated resident is primary.
- AC-3: Given the list is displayed, when rows render, then the primary resident of each unit is visually identifiable.

Edge cases:

- EC-1: Designating a primary resident while another was primary → the previous designation is cleared automatically, and the list reflects both changes rather than showing two primaries.
- EC-2: A unit with no primary designated → permitted; no resident is marked and nothing is forced.
- EC-3: Two designations issued in quick succession for the same unit → the final state has exactly one primary.
- EC-4: Deleting the primary resident of a unit → the unit is left with no primary, and this is visible rather than implied.
- EC-5: Designating as primary a resident whose status is inactive or moved out → either prevented or surfaced, never silently producing an inactive primary contact.

### US-017: Delete and restore a resident

**As a** síndico, **I want** to remove a resident record and recover it if needed, **so that** departures are recorded without destroying history.

Acceptance criteria:

- AC-1: Given I delete a resident, when I confirm, then the record leaves the list and the unit's occupancy updates accordingly.
- AC-2: Given deleted residents are included in the list, when I restore one, then the record returns.
- AC-3: Given I hold read access only, when the list renders, then no delete or restore action is offered.

Edge cases:

- EC-1: Deleting the only active resident of a unit → the unit becomes vacant.
- EC-2: Deleting the primary resident → the unit is left without a primary, shown explicitly.
- EC-3: Restoring a resident whose unit was deleted meanwhile → the outcome is explained rather than producing a resident attached to nothing without comment.
- EC-4: Restoring a resident whose document now conflicts → the conflict is reported and the record stays deleted.
- EC-5: Deleting a resident who has reservations → reservations retain their record of who requested them, so history is not lost.

### US-018: Filter residents by unit, type and status

**As an** operador, **I want** to narrow the resident list by unit, type and status, **so that** I can check who currently occupies a unit.

Acceptance criteria:

- AC-1: Given the list is displayed, when I filter by unit, then only that unit's residents remain.
- AC-2: Given I filter by type or status, when the filter applies, then it is shown as a removable chip alongside any other active filter.
- AC-3: Given several filters are active, when I clear them, then all are removed in one action and the full list returns.
- AC-4: Given I select more than one status, when the filter applies, then residents in any of those statuses are shown.

Edge cases:

- EC-1: A filter combination matching nothing → an empty state offering to clear filters.
- EC-2: Filtering by a unit that is then deleted → the list refreshes and the stale filter is cleared or clearly marked, rather than returning nothing without explanation.
- EC-3: The condominium is switched while a unit filter is active → the filter is cleared, since units do not cross condominiums.
- EC-4: A filter the server does not support → not offered in the interface, rather than appearing to work while being ignored.

---

## Reservas

### US-019: List and filter reservations

**As a** síndico, **I want** a filterable list of reservations with their status, **so that** I can review what is booked and what awaits a decision.

Acceptance criteria:

- AC-1: Given reservations exist, when I open the screen, then I see a paginated list with common area, unit, requester, start, end and status, most recent first.
- AC-2: Given the list is displayed, when I filter by common area, status or unit, then the filter applies and is shown as a removable chip.
- AC-3: Given the screen is open, when it loads, then the number of reservations awaiting a decision is displayed, and selecting it applies the pending filter.
- AC-4: Given a reservation carries a fee or a decision reason, when the row renders, then both are visible without opening the record.
- AC-5: Given statuses differ, when rows render, then each status is visually distinguishable at a glance.

Edge cases:

- EC-1: No reservations in the condominium → an empty state offering to create one.
- EC-2: No pending reservations → the pending indicator shows zero rather than being hidden, so the absence is informative.
- EC-3: A reservation whose common area was deleted → the row still renders with the area shown as unavailable.
- EC-4: A reservation whose unit was deleted → the row still renders, since the requester's name is stored on the reservation itself.
- EC-5: The condominium is switched → the list reloads and area or unit filters from the previous condominium are cleared.

### US-020: Read a month's bookings on a calendar

**As a** síndico, **I want** to see a month's reservations laid out by day, **so that** I can answer whether an area is free on a date without reading a table.

Acceptance criteria:

- AC-1: Given the reservations screen is open, when I switch to the calendar, then the current month is shown with each day carrying its pending and confirmed reservations.
- AC-2: Given the calendar is shown, when I move to the previous or next month, then that month's bookings load.
- AC-3: Given I filter by a common area, when the calendar renders, then only that area's bookings are shown.
- AC-4: Given a day carries reservations, when I look at it, then each entry identifies the area, the unit and the time.
- AC-5: Given a reservation is pending rather than confirmed, when it renders on the calendar, then the two are visually distinct.

Edge cases:

- EC-1: A month with no reservations → the grid renders empty with days visible, not as a blank area.
- EC-2: A day carrying more entries than fit → a capped number is shown with an indicator of how many remain.
- EC-3: A reservation spanning midnight into the next day → it appears on the days it actually covers rather than only on its start date.
- EC-4: Months of 28 to 31 days, and weeks spilling into adjacent months → the grid renders correctly, and days outside the month are distinguishable.
- EC-5: Rapidly paging through months → the displayed month matches the data shown, with no mismatch from a slower earlier response arriving late.
- EC-6: Rejected, canceled and completed reservations → absent from the calendar, which reflects only pending and confirmed bookings; the list remains the exhaustive view.
- EC-7: No condominium selected → the calendar explains the requirement instead of rendering an empty month.

### US-021: Book a common area on behalf of a resident

**As a** síndico, **I want** to create a reservation for a unit, **so that** residents can book areas through me.

Acceptance criteria:

- AC-1: Given I open the booking form, when it loads, then the common-area selector offers the selected condominium's available areas and the unit selector its units.
- AC-2: Given I choose an area, when its rules are known, then the form shows the constraints that apply — opening hours, permitted weekdays, minimum and maximum duration, advance limit and capacity.
- AC-3: Given I supply an area, a unit, a start and an end, when the booking is accepted, then it appears in the list and on the calendar.
- AC-4: Given the chosen area requires approval, when the booking is created, then it is pending and shown as such; otherwise it is confirmed immediately.
- AC-5: Given the area charges a fee, when the reservation is created, then the fee is recorded on it and visible.

Edge cases:

- EC-1: An end at or before the start → rejected against the end field before submission.
- EC-2: A start in the past → refused with the message that past dates cannot be booked.
- EC-3: Beyond the area's advance-booking limit → refused, stating the maximum number of days.
- EC-4: Shorter than the area's minimum or longer than its maximum duration → refused, stating the limit in hours.
- EC-5: On a weekday the area does not permit → refused, stating the area is unavailable that day.
- EC-6: Outside the area's opening hours → refused, stating the permitted window.
- EC-7: Overlapping an existing pending or confirmed booking of that area → refused, stating a reservation already exists for the slot.
- EC-8: The same unit booking again within the area's minimum interval → refused, stating the interval in days.
- EC-9: Guests exceeding the area's capacity → refused, stating the maximum.
- EC-10: An area not currently available for booking → refused, and such areas are not offered in the selector.
- EC-11: Any of the above refusals → shown as a general message, since the server reports no field for them, while a malformed end time is shown against its field.
- EC-12: Two submissions for the same slot in quick succession → one succeeds and the other is refused as a conflict; no double booking results.
- EC-13: Submit pressed twice on one form → one reservation is created.
- EC-14: The condominium has no common areas registered → the form explains an area is required first.

### US-022: Approve a pending reservation

**As a** síndico, **I want** to approve a pending request from the list, **so that** I can clear the queue without opening each record.

Acceptance criteria:

- AC-1: Given a pending reservation is listed and I hold the manage permission, when I approve it, then it becomes confirmed and the list reflects the new status.
- AC-2: Given I approve, when I am offered a reason, then supplying one is optional and it is recorded with the decision.
- AC-3: Given approval succeeds, when the view refreshes, then the pending count decreases accordingly.
- AC-4: Given I hold read access or only update rights, when the list renders, then no approve action is offered.

Edge cases:

- EC-1: The slot was taken by another confirmed booking after the request was made → approval is refused, stating a confirmed reservation already exists for the slot; the reservation stays pending and the refusal is explained rather than presented as a system error.
- EC-2: The reservation is no longer pending, having been decided elsewhere → refused, stating only pending reservations can be approved, and the view refreshes.
- EC-3: Approve pressed twice → one decision is recorded; the second is refused as no longer pending.
- EC-4: Two administrators deciding the same reservation simultaneously → exactly one decision takes effect and the other is told the reservation is no longer pending.
- EC-5: An operador attempting approval → refused by the server, and the action is not offered in the first place.
- EC-6: Approving a reservation whose start has already passed → the outcome is coherent and the resulting status is shown as the server determined it.

### US-023: Reject a pending reservation

**As a** síndico, **I want** to reject a request with a reason, **so that** the resident understands the decision.

Acceptance criteria:

- AC-1: Given a pending reservation and the manage permission, when I reject it, then it becomes rejected and the list reflects it.
- AC-2: Given I reject, when I supply a reason, then it is recorded and visible on the reservation.
- AC-3: Given rejection succeeds, when the view refreshes, then the pending count decreases and the slot is free for another booking.

Edge cases:

- EC-1: A reservation already decided → refused, stating only pending reservations can be decided.
- EC-2: Rejection without a reason → permitted, since the reason is optional.
- EC-3: A reason longer than permitted → rejected against the field before submission.
- EC-4: Rejecting then attempting to approve the same reservation → refused, since it is no longer pending.

### US-024: Cancel a reservation

**As an** operador, **I want** to cancel a booking that will not happen, **so that** the slot returns to availability.

Acceptance criteria:

- AC-1: Given a confirmed or pending reservation that has not started, when I cancel it with a reason, then it becomes canceled and disappears from the calendar.
- AC-2: Given cancellation succeeds, when the slot is checked again, then it is bookable.
- AC-3: Given I hold neither update nor manage rights on reservations, when the list renders, then no cancel action is offered.

Edge cases:

- EC-1: A reservation that has already started → cancellation is restricted to administration; an operador is refused with that explanation.
- EC-2: An already canceled reservation → refused, stating it is already canceled.
- EC-3: A completed reservation → refused, since completed reservations cannot be altered.
- EC-4: Cancel pressed twice → one cancellation is recorded, the second refused.
- EC-5: Canceling a pending reservation → permitted; the pending count decreases without a decision being recorded.

### US-025: Read reservation indicators for the month

**As a** síndico, **I want** to see how many reservations the month holds, how they spread across areas, and how many were canceled, **so that** I can report common-area usage.

Acceptance criteria:

- AC-1: Given the reservations screen is open, when indicators load, then I see the month's reservation count, the breakdown by common area, and the cancellation count.
- AC-2: Given I change the month shown on the calendar, when indicators refresh, then they describe that month.
- AC-3: Given indicators are loading, when the screen renders, then placeholders hold their position.

Edge cases:

- EC-1: A month with no reservations → all indicators show zero, distinct from a loading state.
- EC-2: A condominium with no common areas → the breakdown is empty and says so, rather than rendering an empty chart without explanation.
- EC-3: Indicators fail while the list succeeds → the list stays usable and the indicator area reports its own failure.
- EC-4: Many common areas → the breakdown stays readable, grouping or limiting what it shows rather than overflowing.
- EC-5: Filters active on the list → it is unambiguous whether indicators describe the month as a whole or the filtered subset.

---

## Transversal

### US-026: See only what the role permits

**As an** operador, **I want** the interface to offer only what my role allows, **so that** I am not presented with actions that will be refused.

Acceptance criteria:

- AC-1: Given I lack read permission on a resource, when I attempt its route, then access is refused rather than an empty screen being shown.
- AC-2: Given I hold read permission only, when a listing renders, then create, edit, delete and restore actions are absent.
- AC-3: Given I lack the manage permission on reservations, when the reservation list renders, then approve and reject are absent while cancel remains available if I may update.
- AC-4: Given the navigation menu renders, when my role lacks a resource's read permission, then that entry is not shown.

Edge cases:

- EC-1: The server refuses an action the interface offered → the refusal is explained rather than failing silently, and the interface is corrected so the action is not offered again.
- EC-2: The session expires mid-action → the user is returned to sign-in without a spurious error about the failed request.
- EC-3: Permissions change between page loads → the interface reflects the current permissions on the next load rather than acting on a cached set.
- EC-4: A record outside the user's scope reached by direct link → refused or reported as not found, never partially rendered.

### US-027: Work within the selected condominium

**As a** síndico, **I want** every screen to follow the condominium selected in the shell, **so that** I never act on the wrong building's data.

Acceptance criteria:

- AC-1: Given a condominium is selected, when I open units, residents or reservations, then only that condominium's records are shown.
- AC-2: Given I switch condominium, when the current screen reloads, then it shows the new condominium's data.
- AC-3: Given I create a record on any of those screens, when the form opens, then it is bound to the selected condominium.
- AC-4: Given no condominium is selected, when I open a scoped screen, then it explains the requirement rather than showing an empty list.

Edge cases:

- EC-1: The user has access to exactly one condominium → it is selected automatically and the screens work without a manual step.
- EC-2: The previously selected condominium is no longer accessible → another available one is selected rather than screens failing.
- EC-3: The condominium is switched mid-edit with a dialog open → either the dialog closes with confirmation, or it completes against the condominium it was opened for; it never saves against the wrong one.
- EC-4: A condominium is created → it becomes selectable without a page reload.
- EC-5: The selected condominium is deleted → selection moves elsewhere and dependent screens recover.

### US-028: Merge against a passing pipeline

**As a** desenvolvedor da plataforma, **I want** the continuous integration pipeline to pass on a healthy branch, **so that** a red build means a real defect rather than a configuration fault.

Acceptance criteria:

- AC-1: Given the repository is checked out on a healthy branch, when the test job runs, then it completes successfully.
- AC-2: Given the test job passes, when the pipeline continues, then the jobs depending on it run rather than being skipped.
- AC-3: Given a developer runs the test command locally, when there is nothing wrong, then it exits successfully and reports what ran.
- AC-4: Given the screens in this effort are delivered, when the suite runs, then their behavior is exercised rather than the suite passing on emptiness.

Edge cases:

- EC-1: A suite containing no test files → does not fail the job merely for being empty, while an empty suite is also not treated as adequate coverage.
- EC-2: A genuinely failing test → fails the job, and the pipeline gate holds.
- EC-3: The coverage command invoked → it works, rather than failing on a missing provider.
- EC-4: Components relying on browser capabilities absent from the test environment → they run without the environment itself being the cause of failure.
- EC-5: State persisted between tests, such as stored session data → does not leak from one test into another.

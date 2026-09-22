# User Stories: Votações em Assembleias

Canonical behavior catalog for resident voting and manual unit vote registration.
Companion to `_prd.md`; consumed by `_techspec.md` (component mapping) and
`_tests.md` (coverage matrix).

## Personas

- **Resident (morador)** — Occupant of a unit who receives poll notifications and votes on behalf of the unit from a phone or desktop.
- **Síndico / Admin** — Condominium manager who opens polls and registers votes for units that could not vote in the app.
- **Platform operator (out of primary flow)** — Not a target persona for this feature; super-admin uses the same manager capabilities when needed.

## Story Index

| ID | Feature Area | Persona | Story |
|---|---|---|---|
| US-001 | Vote deep link | Resident | Open a poll from a notification and cast a vote on `/votacoes/:pollId` |
| US-002 | Vote from assemblies UI | Resident | Start a vote from the Deliberações dialog |
| US-003 | Vote confirmation | Resident | See clear confirmation and results after voting |
| US-004 | Already voted state | Resident | On return/deep link, see that the unit already voted |
| US-005 | Manual registration | Síndico/Admin | List unit vote status and register a vote for a pending unit |
| US-006 | Secret ballot privacy | Resident | Vote on a secret poll without the choice being shown back |
| US-007 | Notification link | Resident | Notification action navigates to the vote route |

---

## Vote deep link

### US-001: Cast a vote from the vote page

**As a** resident, **I want** to open my poll from a link and choose an option, **so that** my unit's vote is recorded without going through the assembly admin screens.

Acceptance criteria:

- AC-1: Given an open poll I am eligible for, when I open `/votacoes/:pollId`, then I see the poll title, context, options, and a submit action.
- AC-2: Given I selected an option, when I submit, then the vote is accepted and the UI enters the confirmation state (US-003).
- AC-3: Given I lack `vote:create` or have no unit, when I open the route, then I see a clear forbidden/invalid state, not a broken page.

Edge cases:

- EC-1: Poll id does not exist → not-found state with link back to assemblies.
- EC-2: Poll is DRAFT or CLOSED → message that voting is not open; no option to submit.
- EC-3: Poll outside `startsAt`/`endsAt` → not-open message.
- EC-4: Session expired mid-flow → auth handling redirects to login; after login return to the same poll route when safe.
- EC-5: Unit already voted → US-004 state (no second submit control).
- EC-6: Eligibility `OWNERS` and I am not an owner → forbidden with readable reason.
- EC-7: Double submit / network retry after success → no duplicate; second attempt shows already-voted/conflict handling.
- EC-8: Deep link on mobile viewport → page usable (options tappable, submit reachable).

---

## Vote from assemblies UI

### US-002: Start voting from Deliberações

**As a** resident, **I want** a **Votar** action on an open poll in the assembly's Deliberações dialog, **so that** I can vote while browsing assemblies.

Acceptance criteria:

- AC-1: Given an OPEN poll and `vote:create`, when I use **Votar**, then I reach the vote surface for that poll (route per ADR-001).
- AC-2: Given results-only visibility, when I open Deliberações, then existing apuração actions still work as before.

Edge cases:

- EC-1: Poll not OPEN → no enabled **Votar** (or disabled with reason consistent with US-001).
- EC-2: User without `vote:create` → action hidden or forbidden consistently with guards.
- EC-3: Dialog open and vote completed elsewhere → refresh status when dialog reopens.

---

## Vote confirmation

### US-003: Confirmation and results after voting

**As a** resident, **I want** to see that my vote was registered and the current results, **so that** I trust the system and can follow participation.

Acceptance criteria:

- AC-1: Given a successful vote, when the response arrives, then the UI shows a confirmation message ("Voto registrado" or equivalent).
- AC-2: Given confirmation and permission to read results, when I continue on the page, then I see participation, quorum, and per-option results.
- AC-3: Given a secret poll, when confirmation shows, then the UI does not require displaying my chosen option to others; aggregate results only.

Edge cases:

- EC-1: Results request fails after successful vote → confirmation still visible; results area shows retry/error without undoing confirmation.
- EC-2: Poll closes while viewing results → refresh shows CLOSED results when refetched.
- EC-3: User cannot read results → confirmation only, no results block (no error spam).

---

## Already voted state

### US-004: Return visit shows voted status

**As a** resident, **I want** the vote page to show that my unit already voted, **so that** I do not try to vote twice and I understand my status.

Acceptance criteria:

- AC-1: Given the unit voted, when I open `/votacoes/:pollId`, then I see an already-voted state (and results if allowed per ADR-004).
- AC-2: Given a non-secret poll and `vote:read`, when I load my vote, then I can see which option was chosen (or enough info to reflect choice per API).
- AC-3: Given a secret poll, when I load my vote, then I only see that I voted — not the option.

Edge cases:

- EC-1: `my-vote` says not voted but POST returns 409 → treat as already voted (trust server conflict).
- EC-2: Poll deleted/hidden after vote → not-found handling, no crash.

---

## Manual registration

### US-005: Manager registers a unit's vote

**As a** síndico/admin, **I want** a list of units with vote status and a way to enter a vote for a pending unit, **so that** paper or in-person votes are counted in the same apuração.

Acceptance criteria:

- AC-1: Given `vote:manage` and an OPEN poll, when I open the management dialog, then I see units with status **Already voted** / **Pending** / **Not eligible** without seeing the chosen option.
- AC-2: Given a pending eligible unit and an selected option, when I submit, then the vote is recorded and the row becomes **Already voted**.
- AC-3: Given a unit that already voted, when I attempt registration, then I receive a conflict message and the list stays accurate.
- AC-4: Given I lack `vote:manage`, when I try to open management, then access is denied (hidden action + backend 403).

Edge cases:

- EC-1: Poll not OPEN → management disabled or clear message; no submit.
- EC-2: Unit not eligible for `voterType` → **Not eligible**; submit blocked client-side; server remains authority.
- EC-3: Option list empty/invalid selection → submit disabled or validation message.
- EC-4: Two managers register the same unit concurrently → one succeeds, the other conflict; list reconciles on refresh.
- EC-5: Large unit list → status filter (pending/all) remains usable.
- EC-6: Unit already voted via resident app → shows **Already voted** without revealing option (secret or not, status only).

---

## Secret ballot privacy

### US-006: Secret poll hides choice

**As a** resident on a secret poll, **I want** my choice kept confidential in the product, **so that** voting is free of pressure.

Acceptance criteria:

- AC-1: Given `isSecret`, when I submit or load `my-vote`, then the API/UI do not expose my option to me in a way that differs from policy — at minimum others never see it; confirmation does not broadcast the choice.
- AC-2: Given `isSecret`, when a manager opens vote lists/results, then individual choices are not listed; aggregates only.

Edge cases:

- EC-1: Manager opens management dialog on secret poll → unit **status** allowed; option per unit never shown.
- EC-2: Non-secret poll → identity may be stored (ADR-002); UI still only shows status in management list unless a future audit view exists (out of scope).

---

## Notification link

### US-007: Notification opens the vote

**As a** resident, **I want** the "Nova votacao aberta" notification to take me to the vote, **so that** I act without searching for the assembly.

Acceptance criteria:

- AC-1: Given a poll-open notification with `actionUrl /votacoes/:id`, when I click it, then I land on `/votacoes/:id` (not a dead link or home).
- AC-2: Given an unknown/legacy path, when resolved, then behavior degrades safely (no crash).

Edge cases:

- EC-1: Not logged in → login then return to vote route when the auth flow allows.
- EC-2: Poll already closed by the time of click → US-001 closed state.
- EC-3: Notification for another tenant/condominium (should not occur) → not-found/forbidden, no data leak.

---

## Edge-case sweep coverage

Every story above was probed against invalid input, empty/missing, limits, permissions, concurrency, interruption, repetition, ordering, state transitions, and scale; class-relevant findings are recorded as `EC` entries in the story they affect. Classes that do not apply to a story (e.g. scale limits on US-007) are omitted only after probing.

# PRD: Votações em Assembleias (Resident Vote + Manual Unit Registration)

**Slug:** `votacoes-assembleias`
**Status:** accepted
**Owner:** Product
**Date:** 2026-09-22
**Source plan:** `PLANO_VOTACOES.md` (approved decisions frozen)

---

## Overview

Condominium polls already exist as a backend capability: residents can cast one vote per unit during an open window, managers can register a vote on behalf of a unit, and results with quorum are computed. There is no product surface for voting: no route, no vote action in the UI, and notification links to `/votacoes/:pollId` are discarded.

This feature ships the missing product layer so **moradores vote remotely** and **síndicos/administradores register votes for units that could not use the app**, both feeding the same apuração. Value: higher participation (market pattern: electronic voting materially raises turnout), fewer manual recounts, and a single source of truth for quorum.

## Goals

- After this ships, a resident can open a poll from a notification or from Deliberações, cast the unit's vote, and see confirmation plus results (when readable).
- After this ships, a síndico/admin can see which units have voted (status only) and register a vote for a pending unit under `vote:manage`.
- The system continues to guarantee **exactly one vote per unit per poll**, janela OPEN, quorum and weight rules already defined — UI must not bypass them.
- Notification `actionUrl: /votacoes/:pollId` resolves to a working page instead of being dropped.
- Secret polls never disclose an individual choice in any new surface; open polls record voter identity (ADR-002).

## User Stories

Index into the canonical catalog — [Full user stories](_user_stories.md):

- **US-001–US-004** — Resident: deep-link vote page, entry from Deliberações, confirmation + results, already-voted state.
- **US-005** — Síndico/Admin: unit status list and manual registration.
- **US-006** — Secret ballot privacy across new surfaces.
- **US-007** — Notification deep link resolution.

## Core Features

### 1. Vote page (`/votacoes/:pollId`)

- Displays poll context and options; submits a vote for the authenticated resident's unit.
- After success: confirmation state, then results panel when the user may read results (ADR-004).
- On load: uses current vote status to show already-voted vs votable.
- **Functional requirements:** respect OPEN window, eligibility, one-vote-per-unit, permission `vote:create` / `vote:read`; safe states for not found / closed / forbidden.

### 2. Entry from Deliberações

- **Votar** action on open polls in the existing assemblies polls dialog, leading to the vote page (ADR-001).
- Does not regress create/edit/open/close/apurar behaviors.

### 3. Manual unit registration (management dialog)

- Lists units of the poll's condominium with **Already voted / Pending / Not eligible** (ADR-003).
- Pending eligible rows allow selecting an option and submitting via manager permissions.
- Never displays the chosen option in the list (secret or not).
- **Functional requirements:** `vote:manage` only; same backend rules; conflict on duplicate.

### 4. Notification integration

- Register vote path so existing poll-open notifications navigate to the vote page (US-007).

### Interaction between features

Notification and Deliberações both converge on the vote page; management dialog writes the same vote records the resident path uses; results and quorum remain owned by existing apuração.

## Business Rules

- **Invariant:** at most one vote row per `(tenant, poll, unit)` — second attempt → conflict (409), UI shows already voted / conflict.
- **Window:** vote only when poll `status = OPEN` and time within `startsAt`/`endsAt`.
- **Unit scope:** resident vote uses the unit bound to the session; manager vote uses selected `unitId` in the same condominium as the poll.
- **Eligibility:** `voterType: OWNERS` requires owner resident; otherwise forbidden with clear UX.
- **Weight/quorum:** unchanged — `weightedByFraction` uses ideal fraction; results expose participation vs `quorumPercent`.
- **Secret poll:** individual choice not exposed in lists; `my-vote` returns voted flag only; storage keeps voter identity null (ADR-002).
- **Open poll identity:** `voterId`/`voterName` recorded when not secret (ADR-002); manager registration records `registeredByUserId`.
- **Permissions:**
  - Resident: `vote:create`, `vote:read`, `poll:read` (existing matrix — no role edits).
  - Síndico/Admin: `vote:manage` (via `manageAll`) for management UI.
- **Lifecycle:** management and vote page only meaningful for OPEN polls; CLOSED/DRAFT show non-submittable states.

## User Experience

### Personas

- **Resident** — wants to vote in under a minute from a phone notification.
- **Síndico/Admin** — wants a pending list and reliable entry of off-app votes.

### Primary flows

1. **Resident deep link:** Notification → `/votacoes/:id` → choose option → submit → confirmation → results.
2. **Resident from assembly:** Assembleias → Deliberações → **Votar** → same page flow.
3. **Manager:** Deliberações → gestão → filter pending → pick unit row + option → submit → row becomes Already voted.
4. **Return visit:** Open link again → already-voted state + results.

### UI/UX considerations

- Confirmation copy explicit ("Voto registrado").
- Status labels understandable without training; secret poll never implies the manager can see choices.
- Accessible controls consistent with existing dialogs/pages (labels, focus, keyboard).
- Mobile-first on the vote page (deep links).

### Onboarding / discoverability

- Entry points: notification badge + assemblies Deliberações action; no new global menu item required (vote lives under assembleias context).

## High-Level Technical Constraints

- Must integrate with existing assemblies/polls API and permission model — **no new roles**.
- Frontend stack: existing React/Vite/Tailwind/Radix/Vitest patterns and query-key factories.
- Backend change limited to finishing Fase 1 quality (identity on open votes, cleanup) plus whatever read model the status list needs — TechSpec owns the how.
- Migration `VoteRegisteredBy` is applied manually on MySQL environments; automated tests use synchronize schema.
- LGPD: no new special-category data; identity on open votes only (ADR-002).
- Performance: status list must remain usable on condominiums with hundreds of units (filter/pagination as needed).

## Non-Goals (Out of Scope)

- Formal procuração (power of attorney with document/CPF capture).
- Blocking inadimplentes (delinquent owners) from voting.
- Vote by person/fraction of person — votes stay **per unit**.
- Hash-signed ata, export/report packages, WhatsApp distribution.
- Changing the "no vote change" rule (swap/re-vote before close remains forbidden).
- New nav menu section solely for votes.
- E2E browser suite beyond existing unit/integration harness (unless added by pipeline later).

## Architecture Decision Records

- [ADR-001: Deep-link vote route as primary vote UX](adrs/adr-001.md) — `/votacoes/:pollId` is canonical; Deliberações links to it.
- [ADR-002: Record voter identity only on non-secret polls](adrs/adr-002.md) — open polls store `voterId`/`voterName`; secret forces null.
- [ADR-003: Manual vote registration is per unit, with a status list](adrs/adr-003.md) — status only, no option leak; `vote:manage`.
- [ADR-004: After voting, show confirmation then results](adrs/adr-004.md) — confirmation always; results when readable.

## Open Questions

- None blocking. TechSpec may propose how to derive unit status (join of units × votes) without a new endpoint if feasible.

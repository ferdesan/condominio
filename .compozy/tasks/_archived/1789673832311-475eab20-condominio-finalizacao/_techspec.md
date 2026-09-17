# TechSpec: Condominio SaaS — Finalizacao (LGPD + Testes)

## Executive Summary

This TechSpec translates the LGPD compliance and test coverage PRD into a concrete implementation design. The backend gains a new `lgpd` module with three sub-capabilities (deletion requests, data export, consent management) implemented as a single Express router at `/lgpd` with two new database tables (`lgpd_requests`, `lgpd_consents`). The frontend adds a new "Privacidade" navigation section with a tabbed `/lgpd` page. Testing is risk-prioritized: 4 backend modules get integration tests, and 3 critical frontend infrastructure modules get dedicated unit tests.

The primary trade-off is modularity vs. cohesion: LGPD operations are grouped in one module rather than split into three, sacrificing strict 1:1 module convention for cross-cutting coordination (consent checks before deletion, audit logging across operations).

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ LGPD     │  │ LGPD     │  │ LGPD     │  │ Profile    │  │
│  │ Requests │  │ Export   │  │ Consent  │  │ (deletion  │  │
│  │ Tab      │  │ Tab      │  │ Tab      │  │  request)  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       └──────────────┼─────────────┼───────────────┘         │
│                      ▼                                       │
│              lib/api.ts (apiGet, apiPost)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────────┐
│                      Backend (Express)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  /lgpd router                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ delete-     │  │ export      │  │ consent     │  │   │
│  │  │ requests    │  │ endpoint    │  │ endpoints   │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │   │
│  │         └────────────────┼─────────────────┘          │   │
│  │                          ▼                            │   │
│  │              LgpdService (orchestrator)               │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Resident │  │Dependent │  │ Vehicle  │  │ Financial  │  │
│  │ Repo     │  │ Repo     │  │ Repo     │  │ Repos      │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                      MySQL 8.0                               │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ lgpd_requests│  │lgpd_consents │  (new tables)           │
│  └──────────────┘  └──────────────┘                         │
│  + existing tables (residents, dependents, vehicles, etc.)  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Deletion Request**: Resident → `POST /lgpd/delete-request` → `LgpdService.createDeleteRequest()` → inserts `lgpd_requests` row → audit log
2. **Deletion Execution**: Admin → `POST /lgpd/delete-request/:id/execute` → `LgpdService.executeDelete()` → anonymize resident + dependents + vehicles in transaction → update `lgpd_requests` status → audit log
3. **Data Export**: Resident → `GET /lgpd/export` → `LgpdService.exportData()` → query all related repositories → generate JSON → audit log → download
4. **Consent Update**: Resident → `POST /lgpd/consent` → `LgpdService.updateConsent()` → upsert `lgpd_consents` row → audit log

## Implementation Design

### Core Interfaces

#### Backend: LgpdService

```typescript
// backend/src/modules/lgpd/lgpd.service.ts
export class LgpdService {
  // Deletion requests
  async createDeleteRequest(ctx: RequestContext, dto: CreateDeleteRequestDTO): Promise<LgpdRequest>
  async listDeleteRequests(ctx: RequestContext, params: ListParams): Promise<Paginated<LgpdRequest>>
  async executeDelete(ctx: RequestContext, requestId: string): Promise<void>
  async cancelDeleteRequest(ctx: RequestContext, requestId: string): Promise<void>

  // Data export
  async exportResidentData(ctx: RequestContext, residentId: string): Promise<LgpdExportPayload>

  // Consent management
  async getConsent(ctx: RequestContext, residentId: string): Promise<LgpdConsent | null>
  async updateConsent(ctx: RequestContext, dto: UpdateConsentDTO): Promise<LgpdConsent>
}
```

#### Backend: Anonymization Function

```typescript
// backend/src/modules/lgpd/anonymize.ts
export type AnonymizeResult = {
  residentsAnonymized: number;
  dependentsAnonymized: number;
  vehiclesAnonymized: number;
};

export async function anonymizePersonalData(
  scope: TenantScope,
  residentId: string,
  repositories: {
    residents: ResidentRepository;
    dependents: DependentRepository;
    vehicles: VehicleRepository;
  }
): Promise<AnonymizeResult>
```

#### Frontend: LGPD Types

```typescript
// frontend/src/types/lgpd.ts
export type LgpdRequestStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED';

export type LgpdRequest = {
  id: string;
  tenantId: string;
  condominiumId: string;
  residentId: string;
  residentName: string;  // resolved from join
  status: LgpdRequestStatus;
  requestedAt: string;
  executedAt?: string | null;
  cancelledAt?: string | null;
  notes?: string | null;
};

export type LgpdConsent = {
  id: string;
  residentId: string;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  consentType: string;
};

export type LgpdExportPayload = {
  exportDate: string;
  platform: string;
  dataSubject: { name: string; email: string };
  resident: Record<string, unknown>;
  dependents: Record<string, unknown>[];
  vehicles: Record<string, unknown>[];
  reservations: Record<string, unknown>[];
  financial: { charges: Record<string, unknown>[]; payments: Record<string, unknown>[] };
  correspondences: Record<string, unknown>[];
  documents: Record<string, unknown>[];
};
```

#### Frontend: LGPD Hooks

```typescript
// frontend/src/features/lgpd/lgpd-hooks.ts
export const lgpdHooks = {
  useDeleteRequests: (params: ListParams) => useQuery(...)
  useCreateDeleteRequest: () => useMutation(...)
  useExecuteDelete: () => useMutation(...)
  useCancelDelete: () => useMutation(...)
  useExportData: (residentId?: string) => useQuery(...)
  useConsent: (residentId: string) => useQuery(...)
  useUpdateConsent: () => useMutation(...)
};
```

### Data Models

#### Database: `lgpd_requests` Table

```sql
CREATE TABLE lgpd_requests (
  id VARCHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6) NULL,
  tenant_id VARCHAR(36) NOT NULL,
  condominium_id VARCHAR(36) NOT NULL,
  resident_id VARCHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  executed_at DATETIME(6) NULL,
  cancelled_at DATETIME(6) NULL,
  notes TEXT NULL,
  PRIMARY KEY (id),
  KEY IDX_lgpd_requests_tenant (tenant_id),
  KEY IDX_lgpd_requests_tenant_condominium (tenant_id, condominium_id),
  KEY IDX_lgpd_requests_resident (resident_id),
  KEY IDX_lgpd_requests_status (tenant_id, status),
  CONSTRAINT FK_lgpd_requests_condominium FOREIGN KEY (condominium_id) REFERENCES condominiums(id) ON DELETE CASCADE,
  CONSTRAINT FK_lgpd_requests_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Database: `lgpd_consents` Table

```sql
CREATE TABLE lgpd_consents (
  id VARCHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6) NULL,
  tenant_id VARCHAR(36) NOT NULL,
  resident_id VARCHAR(36) NOT NULL,
  consent_type VARCHAR(50) NOT NULL DEFAULT 'DATA_PROCESSING',
  granted TINYINT(1) NOT NULL DEFAULT 0,
  granted_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  ip_address VARCHAR(64) NULL,
  description TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY UQ_lgpd_consents_resident_type (resident_id, consent_type),
  KEY IDX_lgpd_consents_tenant (tenant_id),
  CONSTRAINT FK_lgpd_consents_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Entity: `lgpd-request.entity.ts`

```typescript
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';

export const LGPD_REQUEST_STATUSES = ['PENDING', 'EXECUTED', 'CANCELLED'] as const;
export type LgpdRequestStatus = (typeof LGPD_REQUEST_STATUSES)[number];

@Entity('lgpd_requests')
@Index(['tenantId', 'condominiumId'])
@Index(['tenantId', 'status'])
export class LgpdRequest extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'resident_id', type: 'varchar', length: 36 })
  residentId: string;

  @ManyToOne(() => Resident)
  @JoinColumn({ name: 'resident_id' })
  resident?: Resident;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: LgpdRequestStatus;

  @Column({ name: 'requested_at', type: 'datetime', precision: 6 })
  requestedAt: Date;

  @Column({ name: 'executed_at', type: 'datetime', precision: 6, nullable: true })
  executedAt?: Date | null;

  @Column({ name: 'cancelled_at', type: 'datetime', precision: 6, nullable: true })
  cancelledAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
```

#### Entity: `lgpd-consent.entity.ts`

```typescript
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';

@Entity('lgpd_consents')
@Unique('UQ_lgpd_consents_resident_type', ['residentId', 'consentType'])
export class LgpdConsent extends TenantScopedEntity {
  @Column({ name: 'resident_id', type: 'varchar', length: 36 })
  residentId: string;

  @ManyToOne(() => Resident)
  @JoinColumn({ name: 'resident_id' })
  resident?: Resident;

  @Column({ name: 'consent_type', type: 'varchar', length: 50, default: 'DATA_PROCESSING' })
  consentType: string;

  @Column({ type: 'tinyint', default: 0 })
  granted: boolean;

  @Column({ name: 'granted_at', type: 'datetime', precision: 6, nullable: true })
  grantedAt?: Date | null;

  @Column({ name: 'revoked_at', type: 'datetime', precision: 6, nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;
}
```

### API Endpoints

#### Deletion Requests

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/lgpd/delete-request` | `resident:create` (own data) | Create deletion request |
| `GET` | `/lgpd/delete-requests` | `lgpd:read` | List all requests (admin, paginated) |
| `GET` | `/lgpd/delete-requests/:id` | `lgpd:read` | Get single request detail |
| `POST` | `/lgpd/delete-request/:id/execute` | `lgpd:manage` | Execute anonymization |
| `POST` | `/lgpd/delete-request/:id/cancel` | `resident:create` (own request) | Cancel pending request |

**POST /lgpd/delete-request**
```json
// Request
{ "condominiumId": "uuid", "notes": "optional string" }

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "PENDING",
    "requestedAt": "2026-09-16T10:00:00.000Z",
    "residentName": "João Silva"
  }
}
```

**POST /lgpd/delete-request/:id/execute**
```json
// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "EXECUTED",
    "executedAt": "2026-09-16T10:05:00.000Z",
    "anonymization": {
      "residentsAnonymized": 1,
      "dependentsAnonymized": 2,
      "vehiclesAnonymized": 1
    }
  }
}
```

#### Data Export

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/lgpd/export` | `resident:read` (own data) | Export own data as JSON |
| `GET` | `/lgpd/export/:residentId` | `lgpd:read` | Export specific resident data (admin) |

**GET /lgpd/export**
```json
// Response 200 (Content-Type: application/json, Content-Disposition: attachment)
{
  "exportDate": "2026-09-16T10:00:00.000Z",
  "platform": "Condominio SaaS",
  "dataSubject": { "name": "João Silva", "email": "joao@email.com" },
  "resident": { "name": "João Silva", "document": "123.456.789-00", ... },
  "dependents": [...],
  "vehicles": [...],
  "reservations": [...],
  "financial": { "charges": [...], "payments": [...] },
  "correspondences": [...],
  "documents": [...]
}
```

#### Consent Management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/lgpd/consent` | `resident:read` (own data) | Get own consent status |
| `POST` | `/lgpd/consent` | `resident:create` | Update consent (grant/revoke) |

**POST /lgpd/consent**
```json
// Request
{
  "consentType": "DATA_PROCESSING",
  "granted": false,
  "description": "Revogação solicitada pelo titular"
}

// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "consentType": "DATA_PROCESSING",
    "granted": false,
    "grantedAt": "2026-09-10T10:00:00.000Z",
    "revokedAt": "2026-09-16T10:00:00.000Z"
  }
}
```

### RBAC Integration

Add new resource to `resources.ts`:

```typescript
export const RESOURCES = [
  // ... existing
  'lgpd-request',
  'lgpd-consent',
] as const;
```

Add permissions to `roles.ts`:

```typescript
ROLE_ADMIN: [...manageAll('lgpd-request', 'lgpd-consent'), 'lgpd-request:read', 'lgpd-consent:read']
ROLE_SINDICO: [...manageAll('lgpd-request'), 'lgpd-consent:read']
ROLE_RESIDENT: ['lgpd-request:create', 'lgpd-consent:read', 'lgpd-consent:create']
```

### Frontend Components

#### `features/lgpd/lgpd-page.tsx`

Main page with Radix Tabs. Three tabs: Solicitações, Exportar, Consentimento.

```tsx
export function LgpdPage() {
  const { can } = useAuth();
  const isAdmin = can('lgpd:manage');

  return (
    <PageHeader title="LGPD" subtitle="Gestão de privacidade e proteção de dados" />
    <Tabs defaultValue="requests">
      <TabsList>
        <TabsTrigger value="requests">Solicitações</TabsTrigger>
        <TabsTrigger value="export">Exportar</TabsTrigger>
        <TabsTrigger value="consent">Consentimento</TabsTrigger>
      </TabsList>
      <TabsContent value="requests"><LgpdRequestsTab isAdmin={isAdmin} /></TabsContent>
      <TabsContent value="export"><LgpdExportTab /></TabsContent>
      <TabsContent value="consent"><LgpdConsentTab /></TabsContent>
    </Tabs>
  );
}
```

#### `features/lgpd/components/lgpd-requests-tab.tsx`

Admin view: DataTable with deletion requests, execute/cancel actions.
Resident view: "Nova solicitação" button, own request status.

#### `features/lgpd/components/lgpd-export-tab.tsx`

Resident: "Exportar meus dados" button → triggers JSON download.
Admin: Resident selector → "Exportar dados do residente" button.

#### `features/lgpd/components/lgpd-consent-tab.tsx`

Resident: Toggle switch for consent status with confirmation dialog.
Admin: Read-only view of consent status.

#### `features/lgpd/lgpd-schema.ts`

```typescript
export const createDeleteRequestSchema = z.object({
  condominiumId: uuidSchema,
  notes: z.string().max(2000).optional(),
});

export const updateConsentSchema = z.object({
  consentType: z.string().min(1).max(50),
  granted: z.boolean(),
  description: z.string().max(2000).optional(),
});
```

#### `features/lgpd/lgpd-labels.ts`

```typescript
export const REQUEST_STATUS_LABELS: Record<LgpdRequestStatus, string> = {
  PENDING: 'Pendente',
  EXECUTED: 'Executado',
  CANCELLED: 'Cancelado',
};
```

### Navigation Changes

**`navigation.ts`** — Add new section:

```typescript
{ title: 'Privacidade', items: [
  { to: '/lgpd', label: 'LGPD', icon: Shield, permission: 'lgpd:read' },
]}
```

**`app-router.tsx`** — Add route:

```tsx
<Route element={<ProtectedRoute permission="lgpd:read" />}>
  <Route path="/lgpd" element={<LgpdPage />} />
</Route>
```

Add `'/lgpd'` to the `IMPLEMENTED` set.

### Profile Page Integration

Add a "Solicitar exclusão de dados" link in `features/profile/profile-page.tsx` that navigates to `/lgpd?tab=export` for residents.

## Integration Points

### Existing Backend Services

| Service | Integration | Purpose |
|---------|-------------|---------|
| `ResidentRepository` | Read + Anonymize | Query resident data for export; anonymize personal fields for deletion |
| `DependentRepository` | Read + Anonymize | Query dependents for export; anonymize in cascade deletion |
| `VehicleRepository` | Read + Anonymize | Query vehicles for export; anonymize in cascade deletion |
| `ChargeRepository` | Read only | Query charges for export (preserve financial data) |
| `PaymentRepository` | Read only | Query payments for export (preserve financial data) |
| `CorrespondenceRepository` | Read only | Query correspondences for export |
| `DocumentRepository` | Read only | Query document metadata for export |
| `ReservationRepository` | Read only | Query reservations for export |
| `AuditService` | Write | Log LGPD operations (DELETE, EXPORT, CONSENT) |

### Existing Frontend Infrastructure

| Module | Integration | Purpose |
|--------|-------------|---------|
| `lib/api.ts` | API calls | `apiGet`, `apiPost` for LGPD endpoints |
| `lib/crud/resource-hooks.ts` | Hook factory | Not used (LGPD operations are non-standard CRUD) |
| `providers/auth-provider.tsx` | Permission checks | `can('lgpd:manage')`, `can('lgpd:read')` |
| `components/common/crud-layout.tsx` | Page layout | Used for requests tab |
| `components/common/data-table.tsx` | Data table | Used for requests list |
| `components/ui/dialog.tsx` | Confirmation | Execute/cancel/delete confirmations |
| `components/ui/tabs.tsx` | Tab navigation | Three LGPD tabs |
| `test/render.tsx` | Test harness | `renderWithProviders` for LGPD tests |

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|---------------------|-----------------|
| `resources.ts` | Modified | Add `lgpd-request`, `lgpd-consent` to RESOURCES array | Add 2 entries |
| `roles.ts` | Modified | Add LGPD permissions to 5 system roles | Add permission arrays |
| `routes/index.ts` | Modified | Register `/lgpd` router | Add 1 line |
| `migration` | New | Create `lgpd_requests` and `lgpd_consents` tables | New migration file |
| `lgpd/` module | New | 6 new files (entity×2, repository×2, service, schema, routes) | Create module |
| `navigation.ts` | Modified | Add "Privacidade" section | Add section |
| `app-router.tsx` | Modified | Add `/lgpd` route + IMPLEMENTED entry | Add route |
| `profile-page.tsx` | Modified | Add deletion request link | Minor addition |
| `resident.entity.ts` | Unchanged | `lgpdConsentAt` field already exists | No action |
| `backend tests/` | New | 4 new integration test files | Create specs |
| `frontend tests/` | New | Multiple test files for LGPD + infrastructure | Create tests |

## Testing Approach

### Frameworks and Harnesses

- **Backend**: Jest + Supertest + sql.js in-memory database (existing `backend/tests/setup.ts`)
- **Frontend**: Vitest + Testing Library + jsdom (existing `frontend/src/test/setup.ts`)
- **Test doubles**: Mock `@/lib/api` at transport layer (existing pattern)

### What Each Level Covers

- **Unit tests**: `anonymize.ts` function, `lgpd-schema.ts` validation, frontend `lgpd-labels.ts`, frontend `lgpd-schema.ts`
- **Integration tests (backend)**: All LGPD API endpoints, RBAC enforcement, tenant isolation, anonymization cascade, consent lifecycle
- **Integration tests (frontend)**: LGPD page rendering, tab switching, form submissions, permission-based visibility
- **E2E tests**: Not in scope for this phase (covered by integration tests)

### Environment Dependencies

- Backend tests need the sql.js in-memory database (no external MySQL)
- Frontend tests need jsdom (already configured)
- No external services required

## Development Sequencing

### Build Order

1. **Migration** — Create `lgpd_requests` and `lgpd_consents` tables (no dependencies)
2. **Backend entities** — `lgpd-request.entity.ts`, `lgpd-consent.entity.ts` (depends on migration)
3. **Backend repositories** — `lgpd-request.repository.ts`, `lgpd-consent.repository.ts` (depends on entities)
4. **Anonymization function** — `anonymize.ts` (depends on existing ResidentRepository, DependentRepository, VehicleRepository)
5. **Backend schema** — `lgpd.schema.ts` (depends on entities for enum constants)
6. **Backend service** — `lgpd.service.ts` (depends on repositories, anonymization, existing services)
7. **Backend routes** — `lgpd.routes.ts` (depends on service, schema, auth middleware)
8. **Backend route registration** — `routes/index.ts` modification (depends on routes)
9. **RBAC updates** — `resources.ts`, `roles.ts` (depends on nothing, can be done in parallel)
10. **Frontend types** — `types/lgpd.ts` (depends on nothing)
11. **Frontend hooks** — `lgpd-hooks.ts` (depends on types)
12. **Frontend schema + labels** — `lgpd-schema.ts`, `lgpd-labels.ts` (depends on types)
13. **Frontend components** — Tab components + page (depends on hooks, schema)
14. **Frontend routing** — `navigation.ts`, `app-router.tsx` modifications (depends on page)
15. **Profile integration** — Add deletion link to profile page (depends on routing)
16. **Backend integration tests** — 4 new spec files + LGPD spec (depends on backend module)
17. **Frontend infrastructure tests** — auth-provider, permissions, ProtectedRoute (independent)
18. **Frontend LGPD tests** — LGPD page and component tests (depends on frontend module)

### Technical Dependencies

- No external services required (no email, no S3, no external APIs)
- MySQL 8.0 already available via Docker
- Redis available but not required for LGPD module (no caching needed)
- All dependencies already installed in package.json

## Monitoring and Observability

### Key Metrics

- `lgpd_delete_requests_total` — Counter of deletion requests created
- `lgpd_delete_requests_executed_total` — Counter of deletions executed
- `lgpd_exports_total` — Counter of data exports generated
- `lgpd_consent_updates_total` — Counter of consent changes

### Log Events

All LGPD operations are logged via the existing `auditService.record()`:
- `LGPD_DELETE_REQUEST` — When a deletion request is created
- `LGPD_DELETE` — When a deletion is executed
- `LGPD_DELETE_CANCEL` — When a deletion request is cancelled
- `LGPD_EXPORT` — When data is exported
- `LGPD_CONSENT_GRANTED` — When consent is granted
- `LGPD_CONSENT_REVOKED` — When consent is revoked

### Alerting

- No new alerting rules needed (existing error handling and rate limiting apply)
- Consider alerting on high volumes of deletion requests (potential abuse)

## Technical Considerations

### Key Decisions

- **Single transaction for anonymization**: The anonymization of resident + dependents + vehicles happens in one MySQL transaction to ensure atomicity. If any part fails, all changes are rolled back.
- **No caching for LGPD endpoints**: Deletion requests and consent status are real-time compliance data; caching would risk showing stale status.
- **JSON export generated on-the-fly**: No storage of export files; the JSON is generated from current database state and streamed to the client.
- **Consent is per-resident, not per-user**: The `lgpd_consents` table links to `resident_id`, not `user_id`, because dependents don't have user accounts.

### Known Risks

- **Risk**: Large exports for residents with many records could be slow
  - **Mitigation**: Stream the JSON response; set a reasonable timeout (60s); consider pagination for very large datasets in future
- **Risk**: Anonymization could fail mid-transaction due to FK constraints
  - **Mitigation**: Anonymize in correct order (dependents first, then resident, then vehicles); test with all constraint scenarios
- **Risk**: Concurrent deletion requests for the same resident
  - **Mitigation**: Use database-level unique constraint on `(resident_id)` WHERE `status = 'PENDING'`; reject duplicate requests in service layer

## Architecture Decision Records

- [ADR-001: LGPD Data Deletion Strategy](adrs/adr-001.md) — Real anonymization + preservation of financial records
- [ADR-002: LGPD Data Export Format](adrs/adr-002.md) — JSON as the sole export format
- [ADR-003: Testing Priority Strategy](adrs/adr-003.md) — Risk-based tiered testing approach
- [ADR-004: LGPD Module Structure](adrs/adr-004.md) — Single module with sub-routes
- [ADR-005: LGPD Frontend Route Design](adrs/adr-005.md) — New "Privacidade" section with tabbed page

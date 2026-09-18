/**
 * Fixtures tipadas do dominio. Como o duble fica na camada de transporte
 * (ADR-010), os testes trabalham com objetos de dominio ja desembrulhados — e
 * uma fixture que divergir do contrato quebra no type check, nao em runtime.
 */

import type { PaginationMeta, Paginated } from '@/lib/api';
import type {
  AuthUser,
  AvailabilityEntry,
  Block,
  CommonArea,
  Condominium,
  Reservation,
  Resident,
  ServiceProvider,
  SystemRole,
  Unit,
  Vehicle,
} from '@/types/api';

const TIMESTAMPS = {
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
  deletedAt: null,
} as const;

export function makeCondominium(overrides: Partial<Condominium> = {}): Condominium {
  return {
    id: 'cond-1',
    name: 'Residencial Aurora',
    document: '12345678000199',
    type: 'RESIDENTIAL',
    status: 'ACTIVE',
    zipCode: '01310100',
    city: 'Sao Paulo',
    state: 'SP',
    district: 'Bela Vista',
    street: 'Avenida Paulista',
    number: '1000',
    complement: null,
    phone: '1133334444',
    email: 'contato@aurora.com.br',
    totalUnits: 48,
    syndicName: 'Marina Alves',
    syndicPhone: '11988887777',
    syndicTermEndsAt: '2027-03-31',
    chargeDueDay: 10,
    openingBalance: 0,
    openingBalanceDate: null,
    logoUrl: null,
    notes: null,
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: 'block-1',
    condominiumId: 'cond-1',
    name: 'Torre A',
    type: 'TOWER',
    description: null,
    floors: 12,
    unitsPerFloor: 4,
    hasElevator: true,
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'unit-1',
    condominiumId: 'cond-1',
    blockId: 'block-1',
    number: '101',
    floor: 1,
    type: 'APARTMENT',
    status: 'OCCUPIED',
    area: 78.5,
    idealFraction: 0.0125,
    monthlyFee: 850,
    bedrooms: 3,
    parkingSpots: 1,
    petsAllowed: true,
    notes: null,
    block: makeBlock(),
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makeResident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: 'resident-1',
    condominiumId: 'cond-1',
    unitId: 'unit-1',
    userId: null,
    name: 'Carlos Pereira',
    document: '12345678909',
    email: 'carlos@exemplo.com',
    phone: '11977776666',
    birthDate: '1985-06-20',
    type: 'OWNER',
    status: 'ACTIVE',
    isPrimary: true,
    moveInDate: '2020-02-01',
    moveOutDate: null,
    emergencyContact: null,
    emergencyPhone: null,
    photoUrl: null,
    lgpdConsentAt: null,
    notes: null,
    unit: makeUnit(),
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makeCommonArea(overrides: Partial<CommonArea> = {}): CommonArea {
  return {
    id: 'area-1',
    condominiumId: 'cond-1',
    name: 'Salao de Festas',
    description: null,
    capacity: 50,
    status: 'AVAILABLE',
    requiresApproval: true,
    reservationFee: 150,
    opensAt: '08:00',
    closesAt: '22:00',
    availableWeekdays: null,
    minHours: 2,
    maxHours: 6,
    advanceBookingDays: 60,
    minIntervalDays: 0,
    photoUrl: null,
    rules: null,
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'reservation-1',
    condominiumId: 'cond-1',
    commonAreaId: 'area-1',
    unitId: 'unit-1',
    requestedById: 'user-1',
    requestedByName: 'Carlos Pereira',
    startsAt: '2026-03-14T18:00:00.000Z',
    endsAt: '2026-03-14T23:00:00.000Z',
    status: 'PENDING',
    guestsCount: 30,
    fee: 150,
    paidAt: null,
    reviewedById: null,
    reviewedAt: null,
    statusReason: null,
    notes: null,
    commonArea: makeCommonArea(),
    unit: makeUnit(),
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makeAvailabilityEntry(
  overrides: Partial<AvailabilityEntry> = {},
): AvailabilityEntry {
  return {
    id: 'reservation-1',
    commonAreaId: 'area-1',
    commonAreaName: 'Salao de Festas',
    unitId: 'unit-1',
    unitNumber: '101',
    startsAt: '2026-03-14T18:00:00.000Z',
    endsAt: '2026-03-14T23:00:00.000Z',
    status: 'PENDING',
    requestedByName: 'Carlos Pereira',
    ...overrides,
  };
}

export function makeServiceProvider(overrides: Partial<ServiceProvider> = {}): ServiceProvider {
  return {
    id: 'provider-1',
    condominiumId: 'cond-1',
    companyName: 'Limpeza Total Ltda',
    tradeName: 'Limpeza Total',
    // CNPJ: o documento do prestador tambem aceita CPF, e os testes do cadastro
    // cobrem os dois comprimentos.
    document: '12345678000199',
    serviceType: 'Limpeza',
    contactName: 'Joana Ribeiro',
    phone: '11955554444',
    email: 'contato@limpezatotal.com.br',
    status: 'ACTIVE',
    contractStart: '2026-01-01',
    contractEnd: '2026-12-31',
    rating: 4,
    notes: null,
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'vehicle-1',
    condominiumId: 'cond-1',
    unitId: 'unit-1',
    residentId: 'resident-1',
    plate: 'ABC1D23',
    brand: 'Fiat',
    model: 'Argo',
    color: 'Prata',
    type: 'CAR',
    year: 2022,
    parkingSpot: 'G1-014',
    stickerNumber: '00147',
    status: 'ACTIVE',
    notes: null,
    unit: makeUnit(),
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    name: 'Marina Alves',
    email: 'marina@exemplo.com',
    phone: null,
    avatarUrl: null,
    role: 'ADMIN' satisfies SystemRole,
    permissions: ['*'],
    ...overrides,
  };
}

export function makeMeta(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
  const page = overrides.page ?? 1;
  const perPage = overrides.perPage ?? 20;
  const total = overrides.total ?? 1;
  const totalPages = overrides.totalPages ?? (perPage > 0 ? Math.ceil(total / perPage) : 0);
  return {
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
    ...overrides,
  };
}

/** Embrulha linhas na forma que `apiGetPaginated` devolve. */
export function makePage<T>(data: T[], meta: Partial<PaginationMeta> = {}): Paginated<T> {
  return { data, meta: makeMeta({ total: data.length, ...meta }) };
}

import { randomUUID } from 'node:crypto';
import { AppDataSource } from '@/config/data-source';
import { Dependent } from '@/modules/dependents/dependent.entity';
import { Reservation } from '@/modules/reservations/reservation.entity';
import { Resident } from '@/modules/residents/resident.entity';
import { Vehicle } from '@/modules/vehicles/vehicle.entity';
import { NotFoundError } from '@/shared/errors';
import type { TenantScope } from '@/shared/repositories/types';

export type AnonymizeResult = {
  residentsAnonymized: number;
  dependentsAnonymized: number;
  vehiclesAnonymized: number;
};

export const ANONYMIZED_NAME_PREFIX = 'REDACTED-';
export const ANONYMIZED_CPF = '000.000.000-00';
export const ANONYMIZED_EMAIL = 'redacted@redacted.invalid';
export const ANONYMIZED_PHONE = '0000000000';
export const ANONYMIZED_LABEL = 'Anonimizado';

export function anonymizedName(): string {
  return `${ANONYMIZED_NAME_PREFIX}${randomUUID().slice(0, 8)}`;
}

export function isAnonymizedName(value?: string | null): boolean {
  return Boolean(value?.startsWith(ANONYMIZED_NAME_PREFIX));
}

/** Nome apresentado na UI: morador ja anonimizado aparece como "Anonimizado". */
export function displayName(value?: string | null): string {
  return isAnonymizedName(value) ? ANONYMIZED_LABEL : (value ?? ANONYMIZED_LABEL);
}

/**
 * Substitui todos os campos pessoais de um morador por valores anonimizados,
 * em cascata para dependentes e veiculos, preservando os registros financeiros.
 * Executa dentro de uma unica transacao: qualquer falha reverte tudo.
 */
export async function anonymizePersonalData(
  scope: TenantScope,
  residentId: string,
): Promise<AnonymizeResult> {
  return AppDataSource.transaction(async (manager) => {
    const resident = await manager.findOne(Resident, {
      where: { id: residentId, tenantId: scope.tenantId },
    });
    if (!resident) throw new NotFoundError('Morador');

    const dependents = await manager.find(Dependent, {
      where: { residentId, tenantId: scope.tenantId },
    });
    const vehicles = await manager.find(Vehicle, {
      where: { residentId, tenantId: scope.tenantId },
    });

    await manager.update(
      Resident,
      { id: resident.id, tenantId: scope.tenantId },
      {
        name: anonymizedName(),
        document: ANONYMIZED_CPF,
        email: ANONYMIZED_EMAIL,
        phone: ANONYMIZED_PHONE,
        birthDate: null,
        emergencyContact: null,
        emergencyPhone: null,
        photoUrl: null,
        userId: null,
        notes: null,
      },
    );

    if (dependents.length > 0) {
      await manager.update(
        Dependent,
        dependents.map((dependent) => ({ id: dependent.id, tenantId: scope.tenantId })),
        {
          name: anonymizedName(),
          document: ANONYMIZED_CPF,
          birthDate: null,
          phone: ANONYMIZED_PHONE,
          photoUrl: null,
        },
      );
    }

    if (vehicles.length > 0) {
      await manager.update(
        Vehicle,
        vehicles.map((vehicle) => ({ id: vehicle.id, tenantId: scope.tenantId })),
        { residentId: null, notes: null },
      );
    }

    await manager.update(
      Reservation,
      { unitId: resident.unitId, tenantId: scope.tenantId },
      { requestedById: null, requestedByName: ANONYMIZED_LABEL },
    );
    await manager.update(
      Reservation,
      { requestedById: residentId, tenantId: scope.tenantId },
      { requestedById: null, requestedByName: ANONYMIZED_LABEL },
    );

    return {
      residentsAnonymized: 1,
      dependentsAnonymized: dependents.length,
      vehiclesAnonymized: vehicles.length,
    };
  });
}

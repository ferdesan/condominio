import { AppDataSource } from '@/config/data-source';
import { logger } from '@/config/logger';
import { Announcement } from '@/modules/announcements/announcement.entity';
import { Assembly } from '@/modules/assemblies/entities/assembly.entity';
import { Poll } from '@/modules/assemblies/entities/poll.entity';
import { PollOption } from '@/modules/assemblies/entities/poll-option.entity';
import { Block } from '@/modules/blocks/block.entity';
import { CommonArea } from '@/modules/common-areas/common-area.entity';
import { Condominium } from '@/modules/condominiums/condominium.entity';
import { Correspondence } from '@/modules/correspondences/correspondence.entity';
import { DocumentFile } from '@/modules/documents/document.entity';
import { Employee } from '@/modules/employees/employee.entity';
import { Charge } from '@/modules/financial/entities/charge.entity';
import { Expense } from '@/modules/financial/entities/expense.entity';
import { FinancialCategory } from '@/modules/financial/entities/financial-category.entity';
import { Payment } from '@/modules/financial/entities/payment.entity';
import { Incident } from '@/modules/incidents/incident.entity';
import { Maintenance } from '@/modules/maintenances/maintenance.entity';
import { Reservation } from '@/modules/reservations/reservation.entity';
import { Resident } from '@/modules/residents/resident.entity';
import { Role } from '@/modules/roles/role.entity';
import { ServiceProvider } from '@/modules/service-providers/service-provider.entity';
import { Tenant } from '@/modules/tenants/tenant.entity';
import { Unit } from '@/modules/units/unit.entity';
import { User } from '@/modules/users/user.entity';
import { Vehicle } from '@/modules/vehicles/vehicle.entity';
import { Visitor } from '@/modules/visitors/visitor.entity';
import {
  ROLE_ADMIN,
  ROLE_DEFINITIONS,
  ROLE_RESIDENT,
  ROLE_SINDICO,
  ROLE_STAFF,
  ROLE_SUPER_ADMIN,
} from '@/shared/constants/roles';
import { hashPassword } from '@/shared/utils/password.util';
import { dayjs } from '@/shared/utils/date.util';

export type SeedResult = {
  tenantId: string;
  condominiumId: string;
  users: Record<string, { id: string; email: string; password: string }>;
  unitIds: string[];
};

const DEMO_PASSWORD = 'Demo@1234';

const FIRST_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique',
  'Isabela', 'Joao', 'Karina', 'Lucas', 'Mariana', 'Nelson', 'Olivia', 'Paulo',
];
const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Almeida', 'Ferreira',
];

function personName(index: number): string {
  return `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[index % LAST_NAMES.length]}`;
}

function fakeCpf(index: number): string {
  return String(10000000000 + index * 137).padStart(11, '0').slice(0, 11);
}

function plate(index: number): string {
  const letters = ['ABC', 'BRA', 'FLO', 'PQR', 'XYZ'];
  return `${letters[index % letters.length]}${String(1000 + index).slice(0, 1)}A${String(10 + (index % 90))}`;
}

/**
 * Popula a base com um cenario completo e coerente: uma administradora, um
 * condominio com dois blocos, moradores, financeiro de tres competencias,
 * reservas, ocorrencias, assembleia com votacao e trilha operacional.
 *
 * Idempotente: se o tenant `demo` ja existir, nada e recriado.
 */
export async function runSeeds(): Promise<SeedResult | null> {
  const manager = AppDataSource.manager;

  const existing = await manager.findOne(Tenant, { where: { slug: 'demo' } });
  if (existing) {
    logger.warn('Seed ignorado: o tenant "demo" ja existe.');
    const condominium = await manager.findOne(Condominium, {
      where: { tenantId: existing.id },
    });
    return condominium
      ? { tenantId: existing.id, condominiumId: condominium.id, users: {}, unitIds: [] }
      : null;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const today = dayjs();

  // --- Tenant + papeis -----------------------------------------------------
  const tenant = await manager.save(
    manager.create(Tenant, {
      name: 'Administradora Horizonte',
      slug: 'demo',
      document: '12345678000199',
      email: 'contato@horizonte.com.br',
      phone: '(11) 4002-8922',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      maxCondominiums: 10,
      maxUsers: 200,
      settings: {
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR',
        chargeGraceDays: 0,
        latePenaltyPercent: 2,
        lateInterestPercent: 1,
        primaryColor: '#2563eb',
      },
    }),
  );

  const roles = await manager.save(
    ROLE_DEFINITIONS.map((definition) =>
      manager.create(Role, {
        tenantId: tenant.id,
        name: definition.name,
        description: definition.description,
        permissions: definition.permissions,
        isSystem: true,
      }),
    ),
  );
  const roleByName = new Map(roles.map((role) => [role.name, role]));

  // --- Condominio, blocos e unidades ---------------------------------------
  const condominium = await manager.save(
    manager.create(Condominium, {
      tenantId: tenant.id,
      name: 'Residencial Parque das Flores',
      document: '98765432000188',
      type: 'RESIDENTIAL',
      status: 'ACTIVE',
      zipCode: '04567000',
      street: 'Rua das Acacias',
      number: '1200',
      district: 'Jardim Botanico',
      city: 'Sao Paulo',
      state: 'SP',
      phone: '(11) 3333-4444',
      email: 'portaria@parqueflores.com.br',
      syndicName: 'Roberto Mendes',
      syndicPhone: '(11) 99999-1010',
      syndicTermEndsAt: today.add(1, 'year').format('YYYY-MM-DD'),
      chargeDueDay: 10,
    }),
  );

  const blocks = await manager.save([
    manager.create(Block, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      name: 'Torre A',
      type: 'TOWER',
      floors: 4,
      unitsPerFloor: 4,
      hasElevator: true,
      description: 'Torre frontal, vista para o parque.',
    }),
    manager.create(Block, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      name: 'Torre B',
      type: 'TOWER',
      floors: 4,
      unitsPerFloor: 4,
      hasElevator: true,
      description: 'Torre dos fundos, proxima ao lazer.',
    }),
  ]);

  const units: Unit[] = [];
  const totalUnits = blocks.length * 16;
  for (const block of blocks) {
    for (let floor = 1; floor <= 4; floor += 1) {
      for (let index = 1; index <= 4; index += 1) {
        const number = `${floor}0${index}`;
        const area = 68 + ((floor + index) % 4) * 12;
        units.push(
          manager.create(Unit, {
            tenantId: tenant.id,
            condominiumId: condominium.id,
            blockId: block.id,
            number,
            floor,
            type: 'APARTMENT',
            status: index === 4 && floor === 4 ? 'VACANT' : 'OCCUPIED',
            area,
            idealFraction: Number((1 / totalUnits).toFixed(6)),
            monthlyFee: 480 + ((floor + index) % 4) * 45,
            bedrooms: 2 + (index % 2),
            parkingSpots: 1 + (index % 2),
          }),
        );
      }
    }
  }
  const savedUnits = await manager.save(units);
  await manager.update(Condominium, condominium.id, { totalUnits: savedUnits.length });

  // --- Usuarios ------------------------------------------------------------
  const firstUnit = savedUnits[0];

  const [superAdmin, admin, sindico, porteiro, morador] = await manager.save([
    manager.create(User, {
      tenantId: tenant.id,
      name: 'Operador da Plataforma',
      email: 'super@condominio.app',
      passwordHash,
      status: 'ACTIVE',
      roleId: roleByName.get(ROLE_SUPER_ADMIN)!.id,
      emailVerifiedAt: new Date(),
      preferences: { theme: 'system', locale: 'pt-BR' },
    }),
    manager.create(User, {
      tenantId: tenant.id,
      name: 'Mariana Horizonte',
      email: 'admin@horizonte.com.br',
      passwordHash,
      phone: '(11) 98888-1000',
      status: 'ACTIVE',
      roleId: roleByName.get(ROLE_ADMIN)!.id,
      emailVerifiedAt: new Date(),
      preferences: { theme: 'light', locale: 'pt-BR', emailNotifications: true },
    }),
    manager.create(User, {
      tenantId: tenant.id,
      name: 'Roberto Mendes',
      email: 'sindico@parqueflores.com.br',
      passwordHash,
      phone: '(11) 99999-1010',
      status: 'ACTIVE',
      roleId: roleByName.get(ROLE_SINDICO)!.id,
      emailVerifiedAt: new Date(),
    }),
    manager.create(User, {
      tenantId: tenant.id,
      name: 'Carlos Portaria',
      email: 'portaria@parqueflores.com.br',
      passwordHash,
      status: 'ACTIVE',
      roleId: roleByName.get(ROLE_STAFF)!.id,
      emailVerifiedAt: new Date(),
    }),
    manager.create(User, {
      tenantId: tenant.id,
      name: personName(0),
      email: 'morador@parqueflores.com.br',
      passwordHash,
      status: 'ACTIVE',
      roleId: roleByName.get(ROLE_RESIDENT)!.id,
      unitId: firstUnit.id,
      emailVerifiedAt: new Date(),
      lgpdConsentAt: new Date(),
    }),
  ]);

  // Vincula os usuarios operacionais ao condominio (escopo de visibilidade).
  for (const user of [sindico, porteiro, morador]) {
    await manager
      .createQueryBuilder()
      .relation(User, 'condominiums')
      .of(user.id)
      .add(condominium.id);
  }

  // --- Moradores, veiculos e dependentes ----------------------------------
  const occupied = savedUnits.filter((unit) => unit.status === 'OCCUPIED');
  const residents = await manager.save(
    occupied.map((unit, index) =>
      manager.create(Resident, {
        tenantId: tenant.id,
        condominiumId: condominium.id,
        unitId: unit.id,
        userId: index === 0 ? morador.id : null,
        name: index === 0 ? morador.name : personName(index),
        document: fakeCpf(index),
        email: index === 0 ? morador.email : `morador${index}@exemplo.com.br`,
        phone: `(11) 9${String(70000000 + index).slice(0, 8)}`,
        type: index % 3 === 0 ? 'TENANT' : 'OWNER',
        status: 'ACTIVE',
        isPrimary: true,
        moveInDate: today.subtract(index + 3, 'month').format('YYYY-MM-DD'),
        lgpdConsentAt: new Date(),
      }),
    ),
  );

  await manager.save(
    residents.slice(0, 12).map((resident, index) =>
      manager.create(Vehicle, {
        tenantId: tenant.id,
        condominiumId: condominium.id,
        unitId: resident.unitId,
        residentId: resident.id,
        plate: plate(index),
        brand: ['Fiat', 'Volkswagen', 'Chevrolet', 'Honda'][index % 4],
        model: ['Argo', 'Polo', 'Onix', 'Civic'][index % 4],
        color: ['Prata', 'Preto', 'Branco', 'Cinza'][index % 4],
        type: index % 7 === 0 ? 'MOTORCYCLE' : 'CAR',
        year: 2018 + (index % 6),
        parkingSpot: `G${(index % 3) + 1}-${String(index + 1).padStart(2, '0')}`,
        status: 'ACTIVE',
      }),
    ),
  );

  // --- Equipe e prestadores ------------------------------------------------
  await manager.save([
    manager.create(Employee, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      userId: porteiro.id,
      name: 'Carlos Portaria',
      document: fakeCpf(101),
      position: 'Porteiro',
      department: 'Portaria',
      contractType: 'CLT',
      status: 'ACTIVE',
      admissionDate: today.subtract(3, 'year').format('YYYY-MM-DD'),
      workSchedule: '12x36 - Diurno',
      salary: 2400,
    }),
    manager.create(Employee, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      name: 'Joana Lima',
      document: fakeCpf(102),
      position: 'Zeladora',
      department: 'Limpeza',
      contractType: 'CLT',
      status: 'ACTIVE',
      admissionDate: today.subtract(18, 'month').format('YYYY-MM-DD'),
      workSchedule: 'Segunda a sexta, 07h-16h',
      salary: 2100,
    }),
  ]);

  const providers = await manager.save([
    manager.create(ServiceProvider, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      companyName: 'Eleva Manutencao de Elevadores LTDA',
      tradeName: 'Eleva',
      document: '11222333000144',
      serviceType: 'Manutencao de elevadores',
      contactName: 'Sergio Prado',
      phone: '(11) 3222-1000',
      email: 'contato@eleva.com.br',
      status: 'ACTIVE',
      contractStart: today.subtract(2, 'year').format('YYYY-MM-DD'),
      contractEnd: today.add(1, 'year').format('YYYY-MM-DD'),
      rating: 5,
    }),
    manager.create(ServiceProvider, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      companyName: 'Jardins Verdes Paisagismo ME',
      serviceType: 'Jardinagem',
      document: '55666777000122',
      contactName: 'Marta Reis',
      phone: '(11) 3555-2020',
      status: 'ACTIVE',
      rating: 4,
    }),
  ]);

  // --- Areas comuns e reservas --------------------------------------------
  const areas = await manager.save([
    manager.create(CommonArea, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      name: 'Salao de Festas',
      description: 'Capacidade para 60 pessoas, com cozinha de apoio.',
      capacity: 60,
      status: 'AVAILABLE',
      requiresApproval: true,
      reservationFee: 250,
      opensAt: '10:00',
      closesAt: '23:00',
      availableWeekdays: [0, 5, 6],
      minHours: 4,
      maxHours: 8,
      advanceBookingDays: 90,
      minIntervalDays: 30,
      rules: 'Musica ate 22h. Limpeza obrigatoria apos o uso.',
    }),
    manager.create(CommonArea, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      name: 'Churrasqueira Gourmet',
      capacity: 20,
      status: 'AVAILABLE',
      requiresApproval: false,
      reservationFee: 80,
      opensAt: '09:00',
      closesAt: '22:00',
      availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
      minHours: 3,
      maxHours: 6,
      advanceBookingDays: 30,
    }),
    manager.create(CommonArea, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      name: 'Coworking',
      capacity: 8,
      status: 'AVAILABLE',
      requiresApproval: false,
      reservationFee: 0,
      opensAt: '07:00',
      closesAt: '21:00',
      minHours: 1,
      maxHours: 4,
      advanceBookingDays: 15,
    }),
  ]);

  await manager.save([
    manager.create(Reservation, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      commonAreaId: areas[0].id,
      unitId: firstUnit.id,
      requestedById: morador.id,
      requestedByName: morador.name,
      startsAt: today.add(7, 'day').hour(18).minute(0).second(0).millisecond(0).toDate(),
      endsAt: today.add(7, 'day').hour(23).minute(0).second(0).millisecond(0).toDate(),
      status: 'PENDING',
      guestsCount: 35,
      fee: 250,
      notes: 'Aniversario de 40 anos.',
    }),
    manager.create(Reservation, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      commonAreaId: areas[1].id,
      unitId: savedUnits[5].id,
      requestedById: sindico.id,
      requestedByName: sindico.name,
      startsAt: today.add(2, 'day').hour(12).minute(0).second(0).millisecond(0).toDate(),
      endsAt: today.add(2, 'day').hour(17).minute(0).second(0).millisecond(0).toDate(),
      status: 'CONFIRMED',
      guestsCount: 12,
      fee: 80,
    }),
  ]);

  // --- Financeiro ----------------------------------------------------------
  const categories = await manager.save([
    manager.create(FinancialCategory, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      name: 'Taxa condominial',
      kind: 'INCOME',
      code: '1.1',
      color: '#2563eb',
    }),
    manager.create(FinancialCategory, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      name: 'Fundo de reserva',
      kind: 'INCOME',
      code: '1.2',
      color: '#0ea5e9',
    }),
    manager.create(FinancialCategory, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      name: 'Folha de pagamento',
      kind: 'EXPENSE',
      code: '2.1',
      color: '#f97316',
    }),
    manager.create(FinancialCategory, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      name: 'Agua e energia',
      kind: 'EXPENSE',
      code: '2.2',
      color: '#22c55e',
    }),
    manager.create(FinancialCategory, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      name: 'Manutencao predial',
      kind: 'EXPENSE',
      code: '2.3',
      color: '#a855f7',
    }),
  ]);

  const charges: Charge[] = [];
  const payments: Payment[] = [];

  for (let monthOffset = 2; monthOffset >= 0; monthOffset -= 1) {
    const reference = today.subtract(monthOffset, 'month');
    const referenceMonth = reference.format('YYYY-MM');
    const dueDate = reference.date(10).format('YYYY-MM-DD');
    const isPastMonth = monthOffset > 0;

    savedUnits.forEach((unit, index) => {
      // Um punhado de unidades fica inadimplente para o dashboard ter dados reais.
      const defaulter = index % 9 === 0;
      const paid = isPastMonth ? !defaulter : index % 3 === 0;

      const charge = manager.create(Charge, {
        tenantId: tenant.id,
        condominiumId: condominium.id,
        unitId: unit.id,
        categoryId: categories[0].id,
        description: `Taxa condominial ${reference.format('MM/YYYY')}`,
        referenceMonth,
        dueDate,
        amount: unit.monthlyFee,
        discount: 0,
        interest: 0,
        penalty: paid ? 0 : isPastMonth ? Number((unit.monthlyFee * 0.02).toFixed(2)) : 0,
        paidAmount: paid ? unit.monthlyFee : 0,
        status: paid ? 'PAID' : isPastMonth ? 'OVERDUE' : 'PENDING',
        paidAt: paid ? reference.date(8).toDate() : null,
        paymentMethod: paid ? 'PIX' : null,
      });
      charges.push(charge);
    });
  }

  const savedCharges = await manager.save(charges, { chunk: 100 });

  savedCharges
    .filter((charge) => charge.status === 'PAID')
    .forEach((charge) => {
      payments.push(
        manager.create(Payment, {
          tenantId: tenant.id,
          condominiumId: condominium.id,
          chargeId: charge.id,
          amount: charge.amount,
          paidAt: charge.paidAt ?? new Date(),
          method: 'PIX',
          registeredById: admin.id,
        }),
      );
    });
  await manager.save(payments, { chunk: 100 });

  const expenses: Expense[] = [];
  for (let monthOffset = 2; monthOffset >= 0; monthOffset -= 1) {
    const reference = today.subtract(monthOffset, 'month');
    const competence = reference.format('YYYY-MM');
    const paid = monthOffset > 0;

    expenses.push(
      manager.create(Expense, {
        tenantId: tenant.id,
        condominiumId: condominium.id,
        categoryId: categories[2].id,
        description: 'Folha de pagamento da equipe',
        competence,
        dueDate: reference.date(5).format('YYYY-MM-DD'),
        amount: 9800,
        status: paid ? 'PAID' : 'PENDING',
        paidAt: paid ? reference.date(5).toDate() : null,
        paymentMethod: paid ? 'TRANSFER' : null,
        isRecurring: true,
      }),
      manager.create(Expense, {
        tenantId: tenant.id,
        condominiumId: condominium.id,
        categoryId: categories[3].id,
        description: 'Conta de agua e energia das areas comuns',
        competence,
        dueDate: reference.date(15).format('YYYY-MM-DD'),
        amount: 3250 + monthOffset * 180,
        status: paid ? 'PAID' : 'PENDING',
        paidAt: paid ? reference.date(14).toDate() : null,
        isRecurring: true,
      }),
      manager.create(Expense, {
        tenantId: tenant.id,
        condominiumId: condominium.id,
        categoryId: categories[4].id,
        serviceProviderId: providers[0].id,
        description: 'Manutencao preventiva dos elevadores',
        competence,
        dueDate: reference.date(20).format('YYYY-MM-DD'),
        amount: 1450,
        status: paid ? 'PAID' : 'PENDING',
        paidAt: paid ? reference.date(20).toDate() : null,
        isRecurring: true,
      }),
    );
  }
  await manager.save(expenses);

  // --- Comunicacao e operacao ---------------------------------------------
  await manager.save([
    manager.create(Announcement, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      title: 'Manutencao programada dos elevadores',
      content:
        'Informamos que no proximo sabado, das 8h as 12h, os elevadores da Torre A passarao por manutencao preventiva. Pedimos a compreensao de todos.',
      category: 'MAINTENANCE',
      status: 'PUBLISHED',
      audience: 'ALL',
      pinned: true,
      publishedAt: today.subtract(2, 'day').toDate(),
      expiresAt: today.add(10, 'day').toDate(),
      authorId: sindico.id,
      authorName: sindico.name,
      readsCount: 18,
    }),
    manager.create(Announcement, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      title: 'Nova regra para uso da churrasqueira',
      content:
        'A partir deste mes, a reserva da churrasqueira gourmet devera ser feita com no minimo 48h de antecedencia pelo portal do morador.',
      category: 'GENERAL',
      status: 'PUBLISHED',
      audience: 'ALL',
      publishedAt: today.subtract(9, 'day').toDate(),
      authorId: admin.id,
      authorName: admin.name,
      readsCount: 26,
    }),
  ]);

  await manager.save([
    manager.create(Incident, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      unitId: savedUnits[3].id,
      protocol: `OC-${today.year()}-000001`,
      title: 'Barulho excessivo apos as 22h',
      description: 'Musica alta vinda da unidade vizinha durante a madrugada de sabado.',
      category: 'NOISE',
      priority: 'MEDIUM',
      status: 'IN_ANALYSIS',
      reportedById: morador.id,
      reportedByName: morador.name,
      occurredAt: today.subtract(3, 'day').toDate(),
      assignedToId: sindico.id,
    }),
    manager.create(Incident, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      protocol: `OC-${today.year()}-000002`,
      title: 'Lampada queimada na garagem G2',
      description: 'Corredor da garagem G2 esta as escuras proximo a vaga 18.',
      category: 'MAINTENANCE',
      priority: 'LOW',
      status: 'RESOLVED',
      reportedById: porteiro.id,
      reportedByName: porteiro.name,
      occurredAt: today.subtract(12, 'day').toDate(),
      resolvedAt: today.subtract(10, 'day').toDate(),
      resolution: 'Lampada substituida pela equipe de manutencao.',
      location: 'Garagem G2',
    }),
  ]);

  await manager.save([
    manager.create(Maintenance, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      title: 'Manutencao preventiva dos elevadores',
      description: 'Inspecao mensal obrigatoria conforme contrato.',
      type: 'PREVENTIVE',
      status: 'SCHEDULED',
      recurrence: 'MONTHLY',
      assetName: 'Elevadores Torre A e B',
      serviceProviderId: providers[0].id,
      responsibleId: sindico.id,
      scheduledFor: today.add(5, 'day').hour(8).minute(0).second(0).millisecond(0).toDate(),
      estimatedCost: 1450,
      nextExecutionAt: today.add(35, 'day').format('YYYY-MM-DD'),
    }),
    manager.create(Maintenance, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      title: 'Limpeza da caixa d agua',
      type: 'PREVENTIVE',
      status: 'COMPLETED',
      recurrence: 'SEMIANNUAL',
      assetName: 'Reservatorio superior',
      scheduledFor: today.subtract(30, 'day').toDate(),
      completedAt: today.subtract(30, 'day').toDate(),
      estimatedCost: 900,
      finalCost: 880,
      nextExecutionAt: today.add(150, 'day').format('YYYY-MM-DD'),
    }),
  ]);

  await manager.save([
    manager.create(Correspondence, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      unitId: firstUnit.id,
      residentId: residents[0].id,
      type: 'PACKAGE',
      status: 'PENDING',
      carrier: 'Correios',
      trackingCode: 'BR123456789BR',
      description: 'Caixa media',
      receivedAt: today.subtract(1, 'day').toDate(),
      receivedBy: porteiro.name,
    }),
    manager.create(Correspondence, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      unitId: savedUnits[2].id,
      type: 'REGISTERED',
      status: 'DELIVERED',
      carrier: 'Correios',
      description: 'Carta registrada',
      receivedAt: today.subtract(6, 'day').toDate(),
      receivedBy: porteiro.name,
      deliveredAt: today.subtract(5, 'day').toDate(),
      deliveredTo: residents[2]?.name ?? 'Morador',
    }),
  ]);

  await manager.save([
    manager.create(Visitor, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      unitId: firstUnit.id,
      name: 'Paulo Tecnico',
      document: fakeCpf(301),
      type: 'SERVICE',
      status: 'EXPECTED',
      company: 'NetFibra Telecom',
      expectedAt: today.add(1, 'day').hour(14).minute(0).second(0).millisecond(0).toDate(),
      authorizedById: morador.id,
      authorizedByName: morador.name,
      registeredById: morador.id,
      accessCode: 'A1B2C3',
    }),
    manager.create(Visitor, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      unitId: savedUnits[4].id,
      name: 'Luiza Andrade',
      document: fakeCpf(302),
      type: 'VISITOR',
      status: 'CHECKED_IN',
      checkedInAt: today.subtract(2, 'hour').toDate(),
      registeredById: porteiro.id,
      badgeNumber: 'V-014',
    }),
  ]);

  // --- Assembleia e votacao ------------------------------------------------
  const assembly = await manager.save(
    manager.create(Assembly, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      title: 'Assembleia Geral Ordinaria 2026',
      description:
        'Pauta: prestacao de contas do exercicio anterior, previsao orcamentaria e eleicao do conselho fiscal.',
      type: 'ORDINARY',
      status: 'SCHEDULED',
      mode: 'HYBRID',
      scheduledAt: today.add(14, 'day').hour(19).minute(0).second(0).millisecond(0).toDate(),
      secondCallAt: today.add(14, 'day').hour(19).minute(30).second(0).millisecond(0).toDate(),
      location: 'Salao de Festas',
      onlineUrl: 'https://meet.example.com/agof-2026',
      quorumPercent: 50,
    }),
  );

  const poll = await manager.save(
    manager.create(Poll, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      assemblyId: assembly.id,
      title: 'Aprovacao da previsao orcamentaria de 2026',
      description: 'Orcamento anual com reajuste de 6,5% na taxa condominial.',
      status: 'OPEN',
      voterType: 'OWNERS',
      weightedByFraction: true,
      isSecret: false,
      startsAt: today.subtract(1, 'day').toDate(),
      endsAt: today.add(13, 'day').toDate(),
      quorumPercent: 50,
      eligibleUnits: savedUnits.length,
      totalVotes: 0,
    }),
  );

  await manager.save([
    manager.create(PollOption, {
      tenantId: tenant.id,
      pollId: poll.id,
      label: 'Aprovo a previsao orcamentaria',
      sortOrder: 0,
    }),
    manager.create(PollOption, {
      tenantId: tenant.id,
      pollId: poll.id,
      label: 'Rejeito a previsao orcamentaria',
      sortOrder: 1,
    }),
    manager.create(PollOption, {
      tenantId: tenant.id,
      pollId: poll.id,
      label: 'Abstencao',
      sortOrder: 2,
    }),
  ]);

  // --- Documentos ----------------------------------------------------------
  await manager.save([
    manager.create(DocumentFile, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      title: 'Convencao do condominio',
      description: 'Documento registrado em cartorio.',
      category: 'CONVENTION',
      visibility: 'RESIDENTS',
      fileName: 'convencao.pdf',
      filePath: 'demo/convencao.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 482_112,
      uploadedById: admin.id,
      tags: ['convencao', 'juridico'],
    }),
    manager.create(DocumentFile, {
      tenantId: tenant.id,
      condominiumId: condominium.id,
      title: 'Regimento interno',
      category: 'REGULATION',
      visibility: 'RESIDENTS',
      fileName: 'regimento-interno.pdf',
      filePath: 'demo/regimento-interno.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 233_984,
      uploadedById: admin.id,
      tags: ['regras'],
    }),
  ]);

  logger.info('Seed concluido com sucesso.');

  return {
    tenantId: tenant.id,
    condominiumId: condominium.id,
    unitIds: savedUnits.map((unit) => unit.id),
    users: {
      superAdmin: { id: superAdmin.id, email: superAdmin.email, password: DEMO_PASSWORD },
      admin: { id: admin.id, email: admin.email, password: DEMO_PASSWORD },
      sindico: { id: sindico.id, email: sindico.email, password: DEMO_PASSWORD },
      porteiro: { id: porteiro.id, email: porteiro.email, password: DEMO_PASSWORD },
      morador: { id: morador.id, email: morador.email, password: DEMO_PASSWORD },
    },
  };
}

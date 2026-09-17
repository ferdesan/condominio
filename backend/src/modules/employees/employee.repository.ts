import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Employee } from './employee.entity';

export class EmployeeRepository extends BaseRepository<Employee> {
  constructor() {
    super(Employee, {
      alias: 'employee',
      searchableFields: ['name', 'document', 'position', 'email'],
      filterableFields: ['condominiumId', 'status', 'department', 'contractType'],
      defaultSort: { field: 'name', order: 'ASC' },
      condominiumField: 'condominiumId',
    });
  }

  async documentTaken(scope: TenantScope, document: string, exceptId?: string): Promise<boolean> {
    const qb = this.query(scope, true).andWhere('employee.document = :document', { document });
    if (exceptId) qb.andWhere('employee.id != :exceptId', { exceptId });
    return qb.getExists();
  }
}

export const employeeRepository = new EmployeeRepository();

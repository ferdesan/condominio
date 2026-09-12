import { BaseRepository } from '@/shared/repositories/base.repository';
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
}

export const employeeRepository = new EmployeeRepository();

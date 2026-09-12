import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import type { Employee } from './employee.entity';
import type { CreateEmployeeDTO, UpdateEmployeeDTO } from './employee.schema';
import { createEmployeeSchema, updateEmployeeSchema } from './employee.schema';
import { employeeService } from './employee.service';

export const employeeRouter = createCrudRouter({
  resource: 'employee',
  controller: new BaseCrudController<Employee, CreateEmployeeDTO, UpdateEmployeeDTO>(
    employeeService,
  ),
  createSchema: createEmployeeSchema,
  updateSchema: updateEmployeeSchema,
});

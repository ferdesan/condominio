import type { DeepPartial } from 'typeorm';
import { BusinessRuleError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import type { RequestContext } from '@/shared/services/request-context';
import { isValidCpf } from '@/shared/utils/document.util';
import { Employee } from './employee.entity';
import { employeeRepository, type EmployeeRepository } from './employee.repository';
import type { CreateEmployeeDTO, UpdateEmployeeDTO } from './employee.schema';

export class EmployeeService extends CondominiumScopedService<
  Employee,
  CreateEmployeeDTO,
  UpdateEmployeeDTO
> {
  constructor(repository: EmployeeRepository = employeeRepository) {
    super(repository, { resource: 'employee', label: 'Funcionario' });
  }

  protected override async prepareCreate(
    _ctx: RequestContext,
    dto: CreateEmployeeDTO,
  ): Promise<DeepPartial<Employee>> {
    this.assertDocument(dto.document ?? null);
    this.assertContractDates(dto.admissionDate ?? null, dto.terminationDate ?? null);
    return dto as DeepPartial<Employee>;
  }

  protected override async prepareUpdate(
    _ctx: RequestContext,
    current: Employee,
    dto: UpdateEmployeeDTO,
  ): Promise<DeepPartial<Employee>> {
    if (dto.document) this.assertDocument(dto.document);
    this.assertContractDates(
      dto.admissionDate ?? current.admissionDate ?? null,
      dto.terminationDate ?? current.terminationDate ?? null,
    );

    // Desligamento registrado sem data assume a data de hoje.
    if (dto.status === 'TERMINATED' && !dto.terminationDate && !current.terminationDate) {
      return { ...dto, terminationDate: new Date().toISOString().slice(0, 10) } as DeepPartial<Employee>;
    }
    return dto as DeepPartial<Employee>;
  }

  private assertDocument(document: string | null): void {
    if (document && !isValidCpf(document)) {
      throw new BusinessRuleError('CPF informado e invalido.');
    }
  }

  private assertContractDates(admission: string | null, termination: string | null): void {
    if (admission && termination && termination < admission) {
      throw new BusinessRuleError('A data de desligamento nao pode ser anterior a admissao.');
    }
  }
}

export const employeeService = new EmployeeService();

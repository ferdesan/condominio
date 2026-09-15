/**
 * Camada de dados da tela de funcionarios: a fabrica do ADR-008 mais a consulta
 * que levanta os departamentos existentes, escrita ao lado da feature.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiGetPaginated, type ApiError } from '@/lib/api';
import { createResourceHooks, MAX_PER_PAGE } from '@/lib/crud';
import type { Employee } from '@/types/api';
import type { EmployeePayload } from './employee-schema';

export const employeeHooks = createResourceHooks<
  Employee,
  EmployeePayload,
  Partial<EmployeePayload>
>('employees');

/**
 * Whitelist do `EmployeeRepository`. Um filtro fora dela o backend descarta em
 * silencio, e o controle pareceria funcionar sem fazer nada — por isso nada fora
 * desta lista pode virar controle na tela.
 *
 * Vive aqui, e nao em `lib/crud/query-params.ts`, porque aquela camada e
 * compartilhada e nao muda por causa de uma tela nova.
 */
export const employeeFilters = ['condominiumId', 'status', 'department', 'contractType'] as const;

/**
 * Departamentos ja usados no condominio selecionado.
 *
 * `department` e texto livre e o servidor o compara por igualdade exata — um
 * campo de digitacao livre so acertaria o filtro por coincidencia de grafia.
 * Levantar os valores existentes e o que torna o controle utilizavel, e a
 * origem certa deles sao os proprios funcionarios.
 *
 * Fica fora da fabrica de proposito (ADR-008): o que se quer e a colecao inteira
 * de uma vez, e nao uma pagina navegavel. A chave comeca com `employees`, entao
 * cadastrar alguem de um departamento novo ja invalida esta consulta junto com a
 * listagem.
 */
export function useDepartmentOptions(
  condominiumId: string | null,
): UseQueryResult<string[], ApiError> {
  return useQuery<string[], ApiError>({
    queryKey: ['employees', 'departments', condominiumId],
    queryFn: async () => {
      const page = await apiGetPaginated<Employee>('/employees', {
        params: {
          perPage: MAX_PER_PAGE,
          condominiumId: condominiumId ?? '',
          sortBy: 'department',
          sortOrder: 'ASC',
        },
      });
      const names = page.data
        .map((employee) => employee.department?.trim())
        .filter((name): name is string => Boolean(name));
      return [...new Set(names)];
    },
    enabled: Boolean(condominiumId),
  });
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, SearchX, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { formatCurrency, formatDate, formatDocument, formatPhone } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Employee } from '@/types/api';
import { employeeFilters, employeeHooks, useDepartmentOptions } from './employee-hooks';
import { normaliseDocument } from './employee-schema';
import { CONTRACT_TYPE_LABELS, STATUS_LABELS } from './employee-labels';
import { EmployeeFilters } from './components/employee-filters';
import { EmployeeFormDialog } from './components/employee-form-dialog';
import { EmployeeRowActions } from './components/employee-row-actions';

const STATUS_VARIANTS: Record<Employee['status'], 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  TERMINATED: 'neutral',
};

/**
 * `employee: null` cadastra; um registro edita. Ausente mantem o dialogo fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { employee: Employee | null; condominiumId: string } | null;

export function EmployeesPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('employee:create');
  const canUpdate = can('employee:update');
  const canDelete = can('employee:delete');

  const departmentsQuery = useDepartmentOptions(selectedId);
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);

  /**
   * Todo pedido carrega o condominio do shell. `pickFilters` descarta o que
   * estiver fora da whitelist do servidor antes que vire uma query inocua, e o
   * termo de busca passa pela normalizacao de documento — CPFs sao guardados sem
   * pontuacao.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      search: base.search ? normaliseDocument(base.search) : undefined,
      filters: {
        ...pickFilters(employeeFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = employeeHooks.useList(params, { enabled: Boolean(selectedId) });
  const remove = employeeHooks.useRemove();
  const restore = employeeHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage, setFilter } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  // Departamentos nao atravessam condominios: trocar a selecao do shell torna o
  // departamento filtrado inexistente aqui.
  const previousCondominium = useRef(selectedId);
  useEffect(() => {
    if (previousCondominium.current === selectedId) return;
    previousCondominium.current = selectedId;
    setFilter('department', undefined);
  }, [selectedId, setFilter]);

  // O ultimo funcionario de um departamento pode ter saido enquanto o filtro
  // seguia ativo. Manter a chave devolveria uma lista vazia sem explicacao.
  const departmentFilter = list.filters.department;
  useEffect(() => {
    if (typeof departmentFilter !== 'string' || departmentFilter === '') return;
    if (!departmentsQuery.isSuccess) return;
    if (departments.includes(departmentFilter)) return;
    setFilter('department', undefined);
  }, [departmentFilter, departments, departmentsQuery.isSuccess, setFilter]);

  /**
   * As acoes de linha nao passam `onError`, entao herdam o toast global — que e a
   * apresentacao certa para um 409 que traz so a mensagem do servidor. O que
   * falta e atualizar a lista: `onSuccess` nao roda quando a recusa chega, e
   * tanto o 404 quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  }

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      label: 'Nome',
      sortable: true,
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <span className={row.deletedAt ? 'line-through' : undefined}>{row.name}</span>
          {/* A tarja nomeia o estado: cor sozinha nao distingue removido de ativo. */}
          {row.deletedAt ? <Badge variant="destructive">Removido</Badge> : null}
        </div>
      ),
    },
    { key: 'position', label: 'Cargo', sortable: true },
    {
      key: 'department',
      label: 'Departamento',
      sortable: true,
      render: (_value, row) => row.department ?? '—',
    },
    {
      key: 'contractType',
      label: 'Contrato',
      sortable: true,
      render: (_value, row) => CONTRACT_TYPE_LABELS[row.contractType],
    },
    {
      key: 'document',
      label: 'CPF',
      sortable: true,
      render: (_value, row) => formatDocument(row.document),
    },
    {
      key: 'phone',
      label: 'Telefone',
      render: (_value, row) => formatPhone(row.phone),
    },
    {
      key: 'admissionDate',
      label: 'Admissao',
      render: (_value, row) => formatDate(row.admissionDate),
    },
    {
      // Salario e dado sensivel: entra na listagem sem destaque nenhum, em
      // tipografia secundaria, para nao ser a primeira coisa que se le de uma
      // tela aberta em balcao de portaria.
      key: 'salary',
      label: 'Salario',
      render: (_value, row) => (
        <span className="text-muted-foreground">{formatCurrency(row.salary)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => (
        <Badge variant={STATUS_VARIANTS[row.status]}>{STATUS_LABELS[row.status]}</Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <EmployeeRowActions
          employee={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={(employee) => setFormTarget({ employee, condominiumId: employee.condominiumId })}
          onDelete={setDeleting}
          onRestore={(employee) => restore.mutate(employee.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Funcionários" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condominio"
              description="Os funcionarios sao listados por condominio. Escolha um no topo da tela para continuar."
            />
          </div>
        }
      />
    );
  }

  return (
    <>
      <CrudLayout
        header={
          <PageHeader
            title="Funcionários"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button
                  onClick={() => setFormTarget({ employee: null, condominiumId: selectedId })}
                >
                  Novo funcionario
                </Button>
              ) : undefined
            }
          />
        }
        filters={<EmployeeFilters list={list} departments={departments} />}
        content={
          <div className="p-4 space-y-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum funcionario corresponde aos termos e filtros aplicados."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        list.setSearch('');
                        list.clearFilters();
                      }}
                    >
                      Limpar busca
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={UserCog}
                  title="Nenhum funcionario cadastrado"
                  description="Cadastre o primeiro funcionario para saber quem trabalha no condominio."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() => setFormTarget({ employee: null, condominiumId: selectedId })}
                      >
                        Cadastrar funcionario
                      </Button>
                    ) : undefined
                  }
                />
              )
            ) : (
              <DataTable
                columns={columns}
                data={rows}
                idKey="id"
                loading={query.isPending}
                // A busca mora no painel de filtros, junto dos demais controles.
                searchable={false}
                sort={list.sort}
                onSort={list.setSort}
                pageable
                pageSize={DEFAULT_PER_PAGE}
                currentPage={page}
                totalPages={totalPages ?? 1}
                onPageChange={setPage}
                rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
              />
            )}
          </div>
        }
      />

      {formTarget ? (
        // O condominio e o da abertura: trocar a selecao do shell com o
        // formulario aberto nao pode mudar para onde ele grava (US-027.EC-3).
        <EmployeeFormDialog
          key={formTarget.employee?.id ?? 'new'}
          employee={formTarget.employee ?? undefined}
          condominiumId={formTarget.condominiumId}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir funcionario?"
        description={
          deleting
            ? `${deleting.name} deixara de aparecer na listagem e nos quadros de pessoal. A exclusao e logica e pode ser desfeita.`
            : undefined
        }
        actionLabel="Excluir"
        loading={removing}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          // O `isPending` da mutacao so muda no proximo tick, entao dois cliques
          // no mesmo passariam os dois. O trinco fecha na hora.
          if (!deleting || removingRef.current) return;
          removingRef.current = true;
          setRemoving(true);
          remove.mutate(deleting.id, {
            onError: refreshOnRefusal,
            onSettled: () => {
              removingRef.current = false;
              setRemoving(false);
              setDeleting(null);
            },
          });
        }}
      />
    </>
  );
}

const DESCRIPTION = 'Quem trabalha no condominio selecionado, e sob que vinculo.';

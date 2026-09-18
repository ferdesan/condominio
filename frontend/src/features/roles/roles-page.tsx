import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import type { ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import type { Role } from '@/types/role';
import { roleFilters, roleHooks, ROLES_KEY } from './role-hooks';
import { CUSTOM_ROLE, SYSTEM_ROLE } from './role-labels';
import { WILDCARD } from './role-schema';
import { RoleFilters } from './components/role-filters';
import { RoleFormDialog } from './components/role-form-dialog';
import { RolePermissionsDialog } from './components/role-permissions-dialog';
import { RoleRowActions } from './components/role-row-actions';

const DESCRIPTION =
  'O que cada papel permite. Os cinco papéis do sistema sao fixos; a administradora pode criar outros combinando as permissões do catálogo.';

/** Recusa do servidor apresentada na linha que a provocou. */
type RowError = { id: string; message: string } | null;

/**
 * O que o formulario faz quando abre; `null` o mantem fechado.
 *
 * Duplicar carrega o papel de origem como `edit`, e por isso o modo nao pode ser
 * deduzido da presenca dele: sao a mesma entrada com destinos opostos — um
 * altera o papel, o outro cadastra um novo com as permissoes dele.
 */
type FormIntent = { mode: 'create' } | { mode: 'edit' | 'duplicate'; role: Role };

/**
 * Papeis de acesso do tenant.
 *
 * **Fecha a lacuna mais antiga do controle de acesso:** dava para *atribuir* um
 * papel a alguem, na tela de Usuarios, e nao dava para ver o que aquele papel
 * permitia — nem criar um novo, nem ajustar um existente. O catalogo de
 * permissoes do servidor nunca tinha sido lido pela interface.
 *
 * **Por tenant, e nao por condominio**, como Usuarios e Auditoria. Nenhuma
 * requisicao daqui carrega a chave de condominio, e a tela nao muda com o
 * seletor do shell.
 *
 * **Compartilha a familia de chaves com o seletor da tela de Usuarios.** A
 * fabrica invalida `[ROLES_KEY]` a cada mutacao, e o prefixo alcanca
 * `['roles', 'options']` — criar um papel aqui faz a tela de Usuarios passar a
 * oferece-lo, sem codigo extra.
 */
export function RolesPage() {
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const list = useListState();
  const [form, setForm] = useState<FormIntent | null>(null);
  const [viewing, setViewing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);
  const [rowError, setRowError] = useState<RowError>(null);

  const canCreate = can('role:create');
  const canUpdate = can('role:update');
  const canDelete = can('role:delete');

  /**
   * Espelha `ctx.scope.superAdmin` do servidor, que e literalmente
   * `roleName === 'SUPER_ADMIN'` (`auth-context.service.ts:66`). Nao e um
   * palpite: e a mesma condicao, do outro lado.
   */
  const canGrantWildcard = user?.role === 'SUPER_ADMIN';

  /**
   * `pickFilters` descarta o que estiver fora da whitelist do servidor antes que
   * vire uma query inocua — e a whitelist deste recurso tem uma chave so.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return { ...base, filters: pickFilters(roleFilters, base.filters ?? {}) };
  }, [list]);

  // Sem `enabled`: a listagem nao depende de nenhuma escolha no shell.
  const query = roleHooks.useList(params);
  const remove = roleHooks.useRemove();
  const restore = roleHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  /**
   * A recusa descreve um estado que a tela ainda nao reflete — o papel pode ter
   * ganhado usuarios enquanto a lista estava aberta.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: [ROLES_KEY] });
  }

  function confirmDelete(): void {
    if (!deleting || removingRef.current) return;
    removingRef.current = true;
    setRemoving(true);
    setRowError(null);
    const target = deleting;

    remove.mutate(target.id, {
      onError: (error: ApiError) => {
        // A recusa mais comum e "existem N usuario(s) com este papel", que se
        // resolve na tela de Usuarios. Ela pertence a linha, e nao a um toast
        // que some antes de ser lido.
        setRowError({ id: target.id, message: error.message });
        refreshOnRefusal();
      },
      onSettled: () => {
        removingRef.current = false;
        setRemoving(false);
        setDeleting(null);
      },
    });
  }

  const columns: Column<Role>[] = [
    {
      key: 'name',
      label: 'Papel',
      sortable: true,
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <span className={row.deletedAt ? 'line-through' : undefined}>{row.name}</span>
          {/* A tarja nomeia o estado: cor sozinha nao distingue removido de ativo. */}
          {row.deletedAt ? <Badge variant="destructive">Removido</Badge> : null}
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Descrição',
      sortable: true,
      render: (_value, row) => row.description ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'isSystem',
      label: 'Origem',
      sortable: true,
      render: (_value, row) => (
        // Papel do sistema nao pode ser renomeado, ter permissoes alteradas nem
        // ser removido. A distincao muda o que as acoes fazem, entao ela precisa
        // aparecer antes de alguem tentar.
        <Badge variant={row.isSystem ? 'neutral' : 'default'}>
          {row.isSystem ? SYSTEM_ROLE : CUSTOM_ROLE}
        </Badge>
      ),
    },
    {
      // Nao ordenavel: `permissions` e um JSON, e nao um campo do conjunto
      // ordenavel do servidor — a chave seria descartada em silencio.
      key: 'permissions',
      label: 'Permissões',
      render: (_value, row) =>
        row.permissions.includes(WILDCARD) ? (
          <Badge variant="warning">Acesso total</Badge>
        ) : (
          `${row.permissions.length}`
        ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_value, row) => (
        <RoleRowActions
          role={row}
          canUpdate={canUpdate}
          canCreate={canCreate}
          canDelete={canDelete}
          error={rowError?.id === row.id ? rowError.message : undefined}
          onViewPermissions={setViewing}
          onEdit={(role) => setForm({ mode: 'edit', role })}
          onDuplicate={(role) => setForm({ mode: 'duplicate', role })}
          onDelete={setDeleting}
          onRestore={(role) => restore.mutate(role.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  return (
    <>
      <CrudLayout
        header={
          <PageHeader
            title="Papéis"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button onClick={() => setForm({ mode: 'create' })}>Novo papel</Button>
              ) : undefined
            }
          />
        }
        filters={<RoleFilters list={list} />}
        content={
          <div className="space-y-4 p-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum papel corresponde aos termos e filtros aplicados."
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
                // Improvavel: os cinco do sistema sao semeados por tenant. Se a
                // lista vier vazia, algo aconteceu com a semente.
                <EmptyState
                  icon={KeyRound}
                  title="Nenhum papel cadastrado"
                  description="Os papéis do sistema sao semeados para cada administradora; nenhum foi encontrado."
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
                emptyIcon={KeyRound}
                rowClassName={(row) => (row.deletedAt ? 'opacity-60' : '')}
              />
            )}
          </div>
        }
      />

      {/*
        `key` no modo e no id: os valores iniciais entram uma vez, e um refetch da
        lista nao sobrescreve o que já foi marcado na matriz. O modo entra na
        chave porque editar e duplicar o **mesmo** papel sao dois formularios
        diferentes — sem ele, ir de um para o outro reaproveitaria a montagem e
        manteria os valores do anterior.
      */}
      {form ? (
        <RoleFormDialog
          key={`${form.mode}:${form.mode === 'create' ? 'new' : form.role.id}`}
          {...form}
          canGrantWildcard={canGrantWildcard}
          onClose={() => setForm(null)}
        />
      ) : null}

      {viewing ? <RolePermissionsDialog role={viewing} onClose={() => setViewing(null)} /> : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir este papel?"
        description={
          deleting
            ? `${deleting.name} será removido. Se houver usuários com este papel, o servidor recusa até que eles sejam reatribuidos.`
            : undefined
        }
        actionLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        loading={removing}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

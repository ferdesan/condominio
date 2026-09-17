import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SearchX, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { formatPhone } from '@/lib/format';
import type { ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { User } from '@/types/user';
import {
  unitLabel,
  useResetUserPassword,
  useRoleOptions,
  useUnitOptions,
  userFilters,
  userHooks,
  USERS_KEY,
} from './user-hooks';
import { ALL_CONDOMINIUMS, NO_ROLE, NO_UNIT, UNIT_UNAVAILABLE } from './user-labels';
import { UserFilters } from './components/user-filters';
import { UserFormDialog } from './components/user-form-dialog';
import { UserRowActions } from './components/user-row-actions';
import { UserStatusBadge } from './components/user-status-badge';

const DESCRIPTION =
  'Quem tem acesso a administracao: o papel de cada um, os predios que enxerga e o estado da conta.';

/** Recusa do servidor apresentada na linha que a provocou. */
type RowError = { id: string; message: string } | null;

/** Senha temporaria recem-gerada. Volta uma unica vez e some ao fechar. */
type ResetResult = { name: string; temporaryPassword?: string } | null;

/**
 * Administracao de usuarios do tenant.
 *
 * **Esta e a unica tela deste tier que nao segue o condominio do shell.**
 * `/users` e por tenant: nem o repositorio o escopa por condominio, nem
 * `condominiumId` esta entre os filtros que ele aceita. Por isso nao ha estado
 * de "selecione um condominio" aqui, nenhuma requisicao carrega a chave, e o
 * `CondominiumScopeNotice` nao se aplica ao formulario — um usuario pertence a
 * administradora, e os predios que ele enxerga sao um vinculo que se escolhe, e
 * nao um escopo que se herda da tela.
 */
export function UsersPage() {
  const { can, user: currentUser } = useAuth();
  // Apenas a colecao, para os vinculos do formulario: esta tela nao le
  // `selectedId` em lugar nenhum, e nao consulta condominios.
  const { condominiums } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<User | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);
  const [resetting, setResetting] = useState<User | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const resetRef = useRef(false);
  const [resetResult, setResetResult] = useState<ResetResult>(null);
  const [rowError, setRowError] = useState<RowError>(null);

  const canCreate = can('user:create');
  const canUpdate = can('user:update');
  const canDelete = can('user:delete');
  // Resetar senha exige `user:manage`, e nao `update`: um papel que corrige um
  // telefone nao necessariamente pode derrubar as sessoes de outra pessoa
  // (ADR-002). E a mesma divisao que `user.routes.ts` faz.
  const canManage = can('user:manage');

  const rolesQuery = useRoleOptions();
  const roles = useMemo(() => rolesQuery.data?.data ?? [], [rolesQuery.data]);
  const unitsQuery = useUnitOptions();
  const units = useMemo(() => unitsQuery.data?.data ?? [], [unitsQuery.data]);
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

  /**
   * Nenhum condominio entra aqui. `pickFilters` descarta o que estiver fora da
   * whitelist do servidor antes que vire uma query inocua — e a whitelist deste
   * recurso tem tres chaves, nenhuma delas de condominio.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return { ...base, filters: pickFilters(userFilters, base.filters ?? {}) };
  }, [list]);

  // Sem `enabled`: a listagem nao depende de nenhuma escolha no shell, e sai
  // assim que a tela monta.
  const query = userHooks.useList(params);
  const remove = userHooks.useRemove();
  const restore = userHooks.useRestore();

  /**
   * A recusa do reset descreve algo sobre esta conta — o usuario pode ter sido
   * removido enquanto a lista estava aberta.
   *
   * Definir `onError` aqui substitui o toast global do React Query v5, que e o
   * que se quer: a mensagem ja tem onde aparecer e nao deve aparecer duas vezes.
   */
  const resetPassword = useResetUserPassword({
    onError: (error: ApiError, variables) =>
      setRowError({ id: variables.id, message: error.message }),
  });

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  /**
   * Exclusao e restauracao nao passam `onError`, entao herdam o toast global —
   * que e a apresentacao certa para um 409 que traz so a mensagem. O que falta e
   * atualizar a lista: `onSuccess` nao roda quando a recusa chega, e tanto o 404
   * quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
  }

  /**
   * Os condominios vinculados, ditos por extenso.
   *
   * Lista vazia significa acesso a todos do tenant, e nao a nenhum: e como
   * perfis administrativos sao cadastrados, e e a leitura que o proprio servidor
   * faz. Um traco aqui diria o oposto do que o registro significa.
   */
  function condominiumsCell(row: User) {
    const linked = row.condominiums ?? [];
    if (linked.length === 0) {
      return <span className="text-muted-foreground">{ALL_CONDOMINIUMS}</span>;
    }
    return linked.map((item) => item.name).join(', ');
  }

  /**
   * As tres situacoes da unidade, ditas por extenso.
   *
   * A listagem traz so o id — `UserRepository` carrega `role` e `condominiums`,
   * mas nao a unidade —, entao o nome sai da colecao ja carregada para o filtro.
   * Enquanto ela nao chegou, a celula usa o placeholder neutro: anunciar
   * "indisponivel" antes de ter procurado seria falso.
   */
  function unitCell(row: User) {
    if (!row.unitId) return <span className="text-muted-foreground">{NO_UNIT}</span>;
    if (!unitsQuery.isSuccess) return '—';
    const unit = unitsById.get(row.unitId);
    if (!unit) return <span className="text-muted-foreground">{UNIT_UNAVAILABLE}</span>;
    return unitLabel(unit);
  }

  const columns: Column<User>[] = [
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
    { key: 'email', label: 'E-mail', sortable: true },
    {
      key: 'phone',
      label: 'Telefone',
      sortable: true,
      render: (_value, row) => (row.phone ? formatPhone(row.phone) : '—'),
    },
    {
      // O papel vem aninhado na resposta (`UserRepository.relations`), entao a
      // celula nao precisa de uma segunda consulta para nomea-lo.
      key: 'roleId',
      label: 'Papel',
      sortable: true,
      render: (_value, row) =>
        row.role?.name ?? <span className="text-muted-foreground">{NO_ROLE}</span>,
    },
    {
      // Tambem aninhado. Nao e ordenavel: `condominiums` e uma relacao, e nao um
      // campo — o servidor descartaria a chave e voltaria a ordem padrao.
      key: 'condominiums',
      label: 'Condominios',
      render: (_value, row) => condominiumsCell(row),
    },
    {
      key: 'unitId',
      label: 'Unidade',
      sortable: true,
      render: (_value, row) => unitCell(row),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => <UserStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <UserRowActions
          user={row}
          canUpdate={canUpdate}
          canManage={canManage}
          canDelete={canDelete}
          error={rowError?.id === row.id ? rowError.message : undefined}
          onResetPassword={setResetting}
          onEdit={setFormTarget}
          onDelete={setDeleting}
          onRestore={(user) => restore.mutate(user.id, { onError: refreshOnRefusal })}
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
            title="Usuários"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button onClick={() => setFormTarget(null)}>Novo usuario</Button>
              ) : undefined
            }
          />
        }
        filters={<UserFilters list={list} roles={roles} units={units} />}
        content={
          <div className="p-4 space-y-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum usuario corresponde aos termos e filtros aplicados."
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
                  icon={ShieldCheck}
                  title="Nenhum usuario cadastrado"
                  description="Nenhuma conta foi criada nesta administradora ate agora."
                  action={
                    canCreate ? (
                      <Button onClick={() => setFormTarget(null)}>Convidar usuario</Button>
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
                emptyIcon={ShieldCheck}
                rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
              />
            )}
          </div>
        }
      />

      {formTarget !== undefined ? (
        <UserFormDialog
          key={formTarget?.id ?? 'new'}
          user={formTarget ?? undefined}
          roles={roles}
          units={units}
          condominiums={condominiums}
          onClose={() => setFormTarget(undefined)}
        />
      ) : null}

      {/*
        Resetar senha e irreversivel e derruba as sessoes ativas de outra pessoa:
        pedir confirmacao e parte da acao, e nao um enfeite. Dispensar o dialogo
        nao dispara requisicao nenhuma.
      */}
      <ConfirmDialog
        open={resetting !== null}
        title="Resetar a senha?"
        description={
          resetting
            ? `${resetting.name} perdera o acesso atual: as sessoes ativas caem, uma senha temporaria e gerada e a troca passa a ser exigida no proximo acesso. A senha atual nao pode ser recuperada.`
            : undefined
        }
        actionLabel="Resetar senha"
        variant="warning"
        loading={resetPending}
        onCancel={() => setResetting(null)}
        onConfirm={() => {
          // O `isPending` da mutacao so muda no proximo tick, entao dois cliques
          // no mesmo passariam os dois. O trinco fecha na hora.
          if (!resetting || resetRef.current) return;
          const target = resetting;
          resetRef.current = true;
          setResetPending(true);
          setRowError(null);
          resetPassword.mutate(
            { id: target.id },
            {
              onSuccess: (data) =>
                setResetResult({ name: target.name, temporaryPassword: data.temporaryPassword }),
              onSettled: () => {
                resetRef.current = false;
                setResetPending(false);
                setResetting(null);
              },
            },
          );
        }}
      />

      {/*
        A senha temporaria volta uma unica vez — o servidor guarda so o hash —,
        entao ela precisa aparecer aqui antes que a tela siga adiante. Nada a
        registra em lugar nenhum.
      */}
      <Dialog
        open={resetResult !== null}
        onOpenChange={(next) => {
          if (!next) setResetResult(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha temporaria gerada</DialogTitle>
            <DialogDescription>
              Ela aparece uma unica vez. Entregue-a a {resetResult?.name} por um canal seguro; no
              proximo acesso o sistema exige a troca.
            </DialogDescription>
          </DialogHeader>

          {resetResult?.temporaryPassword ? (
            <p className="rounded-md border bg-muted px-3 py-2 text-center font-mono text-lg tracking-wider">
              {resetResult.temporaryPassword}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              A senha foi redefinida e as sessoes ativas foram encerradas.
            </p>
          )}

          <DialogFooter>
            <Button type="button" onClick={() => setResetResult(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir usuario?"
        description={
          deleting
            ? `${deleting.name} deixara de aparecer na listagem e perdera o acesso. A exclusao e logica e pode ser desfeita.${
                deleting.id === currentUser?.id
                  ? ' Esta e a sua propria conta: o servidor recusa a exclusao.'
                  : ''
              }`
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

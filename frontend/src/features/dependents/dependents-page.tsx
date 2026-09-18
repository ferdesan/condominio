import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Contact, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { formatDate, formatDocument, formatPhone } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Dependent, Unit } from '@/types/api';
import { dependentFilters, dependentHooks, useResidentOptions } from './dependent-hooks';
import { normaliseDocument } from './dependent-schema';
import { RELATIONSHIP_LABELS, unitLabel } from './dependent-labels';
import { DependentFilters } from './components/dependent-filters';
import { DependentFormDialog } from './components/dependent-form-dialog';
import { DependentRowActions } from './components/dependent-row-actions';

/**
 * `dependent: null` cadastra; um registro edita. Ausente mantem o dialogo fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { dependent: Dependent | null; condominiumId: string } | null;

export function DependentsPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<Dependent | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('dependent:create');
  const canUpdate = can('dependent:update');
  const canDelete = can('dependent:delete');

  const residentsQuery = useResidentOptions(selectedId);
  const residents = useMemo(() => residentsQuery.data?.data ?? [], [residentsQuery.data]);

  /**
   * As unidades que importam aqui sao as dos moradores: o servidor recusa um
   * dependente que nao esteja na unidade do titular, entao uma unidade sem
   * morador nao tem dependente para filtrar nem numero para exibir.
   */
  const units = useMemo(() => {
    const byId = new Map<string, Unit>();
    for (const resident of residents) {
      if (resident.unit) byId.set(resident.unit.id, resident.unit);
    }
    return byId;
  }, [residents]);
  const unitList = useMemo(() => [...units.values()], [units]);

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
        ...pickFilters(dependentFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = dependentHooks.useList(params, { enabled: Boolean(selectedId) });
  const remove = dependentHooks.useRemove();
  const restore = dependentHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage, setFilter } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  // Moradores e unidades nao atravessam condominios: trocar a selecao do shell
  // torna as chaves filtradas inexistentes aqui.
  const previousCondominium = useRef(selectedId);
  useEffect(() => {
    if (previousCondominium.current === selectedId) return;
    previousCondominium.current = selectedId;
    setFilter('residentId', undefined);
    setFilter('unitId', undefined);
  }, [selectedId, setFilter]);

  // O morador ou a unidade filtrada podem ter sido removidos enquanto o filtro
  // seguia ativo. Manter a chave devolveria uma lista vazia sem explicacao.
  const residentFilter = list.filters.residentId;
  const unitFilter = list.filters.unitId;
  useEffect(() => {
    if (!residentsQuery.isSuccess) return;
    if (typeof residentFilter === 'string' && residentFilter !== '') {
      if (!residents.some((resident) => resident.id === residentFilter)) {
        setFilter('residentId', undefined);
      }
    }
    if (typeof unitFilter === 'string' && unitFilter !== '' && !units.has(unitFilter)) {
      setFilter('unitId', undefined);
    }
  }, [residentFilter, unitFilter, residents, units, residentsQuery.isSuccess, setFilter]);

  /**
   * As acoes de linha nao passam `onError`, entao herdam o toast global — que e a
   * apresentacao certa para um 409 que traz so a mensagem do servidor. O que
   * falta e atualizar a lista: `onSuccess` nao roda quando a recusa chega, e
   * tanto o 404 quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: ['dependents'] });
  }

  const columns: Column<Dependent>[] = [
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
    {
      // A listagem ja traz o morador embutido, mas ele pode ter sido removido —
      // e ai o vinculo continua existindo sem ninguem para nomea-lo.
      key: 'residentId',
      label: 'Morador',
      render: (_value, row) =>
        row.resident ? (
          row.resident.name
        ) : (
          <span className="text-muted-foreground">Morador removido</span>
        ),
    },
    {
      // A unidade nao vem embutida na resposta: o servidor carrega o morador, e
      // nao a unidade dele. O numero sai do mesmo mapa que alimenta o filtro.
      key: 'unitId',
      label: 'Unidade',
      render: (_value, row) => {
        const unit = units.get(row.unitId);
        return unit ? unitLabel(unit) : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: 'relationship',
      label: 'Parentesco',
      sortable: true,
      render: (_value, row) => RELATIONSHIP_LABELS[row.relationship],
    },
    {
      key: 'document',
      label: 'CPF',
      sortable: true,
      render: (_value, row) => formatDocument(row.document),
    },
    {
      key: 'birthDate',
      label: 'Nascimento',
      render: (_value, row) => formatDate(row.birthDate),
    },
    {
      key: 'phone',
      label: 'Telefone',
      render: (_value, row) => formatPhone(row.phone),
    },
    {
      key: 'hasAccessCard',
      label: 'Cartao de acesso',
      render: (_value, row) => (row.hasAccessCard ? 'Sim' : 'Não'),
    },
    {
      key: 'active',
      label: 'Situação',
      sortable: true,
      render: (_value, row) => (
        <Badge variant={row.active ? 'success' : 'neutral'}>
          {row.active ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_value, row) => (
        <DependentRowActions
          dependent={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={(dependent) =>
            setFormTarget({ dependent, condominiumId: dependent.condominiumId })
          }
          onDelete={setDeleting}
          onRestore={(dependent) => restore.mutate(dependent.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;
  // Sem morador nao ha a quem vincular um dependente, e o servidor exige um.
  const hasNoResidents = residentsQuery.isSuccess && residents.length === 0;
  const canOpenForm = canCreate && !hasNoResidents;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Dependentes" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condomínio"
              description="Os dependentes sao listados por condomínio. Escolha um no topo da tela para continuar."
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
            title="Dependentes"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button
                  disabled={hasNoResidents}
                  title={hasNoResidents ? NO_RESIDENTS_HINT : undefined}
                  onClick={() => setFormTarget({ dependent: null, condominiumId: selectedId })}
                >
                  Novo dependente
                </Button>
              ) : undefined
            }
          />
        }
        filters={<DependentFilters list={list} residents={residents} units={unitList} />}
        content={
          <div className="p-4 space-y-4">
            {hasNoResidents ? (
              <p
                role="alert"
                className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
              >
                {NO_RESIDENTS_HINT}
              </p>
            ) : null}

            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum dependente corresponde aos termos e filtros aplicados."
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
                  icon={Contact}
                  title="Nenhum dependente cadastrado"
                  description="Cadastre o primeiro dependente para saber quem mais ocupa cada unidade."
                  action={
                    canOpenForm ? (
                      <Button
                        onClick={() =>
                          setFormTarget({ dependent: null, condominiumId: selectedId })
                        }
                      >
                        Cadastrar dependente
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
        <DependentFormDialog
          key={formTarget.dependent?.id ?? 'new'}
          dependent={formTarget.dependent ?? undefined}
          condominiumId={formTarget.condominiumId}
          residents={residents}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir dependente?"
        description={
          deleting
            ? `${deleting.name} deixara de aparecer na listagem e perdera o acesso vinculado ao morador titular. A exclusao e logica e pode ser desfeita.`
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

const DESCRIPTION = 'Quem mais mora com os moradores do condomínio selecionado.';

const NO_RESIDENTS_HINT =
  'Cadastre ao menos um morador antes de registrar dependentes: todo dependente e vinculado a um morador.';

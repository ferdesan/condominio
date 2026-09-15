import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, SearchX, Users } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_PER_PAGE,
  pickFilters,
  residentFilters,
  useListState,
  type ListParams,
} from '@/lib/crud';
import { formatDocument, formatPhone } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Resident } from '@/types/api';
import { residentHooks, useUnitOptions } from './resident-hooks';
import { normaliseDocument } from './resident-schema';
import { STATUS_LABELS, TYPE_LABELS } from './resident-labels';
import { ResidentFilters } from './components/resident-filters';
import { ResidentFormDialog } from './components/resident-form-dialog';
import { ResidentRowActions } from './components/resident-row-actions';

const STATUS_VARIANTS: Record<Resident['status'], 'success' | 'neutral' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  MOVED_OUT: 'warning',
};

/**
 * `resident: null` cadastra; um registro edita. Ausente mantem o dialogo fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { resident: Resident | null; condominiumId: string } | null;

export function ResidentsPage() {
  const { can } = useAuth();
  const { selected, selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<Resident | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('resident:create');
  const canUpdate = can('resident:update');
  const canDelete = can('resident:delete');

  const unitsQuery = useUnitOptions(selectedId);
  const units = useMemo(() => unitsQuery.data?.data ?? [], [unitsQuery.data]);

  /**
   * Todo pedido carrega o condominio do shell. `pickFilters` descarta o que
   * estiver fora da whitelist do servidor antes que vire uma query inocua, e o
   * termo de busca passa pela normalizacao de documento — CPFs e telefones sao
   * guardados sem pontuacao.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      search: base.search ? normaliseDocument(base.search) : undefined,
      filters: {
        ...pickFilters(residentFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = residentHooks.useList(params, { enabled: Boolean(selectedId) });
  const remove = residentHooks.useRemove();
  const restore = residentHooks.useRestore();
  const designate = residentHooks.useUpdate();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage, setFilter } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  // Unidades nao atravessam condominios: trocar a selecao do shell torna a
  // unidade filtrada inexistente aqui (US-018.EC-3).
  const previousCondominium = useRef(selectedId);
  useEffect(() => {
    if (previousCondominium.current === selectedId) return;
    previousCondominium.current = selectedId;
    setFilter('unitId', undefined);
  }, [selectedId, setFilter]);

  // A unidade filtrada pode ter sido removida enquanto o filtro seguia ativo.
  // Manter a chave devolveria uma lista vazia sem explicacao (US-018.EC-2).
  const unitFilter = list.filters.unitId;
  useEffect(() => {
    if (typeof unitFilter !== 'string' || unitFilter === '') return;
    if (!unitsQuery.isSuccess) return;
    if (units.some((unit) => unit.id === unitFilter)) return;
    setFilter('unitId', undefined);
  }, [unitFilter, units, unitsQuery.isSuccess, setFilter]);

  /**
   * As acoes de linha nao passam `onError`, entao herdam o toast global — que e a
   * apresentacao certa para um 409 que traz so a mensagem do servidor. O que
   * falta e atualizar a lista: `onSuccess` nao roda quando a recusa chega, e
   * tanto o 404 quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: ['residents'] });
  }

  /**
   * A designacao e um campo do morador, nao um endpoint proprio: o servidor
   * limpa a marca de todos os outros da unidade na mesma operacao. Nao ha
   * coordenacao a escrever no cliente — ha cache a invalidar, e e a fabrica que
   * o faz, o que traz a lista ja com o anterior rebaixado.
   */
  function handleDesignatePrimary(resident: Resident): void {
    designate.mutate({ id: resident.id, data: { isPrimary: true } }, { onError: refreshOnRefusal });
  }

  const columns: Column<Resident>[] = [
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
      key: 'document',
      label: 'CPF',
      sortable: true,
      render: (_value, row) => formatDocument(row.document),
    },
    {
      key: 'unit',
      label: 'Unidade',
      // A listagem ja traz a unidade embutida, mas ela pode ter sido removida.
      // Dizer que sumiu e melhor do que uma celula vazia (US-013.EC-4).
      render: (_value, row) =>
        row.unit ? (
          unitLabel(row.unit.block?.name, row.unit.number)
        ) : (
          <span className="text-muted-foreground">Unidade removida</span>
        ),
    },
    {
      key: 'condominiumId',
      label: 'Condominio',
      render: () => selected?.name ?? '—',
    },
    {
      key: 'phone',
      label: 'Telefone',
      sortable: true,
      render: (_value, row) => formatPhone(row.phone),
    },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (_value, row) => TYPE_LABELS[row.type],
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
      // Coluna propria para que a ausencia de responsavel seja legivel: toda
      // linha da unidade mostrando o placeholder diz que nao ha nenhum, o que
      // uma marca so na linha certa deixaria implicito (US-016.EC-2, EC-4).
      key: 'isPrimary',
      label: 'Responsavel',
      render: (_value, row) =>
        row.isPrimary ? <Badge variant="default">Responsavel</Badge> : <span>—</span>,
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <ResidentRowActions
          resident={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={(resident) => setFormTarget({ resident, condominiumId: resident.condominiumId })}
          onDelete={setDeleting}
          onRestore={(resident) => restore.mutate(resident.id, { onError: refreshOnRefusal })}
          onDesignatePrimary={handleDesignatePrimary}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;
  // Sem unidade nao ha a que vincular um morador, e o servidor exige uma.
  const hasNoUnits = unitsQuery.isSuccess && units.length === 0;
  const canOpenForm = canCreate && !hasNoUnits;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Moradores" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condominio"
              description="Os moradores sao listados por condominio. Escolha um no topo da tela para continuar."
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
            title="Moradores"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button
                  disabled={hasNoUnits}
                  title={hasNoUnits ? NO_UNITS_HINT : undefined}
                  onClick={() => setFormTarget({ resident: null, condominiumId: selectedId })}
                >
                  Novo morador
                </Button>
              ) : undefined
            }
          />
        }
        filters={<ResidentFilters list={list} units={units} />}
        content={
          <div className="p-4 space-y-4">
            {hasNoUnits ? (
              <p
                role="alert"
                className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
              >
                {NO_UNITS_HINT}
              </p>
            ) : null}

            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum morador corresponde aos termos e filtros aplicados."
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
                  icon={Users}
                  title="Nenhum morador cadastrado"
                  description="Cadastre o primeiro morador para saber quem ocupa cada unidade."
                  action={
                    canOpenForm ? (
                      <Button
                        onClick={() => setFormTarget({ resident: null, condominiumId: selectedId })}
                      >
                        Cadastrar morador
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
        <ResidentFormDialog
          key={formTarget.resident?.id ?? 'new'}
          resident={formTarget.resident ?? undefined}
          condominiumId={formTarget.condominiumId}
          units={units}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir morador?"
        description={
          deleting
            ? `${deleting.name} deixara de aparecer na listagem e a ocupacao da unidade sera recalculada. A exclusao e logica e pode ser desfeita.`
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

const DESCRIPTION = 'Quem ocupa cada unidade do condominio selecionado.';

const NO_UNITS_HINT =
  'Cadastre ao menos uma unidade antes de registrar moradores: todo morador ocupa uma unidade.';

function unitLabel(blockName: string | undefined, number: string): string {
  return blockName ? `${blockName} - ${number}` : number;
}

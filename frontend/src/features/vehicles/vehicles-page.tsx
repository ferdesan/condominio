import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Car, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Vehicle } from '@/types/api';
import { useResidentOptions, useUnitOptions, vehicleFilters, vehicleHooks } from './vehicle-hooks';
import { formatPlate, normalisePlate } from './vehicle-schema';
import { NO_LINK, STATUS_LABELS, TYPE_LABELS, UNIT_REMOVED, unitLabel } from './vehicle-labels';
import { VehicleFilters } from './components/vehicle-filters';
import { VehicleFormDialog } from './components/vehicle-form-dialog';
import { VehicleRowActions } from './components/vehicle-row-actions';

const STATUS_VARIANTS: Record<Vehicle['status'], 'success' | 'neutral'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
};

/**
 * `vehicle: null` cadastra; um registro edita. Ausente mantem o dialogo fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { vehicle: Vehicle | null; condominiumId: string } | null;

export function VehiclesPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('vehicle:create');
  const canUpdate = can('vehicle:update');
  const canDelete = can('vehicle:delete');

  const unitsQuery = useUnitOptions(selectedId);
  const units = useMemo(() => unitsQuery.data?.data ?? [], [unitsQuery.data]);
  const residentsQuery = useResidentOptions(selectedId);
  const residents = useMemo(() => residentsQuery.data?.data ?? [], [residentsQuery.data]);

  /**
   * Todo pedido carrega o condominio do shell. `pickFilters` descarta o que
   * estiver fora da whitelist do servidor antes que vire uma query inocua, e o
   * termo de busca passa pela normalizacao de placa — placas sao guardadas em
   * caixa alta e sem separador.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      search: base.search ? normalisePlate(base.search) : undefined,
      filters: {
        ...pickFilters(vehicleFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = vehicleHooks.useList(params, { enabled: Boolean(selectedId) });
  const remove = vehicleHooks.useRemove();
  const restore = vehicleHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage, setFilter } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  // Unidades e moradores nao atravessam condominios: trocar a selecao do shell
  // torna inexistentes aqui os dois filtros de vinculo.
  const previousCondominium = useRef(selectedId);
  useEffect(() => {
    if (previousCondominium.current === selectedId) return;
    previousCondominium.current = selectedId;
    setFilter('unitId', undefined);
    setFilter('residentId', undefined);
  }, [selectedId, setFilter]);

  // O vinculo filtrado pode ter sido removido enquanto o filtro seguia ativo.
  // Manter a chave devolveria uma lista vazia sem explicacao.
  const unitFilter = list.filters.unitId;
  useEffect(() => {
    if (typeof unitFilter !== 'string' || unitFilter === '') return;
    if (!unitsQuery.isSuccess) return;
    if (units.some((unit) => unit.id === unitFilter)) return;
    setFilter('unitId', undefined);
  }, [unitFilter, units, unitsQuery.isSuccess, setFilter]);

  const residentFilter = list.filters.residentId;
  useEffect(() => {
    if (typeof residentFilter !== 'string' || residentFilter === '') return;
    if (!residentsQuery.isSuccess) return;
    if (residents.some((resident) => resident.id === residentFilter)) return;
    setFilter('residentId', undefined);
  }, [residentFilter, residents, residentsQuery.isSuccess, setFilter]);

  /**
   * As acoes de linha nao passam `onError`, entao herdam o toast global — que e a
   * apresentacao certa para um 409 que traz so a mensagem do servidor. O que
   * falta e atualizar a lista: `onSuccess` nao roda quando a recusa chega, e
   * tanto o 404 quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  }

  const columns: Column<Vehicle>[] = [
    {
      key: 'plate',
      label: 'Placa',
      sortable: true,
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <span className={row.deletedAt ? 'line-through' : undefined}>
            {formatPlate(row.plate)}
          </span>
          {/* A tarja nomeia o estado: cor sozinha nao distingue removido de ativo. */}
          {row.deletedAt ? <Badge variant="destructive">Removido</Badge> : null}
        </div>
      ),
    },
    { key: 'brand', label: 'Marca', sortable: true },
    { key: 'model', label: 'Modelo', sortable: true },
    { key: 'color', label: 'Cor' },
    { key: 'year', label: 'Ano' },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (_value, row) => TYPE_LABELS[row.type],
    },
    {
      // A listagem ja traz a unidade embutida, mas ha duas ausencias diferentes
      // a distinguir: veiculo sem dono cadastrado — que e um estado valido — e
      // vinculo cuja unidade foi removida depois. Uma celula vazia confundiria
      // os dois.
      key: 'unit',
      label: 'Unidade',
      render: (_value, row) => vehicleUnitCell(row),
    },
    { key: 'parkingSpot', label: 'Vaga', sortable: true },
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
        <VehicleRowActions
          vehicle={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={(vehicle) => setFormTarget({ vehicle, condominiumId: vehicle.condominiumId })}
          onDelete={setDeleting}
          onRestore={(vehicle) => restore.mutate(vehicle.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Veiculos" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condominio"
              description="Os veiculos sao listados por condominio. Escolha um no topo da tela para continuar."
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
            title="Veiculos"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button onClick={() => setFormTarget({ vehicle: null, condominiumId: selectedId })}>
                  Novo veiculo
                </Button>
              ) : undefined
            }
          />
        }
        filters={<VehicleFilters list={list} units={units} residents={residents} />}
        content={
          <div className="p-4 space-y-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum veiculo corresponde aos termos e filtros aplicados."
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
                  icon={Car}
                  title="Nenhum veiculo cadastrado"
                  description="Cadastre o primeiro veiculo para saber o que circula pela garagem."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() => setFormTarget({ vehicle: null, condominiumId: selectedId })}
                      >
                        Cadastrar veiculo
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
        <VehicleFormDialog
          key={formTarget.vehicle?.id ?? 'new'}
          vehicle={formTarget.vehicle ?? undefined}
          condominiumId={formTarget.condominiumId}
          units={units}
          residents={residents}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir veiculo?"
        description={
          deleting
            ? `${formatPlate(deleting.plate)} deixara de aparecer na listagem. A exclusao e logica e pode ser desfeita.`
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

const DESCRIPTION = 'Veiculos que circulam pelo condominio selecionado.';

/**
 * As tres situacoes da coluna de unidade, ditas por extenso.
 *
 * Sem `unitId` o veiculo nao tem dono cadastrado, e isso e legitimo. Com
 * `unitId` e sem `unit` a unidade referida sumiu — a coluna do banco e
 * `ON DELETE SET NULL`, mas um registro ja carregado ainda pode chegar assim.
 */
function vehicleUnitCell(vehicle: Vehicle) {
  if (!vehicle.unitId) return <span className="text-muted-foreground">{NO_LINK}</span>;
  if (!vehicle.unit) return <span className="text-muted-foreground">{UNIT_REMOVED}</span>;
  return unitLabel(vehicle.unit);
}

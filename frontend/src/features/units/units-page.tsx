import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, DoorOpen, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, MAX_PER_PAGE, useListState } from '@/lib/crud';
import { formatNumber } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Unit, UnitStatus } from '@/types/api';
import { UNITS_KEY, blockHooks, unitHooks } from './unit-hooks';
import { UNIT_STATUS_LABELS, UNIT_TYPE_LABELS } from './unit-schema';
import { UnitFilters } from './components/unit-filters';
import { UnitFormDialog } from './components/unit-form-dialog';
import { UnitRowActions } from './components/unit-row-actions';
import { BlockManagerDialog } from './components/block-manager-dialog';
import { BulkGenerateDialog } from './components/bulk-generate-dialog';
import { OccupancyIndicators } from './components/occupancy-indicators';

const STATUS_VARIANTS: Record<UnitStatus, 'success' | 'neutral' | 'warning' | 'destructive'> = {
  OCCUPIED: 'success',
  VACANT: 'neutral',
  RENOVATION: 'warning',
  BLOCKED: 'destructive',
};

/**
 * A referencia aos moradores que a listagem mostra. A unidade nao carrega os
 * moradores na resposta, mas o status ocupada/vaga e justamente o que o modulo
 * de moradores calcula a partir deles. Em reforma e bloqueada o calculo nao roda,
 * entao a celula nao afirma nada sobre moradores nesses dois casos.
 */
function residentsReference(status: UnitStatus): string {
  if (status === 'OCCUPIED') return 'Com moradores';
  if (status === 'VACANT') return 'Sem moradores';
  return '—';
}

/**
 * `unit: null` cadastra; um registro edita. Ausente mantem o dialogo fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { unit: Unit | null; condominiumId: string } | null;

export function UnitsPage() {
  const { can } = useAuth();
  const { selected } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  // A geracao em lote grava, entao guarda o condominio de abertura pelo mesmo motivo.
  const [generating, setGenerating] = useState<string | null>(null);
  // A gestao de blocos e uma listagem, nao um formulario: ela acompanha o
  // condominio do shell (IT-205). Quem fica fixado e o formulario dentro dela.
  const [managingBlocks, setManagingBlocks] = useState(false);
  const [deleting, setDeleting] = useState<Unit | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('unit:create');
  const canUpdate = can('unit:update');
  const canDelete = can('unit:delete');
  const canReadBlocks = can('block:read');

  const condominiumId = selected?.id ?? null;
  const { setFilter } = list;

  // Um filtro de bloco aponta para um bloco do condominio anterior: mantido, a
  // lista voltaria vazia sem explicar por que. Os demais filtros continuam
  // valendo, porque status, tipo e andar existem em qualquer condominio.
  useEffect(() => {
    setFilter('blockId', undefined);
  }, [condominiumId, setFilter]);

  const query = unitHooks.useList(
    {
      ...list.toListParams(DEFAULT_PER_PAGE),
      filters: { ...list.filters, condominiumId: condominiumId ?? undefined },
    },
    { enabled: condominiumId !== null },
  );

  // Os blocos alimentam o filtro, o seletor do formulario e a geracao em lote.
  const blocksQuery = blockHooks.useList(
    {
      page: 1,
      perPage: MAX_PER_PAGE,
      sortBy: 'name',
      sortOrder: 'ASC',
      filters: { condominiumId: condominiumId ?? undefined },
    },
    { enabled: condominiumId !== null },
  );
  const blocks = blocksQuery.data?.data ?? [];

  const remove = unitHooks.useRemove();
  const restore = unitHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  /**
   * As acoes de linha nao passam `onError`, entao herdam o toast global — que e a
   * apresentacao certa para um 409 que traz so a mensagem do servidor, inclusive
   * as duas recusas distintas de exclusao. O que falta e atualizar a lista:
   * `onSuccess` nao roda quando a recusa chega.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: UNITS_KEY });
  }

  const columns: Column<Unit>[] = [
    // `block` vem do eager load da API; o nome e o que o operador reconhece.
    { key: 'block', label: 'Bloco', render: (_value, row) => row.block?.name ?? '—' },
    {
      key: 'number',
      label: 'Numero',
      sortable: true,
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <span className={row.deletedAt ? 'line-through' : undefined}>{row.number}</span>
          {/* A tarja nomeia o estado: cor sozinha nao distingue removida de ativa. */}
          {row.deletedAt ? <Badge variant="destructive">Removida</Badge> : null}
        </div>
      ),
    },
    { key: 'floor', label: 'Andar', sortable: true },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (_value, row) => UNIT_TYPE_LABELS[row.type],
    },
    {
      key: 'area',
      label: 'Area',
      // Ausente e diferente de zero: uma area desconhecida nao e uma area nula.
      render: (_value, row) => (row.area === null ? '—' : `${formatNumber(row.area, 2)} m2`),
    },
    {
      key: 'idealFraction',
      label: 'Fracao ideal',
      render: (_value, row) =>
        row.idealFraction === null ? '—' : formatNumber(row.idealFraction, 4),
    },
    {
      key: 'parkingSpots',
      label: 'Vagas',
      render: (_value, row) => formatNumber(row.parkingSpots),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => (
        <Badge variant={STATUS_VARIANTS[row.status]}>{UNIT_STATUS_LABELS[row.status]}</Badge>
      ),
    },
    {
      key: 'residents',
      label: 'Moradores',
      render: (_value, row) => residentsReference(row.status),
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <UnitRowActions
          unit={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={(unit) => setFormTarget({ unit, condominiumId: unit.condominiumId })}
          onDelete={setDeleting}
          onRestore={(unit) => restore.mutate(unit.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  // Calculado antes da guarda de condominio ausente, entao a estreita aqui: sem
  // condominio nao ha acao possivel, e e o que a tela abaixo ja renderiza.
  const actions =
    condominiumId === null ? null : (
      <div className="flex flex-wrap items-center gap-2">
        {canReadBlocks ? (
          <Button variant="outline" onClick={() => setManagingBlocks(true)}>
            Gerenciar blocos
          </Button>
        ) : null}
        {canCreate ? (
          <Button variant="outline" onClick={() => setGenerating(condominiumId)}>
            Gerar unidades
          </Button>
        ) : null}
        {canCreate ? (
          <Button onClick={() => setFormTarget({ unit: null, condominiumId })}>Nova unidade</Button>
        ) : null}
      </div>
    );

  // Todo pedido desta tela e escopado ao condominio do shell. Sem um escolhido
  // nao ha o que pedir, e listar nada pareceria um condominio vazio.
  if (!selected || condominiumId === null) {
    return (
      <CrudLayout
        header={
          <PageHeader
            title="Unidades"
            description="Cadastro das unidades do condominio selecionado."
          />
        }
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condominio"
              description="As unidades pertencem a um condominio. Escolha um no seletor do topo para ver, cadastrar ou gerar unidades."
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
            title="Unidades"
            description={`Cadastro das unidades de ${selected.name}.`}
            actions={actions}
          />
        }
        filters={
          <div className="space-y-4">
            <OccupancyIndicators condominiumId={condominiumId} filtersActive={isNarrowed} />
            <UnitFilters list={list} blocks={blocks} />
          </div>
        }
        content={
          showEmpty ? (
            <div className="p-4">
              {isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhuma unidade corresponde aos termos e filtros aplicados."
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
                  icon={DoorOpen}
                  title="Nenhuma unidade cadastrada"
                  description="Cadastre uma unidade por vez ou gere o predio inteiro de uma vez a partir de um bloco."
                  action={
                    canCreate ? (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button onClick={() => setFormTarget({ unit: null, condominiumId })}>
                          Cadastrar unidade
                        </Button>
                        {/* Rotulo proprio: dois botoes com o mesmo nome acessivel
                            na mesma tela nao dizem qual e qual. */}
                        <Button variant="outline" onClick={() => setGenerating(condominiumId)}>
                          Gerar unidades em lote
                        </Button>
                      </div>
                    ) : undefined
                  }
                />
              )}
            </div>
          ) : (
            <div className="p-4">
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
            </div>
          )
        }
      />

      {/*
        Os formularios recebem o condominio de abertura. Enquanto ele for o do
        shell — o caso comum — nada muda; quando o seletor mudar no meio, o
        dialogo continua gravando onde comecou e o aviso explica a divergencia.
      */}
      {formTarget ? (
        <UnitFormDialog
          key={formTarget.unit?.id ?? 'new'}
          condominiumId={formTarget.condominiumId}
          unit={formTarget.unit ?? undefined}
          blocks={blocks}
          blocksLoading={blocksQuery.isPending}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      {generating ? (
        <BulkGenerateDialog
          condominiumId={generating}
          blocks={blocks}
          blocksLoading={blocksQuery.isPending}
          onClose={() => setGenerating(null)}
        />
      ) : null}

      {managingBlocks ? (
        <BlockManagerDialog
          condominiumId={condominiumId}
          onClose={() => setManagingBlocks(false)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir unidade?"
        description={
          deleting
            ? `A unidade ${deleting.number} deixara de aparecer nas listagens. A exclusao e logica e pode ser desfeita.`
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

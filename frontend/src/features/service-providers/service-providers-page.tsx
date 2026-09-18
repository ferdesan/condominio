import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, HardHat, SearchX } from 'lucide-react';
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
import type { ServiceProvider } from '@/types/api';
import {
  serviceProviderFilters,
  serviceProviderHooks,
  useServiceTypeOptions,
} from './service-provider-hooks';
import { normaliseDocument } from './service-provider-schema';
import { STATUS_LABELS } from './service-provider-labels';
import { ServiceProviderFilters } from './components/service-provider-filters';
import { ServiceProviderFormDialog } from './components/service-provider-form-dialog';
import { ServiceProviderRowActions } from './components/service-provider-row-actions';
import { ProviderRating } from './components/provider-rating';

const STATUS_VARIANTS: Record<ServiceProvider['status'], 'success' | 'neutral' | 'destructive'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  BLOCKED: 'destructive',
};

/**
 * `provider: null` cadastra; um registro edita. Ausente mantem o dialogo fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { provider: ServiceProvider | null; condominiumId: string } | null;

export function ServiceProvidersPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<ServiceProvider | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('service-provider:create');
  const canUpdate = can('service-provider:update');
  const canDelete = can('service-provider:delete');

  const serviceTypesQuery = useServiceTypeOptions(selectedId);
  const serviceTypes = useMemo(() => serviceTypesQuery.data ?? [], [serviceTypesQuery.data]);

  /**
   * Todo pedido carrega o condominio do shell. `pickFilters` descarta o que
   * estiver fora da whitelist do servidor antes que vire uma query inocua, e o
   * termo de busca passa pela normalizacao de documento — CPFs e CNPJs sao
   * guardados sem pontuacao.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      search: base.search ? normaliseDocument(base.search) : undefined,
      filters: {
        ...pickFilters(serviceProviderFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = serviceProviderHooks.useList(params, { enabled: Boolean(selectedId) });
  const remove = serviceProviderHooks.useRemove();
  const restore = serviceProviderHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage, setFilter } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  // O tipo filtrado pode ter deixado de existir no condominio — porque o ultimo
  // prestador daquele tipo saiu, ou porque a selecao do shell mudou. Manter a
  // chave devolveria uma lista vazia sem explicacao.
  const serviceTypeFilter = list.filters.serviceType;
  useEffect(() => {
    if (typeof serviceTypeFilter !== 'string' || serviceTypeFilter === '') return;
    if (!serviceTypesQuery.isSuccess) return;
    if (serviceTypes.includes(serviceTypeFilter)) return;
    setFilter('serviceType', undefined);
  }, [serviceTypeFilter, serviceTypes, serviceTypesQuery.isSuccess, setFilter]);

  /**
   * As acoes de linha nao passam `onError`, entao herdam o toast global — que e a
   * apresentacao certa para um 409 que traz so a mensagem do servidor. O que
   * falta e atualizar a lista: `onSuccess` nao roda quando a recusa chega, e
   * tanto o 404 quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: ['service-providers'] });
  }

  const columns: Column<ServiceProvider>[] = [
    {
      key: 'companyName',
      label: 'Razao social',
      sortable: true,
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <span className={row.deletedAt ? 'line-through' : undefined}>{row.companyName}</span>
          {/* A tarja nomeia o estado: cor sozinha nao distingue removido de ativo. */}
          {row.deletedAt ? <Badge variant="destructive">Removido</Badge> : null}
        </div>
      ),
    },
    { key: 'tradeName', label: 'Nome fantasia', sortable: true },
    {
      // O mesmo helper distingue 11 de 14 digitos, entao CPF e CNPJ saem
      // pontuados do jeito de cada um sem a coluna precisar saber qual e qual.
      key: 'document',
      label: 'CPF/CNPJ',
      sortable: true,
      render: (_value, row) => formatDocument(row.document),
    },
    { key: 'serviceType', label: 'Tipo de serviço', sortable: true },
    { key: 'contactName', label: 'Contato', sortable: true },
    {
      key: 'phone',
      label: 'Telefone',
      render: (_value, row) => formatPhone(row.phone),
    },
    {
      // Ordenar por data de contrato o servidor nao aceita: `contractStart` e
      // `contractEnd` nao sao filtraveis nem buscaveis, e o pedido voltaria
      // ordenado por razao social sem dizer nada.
      key: 'contractEnd',
      label: 'Vigência',
      render: (_value, row) => contractPeriod(row.contractStart, row.contractEnd),
    },
    {
      key: 'rating',
      label: 'Avaliação',
      render: (_value, row) => <ProviderRating value={row.rating} />,
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
      label: 'Ações',
      render: (_value, row) => (
        <ServiceProviderRowActions
          provider={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={(provider) => setFormTarget({ provider, condominiumId: provider.condominiumId })}
          onDelete={setDeleting}
          onRestore={(provider) => restore.mutate(provider.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Prestadores" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condomínio"
              description="Os prestadores sao listados por condomínio. Escolha um no topo da tela para continuar."
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
            title="Prestadores"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button
                  onClick={() => setFormTarget({ provider: null, condominiumId: selectedId })}
                >
                  Novo prestador
                </Button>
              ) : undefined
            }
          />
        }
        filters={<ServiceProviderFilters list={list} serviceTypes={serviceTypes} />}
        content={
          <div className="p-4 space-y-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum prestador corresponde aos termos e filtros aplicados."
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
                  icon={HardHat}
                  title="Nenhum prestador cadastrado"
                  description="Cadastre o primeiro prestador para saber quem atende o condomínio."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() => setFormTarget({ provider: null, condominiumId: selectedId })}
                      >
                        Cadastrar prestador
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
        <ServiceProviderFormDialog
          key={formTarget.provider?.id ?? 'new'}
          provider={formTarget.provider ?? undefined}
          condominiumId={formTarget.condominiumId}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir prestador?"
        description={
          deleting
            ? `${deleting.companyName} deixara de aparecer na listagem. A exclusao e logica e pode ser desfeita.`
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

const DESCRIPTION = 'Fornecedores contratados pelo condomínio selecionado.';

/**
 * A vigencia como periodo, e nao como duas colunas meio vazias. Um contrato sem
 * termino e aberto, e um sem inicio registrado ainda tem um fim que importa.
 */
function contractPeriod(start: string | null, end: string | null): string {
  if (start && end) return `${formatDate(start)} a ${formatDate(end)}`;
  if (start) return `desde ${formatDate(start)}`;
  if (end) return `até ${formatDate(end)}`;
  return '—';
}

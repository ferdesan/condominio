import { useEffect, useMemo, useState } from 'react';
import { ScrollText, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { ForbiddenPage } from '@/features/misc/forbidden-page';
import type { AuditLog } from '@/types/audit';
import { auditFilters, useAuditList } from './audit-hooks';
import {
  auditEntryLabel,
  changedFields,
  NO_FIELDS_CHANGED,
  resourceLabel,
  SYSTEM_ACTOR,
} from './audit-labels';
import { AuditActionBadge } from './components/audit-action-badge';
import { AuditDetailDialog } from './components/audit-detail-dialog';
import { AuditFilters } from './components/audit-filters';

const DESCRIPTION =
  'Quem mudou o que, e quando. O registro cobre a administradora inteira e nao pode ser editado nem apagado.';

/**
 * Trilha de auditoria.
 *
 * **Somente leitura, por contrato.** `audit.routes.ts` expoe duas rotas, ambas
 * `GET`: nao ha criar, editar, excluir nem restaurar aqui porque nao ha no
 * servidor — a trilha e append-only por exigencia da LGPD (art. 37) e da
 * prestacao de contas. Por isso a tabela nao recebe acao de escrita nenhuma, e a
 * unica acao de linha abre o detalhe da entrada.
 *
 * **Tambem nao segue o condominio do shell.** A trilha e por tenant, como
 * `/users`: `AuditRepository` nao a escopa por condominio nem aceita
 * `condominiumId` como filtro. Nao ha estado de "selecione um condominio" aqui,
 * e nenhuma requisicao da tela carrega a chave.
 */
export function AuditPage() {
  const { can } = useAuth();
  const list = useListState();
  const [detail, setDetail] = useState<AuditLog | null>(null);

  // A rota tambem guarda esta tela, mas o guard da rota nao alcanca quem monta a
  // pagina diretamente — e e a consulta, nao o roteador, que o servidor negaria.
  const canRead = can('audit-log:read');

  /**
   * Nenhum condominio entra aqui. `pickFilters` descarta o que estiver fora da
   * whitelist do servidor antes que vire uma query inocua — e a whitelist deste
   * recurso tem quatro chaves, nenhuma delas de condominio.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return { ...base, filters: pickFilters(auditFilters, base.filters ?? {}) };
  }, [list]);

  // Sem permissao nao sai requisicao: a tela nao pede o que o servidor negaria.
  const query = useAuditList(params, { enabled: canRead });

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece quando um filtro encolhe o resultado.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  if (!canRead) return <ForbiddenPage />;

  const columns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      label: 'Quando',
      sortable: true,
      render: (_value, row) => (
        <div className="whitespace-nowrap">
          <p>{formatDateTime(row.createdAt)}</p>
          <p className="text-xs text-muted-foreground">{formatRelative(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'userName',
      label: 'Autor',
      sortable: true,
      // Sem autor significa que quem agiu foi o proprio servidor, e nao que o
      // dado se perdeu — um traco aqui diria a coisa errada.
      render: (_value, row) =>
        row.userName ?? <span className="text-muted-foreground">{SYSTEM_ACTOR}</span>,
    },
    {
      key: 'action',
      label: 'Acao',
      sortable: true,
      render: (_value, row) => <AuditActionBadge action={row.action} />,
    },
    {
      key: 'resource',
      label: 'Recurso',
      sortable: true,
      render: (_value, row) => resourceLabel(row.resource),
    },
    {
      key: 'description',
      label: 'Descricao',
      sortable: true,
      render: (_value, row) => row.description ?? '—',
    },
    {
      // Nao ordenavel: `changes` e uma coluna JSON e nao esta no conjunto
      // ordenavel do servidor — a chave seria descartada em silencio.
      key: 'changes',
      label: 'Campos alterados',
      render: (_value, row) => {
        const fields = changedFields(row);
        if (fields.length === 0) {
          return <span className="text-muted-foreground">{NO_FIELDS_CHANGED}</span>;
        }
        return <span className="font-mono text-xs">{fields.join(', ')}</span>;
      },
    },
    {
      key: 'detail',
      label: 'Detalhes',
      render: (_value, row) => (
        <Button
          variant="outline"
          size="sm"
          // Numa tabela de vinte linhas, "Ver detalhes" sozinho nao diz de qual.
          aria-label={`Ver detalhes de ${auditEntryLabel(row)}`}
          onClick={() => setDetail(row)}
        >
          Ver detalhes
        </Button>
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  return (
    <>
      <CrudLayout
        header={<PageHeader title="Auditoria" description={DESCRIPTION} />}
        filters={<AuditFilters list={list} />}
        content={
          <div className="space-y-4 p-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhuma entrada corresponde aos termos e filtros aplicados."
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
                  icon={ScrollText}
                  title="Nenhuma atividade registrada"
                  description="Assim que alguem criar, alterar ou remover um registro, a acao aparece aqui."
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
                emptyIcon={ScrollText}
              />
            )}
          </div>
        }
      />

      {detail ? <AuditDetailDialog entry={detail} onClose={() => setDetail(null)} /> : null}
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, FileText, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { formatDate, formatFileSize, formatNumber } from '@/lib/format';
import type { ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { DocumentFile } from '@/types/document';
import {
  documentFilters,
  useDocumentList,
  useDownloadDocument,
  useRemoveDocument,
} from './document-hooks';
import { isExpired, NO_EXPIRY, NO_TAGS, VISIBILITY_LABELS } from './document-labels';
import { DocumentCategoryBadge } from './components/document-category-badge';
import { DocumentFilters } from './components/document-filters';
import { DocumentFormDialog } from './components/document-form-dialog';
import { DocumentRowActions } from './components/document-row-actions';

const DESCRIPTION =
  'Convencao, regimento, atas, contratos e laudos do condominio, com o controle de quem pode baixar cada um.';

/** Recusa do servidor apresentada na linha que a provocou. */
type RowError = { id: string; message: string } | null;

/** O dialogo guarda o condominio com que foi aberto (ADR-004). */
type FormTarget = { document: DocumentFile | null; condominiumId: string } | null;

/**
 * Acervo de documentos do condominio.
 *
 * **A exclusao aqui e permanente**, ao contrario de todas as demais telas
 * (ADR-006): `documentService.afterRemove` apaga o arquivo do disco e o servidor
 * nao tem rota de restauracao — e a eliminacao do dado que a LGPD exige. Por
 * isso nao ha alternador de removidos, nem acao de restaurar, e a confirmacao
 * diz que nao ha volta.
 *
 * A regra de visibilidade tambem e diferente do resto: ela vale no **download**,
 * e nao na listagem. Quem alcanca a tela ve todos os registros do condominio; o
 * servidor e que recusa a baixa do que o perfil nao pode ler, e a recusa aparece
 * na linha.
 */
export function DocumentsPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<DocumentFile | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);
  const [rowError, setRowError] = useState<RowError>(null);
  const downloadingRef = useRef(new Set<string>());

  const canCreate = can('document:create');
  const canUpdate = can('document:update');
  const canDelete = can('document:delete');

  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      filters: pickFilters(documentFilters, {
        ...base.filters,
        condominiumId: selectedId ?? '',
      }),
    };
  }, [list, selectedId]);

  const query = useDocumentList(params, { enabled: Boolean(selectedId) });

  /**
   * A recusa descreve algo sobre este documento — a visibilidade do perfil, ou
   * um arquivo que sumiu do armazenamento. Definir `onError` aqui substitui o
   * toast global do React Query v5, que e o que se quer: a mensagem ja tem onde
   * aparecer e nao deve aparecer duas vezes.
   */
  const download = useDownloadDocument({
    onError: (error: ApiError, document) =>
      setRowError({ id: document.id, message: error.message }),
    onSuccess: () => setRowError(null),
  });

  const remove = useRemoveDocument({
    onError: (error: ApiError, id) => setRowError({ id, message: error.message }),
  });

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de excluir os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  function handleDownload(document: DocumentFile): void {
    // O `isPending` da mutacao so muda no proximo tick, entao dois cliques no
    // mesmo botao baixariam o arquivo duas vezes — e cada baixa incrementa o
    // contador no servidor. O trinco fecha na hora, e e por linha para que dois
    // documentos possam ser baixados em sequencia rapida.
    if (downloadingRef.current.has(document.id)) return;
    downloadingRef.current.add(document.id);
    setRowError(null);

    download.mutate(document, {
      onSettled: () => downloadingRef.current.delete(document.id),
    });
  }

  const columns: Column<DocumentFile>[] = [
    {
      key: 'title',
      label: 'Documento',
      sortable: true,
      render: (_value, row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.title}</p>
          <p className="truncate text-xs text-muted-foreground">{row.fileName}</p>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Categoria',
      sortable: true,
      render: (_value, row) => <DocumentCategoryBadge category={row.category} />,
    },
    {
      key: 'visibility',
      label: 'Quem ve',
      sortable: true,
      render: (_value, row) => VISIBILITY_LABELS[row.visibility],
    },
    {
      // Nao ordenavel: `sizeBytes` nao esta no conjunto ordenavel do servidor — a
      // chave seria descartada em silencio e a ordem voltaria para a padrao.
      key: 'sizeBytes',
      label: 'Tamanho',
      render: (_value, row) => formatFileSize(row.sizeBytes),
    },
    {
      key: 'expiresAt',
      label: 'Validade',
      render: (_value, row) => {
        if (!row.expiresAt) return <span className="text-muted-foreground">{NO_EXPIRY}</span>;
        return (
          <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
            {formatDate(row.expiresAt)}
            {/* A tarja nomeia a situacao: cor sozinha nao distingue vencido. */}
            {isExpired(row) ? <Badge variant="destructive">Vencido</Badge> : null}
          </div>
        );
      },
    },
    {
      key: 'tags',
      label: 'Marcadores',
      render: (_value, row) => {
        const tags = row.tags ?? [];
        if (tags.length === 0) return <span className="text-muted-foreground">{NO_TAGS}</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'downloadsCount',
      label: 'Downloads',
      render: (_value, row) => formatNumber(row.downloadsCount),
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <DocumentRowActions
          document={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          error={rowError?.id === row.id ? rowError.message : undefined}
          onDownload={handleDownload}
          onEdit={(item) => setFormTarget({ document: item, condominiumId: item.condominiumId })}
          onDelete={setDeleting}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Documentos" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condominio"
              description="Os documentos sao listados por condominio. Escolha um no topo da tela para continuar."
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
            title="Documentos"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button
                  onClick={() => setFormTarget({ document: null, condominiumId: selectedId })}
                >
                  Enviar documento
                </Button>
              ) : undefined
            }
          />
        }
        filters={<DocumentFilters list={list} />}
        content={
          <div className="space-y-4 p-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum documento corresponde aos termos e filtros aplicados."
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
                  icon={FileText}
                  title="Nenhum documento no acervo"
                  description="Convencao, regimento e atas ficam aqui, disponiveis para quem voce definir."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() => setFormTarget({ document: null, condominiumId: selectedId })}
                      >
                        Enviar o primeiro
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
                emptyIcon={FileText}
              />
            )}
          </div>
        }
      />

      {formTarget ? (
        <DocumentFormDialog
          key={formTarget.document?.id ?? 'new'}
          document={formTarget.document ?? undefined}
          condominiumId={formTarget.condominiumId}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      {/*
        Excluir um documento apaga o arquivo do disco e nao tem volta — e a
        eliminacao do dado que a LGPD exige. A confirmacao precisa dizer isso:
        nas demais telas "excluir" e reversivel, e quem ja usou as outras espera
        o mesmo aqui.
      */}
      <ConfirmDialog
        open={deleting !== null}
        title="Excluir documento?"
        description={
          deleting
            ? `O arquivo "${deleting.fileName}" sera apagado do armazenamento. Esta exclusao e definitiva e nao pode ser desfeita.`
            : undefined
        }
        actionLabel="Excluir definitivamente"
        loading={removing}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          // O `isPending` da mutacao so muda no proximo tick, entao dois cliques
          // no mesmo passariam os dois. O trinco fecha na hora.
          if (!deleting || removingRef.current) return;
          removingRef.current = true;
          setRemoving(true);
          setRowError(null);
          remove.mutate(deleting.id, {
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

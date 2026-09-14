import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ForbiddenPage } from '@/features/misc/forbidden-page';
import { useAuth } from '@/hooks/use-auth';
import { condominiumHooks, useCondominiumStats } from './condominium-hooks';
import { CondominiumFormDialog } from './components/condominium-form-dialog';
import { CondominiumRecordCard } from './components/condominium-record-card';
import { CondominiumStatsPanel } from './components/condominium-stats-panel';

/**
 * Unico modulo com rota propria: o resumo do condominio e material de consulta,
 * e um dialogo que fecha num clique fora nao serve para isso (ADR-004).
 */
export function CondominiumDetailPage() {
  const { id = null } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);

  // Duas consultas independentes de proposito: os indicadores podem falhar sem
  // levar o cadastro junto.
  const record = condominiumHooks.useOne(id);
  const stats = useCondominiumStats(id);

  if (record.isPending) return <DetailSkeleton />;

  if (record.isError) {
    if (record.error.status === 403) return <ForbiddenPage />;
    // 404 e o registro removido ou inexistente; 422 e um identificador que nem
    // chega a ser um UUID. Para quem chegou pelo link, os dois sao a mesma coisa.
    return (
      <EmptyState
        icon={Building2}
        title="Condominio nao encontrado"
        description="O registro nao existe, foi removido ou o endereco esta incorreto."
        action={
          <Button asChild variant="outline">
            <Link to="/condominios">Voltar para a listagem</Link>
          </Button>
        }
      />
    );
  }

  const condominium = record.data;

  return (
    <>
      <PageHeader
        title={condominium.name}
        description="Cadastro completo e indicadores operacionais."
        actions={
          can('condominium:update') ? (
            <Button onClick={() => setEditing(true)}>Editar</Button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <CondominiumStatsPanel
          stats={stats.data}
          loading={stats.isPending}
          failed={stats.isError}
          onRetry={() => stats.refetch()}
        />

        <CondominiumRecordCard condominium={condominium} />
      </div>

      {editing ? (
        <CondominiumFormDialog
          key={condominium.id}
          condominium={condominium}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}

/** Segura a posicao dos blocos para que a pagina nao salte quando os dados chegam. */
function DetailSkeleton() {
  return (
    <>
      <PageHeader title="Condominio" description="Carregando cadastro..." />
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    </>
  );
}

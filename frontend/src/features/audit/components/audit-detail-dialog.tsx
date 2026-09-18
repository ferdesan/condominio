import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';
import type { AuditLog } from '@/types/audit';
import { useResourceHistory } from '../audit-hooks';
import {
  ACTION_LABELS,
  changedFields,
  formatAuditValue,
  NO_FIELDS_CHANGED,
  NO_RESOURCE_TARGET,
  resourceLabel,
  SYSTEM_ACTOR,
} from '../audit-labels';
import { AuditActionBadge } from './audit-action-badge';

export interface AuditDetailDialogProps {
  entry: AuditLog;
  onClose: () => void;
}

/**
 * O conteudo de uma entrada da trilha: o antes e o depois da mudanca, os dados
 * de origem, e o historico do registro que ela tocou.
 *
 * Vive em dialogo sobre a listagem (ADR-004), e nao em rota propria: a trilha e
 * lida varrendo uma sequencia de entradas, e sair da lista a cada uma custaria a
 * posicao. Os rotulos daqui sao deliberadamente diferentes dos cabecalhos da
 * tabela — "Quem agiu", e nao "Autor" — porque a tabela continua montada atras
 * do dialogo, e dois elementos com o mesmo texto quebram a consulta antes de
 * confundir o leitor.
 *
 * **Nada aqui escreve.** A trilha e append-only por exigencia da LGPD (art. 37)
 * e nao tem rota de escrita no servidor.
 */
export function AuditDetailDialog({ entry, onClose }: AuditDetailDialogProps) {
  // Desligada quando a acao nao tem alvo: uma tentativa de login nao aponta para
  // registro nenhum, e pedir o historico de um identificador vazio seria um 400.
  const history = useResourceHistory(entry.resourceId ? entry.resource : null, entry.resourceId);
  const fields = changedFields(entry);
  const actor = entry.userName ?? SYSTEM_ACTOR;

  /** As demais entradas do mesmo registro; a que esta aberta nao se repete. */
  const others = (history.data ?? []).filter((item) => item.id !== entry.id);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{`${ACTION_LABELS[entry.action]} em ${resourceLabel(entry.resource)}`}</DialogTitle>
          <DialogDescription>
            {entry.description ?? 'A entrada não traz descrição própria.'}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Quem agiu</dt>
            <dd className="font-medium">{actor}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Data e hora</dt>
            <dd className="font-medium">{formatDateTime(entry.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Identificador do registro</dt>
            <dd className="break-all font-mono text-xs">{entry.resourceId ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Endereço de origem</dt>
            <dd className="font-mono text-xs">{entry.ipAddress ?? '—'}</dd>
          </div>
        </dl>

        <section aria-labelledby="audit-detail-changes" className="space-y-2">
          {/*
            A contagem vem no titulo porque a lista nao tem teto: uma entrada de
            cadastro completo muda trinta campos, e sem o numero so rolando ate o
            fim se descobre o tamanho do que se esta lendo.
          */}
          <h3 id="audit-detail-changes" className="text-sm font-semibold">
            O que mudou
            {fields.length > 0 ? (
              <span className="ml-2 font-normal text-muted-foreground">
                {fields.length === 1 ? '1 campo' : `${fields.length} campos`}
              </span>
            ) : null}
          </h3>

          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">{NO_FIELDS_CHANGED}</p>
          ) : (
            <ul className="space-y-2">
              {fields.map((field) => (
                <li key={field} className="rounded-md border border-border px-3 py-2">
                  <p className="font-mono text-xs text-muted-foreground">{field}</p>
                  {/*
                    `break-words` porque `formatAuditValue` serializa objeto em
                    JSON: uma linha dessas nao tem espaco onde quebrar, e sem isto
                    ela alarga o dialogo inteiro em vez de quebrar.
                  */}
                  <p className="break-words text-sm">
                    <span className="text-muted-foreground">De </span>
                    <span className="font-medium line-through decoration-muted-foreground/60">
                      {formatAuditValue(entry.changes?.before?.[field])}
                    </span>
                    <span className="text-muted-foreground"> para </span>
                    <span className="font-medium">
                      {formatAuditValue(entry.changes?.after?.[field])}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="audit-detail-history" className="space-y-2">
          <h3 id="audit-detail-history" className="text-sm font-semibold">
            Histórico deste registro
            {others.length > 0 ? (
              <span className="ml-2 font-normal text-muted-foreground">
                {others.length === 1 ? '1 entrada' : `${others.length} entradas`}
              </span>
            ) : null}
          </h3>

          {!entry.resourceId ? (
            <p className="text-sm text-muted-foreground">{NO_RESOURCE_TARGET}</p>
          ) : history.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : history.isError ? (
            // A falha fica contida: o conteudo da entrada aberta ja esta na tela
            // e continua legivel sem o historico.
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar o histórico deste registro.
            </p>
          ) : others.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta e a única entrada registrada para este registro.
            </p>
          ) : (
            /*
              Sem teto de altura de proposito. Um bloco rolavel dentro de um
              dialogo que tambem rola sao duas barras disputando a mesma roda do
              mouse, e o servidor ja limita este historico a cem entradas
              (`findAllBy`) — o comprimento e conhecido, e uma barra so basta.
            */
            <ul className="space-y-1 text-sm">
              {others.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  <AuditActionBadge action={item.action} />
                  <span className="text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                  <span>{item.userName ?? SYSTEM_ACTOR}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

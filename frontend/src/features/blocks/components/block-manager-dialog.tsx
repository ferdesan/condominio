import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useAuth } from '@/hooks/use-auth';
import { MAX_PER_PAGE } from '@/lib/crud';
import type { Block } from '@/types/api';
import { BLOCKS_KEY, blockHooks } from '../block-hooks';
import { BLOCK_TYPE_LABELS } from '../block-schema';
import { BlockFormDialog } from './block-form-dialog';

/**
 * `block: null` cadastra; um registro edita. Ausente mantem o formulario fechado.
 *
 * `condominiumId` e o da abertura: a listagem atras pode ter trocado de
 * condominio desde entao, mas o que foi digitado aqui pertence ao predio em que
 * comecou (US-027.EC-3).
 */
type FormTarget = { block: Block | null; condominiumId: string } | null;

export interface BlockManagerDialogProps {
  condominiumId: string;
  onClose: () => void;
}

/**
 * Gestao dos blocos do condominio selecionado, dentro da tela de unidades.
 *
 * O escopo e deliberadamente o que o cadastro de unidades precisa — listar,
 * criar, editar e excluir — e nada alem disso: e o limite que impede a gestao
 * embutida de virar por acumulo o quinto modulo que o ADR-007 evitou. Nenhuma
 * rota e registrada para blocos.
 *
 * A gestao acompanha o condominio do shell (US-030.EC-5): e uma listagem, e uma
 * listagem do predio errado nao serve para nada. O formulario aberto dentro dela
 * e que fica preso ao condominio em que comecou, porque ele grava (US-027.EC-3).
 */
export function BlockManagerDialog({ condominiumId, onClose }: BlockManagerDialogProps) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<Block | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('block:create');
  const canUpdate = can('block:update');
  const canDelete = can('block:delete');

  // Um condominio tem dezenas de blocos, nao milhares: uma pagina larga evita
  // paginar uma lista que cabe inteira, e o servidor corta em 200 de qualquer jeito.
  const query = blockHooks.useList({
    page: 1,
    perPage: MAX_PER_PAGE,
    sortBy: 'name',
    sortOrder: 'ASC',
    filters: { condominiumId },
  });
  const remove = blockHooks.useRemove();

  const blocks = query.data?.data ?? [];

  // A confirmacao de exclusao aponta para uma linha que a troca de condominio
  // acabou de tirar da lista. Fecha-la nao descarta nada digitado — ao contrario
  // do formulario, que por isso fica aberto e preso ao condominio de origem.
  useEffect(() => {
    setDeleting(null);
  }, [condominiumId]);

  /**
   * A acao de linha nao passa `onError`: ela herda o toast global, que e a
   * apresentacao certa para um 409 que traz so a mensagem do servidor. O que
   * falta e recarregar a lista, porque a recusa descreve um estado que a tela
   * ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: BLOCKS_KEY });
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Blocos do condomínio</DialogTitle>
            <DialogDescription>
              Blocos, torres, alas e ruas do condomínio selecionado. Toda unidade pertence a um
              deles.
            </DialogDescription>
          </DialogHeader>

          {query.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando blocos...</p>
          ) : blocks.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Nenhum bloco cadastrado"
              description="Cadastre o primeiro bloco para poder registrar ou gerar unidades."
              action={
                canCreate ? (
                  <Button onClick={() => setFormTarget({ block: null, condominiumId })}>
                    Criar primeiro bloco
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {blocks.map((block) => (
                <li key={block.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{block.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {BLOCK_TYPE_LABELS[block.type]} · {block.floors}{' '}
                      {block.floors === 1 ? 'andar' : 'andares'} · {block.unitsPerFloor} por andar ·{' '}
                      {block.hasElevator ? 'com elevador' : 'sem elevador'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {canUpdate ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar bloco ${block.name}`}
                        onClick={() => setFormTarget({ block, condominiumId })}
                      >
                        Editar
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        aria-label={`Excluir bloco ${block.name}`}
                        onClick={() => setDeleting(block)}
                      >
                        Excluir
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            {canCreate && blocks.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => setFormTarget({ block: null, condominiumId })}
              >
                Novo bloco
              </Button>
            ) : null}
            {/* "Concluir", e nao "Fechar": o X do dialogo ja se chama assim. */}
            <Button onClick={onClose}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {formTarget ? (
        <BlockFormDialog
          key={formTarget.block?.id ?? 'new'}
          condominiumId={formTarget.condominiumId}
          block={formTarget.block ?? undefined}
          onSaved={() => setFormTarget(null)}
          onCancel={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir bloco?"
        description={
          deleting
            ? `${deleting.name} deixara de aparecer nos seletores de unidade. A exclusao e logica.`
            : undefined
        }
        actionLabel="Excluir bloco"
        loading={removing}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
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

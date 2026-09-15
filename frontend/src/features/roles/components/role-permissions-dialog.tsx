import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Role } from '@/types/role';
import { usePermissionCatalog } from '../role-hooks';
import { WILDCARD } from '../role-schema';
import { PermissionMatrix } from './permission-matrix';

export interface RolePermissionsDialogProps {
  role: Role;
  onClose: () => void;
}

/**
 * O que um papel permite, sem entrar em edicao.
 *
 * Existe por duas razoes. A primeira e que ver e editar sao coisas diferentes:
 * conferir o que o SINDICO alcanca nao deveria exigir a permissao de alterar
 * papeis nem o risco de salvar sem querer. A segunda e que, para os cinco
 * papeis do sistema, o dialogo de edicao e quase todo desabilitado — abri-lo so
 * para ler seria abrir um formulario que nao aceita nada.
 *
 * Reusa a **mesma** matriz do formulario, sem `onChange`. Duas representacoes
 * distintas da mesma informacao divergiriam na primeira mudanca de agrupamento.
 */
export function RolePermissionsDialog({ role, onClose }: RolePermissionsDialogProps) {
  const catalogQuery = usePermissionCatalog();
  const catalog = catalogQuery.data ?? [];
  const hasWildcard = role.permissions.includes(WILDCARD);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{`Permissoes de ${role.name}`}</DialogTitle>
          <DialogDescription>
            {role.description ?? 'Somente leitura. Para alterar, use Editar na lista.'}
          </DialogDescription>
        </DialogHeader>

        {/*
          O curinga nao cabe numa celula da matriz — ele nao tem recurso nem
          acao. Anunciado aqui, ele explica por que todas as caixas abaixo podem
          estar vazias enquanto o papel alcanca tudo.
        */}
        {hasWildcard ? (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <Badge variant="warning">Acesso total (*)</Badge>
            <p className="mt-1 text-muted-foreground">
              Este papel alcanca todo o sistema, inclusive o que for acrescentado depois. A matriz
              abaixo mostra o que foi concedido item a item, e nao o que o curinga ja libera.
            </p>
          </div>
        ) : null}

        {catalogQuery.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : catalogQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Nao foi possivel carregar o catalogo de permissoes. {catalogQuery.error.message}
          </p>
        ) : (
          <PermissionMatrix idPrefix="role-view" catalog={catalog} value={role.permissions} />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Eye, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { ICON_BUTTON_SIZE, ICON_BUTTON_TONE } from '@/components/ui/icon-button-variants';
import { cn } from '@/lib/utils';
import type { Condominium } from '@/types/api';

export interface CondominiumRowActionsProps {
  condominium: Condominium;
  /** Restaurar exige `update`, nao `delete` — e a mesma regra do servidor (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (condominium: Condominium) => void;
  onDelete: (condominium: Condominium) => void;
  onRestore: (condominium: Condominium) => void;
}

/**
 * Cada acao carrega o nome do registro no rotulo acessivel: numa tabela de vinte
 * linhas, "Editar" sozinho nao diz o que sera editado.
 */
export function CondominiumRowActions({
  condominium,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onRestore,
}: CondominiumRowActionsProps) {
  if (condominium.deletedAt) {
    if (!canUpdate) return null;
    return (
      <IconButton
        icon={RotateCcw}
        label={`Restaurar ${condominium.name}`}
        onClick={() => onRestore(condominium)}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/*
        Navegacao, e nao acao: continua sendo `Link` dentro de `Button asChild`,
        porque virar `IconButton` trocaria uma ancora por um `button` e levaria
        junto o "abrir em nova aba" e o endereco na barra de status. So o rotulo
        virou icone, com a mesma tarja do `IconButton` para nao destoar ao lado.
      */}
      <Button variant="ghost" asChild className={cn(ICON_BUTTON_SIZE, ICON_BUTTON_TONE.primary)}>
        <Link to={`/condominios/${condominium.id}`} aria-label={`Ver ${condominium.name}`}>
          <Eye aria-hidden="true" />
        </Link>
      </Button>

      {canUpdate ? (
        <IconButton
          icon={Pencil}
          label={`Editar ${condominium.name}`}
          onClick={() => onEdit(condominium)}
        />
      ) : null}

      {canDelete ? (
        <IconButton
          icon={Trash2}
          tone="destructive"
          label={`Excluir ${condominium.name}`}
          onClick={() => onDelete(condominium)}
        />
      ) : null}
    </div>
  );
}

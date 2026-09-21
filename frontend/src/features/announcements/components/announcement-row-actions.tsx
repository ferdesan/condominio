import { Archive, Megaphone, Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { RowAction, RowActions } from '@/components/ui/row-actions';
import type { Announcement } from '@/types/announcement';

export type AnnouncementLifecycleAction = 'publish' | 'archive';

export interface AnnouncementRowActionsProps {
  announcement: Announcement;
  /** Publicar, arquivar, editar e restaurar exigem `announcement:update` (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  /** Recusa do servidor para esta linha. Fica onde a acao foi disparada. */
  error?: string;
  onLifecycle: (action: AnnouncementLifecycleAction, announcement: Announcement) => void;
  onEdit: (announcement: Announcement) => void;
  onDelete: (announcement: Announcement) => void;
  onRestore: (announcement: Announcement) => void;
}

/**
 * As duas acoes do ciclo editorial vivem na propria linha (ADR-003): uma fila de
 * dez rascunhos e publicada sem sair da lista.
 *
 * Aqui o status importa, e esta e a excecao deliberada a forma das demais telas
 * deste tier — onde a acao de fluxo e oferecida so pela permissao e o servidor
 * decide se vale. O ciclo do comunicado e linear e fechado: um rascunho publica,
 * um publicado arquiva, e um arquivado nao volta (`announcement.service.ts`
 * recusa publicar o arquivado, e arquivar o arquivado nao teria efeito). Oferecer
 * o botao que nao leva a lugar nenhum seria oferecer um beco.
 *
 * O que sobra de incerto continua sendo do servidor: um rascunho pode ter sido
 * publicado por outra pessoa enquanto esta lista estava na tela, e a recusa dele
 * aparece na linha, com o status intacto.
 *
 * Cada rotulo acessivel carrega o titulo do comunicado: numa tabela de vinte
 * linhas, "Publicar" sozinho nao diz qual.
 */
export function AnnouncementRowActions({
  announcement,
  canUpdate,
  canDelete,
  error,
  onLifecycle,
  onEdit,
  onDelete,
  onRestore,
}: AnnouncementRowActionsProps) {
  const label = announcement.title;

  if (announcement.deletedAt) {
    if (!canUpdate) return null;
    return (
      <RowActions>
        <RowAction
          icon={RotateCcw}
          label={`Restaurar ${label}`}
          onClick={() => onRestore(announcement)}
        />
      </RowActions>
    );
  }

  const canPublish = announcement.status === 'DRAFT';
  const canArchive = announcement.status === 'PUBLISHED';

  return (
    <div className="space-y-1">
      <RowActions>
        {canUpdate ? (
          <>
            {canPublish ? (
              <RowAction
                icon={Megaphone}
                label={`Publicar ${label}`}
                onClick={() => onLifecycle('publish', announcement)}
              />
            ) : null}

            {canArchive ? (
              <RowAction
                icon={Archive}
                label={`Arquivar ${label}`}
                onClick={() => onLifecycle('archive', announcement)}
              />
            ) : null}

            <RowAction
              icon={Pencil}
              label={`Editar ${label}`}
              onClick={() => onEdit(announcement)}
            />
          </>
        ) : null}

        {canDelete ? (
          <RowAction
            icon={Trash2}
            tone="destructive"
            label={`Excluir ${label}`}
            onClick={() => onDelete(announcement)}
          />
        ) : null}
      </RowActions>

      {/*
        A recusa aparece na linha, e não em toast: e sobre este comunicado, e a
        próxima coisa a fazer esta a dois centimetros dela.
      */}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

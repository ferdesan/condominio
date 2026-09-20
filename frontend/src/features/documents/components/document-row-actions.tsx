import { Download, Pencil, Trash2 } from 'lucide-react';

import { IconButton } from '@/components/ui/icon-button';
import type { DocumentFile } from '@/types/document';
import { documentLabel } from '../document-labels';

export interface DocumentRowActionsProps {
  document: DocumentFile;
  /** Baixar exige apenas `document:read`, que a propria tela ja exigiu. */
  canUpdate: boolean;
  canDelete: boolean;
  /** Recusa do servidor, apresentada na propria linha que a provocou. */
  error?: string;
  onDownload: (document: DocumentFile) => void;
  onEdit: (document: DocumentFile) => void;
  onDelete: (document: DocumentFile) => void;
}

/**
 * As tres acoes de um documento.
 *
 * **Nao ha restaurar**, ao contrario das demais telas (ADR-006): a exclusao
 * apaga o arquivo do disco e o servidor nao tem rota de volta.
 *
 * Baixar e oferecido a todos que alcancam a tela — e leitura —, mas a regra de
 * visibilidade so e aplicada pelo servidor no download (`assertVisibility`), e
 * nao na listagem. Duplica-la aqui criaria uma segunda versao dela que
 * dessincroniza na primeira mudanca do backend; a recusa aparece na linha.
 *
 * Cada rotulo acessivel carrega o titulo do documento: numa tabela de vinte
 * linhas, "Baixar" sozinho nao diz qual.
 */
export function DocumentRowActions({
  document,
  canUpdate,
  canDelete,
  error,
  onDownload,
  onEdit,
  onDelete,
}: DocumentRowActionsProps) {
  const label = documentLabel(document);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton
          icon={Download}
          label={`Baixar ${label}`}
          onClick={() => onDownload(document)}
        />

        {canUpdate ? (
          <IconButton icon={Pencil} label={`Editar ${label}`} onClick={() => onEdit(document)} />
        ) : null}

        {canDelete ? (
          <IconButton
            icon={Trash2}
            tone="destructive"
            label={`Excluir ${label}`}
            onClick={() => onDelete(document)}
          />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

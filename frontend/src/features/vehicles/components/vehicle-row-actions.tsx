import { Button } from '@/components/ui/button';
import type { Vehicle } from '@/types/api';
import { formatPlate } from '../vehicle-schema';

export interface VehicleRowActionsProps {
  vehicle: Vehicle;
  /** Restaurar exige `update`, nao `delete` — e a mesma regra do servidor (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
  onRestore: (vehicle: Vehicle) => void;
}

/**
 * Cada acao carrega a placa no rotulo acessivel: numa tabela de vinte linhas,
 * "Editar" sozinho nao diz qual veiculo sera editado. A placa identifica mesmo
 * um veiculo sem dono cadastrado, que e o caso que marca e modelo nao cobrem.
 */
export function VehicleRowActions({
  vehicle,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onRestore,
}: VehicleRowActionsProps) {
  const plate = formatPlate(vehicle.plate);

  if (vehicle.deletedAt) {
    if (!canUpdate) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar ${plate}`}
        onClick={() => onRestore(vehicle)}
      >
        Restaurar
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {canUpdate ? (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Editar ${plate}`}
          onClick={() => onEdit(vehicle)}
        >
          Editar
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Excluir ${plate}`}
          onClick={() => onDelete(vehicle)}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}

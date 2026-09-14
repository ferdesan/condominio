import { Search } from 'lucide-react';
import { FilterPanel, type Filter } from '@/components/common/filter-panel';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ListState } from '@/lib/crud';
import type { Unit } from '@/types/api';
import type { Role } from '@/types/user';
import { unitLabel } from '../user-hooks';
import { STATUS_LABELS } from '../user-labels';

/**
 * O repositorio de usuarios aceita exatamente tres filtros: `status`, `roleId` e
 * `unitId`. **Nao ha `condominiumId`** — este recurso e por tenant, e um
 * controle de condominio aqui seria descartado em silencio pelo backend enquanto
 * parecesse funcionar.
 */
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface UserFiltersProps {
  list: ListState;
  roles: Role[];
  units: Unit[];
}

export function UserFilters({ list, roles, units }: UserFiltersProps) {
  const roleOptions = roles.map((role) => ({ value: role.id, label: role.name }));
  const unitOptions = units.map((unit) => ({ value: unit.id, label: unitLabel(unit) }));

  const chips: Filter[] = [];
  if (list.filters.status) {
    chips.push({
      id: 'status',
      label: 'Status',
      value: labelOf(STATUS_OPTIONS, list.filters.status),
    });
  }
  if (list.filters.roleId) {
    chips.push({ id: 'roleId', label: 'Papel', value: labelOf(roleOptions, list.filters.roleId) });
  }
  if (list.filters.unitId) {
    chips.push({
      id: 'unitId',
      label: 'Unidade',
      value: labelOf(unitOptions, list.filters.unitId),
    });
  }

  /** O painel devolve os chips que sobraram; os que sairam viram filtro limpo. */
  function handleChipChange(remaining: Filter[]): void {
    const kept = new Set(remaining.map((chip) => chip.id));
    for (const chip of chips) {
      if (!kept.has(chip.id)) list.setFilter(chip.id, undefined);
    }
  }

  return (
    <FilterPanel filters={chips} onFilterChange={handleChipChange} onClear={list.clearFilters}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="user-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="user-search"
              className="pl-10"
              placeholder="Nome, e-mail ou telefone"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-status">Status</Label>
          <Select
            value={(list.filters.status as string) ?? ANY}
            onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="user-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="user-role">Papel</Label>
          <Select
            value={(list.filters.roleId as string) ?? ANY}
            onValueChange={(value) => list.setFilter('roleId', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="user-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {roleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="user-unit">Unidade</Label>
          <Select
            value={(list.filters.unitId as string) ?? ANY}
            onValueChange={(value) => list.setFilter('unitId', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="user-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {unitOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/*
        Sem gate de permissao: ver registros removidos e leitura, e o servidor
        aceita `includeDeleted` de quem pode ler. Quem nao pode editar ve a linha
        marcada e nenhuma acao de restaurar (ADR-006).
      */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="user-include-deleted"
          checked={list.includeDeleted}
          onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
        />
        <Label htmlFor="user-include-deleted" className="font-normal">
          Incluir removidos
        </Label>
      </div>
    </FilterPanel>
  );
}

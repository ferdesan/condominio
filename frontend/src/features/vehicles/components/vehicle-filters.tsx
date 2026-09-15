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
import type { Resident, Unit } from '@/types/api';
import { STATUS_LABELS, TYPE_LABELS, unitLabel } from '../vehicle-labels';

/**
 * O repositorio de veiculos aceita `condominiumId`, `unitId`, `residentId`,
 * `type` e `status`. O condominio vem do shell e nao e um controle; restam os
 * outros quatro — e nada fora dessa lista pode virar controle, porque o backend
 * descarta o resto em silencio e o filtro pareceria funcionar.
 */
const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface VehicleFiltersProps {
  list: ListState;
  units: Unit[];
  residents: Resident[];
}

export function VehicleFilters({ list, units, residents }: VehicleFiltersProps) {
  const unitOptions = units.map((unit) => ({ value: unit.id, label: unitLabel(unit) }));
  const residentOptions = residents.map((resident) => ({
    value: resident.id,
    label: resident.name,
  }));

  const chips: Filter[] = [];
  if (list.filters.unitId) {
    chips.push({
      id: 'unitId',
      label: 'Unidade',
      value: labelOf(unitOptions, list.filters.unitId),
    });
  }
  if (list.filters.residentId) {
    chips.push({
      id: 'residentId',
      label: 'Morador',
      value: labelOf(residentOptions, list.filters.residentId),
    });
  }
  if (list.filters.type) {
    chips.push({ id: 'type', label: 'Tipo', value: labelOf(TYPE_OPTIONS, list.filters.type) });
  }
  if (list.filters.status) {
    chips.push({
      id: 'status',
      label: 'Status',
      value: labelOf(STATUS_OPTIONS, list.filters.status),
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
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="vehicle-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="vehicle-search"
              className="pl-10"
              placeholder="Placa, marca, modelo ou vaga"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vehicle-unit">Unidade</Label>
          <Select
            value={(list.filters.unitId as string) ?? ANY}
            onValueChange={(value) => list.setFilter('unitId', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="vehicle-unit">
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

        <div className="space-y-1.5">
          <Label htmlFor="vehicle-resident">Morador</Label>
          <Select
            value={(list.filters.residentId as string) ?? ANY}
            onValueChange={(value) =>
              list.setFilter('residentId', value === ANY ? undefined : value)
            }
          >
            <SelectTrigger id="vehicle-resident">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {residentOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vehicle-type">Tipo</Label>
          <Select
            value={(list.filters.type as string) ?? ANY}
            onValueChange={(value) => list.setFilter('type', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="vehicle-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vehicle-status">Status</Label>
          <Select
            value={(list.filters.status as string) ?? ANY}
            onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="vehicle-status">
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
      </div>

      {/*
        Sem gate de permissao: ver registros removidos e leitura, e o servidor
        aceita `includeDeleted` de quem pode ler. Quem nao pode editar ve a linha
        marcada e nenhuma acao de restaurar (ADR-006).
      */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="vehicle-include-deleted"
          checked={list.includeDeleted}
          onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
        />
        <Label htmlFor="vehicle-include-deleted" className="font-normal">
          Incluir removidos
        </Label>
      </div>
    </FilterPanel>
  );
}

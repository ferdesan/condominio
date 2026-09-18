import { Search } from 'lucide-react';
import { FilterPanel, type Filter } from '@/components/common/filter-panel';
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
import type { CommonArea, Unit } from '@/types/api';
import { RESERVATION_STATUS_LABELS } from './reservation-status-labels';

/**
 * `commonAreaId`, `status` e `unitId` sao os filtros que o repositorio de
 * reservas aceita e que a listagem precisa. `condominiumId` tambem e aceito,
 * mas nao e oferecido como controle: quem o define e o seletor do shell.
 */
const STATUS_OPTIONS = Object.entries(RESERVATION_STATUS_LABELS) as [string, string][];

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

export interface ReservationFiltersProps {
  list: ListState;
  areas: CommonArea[];
  units: Unit[];
}

export function ReservationFilters({ list, areas, units }: ReservationFiltersProps) {
  const chips: Filter[] = [];

  if (list.filters.commonAreaId) {
    const area = areas.find((item) => item.id === list.filters.commonAreaId);
    chips.push({
      id: 'commonAreaId',
      label: 'Área comum',
      value: area?.name ?? String(list.filters.commonAreaId),
    });
  }
  if (list.filters.status) {
    const status = STATUS_OPTIONS.find(([value]) => value === list.filters.status);
    chips.push({
      id: 'status',
      label: 'Status',
      value: status?.[1] ?? String(list.filters.status),
    });
  }
  if (list.filters.unitId) {
    const unit = units.find((item) => item.id === list.filters.unitId);
    chips.push({
      id: 'unitId',
      label: 'Unidade',
      value: unit ? `Unidade ${unit.number}` : String(list.filters.unitId),
    });
  }

  /** O painel devolve os chips que sobraram; os que sairam viram filtro limpo. */
  function handleChipChange(remaining: Filter[]): void {
    const kept = new Set(remaining.map((chip) => chip.id));
    for (const chip of chips) {
      if (!kept.has(chip.id)) list.setFilter(chip.id, undefined);
    }
  }

  /** Limpar nao pode derrubar o condominio: ele nao e escolha desta tela. */
  function handleClear(): void {
    list.setFilter('commonAreaId', undefined);
    list.setFilter('status', undefined);
    list.setFilter('unitId', undefined);
  }

  return (
    <FilterPanel filters={chips} onFilterChange={handleChipChange} onClear={handleClear}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="reservation-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="reservation-search"
              className="pl-10"
              placeholder="Solicitante ou observações"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reservation-area">Área comum</Label>
          <Select
            value={(list.filters.commonAreaId as string) ?? ANY}
            onValueChange={(value) =>
              list.setFilter('commonAreaId', value === ANY ? undefined : value)
            }
          >
            <SelectTrigger id="reservation-area">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reservation-status">Status</Label>
          <Select
            value={(list.filters.status as string) ?? ANY}
            onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="reservation-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {STATUS_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reservation-unit">Unidade</Label>
          <Select
            value={(list.filters.unitId as string) ?? ANY}
            onValueChange={(value) => list.setFilter('unitId', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="reservation-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  Unidade {unit.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FilterPanel>
  );
}

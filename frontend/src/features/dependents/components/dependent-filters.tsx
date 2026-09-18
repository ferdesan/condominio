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
import { ACTIVE_FILTER_VALUES } from '../dependent-hooks';
import { RELATIONSHIP_LABELS, unitLabel } from '../dependent-labels';

/**
 * O repositorio de dependentes aceita `condominiumId`, `unitId`, `residentId`,
 * `relationship` e `active`. O condominio vem do shell e nao e um controle;
 * restam os outros quatro — e nada fora dessa lista pode virar controle, porque
 * o backend descarta o resto em silencio e o filtro pareceria funcionar.
 */
const RELATIONSHIP_OPTIONS = Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const ACTIVE_OPTIONS = [
  { value: ACTIVE_FILTER_VALUES.yes, label: 'Ativo' },
  { value: ACTIVE_FILTER_VALUES.no, label: 'Inativo' },
];

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface DependentFiltersProps {
  list: ListState;
  residents: Resident[];
  units: Unit[];
}

export function DependentFilters({ list, residents, units }: DependentFiltersProps) {
  const residentOptions = residents.map((resident) => ({
    value: resident.id,
    label: resident.name,
  }));
  const unitOptions = units.map((unit) => ({ value: unit.id, label: unitLabel(unit) }));

  const chips: Filter[] = [];
  if (list.filters.residentId) {
    chips.push({
      id: 'residentId',
      label: 'Morador',
      value: labelOf(residentOptions, list.filters.residentId),
    });
  }
  if (list.filters.unitId) {
    chips.push({
      id: 'unitId',
      label: 'Unidade',
      value: labelOf(unitOptions, list.filters.unitId),
    });
  }
  if (list.filters.relationship) {
    chips.push({
      id: 'relationship',
      label: 'Parentesco',
      value: labelOf(RELATIONSHIP_OPTIONS, list.filters.relationship),
    });
  }
  if (list.filters.active) {
    chips.push({
      id: 'active',
      label: 'Situação',
      value: labelOf(ACTIVE_OPTIONS, list.filters.active),
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="dependent-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="dependent-search"
              className="pl-10"
              placeholder="Nome ou CPF"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dependent-resident">Morador</Label>
          <Select
            value={(list.filters.residentId as string) ?? ANY}
            onValueChange={(value) =>
              list.setFilter('residentId', value === ANY ? undefined : value)
            }
          >
            <SelectTrigger id="dependent-resident">
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
          <Label htmlFor="dependent-unit">Unidade</Label>
          <Select
            value={(list.filters.unitId as string) ?? ANY}
            onValueChange={(value) => list.setFilter('unitId', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="dependent-unit">
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
          <Label htmlFor="dependent-relationship">Parentesco</Label>
          <Select
            value={(list.filters.relationship as string) ?? ANY}
            onValueChange={(value) =>
              list.setFilter('relationship', value === ANY ? undefined : value)
            }
          >
            <SelectTrigger id="dependent-relationship">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {RELATIONSHIP_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dependent-active">Situação</Label>
          <Select
            value={(list.filters.active as string) ?? ANY}
            onValueChange={(value) => list.setFilter('active', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="dependent-active">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {ACTIVE_OPTIONS.map((option) => (
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
        marcada e nenhuma ação de restaurar (ADR-006).
      */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="include-deleted"
          checked={list.includeDeleted}
          onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
        />
        <Label htmlFor="include-deleted" className="font-normal">
          Incluir removidos
        </Label>
      </div>
    </FilterPanel>
  );
}

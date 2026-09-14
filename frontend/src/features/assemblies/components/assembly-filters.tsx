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
import { ASSEMBLY_MODES, ASSEMBLY_STATUSES, ASSEMBLY_TYPES } from '@/types/assembly';
import {
  ASSEMBLY_MODE_LABELS,
  ASSEMBLY_STATUS_LABELS,
  ASSEMBLY_TYPE_LABELS,
} from '../assembly-labels';

/**
 * O repositorio aceita `condominiumId`, `status`, `type` e `mode`. O condominio
 * vem do shell e nao e um controle; os outros tres sao oferecidos, e nada fora
 * da whitelist pode virar controle, porque o backend descarta o resto em
 * silencio e o filtro pareceria funcionar.
 */
const STATUS_OPTIONS = ASSEMBLY_STATUSES.map((value) => ({
  value,
  label: ASSEMBLY_STATUS_LABELS[value],
}));
const TYPE_OPTIONS = ASSEMBLY_TYPES.map((value) => ({
  value,
  label: ASSEMBLY_TYPE_LABELS[value],
}));
const MODE_OPTIONS = ASSEMBLY_MODES.map((value) => ({
  value,
  label: ASSEMBLY_MODE_LABELS[value],
}));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface AssemblyFiltersProps {
  list: ListState;
}

export function AssemblyFilters({ list }: AssemblyFiltersProps) {
  const chips: Filter[] = [];
  if (list.filters.status) {
    chips.push({
      id: 'status',
      label: 'Situacao',
      value: labelOf(STATUS_OPTIONS, list.filters.status),
    });
  }
  if (list.filters.type) {
    chips.push({ id: 'type', label: 'Tipo', value: labelOf(TYPE_OPTIONS, list.filters.type) });
  }
  if (list.filters.mode) {
    chips.push({ id: 'mode', label: 'Formato', value: labelOf(MODE_OPTIONS, list.filters.mode) });
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
        <div className="space-y-1.5">
          <Label htmlFor="assembly-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="assembly-search"
              className="pl-10"
              placeholder="Titulo, pauta ou local"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="assembly-status">Situacao</Label>
          <Select
            value={(list.filters.status as string) ?? ANY}
            onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="assembly-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="assembly-type">Tipo</Label>
          <Select
            value={(list.filters.type as string) ?? ANY}
            onValueChange={(value) => list.setFilter('type', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="assembly-type">
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
          <Label htmlFor="assembly-mode">Formato</Label>
          <Select
            value={(list.filters.mode as string) ?? ANY}
            onValueChange={(value) => list.setFilter('mode', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="assembly-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {MODE_OPTIONS.map((option) => (
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
          id="assembly-include-deleted"
          checked={list.includeDeleted}
          onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
        />
        <Label htmlFor="assembly-include-deleted" className="font-normal">
          Incluir removidas
        </Label>
      </div>
    </FilterPanel>
  );
}

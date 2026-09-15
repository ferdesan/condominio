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
import { CUSTOM_ROLE, SYSTEM_ROLE } from '../role-labels';

/**
 * `RoleRepository` aceita **um** filtro: `isSystem`. Nao ha `condominiumId` —
 * papel e por tenant —, e nao ha filtro por permissao: o servidor guarda a lista
 * como JSON e nao a indexa, entao um controle desses seria descartado em
 * silencio enquanto parecesse funcionar.
 */
const ORIGIN_OPTIONS = [
  { value: 'true', label: SYSTEM_ROLE },
  { value: 'false', label: CUSTOM_ROLE },
];

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

export interface RoleFiltersProps {
  list: ListState;
}

export function RoleFilters({ list }: RoleFiltersProps) {
  const chips: Filter[] = [];
  if (list.filters.isSystem !== undefined) {
    chips.push({
      id: 'isSystem',
      label: 'Origem',
      value:
        ORIGIN_OPTIONS.find((option) => option.value === String(list.filters.isSystem))?.label ??
        String(list.filters.isSystem),
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="role-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="role-search"
              className="pl-10"
              placeholder="Nome ou descricao"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role-origin">Origem</Label>
          <Select
            value={list.filters.isSystem === undefined ? ANY : String(list.filters.isSystem)}
            onValueChange={(value) =>
              list.setFilter('isSystem', value === ANY ? undefined : value)
            }
          >
            <SelectTrigger id="role-origin">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {ORIGIN_OPTIONS.map((option) => (
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
          id="role-include-deleted"
          checked={list.includeDeleted}
          onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
        />
        <Label htmlFor="role-include-deleted" className="font-normal">
          Incluir removidos
        </Label>
      </div>
    </FilterPanel>
  );
}

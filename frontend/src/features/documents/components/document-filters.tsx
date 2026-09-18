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
import { DOCUMENT_CATEGORIES, DOCUMENT_VISIBILITIES } from '@/types/document';
import { CATEGORY_LABELS, VISIBILITY_LABELS } from '../document-labels';

/**
 * O repositorio aceita `condominiumId`, `category` e `visibility`. O condominio
 * vem do shell e nao e um controle; os outros dois sao oferecidos, e nada fora
 * da whitelist pode virar controle, porque o backend descarta o resto em
 * silencio e o filtro pareceria funcionar.
 *
 * **Nao ha alternador de removidos**, ao contrario das demais telas (ADR-006):
 * a exclusao aqui apaga o arquivo do disco e nao tem rota de restauracao, entao
 * nao existe registro removido que se possa mostrar.
 */
const CATEGORY_OPTIONS = DOCUMENT_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

const VISIBILITY_OPTIONS = DOCUMENT_VISIBILITIES.map((value) => ({
  value,
  label: VISIBILITY_LABELS[value],
}));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface DocumentFiltersProps {
  list: ListState;
}

export function DocumentFilters({ list }: DocumentFiltersProps) {
  const chips: Filter[] = [];
  if (list.filters.category) {
    chips.push({
      id: 'category',
      label: 'Categoria',
      value: labelOf(CATEGORY_OPTIONS, list.filters.category),
    });
  }
  if (list.filters.visibility) {
    chips.push({
      id: 'visibility',
      label: 'Quem ve',
      value: labelOf(VISIBILITY_OPTIONS, list.filters.visibility),
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
          <Label htmlFor="document-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="document-search"
              className="pl-10"
              placeholder="Título, descrição ou nome do arquivo"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="document-category">Categoria</Label>
          <Select
            value={(list.filters.category as string) ?? ANY}
            onValueChange={(value) => list.setFilter('category', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="document-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="document-visibility">Quem ve</Label>
          <Select
            value={(list.filters.visibility as string) ?? ANY}
            onValueChange={(value) =>
              list.setFilter('visibility', value === ANY ? undefined : value)
            }
          >
            <SelectTrigger id="document-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {VISIBILITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FilterPanel>
  );
}

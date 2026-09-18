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
import {
  AUDIENCE_LABELS,
  CATEGORY_LABELS,
  PINNED_LABELS,
  STATUS_LABELS,
} from '../announcement-labels';

/**
 * O repositorio de comunicados aceita `condominiumId`, `status`, `category`,
 * `audience` e `pinned`. O condominio vem do shell e nao e um controle; restam
 * os outros quatro — e nada fora dessa lista pode virar controle, porque o
 * backend descarta o resto em silencio e o filtro pareceria funcionar.
 */
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const AUDIENCE_OPTIONS = Object.entries(AUDIENCE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const PINNED_OPTIONS = Object.entries(PINNED_LABELS).map(([value, label]) => ({ value, label }));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface AnnouncementFiltersProps {
  list: ListState;
}

export function AnnouncementFilters({ list }: AnnouncementFiltersProps) {
  const chips: Filter[] = [];
  if (list.filters.status) {
    chips.push({
      id: 'status',
      label: 'Status',
      value: labelOf(STATUS_OPTIONS, list.filters.status),
    });
  }
  if (list.filters.category) {
    chips.push({
      id: 'category',
      label: 'Categoria',
      value: labelOf(CATEGORY_OPTIONS, list.filters.category),
    });
  }
  if (list.filters.audience) {
    chips.push({
      id: 'audience',
      label: 'Público',
      value: labelOf(AUDIENCE_OPTIONS, list.filters.audience),
    });
  }
  if (list.filters.pinned) {
    chips.push({
      id: 'pinned',
      label: 'Fixação',
      value: labelOf(PINNED_OPTIONS, list.filters.pinned),
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
          <Label htmlFor="announcement-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="announcement-search"
              className="pl-10"
              placeholder="Título ou conteudo do comunicado"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="announcement-status">Status</Label>
          <Select
            value={(list.filters.status as string) ?? ANY}
            onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="announcement-status">
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
          <Label htmlFor="announcement-category">Categoria</Label>
          <Select
            value={(list.filters.category as string) ?? ANY}
            onValueChange={(value) => list.setFilter('category', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="announcement-category">
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
          <Label htmlFor="announcement-audience">Público</Label>
          <Select
            value={(list.filters.audience as string) ?? ANY}
            onValueChange={(value) => list.setFilter('audience', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="announcement-audience">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {AUDIENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/*
          `pinned` e coluna booleana no servidor, entao o filtro tem tres
          estados e não dois: sem recorte, so fixados, so não fixados. Uma
          caixa de marcar so conseguiria dizer dois deles.
        */}
        <div className="space-y-1.5">
          <Label htmlFor="announcement-pinned-filter">Fixação</Label>
          <Select
            value={(list.filters.pinned as string) ?? ANY}
            onValueChange={(value) => list.setFilter('pinned', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="announcement-pinned-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Fixados e não fixados</SelectItem>
              {PINNED_OPTIONS.map((option) => (
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
          id="announcement-include-deleted"
          checked={list.includeDeleted}
          onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
        />
        <Label htmlFor="announcement-include-deleted" className="font-normal">
          Incluir removidos
        </Label>
      </div>
    </FilterPanel>
  );
}

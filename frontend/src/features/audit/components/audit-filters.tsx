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
import { AUDIT_ACTIONS } from '@/types/audit';
import { ACTION_LABELS, RESOURCE_LABELS } from '../audit-labels';

/**
 * O repositorio da trilha aceita `action`, `resource`, `resourceId` e `userId`.
 * A tela oferece os dois que respondem as perguntas do dia a dia — o que
 * aconteceu e com o que —, e nada fora da whitelist pode virar controle, porque
 * o backend descarta o resto em silencio e o filtro pareceria funcionar.
 *
 * Nao ha controle de autor: `userId` e um identificador, e procurar por ele
 * exigiria um seletor de pessoas que esta tela nao precisa carregar —
 * `userName` esta entre os campos buscaveis, entao o nome ja e alcancavel pela
 * busca livre.
 *
 * Tambem nao ha alternador de removidos: a trilha e append-only e nenhuma
 * entrada dela e excluida, entao `includeDeleted` nao mudaria resultado nenhum.
 */
const ACTION_OPTIONS = AUDIT_ACTIONS.map((value) => ({ value, label: ACTION_LABELS[value] }));

const RESOURCE_OPTIONS = Object.entries(RESOURCE_LABELS)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface AuditFiltersProps {
  list: ListState;
}

export function AuditFilters({ list }: AuditFiltersProps) {
  const chips: Filter[] = [];
  if (list.filters.action) {
    chips.push({
      id: 'action',
      label: 'Ação',
      value: labelOf(ACTION_OPTIONS, list.filters.action),
    });
  }
  if (list.filters.resource) {
    chips.push({
      id: 'resource',
      label: 'Recurso',
      value: labelOf(RESOURCE_OPTIONS, list.filters.resource),
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
          <Label htmlFor="audit-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="audit-search"
              className="pl-10"
              placeholder="Autor, descrição ou recurso"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Ação</Label>
          <Select
            value={(list.filters.action as string) ?? ANY}
            onValueChange={(value) => list.setFilter('action', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="audit-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {ACTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-resource">Recurso</Label>
          <Select
            value={(list.filters.resource as string) ?? ANY}
            onValueChange={(value) => list.setFilter('resource', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="audit-resource">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {RESOURCE_OPTIONS.map((option) => (
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

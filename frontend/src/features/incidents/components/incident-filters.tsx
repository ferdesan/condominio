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
import type { IncidentAssignee } from '@/types/incident';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '../incident-labels';

/**
 * O repositorio de ocorrencias aceita `condominiumId`, `unitId`, `status`,
 * `category`, `priority`, `assignedToId` e `reportedById`. O condominio vem do
 * shell e nao e um controle; destes, a tela oferece os quatro que despacham a
 * fila — e nada fora da whitelist pode virar controle, porque o backend descarta
 * o resto em silencio e o filtro pareceria funcionar.
 */
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface IncidentFiltersProps {
  list: ListState;
  /** Ja recortados para o condominio selecionado por `scopeAssignees`. */
  assignees: IncidentAssignee[];
}

export function IncidentFilters({ list, assignees }: IncidentFiltersProps) {
  const assigneeOptions = assignees.map((user) => ({ value: user.id, label: user.name }));

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
  if (list.filters.priority) {
    chips.push({
      id: 'priority',
      label: 'Prioridade',
      value: labelOf(PRIORITY_OPTIONS, list.filters.priority),
    });
  }
  if (list.filters.assignedToId) {
    chips.push({
      id: 'assignedToId',
      label: 'Responsável',
      value: labelOf(assigneeOptions, list.filters.assignedToId),
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
          <Label htmlFor="incident-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="incident-search"
              className="pl-10"
              placeholder="Protocolo, título, descrição ou local"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="incident-status">Status</Label>
          <Select
            value={(list.filters.status as string) ?? ANY}
            onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="incident-status">
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
          <Label htmlFor="incident-category">Categoria</Label>
          <Select
            value={(list.filters.category as string) ?? ANY}
            onValueChange={(value) => list.setFilter('category', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="incident-category">
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
          <Label htmlFor="incident-priority">Prioridade</Label>
          <Select
            value={(list.filters.priority as string) ?? ANY}
            onValueChange={(value) => list.setFilter('priority', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="incident-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="incident-assignee">Responsável</Label>
          <Select
            value={(list.filters.assignedToId as string) ?? ANY}
            onValueChange={(value) =>
              list.setFilter('assignedToId', value === ANY ? undefined : value)
            }
          >
            <SelectTrigger id="incident-assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {assigneeOptions.map((option) => (
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
          id="incident-include-deleted"
          checked={list.includeDeleted}
          onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
        />
        <Label htmlFor="incident-include-deleted" className="font-normal">
          Incluir removidos
        </Label>
      </div>
    </FilterPanel>
  );
}

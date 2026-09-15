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
import type { Block, UnitStatus } from '@/types/api';
import { UNIT_STATUS_LABELS, UNIT_TYPE_LABELS } from '../unit-schema';

/**
 * O repositorio de unidades aceita exatamente `condominiumId`, `blockId`,
 * `status`, `type` e `floor`, e busca so por `number`. O condominio vem do shell,
 * entao a tela oferece os outros quatro — qualquer chave fora disso viraria um
 * controle que o backend descarta em silencio.
 */
const STATUS_OPTIONS = Object.entries(UNIT_STATUS_LABELS) as [UnitStatus, string][];

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

export interface UnitFiltersProps {
  list: ListState;
  blocks: Block[];
}

/** Os status marcados, sempre como lista — o backend le virgula como pertinencia. */
function selectedStatuses(value: ListState['filters'][string]): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function UnitFilters({ list, blocks }: UnitFiltersProps) {
  const statuses = selectedStatuses(list.filters.status);

  const chips: Filter[] = [];
  if (list.filters.blockId) {
    const block = blocks.find((item) => item.id === list.filters.blockId);
    chips.push({ id: 'blockId', label: 'Bloco', value: block?.name ?? 'Selecionado' });
  }
  if (statuses.length > 0) {
    chips.push({
      id: 'status',
      label: 'Status',
      value: statuses
        .map((status) => UNIT_STATUS_LABELS[status as UnitStatus] ?? status)
        .join(', '),
    });
  }
  if (list.filters.type) {
    const type = list.filters.type as keyof typeof UNIT_TYPE_LABELS;
    chips.push({ id: 'type', label: 'Tipo', value: UNIT_TYPE_LABELS[type] ?? String(type) });
  }
  if (list.filters.floor) {
    chips.push({ id: 'floor', label: 'Andar', value: String(list.filters.floor) });
  }

  /** O painel devolve os chips que sobraram; os que sairam viram filtro limpo. */
  function handleChipChange(remaining: Filter[]): void {
    const kept = new Set(remaining.map((chip) => chip.id));
    for (const chip of chips) {
      if (!kept.has(chip.id)) list.setFilter(chip.id, undefined);
    }
  }

  function toggleStatus(status: UnitStatus, checked: boolean): void {
    const next = checked ? [...statuses, status] : statuses.filter((item) => item !== status);
    list.setFilter('status', next.length > 0 ? next : undefined);
  }

  return (
    <FilterPanel filters={chips} onFilterChange={handleChipChange} onClear={list.clearFilters}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="unit-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="unit-search"
              className="pl-10"
              // O unico campo buscavel do recurso e o numero; prometer mais seria mentira.
              placeholder="Numero da unidade"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="unit-block-filter">Bloco</Label>
          <Select
            value={(list.filters.blockId as string) ?? ANY}
            onValueChange={(value) => list.setFilter('blockId', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="unit-block-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {blocks.map((block) => (
                <SelectItem key={block.id} value={block.id}>
                  {block.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="unit-type-filter">Tipo</Label>
          <Select
            value={(list.filters.type as string) ?? ANY}
            onValueChange={(value) => list.setFilter('type', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="unit-type-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="unit-floor-filter">Andar</Label>
          <Input
            id="unit-floor-filter"
            inputMode="numeric"
            placeholder="Todos"
            value={(list.filters.floor as string) ?? ''}
            onChange={(event) =>
              list.setFilter('floor', event.target.value === '' ? undefined : event.target.value)
            }
          />
        </div>
      </div>

      {/*
        Status aceita mais de um valor ao mesmo tempo — o backend le a lista
        separada por virgula como teste de pertinencia —, e um select de valor
        unico nao expressa isso.
      */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Status</legend>
        <div className="flex flex-wrap gap-4">
          {STATUS_OPTIONS.map(([status, label]) => (
            <div key={status} className="flex items-center gap-2">
              <Checkbox
                id={`unit-status-${status}`}
                checked={statuses.includes(status)}
                onCheckedChange={(checked) => toggleStatus(status, checked === true)}
              />
              <Label htmlFor={`unit-status-${status}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      {/*
        Sem gate de permissao: ver registros removidos e leitura, e o servidor
        aceita `includeDeleted` de quem pode ler. Quem nao pode editar ve a linha
        marcada e nenhuma acao de restaurar (ADR-006).
      */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="unit-include-deleted"
          checked={list.includeDeleted}
          onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
        />
        <Label htmlFor="unit-include-deleted" className="font-normal">
          Incluir removidas
        </Label>
      </div>
    </FilterPanel>
  );
}

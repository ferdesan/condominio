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
import { NOTIFICATION_TYPES } from '@/types/notification';
import { TYPE_LABELS } from '../notification-labels';

/**
 * O repositorio aceita `userId`, `type`, `resource` e `condominiumId`. Destes, a
 * tela oferece um: o tipo.
 *
 * `userId` e do servidor, que o sobrescreve com o da sessao. `condominiumId`
 * esconderia as notificacoes do tenant inteiro, que tem a coluna nula.
 * `resource` diria quase o mesmo que o tipo, com vocabulario de banco.
 *
 * E **nao ha filtro de nao lidas**: `readAt` nao esta entre os campos filtraveis
 * do servidor, entao o controle seria descartado em silencio e pareceria
 * funcionar. Quem quer saber quantas faltam le o indicador.
 */
const TYPE_OPTIONS = NOTIFICATION_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface NotificationFiltersProps {
  list: ListState;
}

export function NotificationFilters({ list }: NotificationFiltersProps) {
  const chips: Filter[] = [];
  if (list.filters.type) {
    chips.push({ id: 'type', label: 'Tipo', value: labelOf(TYPE_OPTIONS, list.filters.type) });
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notification-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="notification-search"
              className="pl-10"
              placeholder="Assunto ou mensagem"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notification-type">Tipo</Label>
          <Select
            value={(list.filters.type as string) ?? ANY}
            onValueChange={(value) => list.setFilter('type', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="notification-type">
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
      </div>
    </FilterPanel>
  );
}

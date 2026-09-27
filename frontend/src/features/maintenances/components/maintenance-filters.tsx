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
import type { ServiceProvider } from '@/types/api';
import type { User } from '@/types/user';
import { RECURRENCE_LABELS, STATUS_LABELS, TYPE_LABELS } from '../maintenance-labels';

/**
 * O repositorio de manutencoes aceita `condominiumId`, `status`, `type`,
 * `recurrence`, `serviceProviderId` e `responsibleId`. O condominio vem do shell
 * e nao e um controle; os outros cinco sao oferecidos aqui — e nada fora da
 * whitelist pode virar controle, porque o backend descarta o resto em silencio e
 * o filtro pareceria funcionar.
 */
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
const RECURRENCE_OPTIONS = Object.entries(RECURRENCE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface MaintenanceFiltersProps {
  list: ListState;
  /** Ja escopados ao condominio pelo proprio servidor. */
  providers: ServiceProvider[];
  /** Ja recortados para o condominio selecionado por `scopeToCondominium`. */
  responsibles: User[];
  /**
   * Sem `service-provider:read` / `user:read` a colecao nem e buscada — o
   * servidor recusaria —, e um select so com "Todos" nao filtra nada.
   */
  showProvider?: boolean;
  showResponsible?: boolean;
}

export function MaintenanceFilters({
  list,
  providers,
  responsibles,
  showProvider = true,
  showResponsible = true,
}: MaintenanceFiltersProps) {
  const providerOptions = providers.map((provider) => ({
    value: provider.id,
    label: provider.tradeName ?? provider.companyName,
  }));
  const responsibleOptions = responsibles.map((user) => ({ value: user.id, label: user.name }));

  const chips: Filter[] = [];
  if (list.filters.status) {
    chips.push({
      id: 'status',
      label: 'Status',
      value: labelOf(STATUS_OPTIONS, list.filters.status),
    });
  }
  if (list.filters.type) {
    chips.push({ id: 'type', label: 'Tipo', value: labelOf(TYPE_OPTIONS, list.filters.type) });
  }
  if (list.filters.recurrence) {
    chips.push({
      id: 'recurrence',
      label: 'Recorrência',
      value: labelOf(RECURRENCE_OPTIONS, list.filters.recurrence),
    });
  }
  if (list.filters.serviceProviderId) {
    chips.push({
      id: 'serviceProviderId',
      label: 'Prestador',
      value: labelOf(providerOptions, list.filters.serviceProviderId),
    });
  }
  if (list.filters.responsibleId) {
    chips.push({
      id: 'responsibleId',
      label: 'Responsável',
      value: labelOf(responsibleOptions, list.filters.responsibleId),
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 lg:col-span-3">
          <Label htmlFor="maintenance-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="maintenance-search"
              className="pl-10"
              placeholder="Título, descrição ou ativo"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maintenance-status">Status</Label>
          <Select
            value={(list.filters.status as string) ?? ANY}
            onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="maintenance-status">
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
          <Label htmlFor="maintenance-type">Tipo</Label>
          <Select
            value={(list.filters.type as string) ?? ANY}
            onValueChange={(value) => list.setFilter('type', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="maintenance-type">
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
          <Label htmlFor="maintenance-recurrence">Recorrência</Label>
          <Select
            value={(list.filters.recurrence as string) ?? ANY}
            onValueChange={(value) =>
              list.setFilter('recurrence', value === ANY ? undefined : value)
            }
          >
            <SelectTrigger id="maintenance-recurrence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {RECURRENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showProvider ? (
          <div className="space-y-1.5">
            <Label htmlFor="maintenance-provider">Prestador</Label>
            <Select
              value={(list.filters.serviceProviderId as string) ?? ANY}
              onValueChange={(value) =>
                list.setFilter('serviceProviderId', value === ANY ? undefined : value)
              }
            >
              <SelectTrigger id="maintenance-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todos</SelectItem>
                {providerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {showResponsible ? (
          <div className="space-y-1.5">
            <Label htmlFor="maintenance-responsible">Responsável</Label>
            <Select
              value={(list.filters.responsibleId as string) ?? ANY}
              onValueChange={(value) =>
                list.setFilter('responsibleId', value === ANY ? undefined : value)
              }
            >
              <SelectTrigger id="maintenance-responsible">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todos</SelectItem>
                {responsibleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {/*
        Sem gate de permissao: ver registros removidos e leitura, e o servidor
        aceita `includeDeleted` de quem pode ler. Quem nao pode editar ve a linha
        marcada e nenhuma ação de restaurar (ADR-006).
      */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="maintenance-include-deleted"
          checked={list.includeDeleted}
          onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
        />
        <Label htmlFor="maintenance-include-deleted" className="font-normal">
          Incluir removidos
        </Label>
      </div>
    </FilterPanel>
  );
}

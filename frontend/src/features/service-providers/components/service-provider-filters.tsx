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
import { STATUS_LABELS } from '../service-provider-labels';

/**
 * O repositorio de prestadores aceita `condominiumId`, `status` e `serviceType`.
 * O condominio vem do shell e nao e um controle; restam os outros dois — e nada
 * fora dessa lista pode virar controle, porque o backend descarta o resto em
 * silencio e o filtro pareceria funcionar.
 */
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

export interface ServiceProviderFiltersProps {
  list: ListState;
  /** Tipos ja cadastrados no condominio: o servidor compara por igualdade. */
  serviceTypes: string[];
}

export function ServiceProviderFilters({ list, serviceTypes }: ServiceProviderFiltersProps) {
  const chips: Filter[] = [];
  if (list.filters.serviceType) {
    chips.push({ id: 'serviceType', label: 'Tipo de serviço', value: list.filters.serviceType });
  }
  if (list.filters.status) {
    chips.push({
      id: 'status',
      label: 'Status',
      value:
        STATUS_OPTIONS.find((option) => option.value === list.filters.status)?.label ??
        String(list.filters.status),
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
          <Label htmlFor="provider-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="provider-search"
              className="pl-10"
              placeholder="Razao social, nome fantasia, documento, serviço ou contato"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="provider-service-type">Tipo de serviço</Label>
          <Select
            value={(list.filters.serviceType as string) ?? ANY}
            onValueChange={(value) =>
              list.setFilter('serviceType', value === ANY ? undefined : value)
            }
          >
            <SelectTrigger id="provider-service-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {serviceTypes.map((serviceType) => (
                <SelectItem key={serviceType} value={serviceType}>
                  {serviceType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="provider-status">Status</Label>
          <Select
            value={(list.filters.status as string) ?? ANY}
            onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="provider-status">
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
      </div>

      {/*
        Sem gate de permissao: ver registros removidos e leitura, e o servidor
        aceita `includeDeleted` de quem pode ler. Quem nao pode editar ve a linha
        marcada e nenhuma ação de restaurar (ADR-006).
      */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="provider-include-deleted"
          checked={list.includeDeleted}
          onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
        />
        <Label htmlFor="provider-include-deleted" className="font-normal">
          Incluir removidos
        </Label>
      </div>
    </FilterPanel>
  );
}

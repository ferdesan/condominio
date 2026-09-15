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
import type { Unit } from '@/types/api';
import { STATUS_LABELS, TYPE_LABELS, unitLabel } from '../visitor-labels';

/**
 * O repositorio de visitantes aceita `condominiumId`, `unitId`, `status`, `type`
 * e `authorizedById`. O condominio vem do shell e nao e um controle; restam os
 * outros quatro — e nada fora dessa lista pode virar controle, porque o backend
 * descarta o resto em silencio e o filtro pareceria funcionar.
 *
 * `authorizedById` guarda o id de um usuario, e nao ha tela de usuarios nesta
 * entrega para alimentar um seletor. O unico id que esta tela conhece com
 * certeza e o de quem esta usando, entao o filtro aparece como a pergunta que
 * esse id responde: as visitas que a propria pessoa autorizou.
 */
const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface VisitorFiltersProps {
  list: ListState;
  units: Unit[];
  /** Id de quem esta usando a tela, para o filtro de autorizacao propria. */
  currentUserId: string | null;
}

export function VisitorFilters({ list, units, currentUserId }: VisitorFiltersProps) {
  const unitOptions = units.map((unit) => ({ value: unit.id, label: unitLabel(unit) }));
  const authorizedByMe = Boolean(currentUserId) && list.filters.authorizedById === currentUserId;

  const chips: Filter[] = [];
  if (list.filters.unitId) {
    chips.push({
      id: 'unitId',
      label: 'Unidade',
      value: labelOf(unitOptions, list.filters.unitId),
    });
  }
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
  if (authorizedByMe) {
    chips.push({ id: 'authorizedById', label: 'Autorizacao', value: 'Minhas' });
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
          <Label htmlFor="visitor-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="visitor-search"
              className="pl-10"
              placeholder="Nome, documento, empresa, placa ou cracha"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="visitor-unit">Unidade</Label>
          <Select
            value={(list.filters.unitId as string) ?? ANY}
            onValueChange={(value) => list.setFilter('unitId', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="visitor-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {unitOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="visitor-status">Status</Label>
          <Select
            value={(list.filters.status as string) ?? ANY}
            onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="visitor-status">
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
          <Label htmlFor="visitor-type">Tipo</Label>
          <Select
            value={(list.filters.type as string) ?? ANY}
            onValueChange={(value) => list.setFilter('type', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="visitor-type">
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

      <div className="flex flex-wrap items-center gap-6">
        {currentUserId ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="visitor-authorized-by-me"
              checked={authorizedByMe}
              onCheckedChange={(checked) =>
                list.setFilter('authorizedById', checked === true ? currentUserId : undefined)
              }
            />
            <Label htmlFor="visitor-authorized-by-me" className="font-normal">
              Autorizadas por mim
            </Label>
          </div>
        ) : null}

        {/*
          Sem gate de permissao: ver registros removidos e leitura, e o servidor
          aceita `includeDeleted` de quem pode ler. Quem nao pode editar ve a
          linha marcada e nenhuma acao de restaurar (ADR-006).
        */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="visitor-include-deleted"
            checked={list.includeDeleted}
            onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
          />
          <Label htmlFor="visitor-include-deleted" className="font-normal">
            Incluir removidos
          </Label>
        </div>
      </div>
    </FilterPanel>
  );
}

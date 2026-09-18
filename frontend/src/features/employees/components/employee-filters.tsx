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
import { CONTRACT_TYPE_LABELS, STATUS_LABELS } from '../employee-labels';

/**
 * O repositorio de funcionarios aceita `condominiumId`, `status`, `department` e
 * `contractType`. O condominio vem do shell e nao e um controle; restam os
 * outros tres — e nada fora dessa lista pode virar controle, porque o backend
 * descarta o resto em silencio e o filtro pareceria funcionar.
 */
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
const CONTRACT_TYPE_OPTIONS = Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

function labelOf(options: readonly { value: string; label: string }[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export interface EmployeeFiltersProps {
  list: ListState;
  /** Departamentos ja usados no condominio; a comparacao no servidor e exata. */
  departments: string[];
}

export function EmployeeFilters({ list, departments }: EmployeeFiltersProps) {
  const chips: Filter[] = [];
  if (list.filters.status) {
    chips.push({
      id: 'status',
      label: 'Status',
      value: labelOf(STATUS_OPTIONS, list.filters.status),
    });
  }
  if (list.filters.department) {
    chips.push({
      id: 'department',
      label: 'Departamento',
      value: String(list.filters.department),
    });
  }
  if (list.filters.contractType) {
    chips.push({
      id: 'contractType',
      label: 'Contrato',
      value: labelOf(CONTRACT_TYPE_OPTIONS, list.filters.contractType),
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
        <div className="space-y-1.5">
          <Label htmlFor="employee-search">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="employee-search"
              className="pl-10"
              placeholder="Nome, CPF, cargo ou e-mail"
              value={list.searchInput}
              onChange={(event) => list.setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="employee-status">Status</Label>
          <Select
            value={(list.filters.status as string) ?? ANY}
            onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
          >
            <SelectTrigger id="employee-status">
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

        {/*
          Departamento e texto livre comparado por igualdade no servidor: um
          campo de digitação acertaria o filtro so por coincidência de grafia.
          As opções sao os departamentos que já existem — e quando não existe
          nenhum, não ha filtro a oferecer.
        */}
        {departments.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="employee-department">Departamento</Label>
            <Select
              value={(list.filters.department as string) ?? ANY}
              onValueChange={(value) =>
                list.setFilter('department', value === ANY ? undefined : value)
              }
            >
              <SelectTrigger id="employee-department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todos</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="employee-contract-type">Contrato</Label>
          <Select
            value={(list.filters.contractType as string) ?? ANY}
            onValueChange={(value) =>
              list.setFilter('contractType', value === ANY ? undefined : value)
            }
          >
            <SelectTrigger id="employee-contract-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {CONTRACT_TYPE_OPTIONS.map((option) => (
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
          id="include-deleted"
          checked={list.includeDeleted}
          onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
        />
        <Label htmlFor="include-deleted" className="font-normal">
          Incluir removidos
        </Label>
      </div>
    </FilterPanel>
  );
}

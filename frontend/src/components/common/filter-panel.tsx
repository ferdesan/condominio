import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface Filter {
  id: string;
  label: string;
  value: any;
}

export interface FilterPanelProps {
  filters: Filter[];
  onFilterChange: (filters: Filter[]) => void;
  onClear: () => void;
  children: ReactNode;
  title?: string;
  showActiveOnly?: boolean;
}

/**
 * FilterPanel Component
 *
 * A flexible filter panel for applying dynamic filters to data.
 *
 * ## Features
 *
 * - **Dynamic filters**: Add and remove filters dynamically
 * - **Clear filters**: Reset all filters at once
 * - **Responsive**: Works on all screen sizes
 * - **Accessible**: ARIA labels and keyboard support
 *
 * ## Usage
 *
 * ```tsx
 * const [filters, setFilters] = useState<Filter[]>([
 *   { id: 'status', label: 'Status', value: 'active' },
 * ]);
 *
 * return (
 *   <FilterPanel
 *     filters={filters}
 *     onFilterChange={setFilters}
 *     onClear={() => setFilters([])}
 *     title="Filtros"
 *   >
 *     <div className="space-y-4">
 *       <div>
 *         <label>Status:</label>
 *         <Select
 *           value={filters.find(f => f.id === 'status')?.value}
 *           onValueChange={(value) => {
 *             setFilters(filters.map(f =>
 *               f.id === 'status' ? { ...f, value } : f
 *             ));
 *           }}
 *         >
 *           <SelectTrigger>
 *             <SelectValue />
 *           </SelectTrigger>
 *           <SelectContent>
 *             <SelectItem value="active">Ativo</SelectItem>
 *             <SelectItem value="inactive">Inativo</SelectItem>
 *           </SelectContent>
 *         </Select>
 *       </div>
 *     </div>
 *   </FilterPanel>
 * );
 * ```
 */
export function FilterPanel({
  filters,
  onFilterChange,
  onClear,
  children,
  title = 'Filtros',
  showActiveOnly = false,
}: FilterPanelProps) {
  const activeFilters = filters.filter((f) => f.value !== null && f.value !== undefined && f.value !== '');

  const handleRemoveFilter = (id: string) => {
    onFilterChange(filters.filter((f) => f.id !== id));
  };

  if (showActiveOnly && activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between p-4">
          <h3 className="font-semibold">{title}</h3>
          {activeFilters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-xs"
              aria-label="Limpar filtros"
            >
              Limpar
            </Button>
          )}
        </div>

        <>
          <div className="px-4 pb-4 space-y-4 border-t border-border">{children}</div>

          {activeFilters.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-muted/30">
                <div className="flex flex-wrap gap-2">
                  {activeFilters.map((filter) => (
                    <div
                      key={filter.id}
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
                    >
                      <span className="font-medium">{filter.label}:</span>
                      <span className="font-mono text-xs">{String(filter.value)}</span>
                      <button
                        onClick={() => handleRemoveFilter(filter.id)}
                        className="ml-1 hover:opacity-70 transition-opacity"
                        aria-label={`Remover filtro ${filter.label}`}
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </>
      </Card>
    </div>
  );
}

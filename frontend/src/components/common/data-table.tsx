import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from './empty-state';

export interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => ReactNode;
  width?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

export interface DataTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (term: string) => void;
  sortable?: boolean;
  onSort?: (column: string, direction: SortDirection) => void;
  sort?: SortState;
  pageable?: boolean;
  pageSize?: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  emptyIcon?: any;
  emptyTitle?: string;
  emptyDescription?: string;
  rowClassName?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  idKey?: keyof T;
}

/**
 * DataTable Component
 *
 * A reusable data table component with pagination, sorting, and search capabilities.
 *
 * ## Features
 *
 * - **Pagination**: Navigate through pages of data
 * - **Sorting**: Click column headers to sort (when `sortable` is enabled)
 * - **Search**: Filter data with a search input (when `searchable` is enabled)
 * - **Loading**: Display loading state while data is being fetched
 * - **Empty state**: Show custom empty state when no data is available
 * - **Responsive**: Works on all screen sizes
 * - **Accessible**: ARIA labels and keyboard navigation support
 *
 * ## Usage
 *
 * ```tsx
 * const [data, setData] = useState<User[]>([]);
 * const [page, setPage] = useState(1);
 * const [sort, setSort] = useState<SortState>({ column: null, direction: 'asc' });
 * const [search, setSearch] = useState('');
 *
 * return (
 *   <DataTable
 *     columns={[
 *       { key: 'id', label: 'ID', sortable: true },
 *       { key: 'name', label: 'Name', sortable: true },
 *       { key: 'email', label: 'Email' },
 *       {
 *         key: 'actions',
 *         label: 'Actions',
 *         render: (_, row) => (
 *           <Button onClick={() => handleEdit(row)}>Edit</Button>
 *         ),
 *       },
 *     ]}
 *     data={data}
 *     pageable
 *     pageSize={10}
 *     currentPage={page}
 *     totalPages={Math.ceil(total / 10)}
 *     onPageChange={setPage}
 *     sortable
 *     sort={sort}
 *     onSort={(col, dir) => setSort({ column: col, direction: dir })}
 *     searchable
 *     onSearch={setSearch}
 *     emptyTitle="No users found"
 *   />
 * );
 * ```
 */
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Buscar...',
  onSearch,
  sortable = true,
  onSort,
  sort,
  pageable = true,
  pageSize = 10,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  emptyIcon,
  emptyTitle = 'Nenhum dado encontrado',
  emptyDescription = 'Tente ajustar seus filtros',
  rowClassName,
  onRowClick,
  idKey,
}: DataTableProps<T>) {
  const displayData = data.slice(0, pageSize);

  const handleSort = (columnKey: string) => {
    if (!sortable || !onSort) return;

    const newDirection: SortDirection =
      sort?.column === columnKey && sort.direction === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newDirection);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1 && onPageChange) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages && onPageChange) {
      onPageChange(currentPage + 1);
    }
  };

  const handleFirstPage = () => {
    if (onPageChange) {
      onPageChange(1);
    }
  };

  const handleLastPage = () => {
    if (onPageChange) {
      onPageChange(totalPages);
    }
  };

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            onChange={(e) => onSearch?.(e.target.value)}
            className="pl-10"
            aria-label="Buscar"
          />
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className="px-4 py-3 text-left font-medium"
                    style={{ width: column.width }}
                  >
                    {sortable && column.sortable ? (
                      <button
                        onClick={() => handleSort(String(column.key))}
                        className="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer select-none"
                        aria-sort={
                          sort?.column === String(column.key)
                            ? sort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        {column.label}
                        {sort?.column === String(column.key) && (
                          <span aria-hidden="true">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="size-4 animate-spin rounded-full border-2 border-muted border-b-foreground" />
                      <span className="text-sm text-muted-foreground">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : displayData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8">
                    <EmptyState
                      icon={emptyIcon || Search}
                      title={emptyTitle}
                      description={emptyDescription}
                    />
                  </td>
                </tr>
              ) : (
                displayData.map((row, index) => (
                  <tr
                    key={idKey ? String(row[idKey]) : index}
                    className={`border-b border-border hover:bg-muted/50 transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${rowClassName?.(row, index) || ''}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className="px-4 py-3"
                        style={{ width: column.width }}
                      >
                        {column.render ? column.render(row[column.key], row) : String(row[column.key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pageable && totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleFirstPage}
              disabled={currentPage === 1 || loading}
              aria-label="Ir para primeira página"
            >
              <ChevronsLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || loading}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages || loading}
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLastPage}
              disabled={currentPage === totalPages || loading}
              aria-label="Ir para última página"
            >
              <ChevronsRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

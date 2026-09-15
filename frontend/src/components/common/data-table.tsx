import type { KeyboardEvent, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from './empty-state';

export type CellRenderer<T> = (value: T[keyof T], row: T) => ReactNode;

interface ColumnBase<T> {
  label: string;
  sortable?: boolean;
  render?: CellRenderer<T>;
  width?: string;
}

/** Coluna ligada a um campo da linha: a chave precisa existir em `T`. */
export interface FieldColumn<T> extends ColumnBase<T> {
  key: keyof T;
}

/**
 * Coluna que traz o proprio renderer — acoes, por exemplo. Como nao le nenhum
 * campo da linha, a chave e um identificador livre (ADR-009).
 */
export interface RenderedColumn<T> extends ColumnBase<T> {
  key: string;
  render: CellRenderer<T>;
}

export type Column<T> = FieldColumn<T> | RenderedColumn<T>;

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
  /** Valor controlado da busca. Quem passa tambem faz o debounce da requisicao. */
  searchValue?: string;
  onSearch?: (term: string) => void;
  sortable?: boolean;
  onSort?: (column: string, direction: SortDirection) => void;
  sort?: SortState;
  pageable?: boolean;
  /** Recorta `data` na pagina atual. Deixe desligado quando o servidor pagina. */
  clientPagination?: boolean;
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

/** Placeholder neutro para valores ausentes, o mesmo de `lib/format.ts`. */
const EMPTY_CELL = '—';

/** Zero e string vazia sao valores; so nulo e indefinido viram placeholder. */
function displayCellValue(value: unknown): ReactNode {
  if (value === null || value === undefined) return EMPTY_CELL;
  return String(value);
}

function ariaSortValue(direction: SortDirection | null): 'ascending' | 'descending' | 'none' {
  if (direction === 'asc') return 'ascending';
  if (direction === 'desc') return 'descending';
  return 'none';
}

/**
 * DataTable Component
 *
 * A reusable data table component with pagination, sorting, and search capabilities.
 *
 * ## Features
 *
 * - **Pagination**: server-side by default — the rows received are the rows rendered.
 *   Set `clientPagination` only when the whole collection is already in memory.
 * - **Sorting**: click column headers to sort (when `sortable` is enabled). The direction
 *   vocabulary is `asc`/`desc`; translating it to the API's casing belongs to the data
 *   layer, not here (ADR-008).
 * - **Search**: controlled through `searchValue`, so the caller can clear it. The callback
 *   fires per keystroke; debouncing belongs to whoever issues the request.
 * - **Loading**: display loading state while data is being fetched
 * - **Empty state**: show custom empty state when no data is available
 * - **Responsive**: Works on all screen sizes
 * - **Accessible**: sortable headers announce their state, clickable rows are focusable
 *   and activate with Enter or Space.
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
 *         // Identificador livre: so vale porque a coluna traz o proprio renderer.
 *         key: 'actions',
 *         label: 'Actions',
 *         render: (_, row) => (
 *           <Button onClick={() => handleEdit(row)}>Edit</Button>
 *         ),
 *       },
 *     ]}
 *     data={data}
 *     pageable
 *     pageSize={20}
 *     currentPage={page}
 *     totalPages={meta.totalPages}
 *     onPageChange={setPage}
 *     sortable
 *     sort={sort}
 *     onSort={(col, dir) => setSort({ column: col, direction: dir })}
 *     searchable
 *     searchValue={search}
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
  searchValue,
  onSearch,
  sortable = true,
  onSort,
  sort,
  pageable = true,
  clientPagination = false,
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
  // Com paginacao no servidor a pagina ja chega pronta; recortar aqui derruba linhas.
  const displayData = clientPagination
    ? data.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : data;

  const handleSort = (columnKey: string) => {
    if (!sortable || !onSort) return;

    const newDirection: SortDirection =
      sort?.column === columnKey && sort.direction === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newDirection);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onRowClick(row);
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
      {searchable ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearch?.(e.target.value)}
            className="pl-10"
            aria-label="Buscar"
          />
        </div>
      ) : null}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {columns.map((column) => {
                  const columnKey = String(column.key);
                  const isSortable = Boolean(sortable && column.sortable);
                  const activeDirection = sort && sort.column === columnKey ? sort.direction : null;

                  return (
                    <th
                      key={columnKey}
                      scope="col"
                      className="px-4 py-3 text-left font-medium"
                      style={{ width: column.width }}
                      aria-sort={isSortable ? ariaSortValue(activeDirection) : undefined}
                    >
                      {isSortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(columnKey)}
                          className="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer select-none"
                        >
                          {column.label}
                          {activeDirection ? (
                            <span aria-hidden="true">{activeDirection === 'asc' ? '↑' : '↓'}</span>
                          ) : null}
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  );
                })}
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
                      onRowClick
                        ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
                        : ''
                    } ${rowClassName?.(row, index) || ''}`}
                    role={onRowClick ? 'button' : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (event) => handleRowKeyDown(event, row) : undefined}
                  >
                    {columns.map((column) => {
                      const value = row[column.key as keyof T];
                      const renderer = column.render;

                      return (
                        <td
                          key={String(column.key)}
                          className="px-4 py-3"
                          style={{ width: column.width }}
                        >
                          {renderer ? renderer(value, row) : displayCellValue(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pageable && totalPages > 1 ? (
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
      ) : null}
    </div>
  );
}

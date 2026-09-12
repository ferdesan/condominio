import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface CrudLayoutProps {
  header: ReactNode;
  filters?: ReactNode;
  content: ReactNode;
  footer?: ReactNode;
  sidebar?: ReactNode;
  sidebarPosition?: 'left' | 'right';
}

/**
 * CrudLayout Component
 *
 * A standard layout for CRUD (Create, Read, Update, Delete) operations.
 *
 * ## Structure
 *
 * ```
 * ┌─────────────────────────────────┐
 * │         Header/PageHeader        │
 * ├─────────────────────────────────┤
 * │  ┌─────────────────────────────┐ │
 * │  │      FilterPanel            │ │
 * │  └─────────────────────────────┘ │
 * ├─────────────────────────────────┤
 * │ │           │                   │ │
 * │ │ Sidebar   │ DataTable/Content │ │
 * │ │ (optional)│                   │ │
 * │ │           │                   │ │
 * ├─────────────────────────────────┤
 * │         Footer (optional)        │
 * └─────────────────────────────────┘
 * ```
 *
 * ## Features
 *
 * - **Responsive**: Adapts to different screen sizes
 * - **Flexible**: Works with any content
 * - **Accessible**: Semantic HTML structure
 *
 * ## Usage
 *
 * ```tsx
 * import { CrudLayout } from '@/components/common/crud-layout';
 * import { DataTable } from '@/components/common/data-table';
 * import { PageHeader } from '@/components/common/page-header';
 * import { FilterPanel } from '@/components/common/filter-panel';
 * import { Button } from '@/components/ui/button';
 *
 * export function UsersPage() {
 *   const [users, setUsers] = useState([]);
 *   const [filters, setFilters] = useState([]);
 *
 *   return (
 *     <CrudLayout
 *       header={
 *         <PageHeader
 *           title="Usuários"
 *           description="Gerenciar usuários do sistema"
 *           actions={<Button>Novo Usuário</Button>}
 *         />
 *       }
 *       filters={
 *         <FilterPanel
 *           filters={filters}
 *           onFilterChange={setFilters}
 *           onClear={() => setFilters([])}
 *         >
 *           Filter controls here
 *         </FilterPanel>
 *       }
 *       content={
 *         <DataTable
 *           columns={[
 *             { key: 'id', label: 'ID' },
 *             { key: 'name', label: 'Nome' },
 *             { key: 'email', label: 'Email' },
 *           ]}
 *           data={users}
 *         />
 *       }
 *     />
 *   );
 * }
 * ```
 */
export function CrudLayout({
  header,
  filters,
  content,
  footer,
  sidebar,
  sidebarPosition = 'right',
}: CrudLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>{header}</div>

      {/* Filters */}
      {filters && <div>{filters}</div>}

      {/* Main Content */}
      <div
        className={cn(
          'grid gap-6',
          sidebar && sidebarPosition === 'right' && 'lg:grid-cols-[1fr_300px]',
          sidebar && sidebarPosition === 'left' && 'lg:grid-cols-[300px_1fr]',
        )}
      >
        {/* Sidebar Left */}
        {sidebar && sidebarPosition === 'left' && <aside className="hidden lg:block">{sidebar}</aside>}

        {/* Content */}
        <Card className="overflow-hidden">{content}</Card>

        {/* Sidebar Right */}
        {sidebar && sidebarPosition === 'right' && <aside className="hidden lg:block">{sidebar}</aside>}
      </div>

      {/* Footer */}
      {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}

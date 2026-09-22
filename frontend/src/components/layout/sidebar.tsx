import { NavLink } from 'react-router-dom';
import { Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS } from '@/routes/navigation';

type SidebarProps = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
};

function useNavSections() {
  const { can } = useAuth();
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(item.permission)),
  })).filter((section) => section.items.length > 0);
}

/** Desktop sidebar — static flex child, visible only lg+. */
export function Sidebar({ collapsed }: Pick<SidebarProps, 'collapsed'>) {
  const sections = useNavSections();

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-svh flex-col border-r border-border bg-sidebar text-sidebar-foreground lg:flex',
        'transition-all duration-200 ease-out',
        collapsed ? 'w-16' : 'w-72',
      )}
      aria-label="Navegação principal"
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-border',
          collapsed ? 'justify-center px-2' : 'justify-between gap-2 px-4',
        )}
      >
        {collapsed ? (
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            CS
          </span>
        ) : (
          <span className="flex items-center gap-2.5 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <span className="truncate">Condomínio</span>
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-3 py-4">
        {sections.map((section) => (
          <div key={section.title}>
            {collapsed ? (
              <div className="mx-3 mb-2 border-t border-border" />
            ) : (
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-muted">
                {section.title}
              </p>
            )}
            <ul className={cn('space-y-0.5', collapsed && 'space-y-1')}>
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        'touch-target lg:min-h-0',
                        collapsed && 'justify-center px-2',
                        isActive
                          ? 'bg-sidebar-accent text-primary'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** Mobile bottom sheet — fixed overlay, visible only <lg. */
export function MobileNav({ open, onClose }: Pick<SidebarProps, 'open' | 'onClose'>) {
  const sections = useNavSections();

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 lg:hidden',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl bg-background shadow-xl transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-base font-semibold">Navegação</span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar menu">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Sections */}
        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(85vh - 64px)' }}>
          {sections.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-medium transition-colors',
                        'active:scale-95',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80',
                      )
                    }
                  >
                    <item.icon className="size-5" aria-hidden="true" />
                    <span className="text-center leading-tight">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

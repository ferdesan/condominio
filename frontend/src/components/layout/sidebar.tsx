import { NavLink } from 'react-router-dom';
import { Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS } from '@/routes/navigation';

type SidebarProps = {
  /** No mobile a sidebar vira drawer; no desktop fica sempre visivel. */
  open: boolean;
  /** Estado de colapso (desktop). */
  collapsed: boolean;
  onClose: () => void;
};

export function Sidebar({ open, collapsed, onClose }: SidebarProps) {
  const { can } = useAuth();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      {/* Fundo escuro do drawer; no desktop nunca aparece. */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground',
          'transition-all duration-200 ease-out lg:static lg:z-auto lg:translate-x-0',
          collapsed ? 'w-16' : 'w-72',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        aria-label="Navegação principal"
      >
        {/* Header */}
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

          <Button
            variant="ghost"
            size="icon"
            className={cn('lg:hidden', collapsed && 'hidden')}
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        {/* Navegação */}
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
                      onClick={onClose}
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
    </>
  );
}

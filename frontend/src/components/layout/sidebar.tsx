import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Building2, ChevronDown, LayoutGrid, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS } from '@/routes/navigation';
import type { NavItem } from '@/routes/navigation';

function useNavSections() {
  const { can } = useAuth();
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(item.permission)),
  })).filter((section) => section.items.length > 0);
}

/** Bottom bar: 2 itens esquerda, botão central, 2 itens direita */
const BOTTOM_LEFT = [
  { to: '/', label: 'Início' },
  { to: '/financeiro', label: 'Financeiro' },
];
const BOTTOM_RIGHT = [
  { to: '/ocorrencias', label: 'Ocorrências' },
  { to: '/manutencoes', label: 'Manutenções' },
];

/* ──────────────────────────────────────────────
   Desktop sidebar — collapsible sections
   ────────────────────────────────────────────── */

function SidebarSection({ section }: { section: { title: string; items: NavItem[] } }) {
  const [open, setOpen] = useState(true);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground transition-colors"
      >
        {section.title}
        <ChevronDown
          className={cn('size-3 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul className="space-y-0.5">
          {section.items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'touch-target lg:min-h-0',
                    isActive
                      ? 'bg-sidebar-accent text-primary'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  )
                }
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar() {
  const sections = useNavSections();

  return (
    <aside
      className="sticky top-0 hidden h-svh w-72 flex-col border-r border-border bg-sidebar text-sidebar-foreground lg:flex"
      aria-label="Navegação principal"
    >
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="size-5" aria-hidden="true" />
        </span>
        <span className="truncate text-sm font-semibold">Condomínio</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <ul className="space-y-4">
          {sections.map((section) => (
            <SidebarSection key={section.title} section={section} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/* ──────────────────────────────────────────────
   Mobile — bottom bar + sheet
   ────────────────────────────────────────────── */

export function MobileBottomBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { can } = useAuth();

  const findItem = (to: string) =>
    NAV_SECTIONS.flatMap((s) => s.items).find((n) => n.to === to);

  const isAllowed = (to: string) => {
    const item = findItem(to);
    return !item?.permission || can(item.permission);
  };

  const left = BOTTOM_LEFT.filter((i) => isAllowed(i.to));
  const right = BOTTOM_RIGHT.filter((i) => isAllowed(i.to));

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm lg:hidden safe-bottom"
      aria-label="Navegação rápida"
    >
      <div className="flex items-end justify-around px-2 pb-2 pt-1">
        {left.map((item) => {
          const navItem = findItem(item.to)!;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors min-w-[52px]',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full transition-colors',
                      isActive ? 'bg-primary/10' : 'bg-muted',
                    )}
                  >
                    <navItem.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}

        {/* Botão central — abre menu completo */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center gap-0.5 -mt-4"
          aria-label="Abrir menu completo"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-active active:scale-95">
            <LayoutGrid className="size-6" aria-hidden="true" />
          </span>
        </button>

        {right.map((item) => {
          const navItem = findItem(item.to)!;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors min-w-[52px]',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full transition-colors',
                      isActive ? 'bg-primary/10' : 'bg-muted',
                    )}
                  >
                    <navItem.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sections = useNavSections();

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 lg:hidden',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl bg-background shadow-xl transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-base font-semibold">Navegação</span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar menu">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

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

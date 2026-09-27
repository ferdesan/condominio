import { Fragment, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Building2, ChevronDown, LayoutGrid, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS, QUICK_NAV_POOL, QUICK_NAV_SLOTS } from '@/routes/navigation';
import type { NavItem } from '@/routes/navigation';

function useNavSections() {
  const { can } = useAuth();
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(item.permission)),
  })).filter((section) => section.items.length > 0);
}

/* ──────────────────────────────────────────────
   Desktop sidebar — collapsible sections
   ────────────────────────────────────────────── */

function SidebarSection({
  section,
  collapsed,
}: {
  section: { title: string; items: NavItem[] };
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(true);

  // Colapsado: so icones, sem titulo de secao. O `title` do link cobre o hover.
  if (collapsed) {
    return (
      <li>
        <ul className="space-y-0.5">
          {section.items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                title={item.label}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-center rounded-md py-2 transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-primary'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  )
                }
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="sr-only">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </li>
    );
  }

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
  const { collapsed } = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-svh flex-col border-r border-border bg-sidebar text-sidebar-foreground lg:flex',
        'transition-all duration-200 ease-out',
        collapsed ? 'w-16' : 'w-72',
      )}
      aria-label="Navegação principal"
      aria-expanded={!collapsed}
    >
      {/* Header */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-2.5 border-b border-border',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="size-5" aria-hidden="true" />
        </span>
        {!collapsed && <span className="truncate text-sm font-semibold">Condomínio</span>}
        {collapsed && <span className="sr-only">Condomínio</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <ul className="space-y-4">
          {sections.map((section, index) => (
            <Fragment key={section.title}>
              {collapsed && index > 0 && (
                <li aria-hidden="true" className="mx-1 border-t border-border" />
              )}
              <SidebarSection section={section} collapsed={collapsed} />
            </Fragment>
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

  /**
   * O pool e ordenado por preferencia e nao por posicao na barra: o que decide
   * o que aparece e a permissao. Corta em `QUICK_NAV_SLOTS` para cada lado, de
   * modo que os dois lados recebem a mesma quantidade sempre que o pool tenha
   * itens suficientes — e, quando nao tem, cada lado recebe o que sobrou, num
   * total unico que o grid abaixo distribui sem torto o botao central.
   */
  const allowed = QUICK_NAV_POOL.filter((item) => can(item.permission));
  const left = allowed.slice(0, QUICK_NAV_SLOTS);
  const right = allowed.slice(QUICK_NAV_SLOTS, QUICK_NAV_SLOTS * 2);

  function quickLink(item: NavItem) {
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === '/'}
        className={({ isActive }) =>
          cn(
            'flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors',
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
              <item.icon className="size-5" aria-hidden="true" />
            </span>
            <span className="max-w-full truncate">{item.label}</span>
          </>
        )}
      </NavLink>
    );
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm lg:hidden safe-bottom"
      aria-label="Navegação rápida"
    >
      {/*
        Grade de cinco colunas, e nao `justify-around`: as duas colunas da
        esquerda e as duas da direita tem a mesma largura, entao o botao central
        fica no meio da tela com qualquer combinacao de itens. Com espelhamento,
        perder um item deslocava o botao e os icones restantes nao caiam mais
        sob o dedo onde estavam.
      */}
      <div className="grid grid-cols-5 items-end px-2 pb-2 pt-1">
        <div className="col-span-2 flex items-end justify-around">{left.map(quickLink)}</div>

        <button
          type="button"
          onClick={onOpenMenu}
          className="col-span-1 flex flex-col items-center justify-end -mt-4"
          aria-label="Abrir menu completo"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-active active:scale-95">
            <LayoutGrid className="size-6" aria-hidden="true" />
          </span>
        </button>

        <div className="col-span-2 flex items-end justify-around">{right.map(quickLink)}</div>
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
                        'flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl p-2 text-xs font-medium transition-colors',
                        'active:scale-95',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80',
                      )
                    }
                  >
                    <item.icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="w-full break-words hyphens-auto text-center leading-tight">
                      {item.label}
                    </span>
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

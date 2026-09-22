import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '@/providers/auth-context';
import { CondominiumContext, type CondominiumContextValue } from '@/providers/condominium-context';
import { ThemeProvider } from '@/providers/theme-provider';
import { makeAuthUser, makeCondominium } from '@/test/fixtures';
import { Topbar } from '../topbar';

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    Menu: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-menu" {...props} />,
    PanelLeftClose: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-close" {...props} />,
    PanelLeftOpen: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-open" {...props} />,
    Sun: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-sun" {...props} />,
    Moon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-moon" {...props} />,
    LogOut: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-logout" {...props} />,
    User: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-user" {...props} />,
  };
});

const authValue: AuthContextValue = {
  user: makeAuthUser(),
  initializing: false,
  isAuthenticated: true,
  login: async () => undefined,
  logout: async () => undefined,
  updateUser: () => undefined,
  can: () => true,
};

const condominiumValue: CondominiumContextValue = {
  condominiums: [makeCondominium()],
  selected: makeCondominium(),
  selectedId: 'cond-1',
  select: vi.fn(),
  isLoading: false,
};

function renderTopbar(props: Partial<React.ComponentProps<typeof Topbar>> = {}) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <CondominiumContext.Provider value={condominiumValue}>
          <ThemeProvider>
            <Topbar onOpenMenu={vi.fn()} collapsed={false} onToggleCollapse={vi.fn()} {...props} />
          </ThemeProvider>
        </CondominiumContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('Topbar Toggle', () => {
  it('botao toggle sempre visivel', () => {
    renderTopbar();
    const toggle = screen.getByRole('button', { name: /recolher menu/i });
    expect(toggle.className).toContain('flex');
  });

  it('chama onToggleCollapse ao clicar', async () => {
    const onToggleCollapse = vi.fn();
    renderTopbar({ onToggleCollapse });

    const toggle = screen.getByRole('button', { name: /recolher menu/i });
    await userEvent.click(toggle);

    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('mostra PanelLeftClose quando expanded', () => {
    renderTopbar({ collapsed: false });
    expect(screen.getByTestId('icon-close')).toBeInTheDocument();
  });

  it('mostra PanelLeftOpen quando collapsed', () => {
    renderTopbar({ collapsed: true });
    expect(screen.getByTestId('icon-open')).toBeInTheDocument();
  });

  it('aria-label muda conforme estado', () => {
    const { rerender } = render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <CondominiumContext.Provider value={condominiumValue}>
            <ThemeProvider>
              <Topbar onOpenMenu={vi.fn()} collapsed={false} onToggleCollapse={vi.fn()} />
            </ThemeProvider>
          </CondominiumContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /recolher menu/i })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <CondominiumContext.Provider value={condominiumValue}>
            <ThemeProvider>
              <Topbar onOpenMenu={vi.fn()} collapsed={true} onToggleCollapse={vi.fn()} />
            </ThemeProvider>
          </CondominiumContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /expandir menu/i })).toBeInTheDocument();
  });

  it('aria-expanded reflete estado', () => {
    renderTopbar({ collapsed: false });
    const toggle = screen.getByRole('button', { name: /recolher menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('aria-expanded=false quando collapsed', () => {
    renderTopbar({ collapsed: true });
    const toggle = screen.getByRole('button', { name: /expandir menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

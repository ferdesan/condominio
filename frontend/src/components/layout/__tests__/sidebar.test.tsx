import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '@/providers/auth-context';
import { makeAuthUser } from '@/test/fixtures';
import { Sidebar, MobileNav, MobileBottomBar } from '../sidebar';

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return { ...actual, Building2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} /> };
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

function renderSidebar() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <Sidebar />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function renderMobileNav(props: Partial<React.ComponentProps<typeof MobileNav>> = {}) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <MobileNav open={false} onClose={vi.fn()} {...props} />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function renderBottomBar() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <MobileBottomBar onOpenMenu={vi.fn()} />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('Sidebar — Desktop', () => {
  it('renderiza w-72', () => {
    renderSidebar();
    const aside = document.querySelector('aside[aria-label="Navegação principal"]');
    expect(aside?.className).toContain('w-72');
  });

  it('mostra nome Condomínio', () => {
    renderSidebar();
    expect(screen.getByText('Condomínio')).toBeInTheDocument();
  });

  it('seções com botão de recolher', () => {
    renderSidebar();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('clicar na seção alterna visibilidade', async () => {
    renderSidebar();
    const btn = screen.getAllByRole('button')[0];
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    await userEvent.click(btn);
    // Após clicar, some (primeira seção é "Visão geral" com Dashboard)
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});

describe('MobileNav — Bottom sheet', () => {
  it('aparece quando open=true', () => {
    renderMobileNav({ open: true });
    expect(screen.getByText('Navegação')).toBeInTheDocument();
  });

  it('tem botao fechar', () => {
    renderMobileNav({ open: true });
    expect(screen.getByRole('button', { name: /fechar menu/i })).toBeInTheDocument();
  });
});

describe('MobileBottomBar', () => {
  it('renderiza itens de navegacao', () => {
    renderBottomBar();
    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Financeiro')).toBeInTheDocument();
  });

  it('tem botao central para abrir menu', () => {
    renderBottomBar();
    expect(screen.getByRole('button', { name: /abrir menu completo/i })).toBeInTheDocument();
  });
});

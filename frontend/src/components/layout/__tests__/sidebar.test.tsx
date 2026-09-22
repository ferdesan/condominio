import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '@/providers/auth-context';
import { makeAuthUser } from '@/test/fixtures';
import { Sidebar, MobileNav } from '../sidebar';

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

function renderSidebar(props: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <Sidebar collapsed={false} {...props} />
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

function getDesktopAside(): HTMLElement {
  return document.querySelector('aside[aria-label="Navegação principal"]') as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
});

describe('Sidebar — Desktop', () => {
  it('renderiza expanded por padrao (w-72)', () => {
    renderSidebar({ collapsed: false });
    expect(getDesktopAside().className).toContain('w-72');
  });

  it('renderiza collapsed quando collapsed=true (w-16)', () => {
    renderSidebar({ collapsed: true });
    expect(getDesktopAside().className).toContain('w-16');
  });

  it('labels visiveis no modo expanded', () => {
    renderSidebar({ collapsed: false });
    expect(screen.queryByText('Financeiro')).toBeInTheDocument();
  });

  it('labels ocultos no modo collapsed', () => {
    renderSidebar({ collapsed: true });
    expect(screen.queryByText('Financeiro')).not.toBeInTheDocument();
  });

  it('mostra CS no header quando collapsed', () => {
    renderSidebar({ collapsed: true });
    expect(screen.getByText('CS')).toBeInTheDocument();
  });

  it('mostra nome completo quando expanded', () => {
    renderSidebar({ collapsed: false });
    expect(screen.getByText('Condomínio')).toBeInTheDocument();
  });
});

describe('MobileNav — Bottom sheet', () => {
  it('aparece quando open=true', () => {
    renderMobileNav({ open: true });
    expect(screen.getByText('Navegação')).toBeInTheDocument();
  });

  it('tem titulo e botao fechar', () => {
    renderMobileNav({ open: true });
    expect(screen.getByText('Navegação')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fechar menu/i })).toBeInTheDocument();
  });

  it('mostra grid de navegacao', () => {
    renderMobileNav({ open: true });
    const grid = document.querySelector('.grid.grid-cols-4');
    expect(grid).toBeInTheDocument();
  });

  it('chama onClose ao clicar no backdrop', () => {
    const onClose = vi.fn();
    renderMobileNav({ open: true, onClose });

    const backdrop = document.querySelector('.fixed.inset-0.lg\\:hidden > div:first-child');
    backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onClose).toHaveBeenCalled();
  });
});

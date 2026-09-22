import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '@/providers/auth-context';
import { makeAuthUser } from '@/test/fixtures';
import { Sidebar } from '../sidebar';

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
        <Sidebar open={false} collapsed={false} onClose={vi.fn()} {...props} />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function getAside(): HTMLElement {
  return document.querySelector('aside[aria-label="Navegação principal"]') as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
});

describe('Sidebar', () => {
  it('renderiza expanded por padrao (w-72)', () => {
    renderSidebar({ collapsed: false });
    expect(getAside().className).toContain('w-72');
  });

  it('renderiza collapsed quando collapsed=true (w-16)', () => {
    renderSidebar({ collapsed: true });
    expect(getAside().className).toContain('w-16');
  });

  it('labels visiveis no modo expanded', () => {
    renderSidebar({ collapsed: false });
    expect(screen.queryByText('Financeiro')).toBeInTheDocument();
  });

  it('labels ocultos no modo collapsed', () => {
    renderSidebar({ collapsed: true });
    expect(screen.queryByText('Financeiro')).not.toBeInTheDocument();
  });

  it('mostra texto CS no header quando collapsed', () => {
    renderSidebar({ collapsed: true });
    expect(screen.getByText('CS')).toBeInTheDocument();
  });

  it('mostra nome completo no header quando expanded', () => {
    renderSidebar({ collapsed: false });
    expect(screen.getByText('Condomínio')).toBeInTheDocument();
  });

  it('drawer abre com open=true no mobile', () => {
    renderSidebar({ open: true, collapsed: false });
    expect(getAside().className).toContain('translate-x-0');
  });

  it('drawer fecha com open=false no mobile', () => {
    renderSidebar({ open: false, collapsed: false });
    expect(getAside().className).toContain('-translate-x-full');
  });

  it('chama onClose ao clicar no backdrop', () => {
    const onClose = vi.fn();
    renderSidebar({ open: true, onClose });

    const backdrop = document.querySelector('.fixed.inset-0.z-40');
    backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onClose).toHaveBeenCalled();
  });

  it('botao fechar visivel no mobile', () => {
    renderSidebar({ open: true, collapsed: false });
    const closeBtn = screen.getByRole('button', { name: /fechar menu/i });
    expect(closeBtn).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '@/providers/auth-context';
import { hasPermission } from '@/lib/permissions';
import { makeAuthUser } from '@/test/fixtures';
import { Sidebar, MobileNav, MobileBottomBar } from '../sidebar';

/**
 * Matriz do STAFF em `backend/src/shared/constants/roles.ts`, so nos recursos
 * que a barra rapida toca: ele le ocorrencias e nao le `charge`, e foi esse o
 * item que sumia da barra deixando o botao central torto.
 */
const STAFF_PERMISSIONS = [
  'incident:read',
  'dashboard:read',
  'announcement:read',
  'visitor:read',
  'reservation:read',
  'vehicle:read',
  'resident:read',
  'correspondence:read',
  'unit:read',
  'document:read',
  'block:read',
  'common-area:read',
  'dependent:read',
  'condominium:read',
];

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    Building2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />,
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

function renderBottomBar(granted?: string[]) {
  const value: AuthContextValue = {
    ...authValue,
    can: (permission?: string) => (granted ? hasPermission(granted, permission) : true),
  };

  return render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
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
  /** Rotulos dos quatro slots, na ordem em que a barra os apresenta. */
  function barLabels(): string[] {
    return screen.getAllByRole('link').map((link) => link.textContent?.trim() ?? '');
  }

  it('preenche os quatro slots com o pool comum', () => {
    renderBottomBar();
    expect(barLabels()).toEqual(['Início', 'Ocorrências', 'Comunicados', 'Visitantes']);
  });

  it('tem botao central para abrir menu', () => {
    renderBottomBar();
    expect(screen.getByRole('button', { name: /abrir menu completo/i })).toBeInTheDocument();
  });

  /**
   * A regressao que motivou o pool: o STAFF nao tem `charge:read` e perdia o
   * item da esquerda. Com `justify-around` a barra ficava com tres icones e o
   * botao central saia do meio.
   */
  it('mantem os quatro slots e a simetria para quem nao tem acesso ao financeiro', () => {
    renderBottomBar(STAFF_PERMISSIONS);

    // `charge:read` fora: o item some, mas nunca vira um buraco na barra.
    expect(barLabels()).toEqual(['Início', 'Ocorrências', 'Comunicados', 'Visitantes']);
    expect(screen.getByRole('button', { name: /abrir menu completo/i })).toBeInTheDocument();
  });

  it('troca o item ausente por outro do pool, em vez de deixar a barra torta', () => {
    renderBottomBar(['dashboard:read', 'incident:read', 'announcement:read']);

    // Tres leituras e, portanto, tres icones — mas dois de cada lado, que e o
    // que a barra precisa ter para nao perder a proporcao.
    expect(barLabels()).toEqual(['Início', 'Ocorrências', 'Comunicados']);
  });

  it('nunca deixa um lado com mais icones que o outro', () => {
    // Papel sob medida: uma unica leitura permitida.
    renderBottomBar(['dashboard:read']);

    expect(barLabels()).toEqual(['Início']);
  });

  it('esconde o que o papel nao le, em vez de exibir e recusar', () => {
    renderBottomBar(['dashboard:read', 'incident:read']);

    // Os quatro primeiros do pool, menos os que faltam: nada de link morto.
    expect(barLabels()).toEqual(['Início', 'Ocorrências']);
    expect(screen.queryByRole('link', { name: /comunicados/i })).not.toBeInTheDocument();
  });
});

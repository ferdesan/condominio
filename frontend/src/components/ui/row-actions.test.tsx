import { render, screen } from '@testing-library/react';
import { Pencil, Trash2 } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { RowAction, RowActions } from './row-actions';

function renderInRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('RowActions', () => {
  it('desenha um botao por acao, com o rotulo como nome acessivel', () => {
    renderInRouter(
      <RowActions>
        <RowAction icon={Pencil} label="Editar Torre A" onClick={vi.fn()} />
        <RowAction icon={Trash2} tone="destructive" label="Excluir Torre A" onClick={vi.fn()} />
      </RowActions>,
    );

    expect(screen.getByRole('button', { name: 'Editar Torre A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir Torre A' })).toBeInTheDocument();
  });

  /**
   * O defeito que este caso prende ja aconteceu. A tela agrupa acoes da mesma
   * permissao num fragmento, `React.Children.toArray` nao desce dentro dele, e
   * `RowAction` nao renderiza nada sozinho — entao as acoes sumiam da coluna
   * **sem erro nenhum**. Cinquenta e tres casos de tela ficaram vermelhos por
   * isso; nenhum deles apontava para o `RowActions`.
   */
  it('desce dentro de fragmentos para achar as acoes', () => {
    renderInRouter(
      <RowActions>
        <>
          <RowAction icon={Pencil} label="Editar Torre A" onClick={vi.fn()} />
          <RowAction icon={Trash2} label="Excluir Torre A" onClick={vi.fn()} />
        </>
      </RowActions>,
    );

    expect(screen.getByRole('button', { name: 'Editar Torre A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir Torre A' })).toBeInTheDocument();
  });

  it('ignora filho que nao e acao, e nao quebra com condicao falsa', () => {
    // Como a tela escreve: a permissao decide se a acao existe.
    const canUpdate = false as boolean;

    renderInRouter(
      <RowActions>
        {canUpdate ? <RowAction icon={Pencil} label="Editar Torre A" onClick={vi.fn()} /> : null}
        <span>texto solto</span>
        <RowAction icon={Trash2} label="Excluir Torre A" onClick={vi.fn()} />
      </RowActions>,
    );

    expect(screen.queryByRole('button', { name: 'Editar Torre A' })).not.toBeInTheDocument();
    expect(screen.queryByText('texto solto')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir Torre A' })).toBeInTheDocument();
  });

  it('sem acao nenhuma, nao desenha a coluna', () => {
    const canUpdate = false as boolean;

    const { container } = renderInRouter(
      <RowActions>
        {canUpdate ? <RowAction icon={Pencil} label="x" onClick={vi.fn()} /> : null}
      </RowActions>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  /**
   * O menu e o que da rotulo no toque, onde a tarja do tooltip nao abre. Ele
   * convive com a fileira de icones: o CSS mostra um ou outro, e por isso o
   * gatilho existe no documento mesmo no caso acima.
   */
  it('oferece o menu de acoes, que e o rotulo de quem usa toque', () => {
    renderInRouter(
      <RowActions>
        <RowAction icon={Pencil} label="Editar Torre A" onClick={vi.fn()} />
      </RowActions>,
    );

    expect(screen.getByRole('button', { name: 'Ações' })).toBeInTheDocument();
  });

  it('acao com `to` vira ancora, e nao botao — para nao perder nova aba', () => {
    renderInRouter(
      <RowActions>
        <RowAction icon={Pencil} label="Ver Torre A" to="/condominios/1" />
      </RowActions>,
    );

    const link = screen.getByRole('link', { name: 'Ver Torre A' });
    expect(link).toHaveAttribute('href', '/condominios/1');
  });
});

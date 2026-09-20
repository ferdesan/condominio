import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pencil, Trash2 } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { IconButton } from './icon-button';

/**
 * O que estes casos prendem nao e a aparencia — e o contrato de acessibilidade
 * do qual as vinte telas passaram a depender quando o rotulo saiu da tela.
 *
 * Os testes de pagina consultam por nome acessivel e continuariam verdes se um
 * refactor apagasse o `aria-label` e deixasse so a tarja, porque a tarja tambem
 * produz texto. Aqui o nome e conferido no proprio botao.
 */
describe('IconButton', () => {
  it('o `label` vira o nome acessivel do botao', () => {
    render(<IconButton icon={Pencil} label="Editar Torre A" onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Editar Torre A' })).toBeInTheDocument();
  });

  it('o icone e escondido do leitor de tela, para nao duplicar o rotulo', () => {
    const { container } = render(
      <IconButton icon={Pencil} label="Editar Torre A" onClick={vi.fn()} />,
    );

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('o tom destrutivo pinta a acao sem volta de vermelho, e o padrao de verde', () => {
    const { rerender } = render(
      <IconButton icon={Trash2} tone="destructive" label="Excluir Torre A" onClick={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Excluir Torre A' })).toHaveClass('text-destructive');

    rerender(<IconButton icon={Pencil} label="Editar Torre A" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Editar Torre A' })).toHaveClass('text-primary');
  });

  it('chama o `onClick` uma vez por clique', async () => {
    const onClick = vi.fn();
    render(<IconButton icon={Pencil} label="Editar Torre A" onClick={onClick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Editar Torre A' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('desabilitado, nao dispara — o `disabled` chega ao botao', async () => {
    const onClick = vi.fn();
    render(<IconButton icon={Pencil} label="Editar Torre A" onClick={onClick} disabled />);

    const button = screen.getByRole('button', { name: 'Editar Torre A' });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  /**
   * O uso natural destes botoes e como gatilho de dialogo
   * (`<DialogTrigger asChild>`), e o `Slot` do Radix entrega a `ref` ao filho.
   * Sem `forwardRef` a `ref` se perde: o gatilho nao abre e o React so avisa no
   * console — falha que nenhum teste de pagina pegaria.
   */
  it('encaminha a `ref` para o elemento do botao', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<IconButton ref={ref} icon={Pencil} label="Editar Torre A" onClick={vi.fn()} />);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toHaveAttribute('aria-label', 'Editar Torre A');
  });
});

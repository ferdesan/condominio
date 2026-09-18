/**
 * O seletor com busca, isolado do formulario que o usa.
 *
 * O caso que motivou o componente: uma lista de moradores em que dois cadastros
 * trazem o mesmo nome. Sem busca a escolha vira rolagem, e sem a segunda linha
 * as duas opcoes ficam identicas na tela — a busca sozinha nao resolveria.
 */
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { describe, expect, it, vi } from 'vitest';
import { Combobox, type ComboboxOption } from './combobox';

const MORADORES: ComboboxOption[] = [
  { value: 'r-1', label: 'Ana Silva', hint: 'Torre A - 101' },
  { value: 'r-2', label: 'Ana Silva', hint: 'Torre B - 204' },
  { value: 'r-3', label: 'Bruno Santos', hint: 'Torre A - 102' },
  { value: 'r-4', label: 'José Gonçalves', hint: 'Torre C - 301' },
];

function montar(onValueChange = vi.fn()) {
  renderWithProviders(
    <Combobox
      options={MORADORES}
      onValueChange={onValueChange}
      placeholder="Selecione o morador"
      searchPlaceholder="Buscar por nome ou unidade"
      emptyMessage="Nenhum morador corresponde a busca."
    />,
  );
  return { trigger: screen.getByRole('combobox'), onValueChange };
}

function buscar(termo: string): void {
  fireEvent.change(screen.getByPlaceholderText('Buscar por nome ou unidade'), {
    target: { value: termo },
  });
}

describe('Combobox', () => {
  it('fechado, mostra o placeholder e não monta a lista', () => {
    const { trigger } = montar();

    expect(trigger).toHaveTextContent('Selecione o morador');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('aberto, lista tudo e cada opção carrega a sua dica', () => {
    const { trigger } = montar();
    fireEvent.click(trigger);

    expect(screen.getAllByRole('option')).toHaveLength(4);
    // Os dois cadastros de "Ana Silva" so se distinguem pela unidade.
    expect(screen.getByRole('option', { name: 'Ana Silva, Torre A - 101' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana Silva, Torre B - 204' })).toBeInTheDocument();
  });

  it('a busca filtra pelo nome', () => {
    const { trigger } = montar();
    fireEvent.click(trigger);
    buscar('bruno');

    const opcoes = screen.getAllByRole('option');
    expect(opcoes).toHaveLength(1);
    expect(opcoes[0]).toHaveAttribute('aria-label', 'Bruno Santos, Torre A - 102');
  });

  it('a busca também alcança a dica, entao o número da unidade encontra o morador', () => {
    const { trigger } = montar();
    fireEvent.click(trigger);
    buscar('204');

    const opcoes = screen.getAllByRole('option');
    expect(opcoes).toHaveLength(1);
    expect(opcoes[0]).toHaveAttribute('aria-label', 'Ana Silva, Torre B - 204');
  });

  it('a busca ignora acento nos dois sentidos', () => {
    const { trigger } = montar();
    fireEvent.click(trigger);

    // Sem acento no termo, acentuado no dado.
    buscar('jose goncalves');
    expect(screen.getAllByRole('option')).toHaveLength(1);

    // E com acento no termo tambem.
    buscar('JOSÉ');
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('sem correspondência, diz isso em vez de mostrar lista vazia', () => {
    const { trigger } = montar();
    fireEvent.click(trigger);
    buscar('ninguem com esse nome');

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum morador corresponde a busca.')).toBeInTheDocument();
  });

  it('escolher uma opção avisa o formulário e fecha a lista', () => {
    const { trigger, onValueChange } = montar();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Ana Silva, Torre B - 204' }));

    expect(onValueChange).toHaveBeenCalledWith('r-2');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('as setas percorrem a lista e o Enter escolhe o que estiver ativo', () => {
    const { trigger, onValueChange } = montar();
    fireEvent.click(trigger);
    const busca = screen.getByPlaceholderText('Buscar por nome ou unidade');

    fireEvent.keyDown(busca, { key: 'ArrowDown' });
    fireEvent.keyDown(busca, { key: 'Enter' });

    // Comeca no primeiro; uma seta para baixo leva ao segundo.
    expect(onValueChange).toHaveBeenCalledWith('r-2');
  });

  it('o valor escolhido aparece no gatilho, com a marca na opção', () => {
    renderWithProviders(
      <Combobox options={MORADORES} value="r-3" onValueChange={vi.fn()} placeholder="Selecione" />,
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Bruno Santos');

    fireEvent.click(trigger);
    expect(screen.getByRole('option', { name: 'Bruno Santos, Torre A - 102' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

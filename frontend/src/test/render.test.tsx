import { describe, expect, it, vi } from 'vitest';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import { makeCondominium } from './fixtures';
import { clickTrigger, openSelect, renderWithProviders, screen, selectOption } from './render';

/**
 * Verifica o proprio harness: os polyfills do setup e a injecao de contexto do
 * helper. Sem isto, uma tela das tarefas seguintes falharia por motivo alheio
 * ao seu proprio codigo.
 */

function ContextProbe() {
  const { can, user } = useAuth();
  const { selected } = useCondominium();
  return (
    <div>
      <span data-testid="user">{user?.name ?? 'anonimo'}</span>
      <span data-testid="condominium">{selected?.name ?? 'nenhum'}</span>
      <span data-testid="can-create">{String(can('condominium:create'))}</span>
    </div>
  );
}

function SelectProbe({ onChange }: { onChange: (value: string) => void }) {
  return (
    <Select onValueChange={onChange}>
      <SelectTrigger aria-label="Situacao">
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ACTIVE">Ativo</SelectItem>
        <SelectItem value="INACTIVE">Inativo</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('renderWithProviders', () => {
  it('injeta o papel e resolve as permissoes por ele', () => {
    const { unmount } = renderWithProviders(<ContextProbe />, { role: 'ADMIN' });
    expect(screen.getByTestId('can-create')).toHaveTextContent('true');
    unmount();

    renderWithProviders(<ContextProbe />, { role: 'STAFF' });
    expect(screen.getByTestId('can-create')).toHaveTextContent('false');
  });

  it('injeta o condominio selecionado e aceita a ausencia de escolha', () => {
    const { unmount } = renderWithProviders(<ContextProbe />, {
      condominium: makeCondominium({ name: 'Edificio Central' }),
    });
    expect(screen.getByTestId('condominium')).toHaveTextContent('Edificio Central');
    unmount();

    renderWithProviders(<ContextProbe />, { condominium: null });
    expect(screen.getByTestId('condominium')).toHaveTextContent('nenhum');
  });
});

describe('polyfills do ambiente de teste', () => {
  it('abre um select do Radix e lista as opcoes', () => {
    renderWithProviders(<SelectProbe onChange={vi.fn()} />);

    openSelect(screen.getByRole('combobox', { name: 'Situacao' }));

    expect(screen.getByRole('option', { name: 'Ativo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Inativo' })).toBeInTheDocument();
  });

  it('escolhe uma opcao do select e propaga o valor', () => {
    const onChange = vi.fn();
    renderWithProviders(<SelectProbe onChange={onChange} />);

    selectOption(screen.getByRole('combobox', { name: 'Situacao' }), 'Inativo');

    expect(onChange).toHaveBeenCalledWith('INACTIVE');
  });

  it('abre um dialog do Radix sem falhar por API ausente no jsdom', () => {
    renderWithProviders(
      <Dialog>
        <DialogTrigger>Abrir</DialogTrigger>
        <DialogContent>
          <DialogTitle>Novo condominio</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    clickTrigger(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Novo condominio')).toBeInTheDocument();
  });
});

/**
 * O ambiente de teste em si: as capacidades de navegador que o jsdom nao tem e
 * os primitivos do Radix exigem, e o estado guardado que nao pode atravessar de
 * um caso para o seguinte.
 *
 * Os dois sao a mesma especie de defeito — o ambiente causando a falha, ou
 * causando o sucesso — e nenhum deles aparece no teste de uma tela: ali se
 * manifestam como um select que nao abre, ou como um caso que so passa quando
 * roda depois de outro.
 */

import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { clickTrigger, openSelect, render, screen, within } from '@/test/render';

/** Marca de sessao e rascunho: o que pode sobreviver de um caso para o outro. */
const LEAK_KEY = 'condomínio.session';
const SESSION_KEY = 'condomínio.rascunho';

function SelectHarness() {
  const [value, setValue] = useState<string>();
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger aria-label="Bloco">
        <SelectValue placeholder="Escolha" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="block-1">Torre A</SelectItem>
        <SelectItem value="block-2">Torre B</SelectItem>
      </SelectContent>
    </Select>
  );
}

function DialogHarness() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Abrir</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Um dialogo</DialogTitle>
          <DialogDescription>Com conteudo dentro.</DialogDescription>
        </DialogHeader>
        <p>Conteudo do dialogo</p>
      </DialogContent>
    </Dialog>
  );
}

describe('Capacidades de navegador ausentes do jsdom', () => {
  it('IT-192: abrir um select não falha por API ausente no ambiente', () => {
    // Sem os preenchimentos do setup — `scrollIntoView`, captura de ponteiro,
    // `PointerEvent`, `ResizeObserver` — o gatilho simplesmente nao abre, e o
    // teste expira esperando uma opcao que nunca aparece.
    render(<SelectHarness />);

    openSelect(screen.getByLabelText('Bloco'));

    expect(screen.getByRole('option', { name: 'Torre A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Torre B' })).toBeInTheDocument();
  });

  it('IT-192: abrir um dialogo não falha por API ausente no ambiente', () => {
    render(<DialogHarness />);

    clickTrigger(screen.getByRole('button', { name: 'Abrir' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Conteudo do dialogo')).toBeInTheDocument();
    // O `:modal` do Radix passa pelo seletor do jsdom, que resolve `:fullscreen`
    // chamando `matches` de volta — o curto-circuito do setup e o que mantem
    // isto em milissegundos em vez de dezenas de segundos.
    expect(dialog).toBeVisible();
  });
});

/**
 * Os dois casos abaixo sao um par e dependem da ordem: o primeiro suja o
 * armazenamento, o segundo confere que ele chegou limpo. Se a limpeza global do
 * setup sair, e o segundo que acusa.
 */
describe('Estado guardado entre casos', () => {
  it('IT-193: um caso escreve estado de sessão no armazenamento', () => {
    localStorage.setItem(LEAK_KEY, '1');
    sessionStorage.setItem(SESSION_KEY, 'rascunho-do-caso-anterior');

    expect(localStorage.getItem(LEAK_KEY)).toBe('1');
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('rascunho-do-caso-anterior');
  });

  it('IT-193: o caso seguinte comeca sem nada do anterior', () => {
    expect(localStorage.getItem(LEAK_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

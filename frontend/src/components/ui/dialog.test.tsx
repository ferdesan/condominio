/**
 * O dialogo, isolado das telas que o usam.
 *
 * O caso que motivou estes testes: a trilha de auditoria, aberta numa entrada
 * que mudou dezenas de campos, crescia para fora da tela sem barra de rolagem
 * nenhuma. Centralizado por `-translate-y-1/2`, o excedente sai pelos dois
 * lados — e a parte de cima fica inalcancavel, porque o Radix trava a rolagem do
 * corpo enquanto o modal esta aberto.
 *
 * O jsdom nao calcula layout, entao nenhum teste aqui prova que a barra aparece.
 * O que da para garantir e a estrutura de onde a barra sai: um teto de altura,
 * uma regiao de rolagem so, e o botao de fechar fora dela.
 */
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './dialog';

function montar(side: 'center' | 'right' = 'center'): HTMLElement {
  renderWithProviders(
    <Dialog open>
      <DialogContent side={side} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes</DialogTitle>
        </DialogHeader>
        <p>Conteúdo longo</p>
        <DialogFooter>
          <button type="button">Voltar</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  );
  return screen.getByRole('dialog');
}

/** A regiao de rolagem: o unico filho do conteudo que rola. */
function regiaoDeRolagem(content: HTMLElement): HTMLElement {
  const regiao = content.querySelector('.overflow-y-auto');
  if (!(regiao instanceof HTMLElement)) throw new Error('nenhuma regiao de rolagem no dialogo');
  return regiao;
}

describe('DialogContent', () => {
  it('centralizado, tem teto de altura — senao cresce para fora da tela', () => {
    expect(montar().className).toContain('max-h-[calc(100dvh-2rem)]');
  });

  it('ancorado a direita, a altura ja vem da borda a borda', () => {
    const content = montar('right');
    expect(content.className).toContain('inset-y-0');
    expect(content.className).toContain('h-full');
  });

  it('centralizado, a rolagem e de uma regiao so', () => {
    const content = montar();
    expect(content.querySelectorAll('.overflow-y-auto')).toHaveLength(1);
    // O proprio conteudo nao rola: a barra dupla vinha de um `overflow-y-auto`
    // repetido em cada chamada, e agora a regra mora so no componente.
    expect(content.className).not.toContain('overflow-y-auto');
  });

  it('ancorado a direita, a rolagem tambem e de uma regiao so', () => {
    const content = montar('right');
    expect(content.querySelectorAll('.overflow-y-auto')).toHaveLength(1);
    expect(content.className).not.toContain('overflow-y-auto');
  });

  it('o conteudo declarado pela tela vai todo para dentro da regiao que rola', () => {
    const regiao = regiaoDeRolagem(montar());

    expect(regiao).toContainElement(screen.getByRole('heading', { name: 'Detalhes' }));
    expect(regiao).toContainElement(screen.getByText('Conteúdo longo'));
    expect(regiao).toContainElement(screen.getByRole('button', { name: 'Voltar' }));
  });

  it('o botao de fechar fica fora da rolagem: descer ate o fim nao custa a saida', () => {
    const content = montar();
    const fechar = screen.getByRole('button', { name: 'Fechar' });

    expect(content).toContainElement(fechar);
    expect(regiaoDeRolagem(content).contains(fechar)).toBe(false);
  });

  it('a largura continua vindo da tela', () => {
    expect(montar().className).toContain('max-w-2xl');
  });
});

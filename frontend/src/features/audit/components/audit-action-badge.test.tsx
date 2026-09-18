/**
 * A etiqueta de acao da trilha, exercitada contra o catalogo inteiro.
 *
 * Existe por causa de um defeito real: o modulo LGPD passou a gravar seis acoes
 * novas (`LGPD_*`) e o catalogo do frontend ficou nas onze antigas. `ICONS[acao]`
 * devolvia `undefined`, `<Icon />` virava elemento de tipo invalido, e — sem
 * error boundary na arvore — uma unica linha da trilha deixava a aplicacao
 * inteira em branco.
 *
 * O caso tabelado percorre `AUDIT_ACTIONS`, entao uma acao acrescentada ao
 * catalogo sem rotulo, sem icone ou sem variante quebra aqui. O caso da acao
 * desconhecida cobre o outro lado: `action` e `varchar(60)` livre no servidor, e
 * o catalogo do cliente sempre pode estar atras dele.
 */
import { renderWithProviders, screen } from '@/test/render';
import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS, type AuditAction } from '@/types/audit';
import { ACTION_LABELS } from '../audit-labels';
import { AuditActionBadge } from './audit-action-badge';

describe('AuditActionBadge', () => {
  it.each(AUDIT_ACTIONS)('%s tem rotulo e icone próprios', (action) => {
    const { container } = renderWithProviders(<AuditActionBadge action={action} />);

    expect(screen.getByText(ACTION_LABELS[action])).toBeInTheDocument();
    // O icone e decorativo; o que se afirma e que existe um, e nao qual.
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('nenhum rotulo se repete entre as ações', () => {
    const rotulos = AUDIT_ACTIONS.map((action) => ACTION_LABELS[action]);

    // Dois rotulos iguais tornam duas acoes indistinguiveis na tabela.
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });

  it('uma ação fora do catálogo aparece crua, em vez de derrubar a tela', () => {
    const desconhecida = 'ACAO_QUE_O_SERVIDOR_INVENTOU' as AuditAction;

    const { container } = renderWithProviders(<AuditActionBadge action={desconhecida} />);

    expect(screen.getByText('ACAO_QUE_O_SERVIDOR_INVENTOU')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

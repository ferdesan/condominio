import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  ACTION_LABELS,
  ACTION_ORDER,
  MANAGE_NOTE,
  PERMISSION_GROUPS,
  resourceLabel,
  type PermissionAction,
} from '../role-labels';
import { splitCatalog } from '../role-schema';

export interface PermissionMatrixProps {
  /** O catalogo do servidor, cru. */
  catalog: readonly string[];
  /** As permissoes concedidas ao papel. */
  value: readonly string[];
  /** Ausente torna a matriz somente leitura — e o modo de visualizacao. */
  onChange?: (next: string[]) => void;
  /** Prefixo dos ids, para que duas matrizes na mesma pagina nao colidam. */
  idPrefix: string;
}

/**
 * A matriz de permissoes: um recurso por linha, as cinco acoes em colunas.
 *
 * **Por que matriz e nao lista.** O catalogo tem cento e quarenta e cinco
 * entradas `recurso:acao`. Uma coluna de caixas de selecao com esse tamanho nao
 * e navegavel; cruzando recurso e acao, a mesma informacao cabe em vinte e nove
 * linhas e cinco colunas, e a pergunta que se faz aqui — "o que este papel pode
 * fazer com reservas?" — vira uma linha, e nao uma busca.
 *
 * **`manage` nao marca as outras quatro, e isso e proposital.** No servidor ele
 * *resolve* as outras (`hasPermission` trata `<recurso>:manage` como curinga do
 * recurso), mas nao as *contem*: o papel guarda exatamente o que foi concedido.
 * Marcar as quatro junto gravaria cinco permissoes onde o servidor esperava uma,
 * e desmarcar `manage` depois deixaria quatro para tras sem que ninguem pedisse.
 * A coluna e destacada e a nota explica a implicacao.
 *
 * **Somente leitura e o mesmo componente.** Sem `onChange`, as caixas ficam
 * desabilitadas — o que se ve na visualizacao e exatamente o que se veria na
 * edicao, e nao uma segunda representacao que pode divergir.
 *
 * **Nada aqui declara quais permissoes existem.** As linhas saem do catalogo
 * recebido; `PERMISSION_GROUPS` so decide a ordem. Um recurso que o servidor
 * passe a expor e que nenhum grupo mencione aparece em "Outros", visivel.
 */
export function PermissionMatrix({ catalog, value, onChange, idPrefix }: PermissionMatrixProps) {
  const readOnly = !onChange;
  const granted = useMemo(() => new Set(value), [value]);

  const { byResource } = useMemo(() => splitCatalog(catalog), [catalog]);

  /**
   * Os grupos, com os recursos que o catalogo realmente trouxe, mais o que
   * sobrou. Um recurso citado num grupo e ausente do catalogo simplesmente nao
   * rende linha: a fonte da verdade e o servidor.
   */
  const sections = useMemo(() => {
    const placed = new Set<string>();
    const result = PERMISSION_GROUPS.map((group) => {
      const resources = group.resources.filter((resource) => {
        const present = byResource.has(resource);
        if (present) placed.add(resource);
        return present;
      });
      return { title: group.title, resources };
    }).filter((group) => group.resources.length > 0);

    const orphans = [...byResource.keys()].filter((resource) => !placed.has(resource)).sort();
    if (orphans.length > 0) result.push({ title: 'Outros', resources: orphans });
    return result;
  }, [byResource]);

  function toggle(entry: string, checked: boolean): void {
    if (!onChange) return;
    const next = new Set(granted);
    if (checked) next.add(entry);
    else next.delete(entry);
    // Ordem estavel: a do catalogo. Sem isso, marcar e desmarcar reembaralharia
    // a lista e o `isDirty` do formulario acusaria mudanca onde nao houve.
    onChange(catalog.filter((item) => next.has(item)));
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{MANAGE_NOTE}</p>

      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>

          {/*
            A tabela rola sozinha em telas estreitas; a pagina nunca rola na
            horizontal por causa dela.
          */}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Recurso
                  </th>
                  {ACTION_ORDER.map((action) => (
                    <th
                      key={action}
                      scope="col"
                      className={cn(
                        'px-3 py-2 text-center font-medium whitespace-nowrap',
                        action === 'manage' && 'text-primary',
                      )}
                    >
                      {ACTION_LABELS[action]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.resources.map((resource) => {
                  const available = byResource.get(resource) ?? new Set<string>();
                  return (
                    <tr key={resource} className="border-t">
                      <th scope="row" className="px-3 py-2 text-left font-normal">
                        {resourceLabel(resource)}
                      </th>
                      {ACTION_ORDER.map((action) => (
                        <ActionCell
                          key={action}
                          idPrefix={idPrefix}
                          resource={resource}
                          action={action}
                          available={available.has(action)}
                          granted={granted.has(`${resource}:${action}`)}
                          readOnly={readOnly}
                          onToggle={toggle}
                        />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function ActionCell({
  idPrefix,
  resource,
  action,
  available,
  granted,
  readOnly,
  onToggle,
}: {
  idPrefix: string;
  resource: string;
  action: PermissionAction;
  available: boolean;
  granted: boolean;
  readOnly: boolean;
  onToggle: (entry: string, checked: boolean) => void;
}) {
  // O catalogo e o produto de recursos por acoes, entao toda celula costuma
  // existir. Se alguma faltar, um traco diz "esta acao nao existe para este
  // recurso" — diferente de uma caixa desmarcada, que diz "existe e nao foi
  // concedida".
  if (!available) {
    return (
      <td className="px-3 py-2 text-center text-muted-foreground" aria-label="Nao se aplica">
        —
      </td>
    );
  }

  const entry = `${resource}:${action}`;
  const id = `${idPrefix}-${resource}-${action}`;

  return (
    <td className="px-3 py-2 text-center">
      <Checkbox
        id={id}
        checked={granted}
        disabled={readOnly}
        onCheckedChange={(checked) => onToggle(entry, checked === true)}
      />
      {/*
        O rotulo carrega recurso e acao por extenso e fica so para leitores de
        tela: numa grade de cento e quarenta e cinco caixas, "Ver" sozinho nao
        diz de quê. O cabecalho da coluna nao resolve isso — `Checkbox` do Radix
        e um botao, e nao uma celula que herde `headers`.
      */}
      <Label htmlFor={id} className="sr-only">
        {`${ACTION_LABELS[action]} ${resourceLabel(resource)}`}
      </Label>
    </td>
  );
}

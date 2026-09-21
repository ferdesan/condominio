import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { IconButton } from './icon-button';
import { ICON_BUTTON_SIZE, ICON_BUTTON_TONE, type IconButtonTone } from './icon-button-variants';

interface RowActionBase {
  icon: LucideIcon;
  /** O nome acessivel completo, com o registro: "Editar Torre A". */
  label: string;
  tone?: IconButtonTone;
  disabled?: boolean;
}

/**
 * Uma acao ou navega ou executa, nunca as duas. O `to` existe porque duas
 * acoes da coluna — "Ver condominio" e "Abrir origem" — levam a outra tela, e
 * uma ancora nao pode virar `button` sem perder "abrir em nova aba" e o
 * endereco na barra de status.
 */
export type RowActionProps =
  | (RowActionBase & { onClick: () => void; to?: never })
  | (RowActionBase & { to: string; onClick?: never });

/**
 * Descritor de uma acao de linha. **Nao renderiza nada sozinho** — existe para
 * que `RowActions` leia as acoes como dados e possa desenha-las de duas formas
 * sem que a tela precise declarar as duas.
 *
 * Por isso ele **falha alto** quando alguem o usa fora do `RowActions`: como
 * `RowActions` le as props e desenha por conta propria, este corpo so executa
 * quando o descritor ficou orfao. Devolver `null` ali seria o pior resultado
 * possivel — a acao some da tela, sem erro, sem aviso e sem teste vermelho. Foi
 * exatamente o que aconteceu com o ramo de "Restaurar" das tres secoes do
 * Financeiro.
 */
export function RowAction(_props: RowActionProps): never {
  throw new Error(
    'RowAction e um descritor e precisa estar dentro de <RowActions>. ' +
      'Sozinho ele nao desenha nada, e a acao sumiria da coluna em silencio.',
  );
}

/**
 * Recolhe os descritores, **descendo dentro de fragmentos**.
 *
 * `React.Children.toArray` nao achata `<>...</>`: ele devolve o fragmento como
 * um filho so, cujo `type` e `React.Fragment` e nao `RowAction`. Como a tela
 * agrupa acoes que dependem da mesma permissao num fragmento
 * (`{canUpdate ? <><RowAction/><RowAction/></> : null}`), filtrar sem descer
 * descarta as duas em silencio — e `RowAction` nao renderiza nada sozinho,
 * entao a coluna simplesmente fica vazia, sem erro nenhum.
 */
function collectActions(
  children: React.ReactNode,
  found: React.ReactElement<RowActionProps>[] = [],
): React.ReactElement<RowActionProps>[] {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      collectActions((child.props as { children?: React.ReactNode }).children, found);
      return;
    }
    if (child.type === RowAction) {
      found.push(child as React.ReactElement<RowActionProps>);
    }
  });
  return found;
}

/**
 * A coluna "Acoes" de uma tabela, nas duas formas que ela precisa ter.
 *
 * **Icones lado a lado no ponteiro; um menu no toque.** A razao e um defeito
 * concreto: o Radix suprime a tarja quando `pointerType === 'touch'`
 * (`react-tooltip`: `if (event.pointerType === "touch") return;`). Num celular
 * nao ha hover, e sem teclado nao ha foco — entao o unico rotulo de um botao so
 * de icone e um `aria-label` que o usuario vidente nunca ouve. Com "Editar" e
 * "Excluir" isso passaria; com "Dar baixa", "Deliberacoes" e "Encerrar" vira
 * adivinhacao. No menu o rotulo e texto de novo.
 *
 * As acoes chegam como filhos `<RowAction>` e nao como um array em prop porque
 * a tela ja escreve as permissoes em JSX (`{canUpdate ? ... : null}`), e um
 * array obrigaria a reescrever isso como `hidden:` em objeto — mais mudanca nas
 * vinte telas do que o problema pede.
 */
export function RowActions({ children }: { children: React.ReactNode }) {
  const actions = collectActions(children);

  if (actions.length === 0) return null;

  return (
    <>
      <div className="hidden items-center gap-1 sm:flex">
        {actions.map(({ props }) =>
          props.to === undefined ? (
            <IconButton
              key={props.label}
              icon={props.icon}
              label={props.label}
              tone={props.tone}
              disabled={props.disabled}
              onClick={props.onClick}
            />
          ) : (
            <Button
              key={props.label}
              variant="ghost"
              asChild
              className={cn(ICON_BUTTON_SIZE, ICON_BUTTON_TONE[props.tone ?? 'primary'])}
            >
              <Link to={props.to} aria-label={props.label}>
                <props.icon aria-hidden="true" />
              </Link>
            </Button>
          ),
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton icon={MoreHorizontal} label="Ações" className="sm:hidden" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map(({ props }) => (
            <DropdownMenuItem
              key={props.label}
              disabled={props.disabled}
              onSelect={props.onClick}
              asChild={props.to !== undefined}
              className={props.tone === 'destructive' ? 'text-destructive' : undefined}
            >
              {props.to === undefined ? (
                <>
                  <props.icon aria-hidden="true" />
                  {props.label}
                </>
              ) : (
                <Link to={props.to}>
                  <props.icon aria-hidden="true" />
                  {props.label}
                </Link>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

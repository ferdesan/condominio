import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronDown, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ComboboxOption = {
  value: string;
  label: string;
  /**
   * Segunda linha da opcao. Existe para desempatar rotulos iguais: dois
   * moradores podem se chamar "Ana Silva", e so o nome nao diz qual e qual.
   */
  hint?: string;
};

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-labelledby'?: string;
}

/**
 * Compara ignorando acento e caixa: quem digita "jose" precisa achar "José", e
 * quem digita "JOSE" tambem. `NFD` separa a letra do acento e o intervalo
 * combinante apaga o acento — sem isso, metade dos nomes do cadastro so seria
 * alcancavel com o teclado certo.
 */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Seletor com busca, para as colecoes que vem do servidor.
 *
 * O `Select` do Radix nao filtra: ele serve para um punhado de valores fixos —
 * um status, um tipo — onde percorrer a lista com o olho e viavel. Uma lista de
 * moradores ou de unidades nao e isso; sem busca, escolher vira rolagem.
 *
 * O `hint` de cada opcao aparece abaixo do rotulo e tambem entra na busca,
 * entao "101" acha o morador da unidade 101.
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Selecione',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nada encontrado.',
  disabled,
  id,
  className,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [termo, setTermo] = React.useState('');
  const [ativo, setAtivo] = React.useState(0);
  const listaId = React.useId();

  const selecionada = options.find((opcao) => opcao.value === value);

  const filtradas = React.useMemo(() => {
    const busca = normalizar(termo.trim());
    if (!busca) return options;
    return options.filter((opcao) =>
      normalizar(`${opcao.label} ${opcao.hint ?? ''}`).includes(busca),
    );
  }, [options, termo]);

  // Um indice preso na posicao antiga destacaria a opcao errada — ou nenhuma —
  // assim que a filtragem encurta a lista.
  React.useEffect(() => {
    setAtivo(0);
  }, [termo]);

  function escolher(opcao: ComboboxOption): void {
    onValueChange(opcao.value);
    setOpen(false);
    setTermo('');
  }

  function navegar(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtradas.length === 0) return;
      const passo = event.key === 'ArrowDown' ? 1 : -1;
      setAtivo((atual) => (atual + passo + filtradas.length) % filtradas.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const opcao = filtradas[ativo];
      if (opcao) escolher(opcao);
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(proximo) => {
        setOpen(proximo);
        if (!proximo) setTermo('');
      }}
    >
      <PopoverPrimitive.Trigger
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listaId : undefined}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-full border border-input bg-card px-3 py-2 text-sm',
          'transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-destructive',
          className,
        )}
        {...aria}
      >
        <span className={cn('truncate', !selecionada && 'text-muted-foreground')}>
          {selecionada?.label ?? placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-elevated"
        >
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={termo}
              onChange={(event) => setTermo(event.target.value)}
              onKeyDown={navegar}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listaId}
              aria-activedescendant={
                filtradas[ativo] ? `${listaId}-${filtradas[ativo].value}` : undefined
              }
              className="h-8 w-full rounded-full border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {filtradas.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <SearchX className="size-4 shrink-0" aria-hidden="true" />
              {emptyMessage}
            </p>
          ) : (
            <ul id={listaId} role="listbox" className="max-h-64 overflow-y-auto p-1">
              {filtradas.map((opcao, indice) => {
                const escolhida = opcao.value === value;
                return (
                  <li
                    key={opcao.value}
                    id={`${listaId}-${opcao.value}`}
                    role="option"
                    aria-selected={escolhida}
                    // Sem isto o nome acessivel sai da concatenacao dos dois
                    // textos, e o leitor de tela anuncia "PereiraTorre A".
                    aria-label={opcao.hint ? `${opcao.label}, ${opcao.hint}` : opcao.label}
                    onClick={() => escolher(opcao)}
                    onMouseEnter={() => setAtivo(indice)}
                    className={cn(
                      'relative flex cursor-pointer select-none flex-col rounded-md py-2 pl-8 pr-2 text-sm',
                      indice === ativo && 'bg-accent text-accent-foreground',
                    )}
                  >
                    {escolhida ? (
                      <Check className="absolute left-2 top-2.5 size-4" aria-hidden="true" />
                    ) : null}
                    <span className="truncate">{opcao.label}</span>
                    {opcao.hint ? (
                      <span className="truncate text-xs text-muted-foreground">{opcao.hint}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

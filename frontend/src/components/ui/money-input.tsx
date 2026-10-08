import * as React from 'react';
import { cn } from '@/lib/utils';

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** Valor canonico do formulario: `''` quando vazio, ou decimal com ponto. */
  value?: string | number | null;
  /** Emite `''` ou um decimal canonico (`'49.99'`), pronto para `Number()`. */
  onChange?: (value: string) => void;
}

type Mode = 'cents' | 'decimal';

type MaskState = {
  display: string;
  mode: Mode;
  cents: number;
};

type ParseResult =
  | { kind: 'empty' }
  | { kind: 'reject' }
  | { kind: 'value'; cents: number; fracDigits: number; trailingSeparator: boolean };

/** `99.999.999,99`, o teto do `moneySchema` do servidor, em centavos. */
const MAX_CENTS = 9_999_999_999;

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** Mesmo `R$` (e o mesmo espaco rigido) que `formatCurrency` escreve. */
const PREFIX = currencyFormatter.format(0).split(/\d/)[0];

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}

function countDigits(text: string): number {
  let total = 0;
  for (const char of text) if (isDigit(char)) total += 1;
  return total;
}

/**
 * Le o texto digitado e devolve o valor em centavos.
 *
 * Sem separador, quem decide o que os digitos significam e o modo do campo: em
 * `cents` eles sao centavos (`4999` = `49,99`), em `decimal` sao reais
 * (`4999` = `4999,00`). Com separador a leitura e sempre decimal, e a virgula
 * (ou o ponto digitado) e que corta as casas — `1500,50` = `1.500,50`.
 *
 * A excecao e uma fracao maior que duas: ai os digitos voltam a valer como
 * centavos (`R$ 0,049` = `49`). E o que deixa o campo aceitar o proximo digito
 * depois de ter se formatado sozinho — sem ele, `4999` travaria em `0,04`.
 */
function parse(raw: string, mode: Mode): ParseResult {
  const body = raw.replace(/[^\d.,]/g, '');
  if (body === '') return { kind: 'empty' };

  const separatorAt = Math.max(body.lastIndexOf(','), body.lastIndexOf('.'));
  const hasSeparator = separatorAt >= 0;
  const integerDigits = (hasSeparator ? body.slice(0, separatorAt) : body).replace(/[.,]/g, '');
  const fractionDigits = hasSeparator ? body.slice(separatorAt + 1).replace(/[.,]/g, '') : '';

  let cents: number;
  if (hasSeparator && fractionDigits.length > 2) {
    cents = Number(`${integerDigits}${fractionDigits}`);
  } else if (hasSeparator) {
    cents = Number(integerDigits || '0') * 100 + Number(fractionDigits.padEnd(2, '0'));
  } else if (mode === 'cents') {
    cents = Number(integerDigits);
  } else {
    cents = Number(integerDigits || '0') * 100;
  }

  if (!Number.isFinite(cents) || cents < 0 || cents > MAX_CENTS) return { kind: 'reject' };

  return {
    kind: 'value',
    cents,
    fracDigits: hasSeparator
      ? Math.min(fractionDigits.length, 2)
      : mode === 'cents'
        ? 2
        : 0,
    trailingSeparator: hasSeparator && fractionDigits.length === 0,
  };
}

/** `R$ 1.234,56`, com as casas pedidas e virgula no fim quando faltam. */
function formatMoney(cents: number, fracDigits: number, trailingSeparator: boolean): string {
  const reais = Math.floor(cents / 100);
  const integer = integerFormatter.format(reais);
  if (trailingSeparator) return `${PREFIX}${integer},`;
  if (fracDigits === 0) return `${PREFIX}${integer}`;
  const fraction = String(cents - reais * 100).padStart(2, '0').slice(0, fracDigits);
  return `${PREFIX}${integer},${fraction}`;
}

/** O que o formulario guarda: texto com ponto, que `Number()` converte. */
function toCanonical(cents: number): string {
  return (cents / 100).toFixed(2);
}

function toCents(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100);
}

/**
 * Onde o cursor fica depois da reformatacao: o que importa e a posicao dos
 * digitos do valor, e nao a do texto. Em `cents` eles correm para o fim (a
 * virgula entra no meio deles, como em `R$ 0,049`); em `decimal` ficam na
 * frente, antes das casas decimais.
 */
function placeCaret(
  display: string,
  mode: Mode,
  digitsBefore: number,
  digitsAfter: number,
): number {
  const total = countDigits(display);
  const target = mode === 'cents'
    ? Math.max(total - digitsAfter, 0)
    : Math.min(digitsBefore, total);

  let count = 0;
  let caret = 0;
  for (let index = 0; index <= display.length; index += 1) {
    if (count > target) break;
    if (count === target) caret = index;
    if (isDigit(display[index])) count += 1;
  }
  return caret;
}

function stateFor(cents: number | null): MaskState {
  if (cents === null) return { display: '', mode: 'cents', cents: 0 };
  return { display: formatMoney(cents, 2, false), mode: 'decimal', cents };
}

/**
 * Campo de dinheiro em pt-BR, com centavos implicitos.
 *
 * Digitar `4999` mostra `R$ 49,99` — sem virgula, os digitos sao centavos — e
 * digitar `1500,50` mostra `R$ 1.500,50` — com virgula, eles sao reais. O
 * formulario nao muda de jeito: `onChange` emite `''` ou um decimal canonico
 * com ponto (`'49.99'`), que os `Number()` dos `to...Payload` convertem sem
 * virgula para dar `NaN`. `Number.isFinite` e o schema continuam validando.
 *
 * O valor que chega de fora (padrao, edicao, `reset`) reformata o campo uma vez
 * e sai do caminho: so uma mudanca que nao veio daqui reescreve a mascara, para
 * que o que o usuario digita nunca seja sobrescrito no meio da digitacao.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, value, onChange, onBlur, placeholder = '0,00', ...props }, ref) => {
    const externalCents = toCents(value);
    const [state, setState] = React.useState<MaskState>(() => stateFor(externalCents));
    const lastEmittedRef = React.useRef<number | null>(externalCents);
    const caretRef = React.useRef<number | null>(null);
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
      if (externalCents === lastEmittedRef.current) return;
      lastEmittedRef.current = externalCents;
      caretRef.current = null;
      setState(stateFor(externalCents));
    }, [externalCents]);

    React.useLayoutEffect(() => {
      const input = inputRef.current;
      const caret = caretRef.current;
      if (!input || caret === null) return;
      caretRef.current = null;
      input.setSelectionRange(caret, caret);
    });

    const setRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref],
    );

    function handleChange(event: React.ChangeEvent<HTMLInputElement>): void {
      const raw = event.target.value;
      const selection = event.target.selectionStart ?? raw.length;
      const digitsBefore = countDigits(raw.slice(0, selection));
      const digitsAfter = countDigits(raw.slice(selection));
      // Um separador no texto e o sinal de que ele passou a ser lido como
      // decimal. So o campo vazio volta a ser de centavos.
      const mode: Mode =
        raw === '' ? 'cents' : /[,./]/.test(raw) ? 'decimal' : state.mode;

      const result = parse(raw, mode);

      if (result.kind === 'empty') {
        lastEmittedRef.current = null;
        caretRef.current = 0;
        setState({ display: '', mode: 'cents', cents: 0 });
        onChange?.('');
        return;
      }

      if (result.kind === 'reject') {
        // Passou do teto: o texto digitado desfaz e volta o que ja estava.
        event.target.value = state.display;
        setState({ ...state });
        return;
      }

      const display = formatMoney(result.cents, result.fracDigits, result.trailingSeparator);
      lastEmittedRef.current = result.cents;
      caretRef.current = placeCaret(display, mode, digitsBefore, digitsAfter);
      setState({ display, mode, cents: result.cents });
      onChange?.(toCanonical(result.cents));
    }

    function handleBlur(event: React.FocusEvent<HTMLInputElement>): void {
      onBlur?.(event);
      // No repouso as duas casas sempre: `R$ 1.500` e `R$ 1.500,00`.
      setState((previous) => {
        if (previous.display === '') return previous;
        const display = formatMoney(previous.cents, 2, false);
        return display === previous.display ? previous : { ...previous, display };
      });
    }

    return (
      <input
        {...props}
        ref={setRef}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={state.display}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          'flex h-10 w-full rounded-full border border-input bg-card px-3 py-2 text-sm transition-colors',
          'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-destructive',
          className,
        )}
      />
    );
  },
);
MoneyInput.displayName = 'MoneyInput';

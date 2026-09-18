import { useState } from 'react';
import { KeyRound, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Visitor } from '@/types/visitor';
import { useVisitorByAccessCode } from '../visitor-hooks';
import { TYPE_LABELS, UNIT_REMOVED, unitLabel } from '../visitor-labels';
import { VisitorStatusBadge } from './visitor-status-badge';

/** Limites do parametro em `visitor.routes.ts`. */
const MIN_CODE = 4;
const MAX_CODE = 12;

export interface AccessCodeLookupProps {
  /** Oferecida so a quem pode registrar entrada; o resultado e leitura. */
  canCheckIn: boolean;
  onCheckIn: (visitor: Visitor) => void;
}

/**
 * Consulta de visitante pelo codigo de acesso — o balcao da portaria.
 *
 * **Nao e o filtro da lista.** A busca por texto percorre uma pagina de
 * resultados e pede refinamento; esta rota devolve **um** visitante ou nenhum, e
 * responde a pergunta concreta de quem esta com alguem parado na frente: "este
 * codigo vale?". Sao gestos diferentes, com respostas de formato diferente, e
 * juntar os dois num controle so tornaria ambos piores.
 *
 * **Codigo desconhecido nao e erro de sistema.** O servidor responde **409**
 * com "Codigo de acesso invalido ou ja utilizado." — e a consulta so procura
 * entre os visitantes `EXPECTED`, entao quem ja entrou tambem nao e encontrado.
 * Os dois casos sao desfechos normais do balcao: aparecem aqui, na propria
 * consulta, e nao como um toast de falha.
 *
 * **Sem consulta automatica.** O resultado e sobre o estado de agora; guardar a
 * resposta por chave faria a segunda leitura do mesmo codigo vir do cache,
 * exatamente quando a primeira ja pode ter mudado o estado. Por isso a leitura e
 * disparada por acao, e nao pela montagem.
 */
export function AccessCodeLookup({ canCheckIn, onCheckIn }: AccessCodeLookupProps) {
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Visitor | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const lookup = useVisitorByAccessCode({
    onSuccess: (visitor) => {
      setFound(visitor);
      setRefusal(null);
    },
    onError: (error: ApiError) => {
      setFound(null);
      // 409 e a resposta "nao encontrado" desta rota; qualquer outro status e
      // falha de verdade, e a mensagem do servidor continua sendo a melhor.
      setRefusal(error.message);
    },
  });

  const trimmed = code.trim();
  const valid = trimmed.length >= MIN_CODE && trimmed.length <= MAX_CODE;

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (!valid || lookup.isPending) return;
    lookup.mutate(trimmed);
  }

  function clear(): void {
    setCode('');
    setFound(null);
    setRefusal(null);
  }

  return (
    <section className="app-surface space-y-3 p-4" aria-label="Consulta por código de acesso">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="visitor-access-code">Código de acesso</Label>
          <div className="relative">
            <ScanLine
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="visitor-access-code"
              className="pl-10 font-mono uppercase"
              // O servidor normaliza para maiusculas; fazer o mesmo aqui evita
              // um 409 que seria so diferenca de caixa.
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={MAX_CODE}
              autoComplete="off"
              placeholder="Ex.: A1B2C3"
              aria-describedby="visitor-access-code-help"
            />
          </div>
          <p id="visitor-access-code-help" className="text-xs text-muted-foreground">
            De {MIN_CODE} a {MAX_CODE} caracteres. Encontra apenas visitas aguardando entrada.
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={!valid} loading={lookup.isPending}>
            Consultar
          </Button>
          {found || refusal ? (
            <Button type="button" variant="ghost" onClick={clear}>
              Limpar
            </Button>
          ) : null}
        </div>
      </form>

      {refusal ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {/*
            `role="status"` e nao `alert`: e uma resposta da consulta, nao uma
            falha da tela. A mensagem do servidor já cobre os dois casos que
            produzem 409 — código inexistente e visita já registrada.
          */}
          <span>{refusal}</span>
        </p>
      ) : null}

      {found ? (
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{found.name}</span>
              <VisitorStatusBadge status={found.status} />
            </div>
            {canCheckIn ? (
              <Button
                size="sm"
                aria-label={`Registrar entrada de ${found.name}`}
                onClick={() => onCheckIn(found)}
              >
                Registrar entrada
              </Button>
            ) : null}
          </div>

          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Field label="Tipo" value={TYPE_LABELS[found.type] ?? found.type} />
            <Field
              label="Unidade"
              // O visitante traz a unidade aninhada; ela pode ter sido removida.
              value={found.unit ? unitLabel(found.unit) : UNIT_REMOVED}
            />
            <Field label="Documento" value={found.document ?? '—'} />
            <Field
              label="Previsto para"
              value={found.expectedAt ? formatDateTime(found.expectedAt) : '—'}
            />
          </dl>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

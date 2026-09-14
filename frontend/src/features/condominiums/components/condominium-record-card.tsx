import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDocument, formatNumber, formatPhone } from '@/lib/format';
import type { Condominium } from '@/types/api';

const TYPE_LABELS: Record<Condominium['type'], string> = {
  RESIDENTIAL: 'Residencial',
  COMMERCIAL: 'Comercial',
  MIXED: 'Misto',
};

const STATUS_LABELS: Record<Condominium['status'], string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

/** Placeholder neutro, o mesmo de `lib/format.ts`. */
const EMPTY = '—';

function text(value?: string | null): string {
  return value && value.trim() !== '' ? value : EMPTY;
}

/** Endereco em uma linha; as partes ausentes somem em vez de virar virgulas soltas. */
function formatAddress(condominium: Condominium): string {
  const line = [condominium.street, condominium.number, condominium.complement]
    .filter((part) => part && part.trim() !== '')
    .join(', ');
  const area = [condominium.district, condominium.city, condominium.state]
    .filter((part) => part && part.trim() !== '')
    .join(' · ');
  const parts = [line, area].filter((part) => part !== '');
  return parts.length > 0 ? parts.join(' — ') : EMPTY;
}

export function CondominiumRecordCard({ condominium }: { condominium: Condominium }) {
  return (
    <section aria-label="Cadastro" className="app-surface p-5">
      <dl className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome">{condominium.name}</Field>
        <Field label="CNPJ">{formatDocument(condominium.document)}</Field>
        <Field label="Tipo">{TYPE_LABELS[condominium.type]}</Field>
        <Field label="Status">
          <Badge variant={condominium.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {STATUS_LABELS[condominium.status]}
          </Badge>
        </Field>
        <Field label="CEP">{text(condominium.zipCode)}</Field>
        <Field label="Endereco">{formatAddress(condominium)}</Field>
        <Field label="Telefone">{formatPhone(condominium.phone)}</Field>
        <Field label="E-mail">{text(condominium.email)}</Field>
        <Field label="Sindico">{text(condominium.syndicName)}</Field>
        <Field label="Telefone do sindico">{formatPhone(condominium.syndicPhone)}</Field>
        <Field label="Fim do mandato">{formatDate(condominium.syndicTermEndsAt)}</Field>
        <Field label="Dia de vencimento">{formatNumber(condominium.chargeDueDay)}</Field>
        <Field label="Total de unidades">{formatNumber(condominium.totalUnits)}</Field>
        <Field label="Observacoes" className="sm:col-span-2">
          {text(condominium.notes)}
        </Field>
      </dl>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

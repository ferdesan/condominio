import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, FileQuestion, Vote } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ForbiddenPage } from '@/features/misc/forbidden-page';
import { useAuth } from '@/hooks/use-auth';
import { POLL_STATUS_LABELS, VOTE_CONFIRMATION } from './assembly-labels';
import { pollHooks, useCastVote, useMyVote } from './assembly-hooks';
import { PollResultsPanel } from './components/poll-results-panel';
import type { Poll } from '@/types/assembly';

/**
 * Fases da tela apos o envio.
 *
 * `conflict` e o 409 do proprio envio: o servidor ja tinha o voto e o disse.
 * Ela convive com `confirmation` porque o duplo clique pode chegar nos dois
 * sentidos — o que importa e que a tela converge para "ja votou" sem gravar
 * duas vezes (US-004 EC-1).
 */
type VotePhase = 'form' | 'confirmation' | 'conflict';

/**
 * A votacao canonica do morador, na rota `/votacoes/:pollId`.
 *
 * **Rota fora do menu, com guarda propria `vote:read`** — terceiro caso do
 * genero, depois de `/perfil` e do balancete (ADR-001). Chega-se por link de
 * notificacao ou pela acao Votar em Deliberacoes; nao ha item de menu para uma
 * tela aberta uma vez por votacao.
 *
 * Ordem de estados (uma tela so mostra um): carregando → erro da votacao
 * (403 proibida, resto nao encontrada) → 403 do my-vote → confirmacao →
 * ja votou → nao aberta → sem `vote:create` proibida → votavel. Confirmacao e
 * ja-votou ficam **nao-aberta** de proposito: uma votacao que fecha enquanto
 * alguem le a tela nao pode apagar a confirmacao dela (IT-366), e um 404 no
 * detalhe derruba tudo, inclusive a confirmacao (IT-372).
 *
 * A apuracao (`PollResultsPanel`) so entra com `poll:read` e nas fases
 * pos-voto: quem nao pode ler apuracao fica so com a confirmacao, sem bloco de
 * erro nenhum (ADR-004).
 */
export function VotePage() {
  const { pollId = '' } = useParams<{ pollId: string }>();
  const { can } = useAuth();

  const [phase, setPhase] = useState<VotePhase>('form');
  const [optionId, setOptionId] = useState('');
  const [voteError, setVoteError] = useState<string | null>(null);

  const poll = pollHooks.useOne(pollId);
  const myVote = useMyVote(pollId);

  const castVote = useCastVote(pollId, {
    onSuccess: () => {
      setVoteError(null);
      setPhase('confirmation');
    },
    onError: (error) => {
      if (error.status === 409) {
        // 409 nunca tira a confirmacao: o duplo envio que ja la chegou
        // permanece; o que vinha do formulario converge para ja-votou.
        setVoteError(null);
        setPhase((current) => (current === 'confirmation' ? 'confirmation' : 'conflict'));
        return;
      }
      setVoteError(error.message);
    },
  });

  if (poll.isPending || myVote.isPending) return <VoteSkeleton />;

  // 403 e escopo sobre esta votacao; o resto (404, 422) e endereco que nao
  // resolve — para quem colou o link, os dois sao a mesma coisa.
  if (poll.isError) {
    if (poll.error?.status === 403) return <ForbiddenPage />;
    return <VoteNotFound />;
  }

  if (myVote.isError && myVote.error?.status === 403) return <ForbiddenPage />;

  const data = poll.data;
  const alreadyVoted = phase === 'conflict' || Boolean(myVote.data?.voted);
  const outsideWindow = !withinWindow(data);
  const open = data.status === 'OPEN' && !outsideWindow;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!optionId) return;
    setVoteError(null);
    castVote.mutate({ optionId });
  }

  /** Confirmacao + apuracao, sem revelar a opcao escolhida (ADR-004). */
  function confirmationBlock() {
    return (
      <div className="space-y-4">
        <Card role="status" className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Vote className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium">{VOTE_CONFIRMATION}</p>
              <p className="text-sm text-muted-foreground">
                Seu voto foi contabilizado nesta votacao.
              </p>
            </div>
          </div>
        </Card>
        {can('poll:read') ? <ResultsCard pollId={data.id} /> : null}
      </div>
    );
  }

  /** Ja votou (retorno ou 409): a opcao so aparece se a API devolveu o id. */
  function alreadyVotedBlock() {
    const chosen = myVote.data?.optionId
      ? (data.options ?? []).find((option) => option.id === myVote.data?.optionId)
      : undefined;

    return (
      <div className="space-y-4">
        <EmptyState
          icon={CheckCircle2}
          title="Você já votou nesta votação"
          description={
            chosen
              ? `Opção escolhida: ${chosen.label}`
              : 'Seu voto já está registrado nesta votação.'
          }
        />
        {can('poll:read') ? <ResultsCard pollId={data.id} /> : null}
      </div>
    );
  }

  /** Fora de estado aberto: sem controle de envio nenhum (IT-351/IT-352). */
  function notOpenBlock() {
    const byStatus = data.status !== 'OPEN';
    return (
      <EmptyState
        icon={Clock}
        title={byStatus ? 'Votação não está aberta' : 'Votação fora do período de votação'}
        description={
          byStatus
            ? 'Esta votação ainda não está aberta para receber votos.'
            : `A votação recebe votos entre as datas definidas pela gestão. Situação atual: ${POLL_STATUS_LABELS[data.status]}.`
        }
      />
    );
  }

  /** Formulario votavel: radio nativo em `<label>` e envio por `<form>`. */
  function formBlock() {
    if (!can('vote:create')) return <ForbiddenPage />;

    const options = data.options ?? [];

    return (
      <Card className="p-4">
        <form aria-label="Formulário de voto" onSubmit={handleSubmit}>
          <fieldset className="min-w-0 space-y-3">
            <legend className="text-sm font-medium">
              Escolha uma alternativa e registre o seu voto.
            </legend>
            {options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/40"
              >
                <input
                  type="radio"
                  name="poll-option"
                  value={option.id}
                  checked={optionId === option.id}
                  onChange={() => setOptionId(option.id)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.label}</span>
                  {option.description ? (
                    <span className="block text-xs text-muted-foreground">{option.description}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </fieldset>

          {voteError ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {voteError}
            </p>
          ) : null}

          {/* Nao desabilita durante o envio: o duplo clique e exercitado de
              proposito e precisa chegar ao servidor como 409 (US-004 EC-1). */}
          <Button type="submit" className="mt-4" disabled={!optionId}>
            Enviar voto
          </Button>
        </form>
      </Card>
    );
  }

  let body: React.ReactNode;
  if (phase === 'confirmation') {
    body = confirmationBlock();
  } else if (alreadyVoted) {
    body = alreadyVotedBlock();
  } else if (!open) {
    body = notOpenBlock();
  } else {
    body = formBlock();
  }

  return (
    <>
      <PageHeader
        title={data.title}
        description={data.description ?? undefined}
        actions={<Badge variant="outline">{POLL_STATUS_LABELS[data.status]}</Badge>}
      />
      {body}
    </>
  );
}

/** A votacao nao existe, saiu do acesso ou o endereco esta errado. */
function VoteNotFound() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Votação não encontrada"
      description="A votação não existe, está fora do seu acesso ou o endereço está incorreto."
      action={
        <Button asChild variant="outline">
          <Link to="/assembleias">Voltar para as assembleias</Link>
        </Button>
      }
    />
  );
}

/** Apuracao pos-voto, só para quem tem `poll:read` (ADR-004). */
function ResultsCard({ pollId }: { pollId: string }) {
  return (
    <Card role="region" aria-labelledby="vote-results-title" className="p-4">
      <h2 id="vote-results-title" className="mb-3 text-sm font-semibold">
        Apuração
      </h2>
      <PollResultsPanel pollId={pollId} />
    </Card>
  );
}

/** Segura a posicao dos blocos para que a pagina nao salte quando os dados chegam. */
function VoteSkeleton() {
  return (
    <>
      <PageHeader title="Carregando votação..." />
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-24" />
      </div>
    </>
  );
}

/** Entre `startsAt` e `endsAt`, inclusive. Status aberto e janela sao duas coisas. */
function withinWindow(poll: Poll): boolean {
  const now = Date.now();
  return now >= Date.parse(poll.startsAt) && now <= Date.parse(poll.endsAt);
}

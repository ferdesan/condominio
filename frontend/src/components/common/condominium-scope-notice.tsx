import { Building2 } from 'lucide-react';
import { useCondominium } from '@/hooks/use-condominium';

export interface CondominiumScopeNoticeProps {
  /** O condominio com que o dialogo foi aberto, e nao o do shell agora. */
  condominiumId: string;
}

/**
 * Aviso de que o condominio do shell mudou depois que este dialogo abriu.
 *
 * Um formulario aberto grava no condominio para o qual foi aberto, nunca no que
 * passou a estar selecionado (US-027.EC-3): quem digitou tres campos para a
 * Torre A nao os enviou para outro predio porque alguem mexeu no seletor. A
 * alternativa — reapontar o formulario ao vivo — salva no condominio errado, e
 * fecha-lo sozinho descarta o que ja foi digitado sem perguntar.
 *
 * O que sobra e a divergencia entre o que o dialogo grava e o que o resto da
 * tela mostra, e e justamente isso que este aviso nomeia. Ele nao aparece
 * enquanto os dois coincidem, que e o caso comum.
 */
export function CondominiumScopeNotice({ condominiumId }: CondominiumScopeNoticeProps) {
  const { condominiums, selectedId } = useCondominium();

  if (selectedId === null || selectedId === condominiumId) return null;

  // O condominio de origem pode ter saido da lista acessivel (foi removido, ou o
  // acesso mudou). Nomear o registro e melhor, mas a ausencia do nome nao impede
  // o aviso de dizer o que importa.
  const origin = condominiums.find((item) => item.id === condominiumId);

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-foreground"
    >
      <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        O condominio selecionado mudou depois que este formulario abriu. Ele continua valendo para{' '}
        <strong>{origin?.name ?? 'o condomínio de origem'}</strong>. Feche e abra de novo para
        trabalhar no condomínio agora selecionado.
      </span>
    </p>
  );
}

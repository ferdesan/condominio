import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Block } from '@/types/api';
import { BlockFormDialog } from './block-form-dialog';

export interface BlockSelectFieldProps {
  id: string;
  label?: string;
  condominiumId: string;
  /** Somente os blocos do condominio selecionado: e o que impede o desencontro que o servidor recusa. */
  blocks: Block[];
  loading: boolean;
  value: string;
  onChange: (blockId: string) => void;
  error?: string;
  /**
   * Liga a criacao em linha. Falso quando o papel nao pode criar blocos — e ai a
   * lista mostra apenas os blocos existentes.
   */
  canCreate: boolean;
  /** Avisa o formulario hospedeiro do bloco recem-criado, que ja vem selecionado. */
  onBlockCreated?: (block: Block) => void;
}

/**
 * Seletor de bloco com criacao em linha.
 *
 * Um condominio recem-cadastrado nao tem bloco nenhum, e nenhuma unidade pode
 * existir sem um. Por isso, quando nao ha blocos, a criacao do primeiro e
 * oferecida direto, no lugar de um seletor vazio sem saida (ADR-007). O
 * formulario que hospeda este campo continua montado enquanto o dialogo de bloco
 * esta aberto, entao o que ja foi digitado na unidade sobrevive.
 */
export function BlockSelectField({
  id,
  label = 'Bloco',
  condominiumId,
  blocks,
  loading,
  value,
  onChange,
  error,
  canCreate,
  onBlockCreated,
}: BlockSelectFieldProps) {
  const [creating, setCreating] = useState(false);
  /**
   * Blocos criados aqui mesmo. A lista de fora vem de uma consulta que a criacao
   * invalida, mas ela so chega no proximo ciclo — e ate la o bloco recem-criado
   * ja esta escolhido para a unidade e precisa aparecer no seletor.
   */
  const [createdBlocks, setCreatedBlocks] = useState<Block[]>([]);

  const options = useMemo(() => {
    const merged = new Map(blocks.map((block) => [block.id, block]));
    for (const block of createdBlocks) {
      if (!merged.has(block.id)) merged.set(block.id, block);
    }
    return [...merged.values()];
  }, [blocks, createdBlocks]);

  const hasBlocks = options.length > 0;

  function handleSaved(block: Block): void {
    setCreating(false);
    setCreatedBlocks((current) => [...current, block]);
    onChange(block.id);
    onBlockCreated?.(block);
  }

  const inlineDialog = creating ? (
    <BlockFormDialog
      condominiumId={condominiumId}
      description="O cadastro da unidade continua aberto atras deste dialogo e nada do que foi preenchido se perde."
      onSaved={handleSaved}
      onCancel={() => setCreating(false)}
    />
  ) : null;

  // Sem blocos e com permissao nao ha o que escolher, so o que criar. Nao e um
  // `FormField`: rotular o botao com `htmlFor` faria seu nome acessivel virar
  // "Bloco", escondendo justamente a acao que o resolve.
  if (!loading && !hasBlocks && canCreate) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          Este condominio ainda nao tem blocos. Toda unidade pertence a um.
        </p>
        <Button type="button" variant="outline" onClick={() => setCreating(true)}>
          Cadastrar o primeiro bloco
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {inlineDialog}
      </div>
    );
  }

  return (
    <>
      <FormField id={id} label={label} error={error}>
        {(aria) => (
          <div className="flex items-center gap-2">
            <Select value={value} onValueChange={onChange} disabled={loading || !hasBlocks}>
              <SelectTrigger className="flex-1" {...aria}>
                <SelectValue
                  placeholder={loading ? 'Carregando blocos...' : 'Selecione o bloco'}
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((block) => (
                  <SelectItem key={block.id} value={block.id}>
                    {block.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canCreate ? (
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => setCreating(true)}
              >
                Novo bloco
              </Button>
            ) : null}
          </div>
        )}
      </FormField>

      {inlineDialog}
    </>
  );
}

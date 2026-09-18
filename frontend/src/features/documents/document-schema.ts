/**
 * Espelho cliente de `backend/src/modules/documents/document.schema.ts`.
 *
 * O servidor tem duas formas, e nao uma: o envio e **multipart** e carrega o
 * arquivo; a edicao e um PATCH de JSON que so toca os metadados — **nao ha rota
 * para trocar o arquivo de um documento existente**. Por isso o campo de arquivo
 * so aparece no cadastro, e o formulario de edicao simplesmente nao o mostra, em
 * vez de mostra-lo desabilitado: um controle que nunca faz nada e pior do que um
 * controle ausente.
 *
 * Os dois casos compartilham os mesmos valores de formulario — `file` e nulavel
 * — e o que muda e a exigencia, aplicada por `documentSchema(requireFile)`. Isso
 * evita dois genericos de `useForm` para um unico dialogo.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell.
 */

import { z } from 'zod';
import { DOCUMENT_CATEGORIES, DOCUMENT_VISIBILITIES, type DocumentFile } from '@/types/document';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from './document-labels';

const documentFields = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Informe o título do documento.')
    .max(180, 'Use no máximo 180 caracteres.'),
  description: z.string().trim().max(255, 'Use no máximo 255 caracteres.'),
  category: z.enum(DOCUMENT_CATEGORIES),
  visibility: z.enum(DOCUMENT_VISIBILITIES),
  /** Vazio significa sem validade; o servidor aceita nulo. */
  expiresAt: z.string(),
  /** Uma linha separada por virgulas; o servidor tambem aceita essa forma. */
  tags: z.string().trim().max(400, 'Use no máximo 400 caracteres.'),
  /** Nulo na edicao, onde o arquivo nao participa. */
  file: z.instanceof(File).nullable(),
});

export type DocumentFormValues = z.infer<typeof documentFields>;

/**
 * O arquivo e conferido aqui antes de sair da maquina.
 *
 * Nao e duplicacao ociosa da regra do servidor: sem isso, escolher um arquivo de
 * cem megabytes so falharia depois de enviar os cem megabytes. O `fileFilter` e
 * o limite do multer continuam sendo a autoridade — o ambiente pode ter outro
 * teto —, e a recusa deles aparece como mensagem geral do formulario.
 */
export function documentSchema(requireFile: boolean) {
  return documentFields.superRefine((values, ctx) => {
    if (!requireFile) return;

    if (!values.file) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['file'],
        message: 'Escolha o arquivo do documento.',
      });
      return;
    }

    if (values.file.size === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['file'],
        message: 'O arquivo selecionado esta vazio.',
      });
      return;
    }

    if (values.file.size > MAX_FILE_SIZE_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['file'],
        message: `O arquivo excede o limite de ${MAX_FILE_SIZE_MB} MB.`,
      });
    }
  });
}

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const DOCUMENT_FIELDS: ReadonlySet<string> = new Set(Object.keys(documentFields.shape));

/** Os padroes sao os do servidor: outro, visivel aos moradores, sem validade. */
export function documentFormDefaults(): DocumentFormValues {
  return {
    title: '',
    description: '',
    category: 'OTHER',
    visibility: 'RESIDENTS',
    expiresAt: '',
    tags: '',
    file: null,
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira vazio. */
export function toDocumentFormValues(document: DocumentFile): DocumentFormValues {
  return {
    title: document.title,
    description: document.description ?? '',
    category: document.category,
    visibility: document.visibility,
    expiresAt: document.expiresAt ?? '',
    tags: (document.tags ?? []).join(', '),
    file: null,
  };
}

function toTagList(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Corpo de `PATCH /documents/:id`.
 *
 * Campos vazios viram `null`, e nao string vazia: e assim que se apaga uma
 * descricao ou uma validade que existia. O schema do servidor aceita nulo nos
 * tres opcionais.
 */
export type DocumentMetadataPayload = {
  title: string;
  description: string | null;
  category: DocumentFormValues['category'];
  visibility: DocumentFormValues['visibility'];
  expiresAt: string | null;
  tags: string[] | null;
};

export function toDocumentMetadataPayload(values: DocumentFormValues): DocumentMetadataPayload {
  const tags = toTagList(values.tags);
  return {
    title: values.title,
    description: values.description || null,
    category: values.category,
    visibility: values.visibility,
    expiresAt: values.expiresAt || null,
    tags: tags.length > 0 ? tags : null,
  };
}

/**
 * Corpo multipart de `POST /documents`.
 *
 * Tudo vira texto — e o que o `uploadDocumentSchema` do servidor espera, que por
 * isso aceita `tags` como string separada por virgulas. Chaves de valor vazio
 * ficam de fora: um campo textual vazio num multipart chega como `''`, e o
 * `.optional()` do servidor nao trata string vazia como ausencia.
 */
export function toDocumentFormData(values: DocumentFormValues, condominiumId: string): FormData {
  const data = new FormData();
  // Chamado somente no cadastro, onde o schema ja exigiu o arquivo.
  if (values.file) data.append('file', values.file);
  data.append('condominiumId', condominiumId);
  data.append('title', values.title);
  data.append('category', values.category);
  data.append('visibility', values.visibility);

  if (values.description) data.append('description', values.description);
  if (values.expiresAt) data.append('expiresAt', values.expiresAt);

  const tags = toTagList(values.tags);
  if (tags.length > 0) data.append('tags', tags.join(','));

  return data;
}

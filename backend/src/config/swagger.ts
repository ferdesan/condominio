import { env } from './env';

type OpenApiObject = Record<string, unknown>;

const PAGINATION_PARAMS = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'perPage', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 20 } },
  { name: 'search', in: 'query', schema: { type: 'string' } },
  { name: 'sortBy', in: 'query', schema: { type: 'string' } },
  { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
  { name: 'condominiumId', in: 'query', schema: { type: 'string', format: 'uuid' } },
];

const ID_PARAM = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const ERROR_RESPONSES = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  404: { $ref: '#/components/responses/NotFound' },
  422: { $ref: '#/components/responses/ValidationError' },
};

/** Recursos que seguem o contrato CRUD padrao gerado por `createCrudRouter`. */
const CRUD_RESOURCES: Array<{ path: string; tag: string; singular: string }> = [
  { path: '/users', tag: 'Usuarios', singular: 'usuario' },
  { path: '/roles', tag: 'Papeis & Permissoes', singular: 'papel de acesso' },
  { path: '/condominiums', tag: 'Condominios', singular: 'condominio' },
  { path: '/blocks', tag: 'Blocos', singular: 'bloco' },
  { path: '/units', tag: 'Unidades', singular: 'unidade' },
  { path: '/residents', tag: 'Moradores', singular: 'morador' },
  { path: '/dependents', tag: 'Dependentes', singular: 'dependente' },
  { path: '/employees', tag: 'Funcionarios', singular: 'funcionario' },
  { path: '/service-providers', tag: 'Prestadores', singular: 'prestador de servico' },
  { path: '/visitors', tag: 'Visitantes', singular: 'visitante' },
  { path: '/vehicles', tag: 'Veiculos', singular: 'veiculo' },
  { path: '/correspondences', tag: 'Correspondencias', singular: 'correspondencia' },
  { path: '/common-areas', tag: 'Areas comuns', singular: 'area comum' },
  { path: '/reservations', tag: 'Reservas', singular: 'reserva' },
  { path: '/financial/categories', tag: 'Financeiro', singular: 'categoria financeira' },
  { path: '/financial/charges', tag: 'Financeiro', singular: 'cobranca' },
  { path: '/financial/expenses', tag: 'Financeiro', singular: 'despesa' },
  { path: '/assemblies', tag: 'Assembleias', singular: 'assembleia' },
  { path: '/polls', tag: 'Votacoes', singular: 'votacao' },
  { path: '/announcements', tag: 'Comunicados', singular: 'comunicado' },
  { path: '/incidents', tag: 'Ocorrencias', singular: 'ocorrencia' },
  { path: '/maintenances', tag: 'Manutencoes', singular: 'manutencao' },
];

function crudPaths(): OpenApiObject {
  const paths: OpenApiObject = {};

  for (const resource of CRUD_RESOURCES) {
    paths[resource.path] = {
      get: {
        tags: [resource.tag],
        summary: `Lista ${resource.singular}s`,
        parameters: PAGINATION_PARAMS,
        responses: {
          200: { $ref: '#/components/responses/PaginatedList' },
          ...ERROR_RESPONSES,
        },
      },
      post: {
        tags: [resource.tag],
        summary: `Cria ${resource.singular}`,
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: { 201: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    };

    paths[`${resource.path}/{id}`] = {
      get: {
        tags: [resource.tag],
        summary: `Detalha ${resource.singular}`,
        parameters: [ID_PARAM],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
      patch: {
        tags: [resource.tag],
        summary: `Atualiza ${resource.singular}`,
        parameters: [ID_PARAM],
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
      delete: {
        tags: [resource.tag],
        summary: `Remove ${resource.singular} (exclusao logica)`,
        parameters: [ID_PARAM],
        responses: { 204: { description: 'Removido com sucesso.' }, ...ERROR_RESPONSES },
      },
    };

    paths[`${resource.path}/{id}/restore`] = {
      post: {
        tags: [resource.tag],
        summary: `Restaura ${resource.singular} removido`,
        parameters: [ID_PARAM],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    };
  }

  return paths;
}

/** Endpoints com contrato proprio (fluxos de negocio e autenticacao). */
function customPaths(): OpenApiObject {
  const action = (tag: string, summary: string, withBody = true): OpenApiObject => ({
    post: {
      tags: [tag],
      summary,
      parameters: [ID_PARAM],
      ...(withBody ? { requestBody: { $ref: '#/components/requestBodies/GenericPayload' } } : {}),
      responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
    },
  });

  return {
    '/health': {
      get: {
        tags: ['Infra'],
        summary: 'Status da API',
        security: [],
        responses: { 200: { description: 'API no ar.' } },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Infra'],
        summary: 'Readiness (banco e cache)',
        security: [],
        responses: { 200: { description: 'Pronta.' }, 503: { description: 'Indisponivel.' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Autenticacao'],
        summary: 'Autentica e emite os tokens de acesso e refresh',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                  tenantSlug: { type: 'string' },
                },
              },
              example: { email: 'sindico@parqueflores.com.br', password: 'Sindico@123' },
            },
          },
        },
        responses: {
          200: { $ref: '#/components/responses/LoginResponse' },
          401: { $ref: '#/components/responses/Unauthorized' },
          409: { description: 'E-mail presente em mais de uma administradora.' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Autenticacao'],
        summary: 'Cadastro self-service de uma nova administradora',
        security: [],
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: {
          201: { $ref: '#/components/responses/LoginResponse' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Autenticacao'],
        summary: 'Rotaciona o refresh token e emite novo access token',
        security: [],
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: {
          200: { $ref: '#/components/responses/LoginResponse' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Autenticacao'],
        summary: 'Perfil, permissoes e escopo do usuario autenticado',
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
      patch: {
        tags: ['Autenticacao'],
        summary: 'Atualiza o proprio perfil',
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['Autenticacao'],
        summary: 'Troca a senha do usuario autenticado',
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: { 204: { description: 'Senha alterada.' }, ...ERROR_RESPONSES },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Autenticacao'],
        summary: 'Encerra a sessao atual',
        security: [],
        responses: { 204: { description: 'Sessao encerrada.' } },
      },
    },
    '/condominiums/{id}/stats': {
      get: {
        tags: ['Condominios'],
        summary: 'Indicadores consolidados do condominio',
        parameters: [ID_PARAM],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/units/bulk': {
      post: {
        tags: ['Unidades'],
        summary: 'Cria unidades em lote a partir do padrao de numeracao do bloco',
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: { 201: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/correspondences/{id}/deliver': action('Correspondencias', 'Registra a retirada'),
    '/visitors/{id}/check-in': action('Visitantes', 'Registra a entrada do visitante'),
    '/visitors/{id}/check-out': action('Visitantes', 'Registra a saida do visitante'),
    '/reservations/availability': {
      get: {
        tags: ['Reservas'],
        summary: 'Agenda das areas comuns em um intervalo',
        parameters: [
          { name: 'condominiumId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'commonAreaId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'from', in: 'query', required: true, schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', required: true, schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/reservations/{id}/approve': action('Reservas', 'Aprova a reserva'),
    '/reservations/{id}/reject': action('Reservas', 'Recusa a reserva'),
    '/reservations/{id}/cancel': action('Reservas', 'Cancela a reserva'),
    '/financial/charges/generate': {
      post: {
        tags: ['Financeiro'],
        summary: 'Gera as cobrancas do mes para todas as unidades',
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: { 201: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/financial/charges/{id}/payments': action('Financeiro', 'Registra pagamento da cobranca'),
    '/financial/charges/summary': {
      get: {
        tags: ['Financeiro'],
        summary: 'Totais faturados, recebidos e inadimplencia',
        parameters: [
          { name: 'condominiumId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'referenceMonth', in: 'query', schema: { type: 'string', example: '2026-09' } },
        ],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/financial/expenses/{id}/pay': action('Financeiro', 'Quita a despesa'),
    '/financial/closings': {
      get: {
        tags: ['Financeiro'],
        summary: 'Lista os meses ja fechados do condominio',
        parameters: [
          { name: 'condominiumId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'perPage', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { $ref: '#/components/responses/PaginatedList' }, ...ERROR_RESPONSES },
      },
    },
    '/financial/closings/{referenceMonth}': {
      get: {
        tags: ['Financeiro'],
        summary: 'Balancete do mes: saldo anterior, entradas e saidas por categoria, saldo final',
        description:
          'Regime de caixa: a receita vem da data do pagamento e a despesa da data em que foi paga. ' +
          'Recalcula enquanto o mes esta aberto e serve o documento gravado depois de fechado.',
        parameters: [
          { name: 'referenceMonth', in: 'path', required: true, schema: { type: 'string', example: '2026-09' } },
          { name: 'condominiumId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/financial/closings/{referenceMonth}/entries': {
      get: {
        tags: ['Financeiro'],
        summary: 'Lancamentos do balancete: cada entrada e cada saida do mes',
        description:
          'Exige `financial-closing:read`. Serve os lancamentos gravados quando a competencia esta ' +
          'fechada e os calcula quando esta aberta — `frozen` diz de qual dos dois a lista veio. ' +
          '`frozen: true` com lista vazia e um documento fechado antes de os lancamentos passarem a ' +
          'ser gravados, e nao um mes sem movimento. ' +
          'O mes vem inteiro numa resposta so: `page` e `perPage` sao recusados, nao ignorados.',
        parameters: [
          { name: 'referenceMonth', in: 'path', required: true, schema: { type: 'string', example: '2026-08' } },
          { name: 'condominiumId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/financial/closings/{referenceMonth}/close': {
      post: {
        tags: ['Financeiro'],
        summary: 'Fecha o mes e congela o balancete',
        description:
          'Exige `financial-closing:create`. Recusa mes que ainda nao terminou e mes ja fechado. ' +
          'Depois disto, lancamento que moveria o caixa do mes e recusado com 409.',
        parameters: [
          { name: 'referenceMonth', in: 'path', required: true, schema: { type: 'string', example: '2026-08' } },
        ],
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/financial/closings/{referenceMonth}/reopen': {
      post: {
        tags: ['Financeiro'],
        summary: 'Reabre o mes fechado, deixando registro',
        description:
          'Exige `financial-closing:manage`, estritamente mais forte do que a permissao de fechar.',
        parameters: [
          { name: 'referenceMonth', in: 'path', required: true, schema: { type: 'string', example: '2026-08' } },
        ],
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/assemblies/{id}/start': action('Assembleias', 'Inicia a assembleia', false),
    '/assemblies/{id}/finish': action('Assembleias', 'Encerra e anexa a ata'),
    '/polls/{id}/open': action('Votacoes', 'Abre a votacao', false),
    '/polls/{id}/close': action('Votacoes', 'Encerra e publica o resultado', false),
    '/polls/{id}/vote': action('Votacoes', 'Registra o voto da unidade'),
    '/polls/{id}/votes': {
      get: {
        tags: ['Votacoes'],
        summary: 'Lista votos individuais da votacao (indisponivel em secreta)',
        parameters: [ID_PARAM],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
      post: {
        tags: ['Votacoes'],
        summary: 'Registra voto de uma unidade (gestao manual)',
        parameters: [ID_PARAM],
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/polls/{id}/my-vote': {
      get: {
        tags: ['Votacoes'],
        summary: 'Voto da unidade do usuario autenticado',
        parameters: [ID_PARAM],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/polls/{id}/vote-status': {
      get: {
        tags: ['Votacoes'],
        summary: 'Situacao de voto por unidade (sem revelar a opcao)',
        parameters: [ID_PARAM],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/polls/{id}/results': {
      get: {
        tags: ['Votacoes'],
        summary: 'Apuracao da votacao',
        parameters: [ID_PARAM],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/announcements/{id}/publish': action('Comunicados', 'Publica o comunicado', false),
    '/incidents/{id}/status': action('Ocorrencias', 'Altera o status da ocorrencia'),
    '/incidents/{id}/assign': action('Ocorrencias', 'Atribui a ocorrencia a um responsavel'),
    '/maintenances/{id}/complete': action('Manutencoes', 'Conclui e reprograma a recorrencia'),
    '/documents': {
      get: {
        tags: ['Documentos'],
        summary: 'Lista documentos',
        parameters: PAGINATION_PARAMS,
        responses: { 200: { $ref: '#/components/responses/PaginatedList' }, ...ERROR_RESPONSES },
      },
      post: {
        tags: ['Documentos'],
        summary: 'Faz upload de um documento',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'condominiumId', 'title'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  condominiumId: { type: 'string', format: 'uuid' },
                  title: { type: 'string' },
                  category: { type: 'string' },
                  visibility: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/documents/{id}/download': {
      get: {
        tags: ['Documentos'],
        summary: 'Baixa o arquivo do documento',
        parameters: [ID_PARAM],
        responses: {
          200: { description: 'Arquivo binario.', content: { 'application/octet-stream': {} } },
          ...ERROR_RESPONSES,
        },
      },
    },
    '/dashboard/overview': {
      get: {
        tags: ['Dashboard'],
        summary: 'Indicadores executivos do condominio',
        parameters: [
          { name: 'condominiumId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'referenceMonth', in: 'query', schema: { type: 'string', example: '2026-09' } },
        ],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/dashboard/financial-series': {
      get: {
        tags: ['Dashboard'],
        summary: 'Serie mensal de faturamento e recebimento',
        parameters: [
          { name: 'condominiumId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'months', in: 'query', schema: { type: 'integer', default: 6 } },
        ],
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notificacoes'],
        summary: 'Central de notificacoes do usuario',
        parameters: PAGINATION_PARAMS,
        responses: { 200: { $ref: '#/components/responses/PaginatedList' }, ...ERROR_RESPONSES },
      },
    },
    '/notifications/read': {
      post: {
        tags: ['Notificacoes'],
        summary: 'Marca notificacoes como lidas',
        requestBody: { $ref: '#/components/requestBodies/GenericPayload' },
        responses: { 200: { $ref: '#/components/responses/Entity' }, ...ERROR_RESPONSES },
      },
    },
    '/audit-logs': {
      get: {
        tags: ['Auditoria'],
        summary: 'Trilha de auditoria do tenant',
        parameters: PAGINATION_PARAMS,
        responses: { 200: { $ref: '#/components/responses/PaginatedList' }, ...ERROR_RESPONSES },
      },
    },
  };
}

function errorResponse(description: string) {
  return {
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
  };
}

export function buildOpenApiDocument(): OpenApiObject {
  return {
    openapi: '3.0.3',
    info: {
      title: `${env.APP_NAME} API`,
      version: '1.0.0',
      description: [
        'API REST multi-tenant para gestao de condominios.',
        '',
        '**Autenticacao**: `POST /auth/login` devolve `accessToken` (15 min) e `refreshToken` (7 dias).',
        'Envie o access token no header `Authorization: Bearer <token>`.',
        '',
        '**Multi-tenancy**: todo registro pertence a um tenant; o escopo e derivado do token,',
        'nunca de parametros da requisicao.',
        '',
        '**Autorizacao**: cada endpoint exige uma permissao `<recurso>:<acao>` do papel do usuario.',
      ].join('\n'),
      contact: { name: 'Suporte', email: 'suporte@condominio.app' },
      license: { name: 'MIT' },
    },
    servers: [{ url: `${env.API_URL}${env.API_PREFIX}`, description: env.NODE_ENV }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Autenticacao' },
      { name: 'Dashboard' },
      { name: 'Condominios' },
      { name: 'Blocos' },
      { name: 'Unidades' },
      { name: 'Moradores' },
      { name: 'Dependentes' },
      { name: 'Funcionarios' },
      { name: 'Prestadores' },
      { name: 'Visitantes' },
      { name: 'Veiculos' },
      { name: 'Correspondencias' },
      { name: 'Areas comuns' },
      { name: 'Reservas' },
      { name: 'Financeiro' },
      { name: 'Assembleias' },
      { name: 'Votacoes' },
      { name: 'Comunicados' },
      { name: 'Ocorrencias' },
      { name: 'Manutencoes' },
      { name: 'Documentos' },
      { name: 'Usuarios' },
      { name: 'Papeis & Permissoes' },
      { name: 'Notificacoes' },
      { name: 'Auditoria' },
      { name: 'Infra' },
    ],
    paths: { ...customPaths(), ...crudPaths() },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
                requestId: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            perPage: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 137 },
            totalPages: { type: 'integer', example: 7 },
            hasNext: { type: 'boolean' },
            hasPrevious: { type: 'boolean' },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'integer', example: 900 },
            tokenType: { type: 'string', example: 'Bearer' },
          },
        },
      },
      requestBodies: {
        GenericPayload: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
      responses: {
        Entity: {
          description: 'Operacao realizada com sucesso.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { success: { type: 'boolean' }, data: { type: 'object' } },
              },
            },
          },
        },
        PaginatedList: {
          description: 'Lista paginada.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'array', items: { type: 'object' } },
                  meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
              },
            },
          },
        },
        LoginResponse: {
          description: 'Usuario autenticado.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'object',
                    properties: {
                      user: { type: 'object' },
                      tokens: { $ref: '#/components/schemas/AuthTokens' },
                    },
                  },
                },
              },
            },
          },
        },
        BadRequest: errorResponse('Requisicao invalida.'),
        Unauthorized: errorResponse('Token ausente, invalido ou expirado.'),
        Forbidden: errorResponse('Sem permissao para o recurso.'),
        NotFound: errorResponse('Recurso nao encontrado.'),
        Conflict: errorResponse('Conflito com o estado atual do recurso.'),
        ValidationError: errorResponse('Falha de validacao dos dados enviados.'),
      },
    },
  };
}

export const openApiDocument = buildOpenApiDocument();

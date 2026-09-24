import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

export const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

/**
 * Access e refresh em **memoria de modulo**, nunca em `localStorage`.
 *
 * O refresh ja e emitido pelo backend em cookie `HttpOnly; SameSite` — o
 * storage local so existia para o JS reenviar o corpo, e e exatamente o que um
 * XSS aproveitava. Apos reload a memoria zera; o boot chama
 * `trySilentLogin()` (refresh via cookie) para rehidratar o access.
 *
 * `refreshToken` em memoria e so o fallback de clientes que ainda mandam corpo;
 * o caminho normal e o cookie. Sai no `clear()` junto com o access.
 */
let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

/**
 * Marca de "ja houve login neste navegador", sem conteudo sensivel.
 *
 * Depois de reload a memoria zera e o cookie httpOnly nao e legivel do JS, entao
 * sem esta marca o boot nao distinguiria "sessao para restaurar" de "visita
 * anonima" — e chamaria o refresh de todo visitante. Nao e credencial: um XSS
 * que leia a marca so descobre que vale tentar o cookie, que ele proprio ja
 * manda no refresh.
 */
const SESSION_HINT_KEY = 'condomínio.session';

function markSession(): void {
  try {
    localStorage.setItem(SESSION_HINT_KEY, '1');
  } catch {
    // Armazenamento indisponivel: o cookie ainda restaura a sessao no boot.
  }
}

function clearSessionHint(): void {
  try {
    localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Irrelevante: sem storage, a marca nunca existiu.
  }
}

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export type ApiEnvelope<T> = {
  success: true;
  data: T;
  meta?: PaginationMeta;
};

export type PaginationMeta = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: Array<{ field?: string; message: string }>;
  requestId?: string;
};

/** Erro normalizado consumido pela UI (toasts, formularios). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: ApiErrorPayload['details'],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Mapeia os erros de validacao do backend para os campos do formulario. */
  get fieldErrors(): Record<string, string> {
    return (this.details ?? []).reduce<Record<string, string>>((acc, detail) => {
      if (detail.field) acc[detail.field] = detail.message;
      return acc;
    }, {});
  }
}

export const tokenStorage = {
  get accessToken(): string | null {
    return memoryAccessToken;
  },
  get refreshToken(): string | null {
    return memoryRefreshToken;
  },
  set(accessToken: string, refreshToken: string): void {
    memoryAccessToken = accessToken;
    memoryRefreshToken = refreshToken;
    markSession();
  },
  clear(): void {
    memoryAccessToken = null;
    memoryRefreshToken = null;
    clearSessionHint();
  },
};

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

/**
 * Renova o access token uma unica vez por rajada de 401: requisicoes
 * concorrentes compartilham a mesma promessa e sao reexecutadas depois.
 *
 * O corpo vai sem `refreshToken` de proposito: o backend ja aceita o cookie
 * httpOnly (`withCredentials`) e e ele a fonte de verdade. O valor em memoria,
 * quando existe, e so compatibilidade com clientes nativos.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<ApiEnvelope<{ tokens: { accessToken: string; refreshToken: string } }>>(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((response) => {
        const { accessToken, refreshToken } = response.data.data.tokens;
        tokenStorage.set(accessToken, refreshToken);
        return accessToken;
      })
      .catch(() => {
        tokenStorage.clear();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * Boot de sessao apos reload: a memoria zera, o cookie httpOnly continua.
 * Devolve o access novo, ou `null` quando nao ha sessao para restaurar.
 *
 * Sem marca de sessao nao tenta nada — evita um 401 de refresh em todo visitante
 * anonimo que abre o app.
 */
export async function trySilentLogin(): Promise<string | null> {
  if (memoryAccessToken) return memoryAccessToken;
  if (!hasSessionHint()) return null;
  return refreshAccessToken();
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: ApiErrorPayload }>) => {
    const status = error.response?.status ?? 0;
    const original = error.config as RetriableConfig | undefined;
    const isAuthRoute =
      original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      const token = await refreshAccessToken();

      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api.request(original);
      }

      // Sessao perdida: o AuthProvider reage ao evento e redireciona para o login.
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }

    const payload = error.response?.data?.error;
    throw new ApiError(
      payload?.message ?? error.message ?? 'Não foi possível concluir a operação.',
      status,
      payload?.code ?? 'NETWORK_ERROR',
      payload?.details,
    );
  },
);

// ---------------------------------------------------------------------------
// Helpers tipados
// ---------------------------------------------------------------------------

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.get<ApiEnvelope<T>>(url, config);
  return response.data.data;
}

export async function apiGetPaginated<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<Paginated<T>> {
  const response = await api.get<ApiEnvelope<T[]>>(url, config);
  return {
    data: response.data.data,
    meta: response.data.meta ?? {
      page: 1,
      perPage: response.data.data.length,
      total: response.data.data.length,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  };
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.post<ApiEnvelope<T>>(url, body, config);
  return response.data?.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.patch<ApiEnvelope<T>>(url, body);
  return response.data.data;
}

export async function apiDelete(url: string): Promise<void> {
  await api.delete(url);
}

import Config from 'react-native-config';
import { getAccessToken } from './authTokenStorage';

type Primitive = string | number | boolean | null | undefined;

/** Normalized ASP.NET / FluentValidation `errors` keys (e.g. email, password). */
export type FieldErrors = Record<string, string>;

function normalizePropertyKey(key: string): string {
  if (!key) return key;
  return key.charAt(0).toLowerCase() + key.slice(1);
}

export function parseFieldErrorsFromPayload(payload: unknown): FieldErrors {
  const out: FieldErrors = {};
  if (!payload || typeof payload !== 'object') return out;
  const p = payload as Record<string, unknown>;
  const raw = p.errors ?? p.Errors;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, val] of Object.entries(raw)) {
    const nk = normalizePropertyKey(key);
    if (Array.isArray(val)) {
      const msg = val.map((x) => String(x)).filter(Boolean).join(' ');
      if (msg) out[nk] = msg;
    } else if (typeof val === 'string' && val.trim()) {
      out[nk] = val.trim();
    }
  }
  return out;
}

function formatApiErrorMessage(payload: unknown, fallback: string): string {
  const fieldErrors = parseFieldErrorsFromPayload(payload);
  const lines = Object.entries(fieldErrors).map(([k, v]) => {
    const label = k.charAt(0).toUpperCase() + k.slice(1);
    return `${label}: ${v}`;
  });
  if (lines.length > 0) return lines.join('\n');

  if (!payload || typeof payload !== 'object') {
    return fallback;
  }
  const p = payload as Record<string, unknown>;
  const detail = (p.detail ?? p.Detail) as string | undefined;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  const title = (p.title ?? p.Title) as string | undefined;
  if (typeof title === 'string' && title.trim()) return title.trim();
  const message = p.message as string | undefined;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return fallback;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  /** Populated for ASP.NET 400 validation responses (`errors` object). */
  fieldErrors: FieldErrors;

  constructor(
    message: string,
    status: number,
    details?: unknown,
    code?: string,
    fieldErrors?: FieldErrors
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code = code;
    this.fieldErrors = fieldErrors ?? {};
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  requiresAuth?: boolean;
  isFormData?: boolean;
  headers?: Record<string, string>;
};

function getApiBaseUrl(): string {
  const url =
    Config.BACKEND_API_URL ||
    Config.DOTNET_API_URL ||
    Config.API_BASE_URL ||
    Config.BACKEND_URL ||
    '';

  return url.replace(/\/+$/, '');
}

function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function toSnakeCaseKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function mapObjectKeysDeep<T>(
  value: T,
  keyMapper: (key: string) => string
): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => mapObjectKeysDeep(item, keyMapper)) as T;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  const output: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, nestedValue]) => {
    output[keyMapper(key)] = mapObjectKeysDeep(nestedValue, keyMapper);
  });
  return output as T;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    token,
    requiresAuth = true,
    isFormData = false,
    headers = {},
  } = options;

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError(
      'Backend API URL is missing. Set BACKEND_API_URL or DOTNET_API_URL in environment.',
      0
    );
  }

  const authToken = token ?? (requiresAuth ? await getAccessToken() : null);

  const requestHeaders: Record<string, string> = { ...headers };
  if (!isFormData) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  if (authToken) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
  }

  const payload =
    body === undefined
      ? undefined
      : isFormData
      ? (body as any)
      : JSON.stringify(mapObjectKeysDeep(body, toCamelCaseKey));

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: payload,
  });

  const isNoContent = response.status === 204;
  if (isNoContent) {
    return null as T;
  }

  let parsedPayload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      parsedPayload = JSON.parse(text);
    } catch {
      parsedPayload = text as Primitive;
    }
  }

  if (!response.ok) {
    const fieldErrors = parseFieldErrorsFromPayload(parsedPayload);
    const message = formatApiErrorMessage(parsedPayload, `Request failed (${response.status})`);
    const code =
      parsedPayload && typeof parsedPayload === 'object'
        ? (parsedPayload as Record<string, unknown>).code as string | undefined
        : undefined;
    throw new ApiError(message, response.status, parsedPayload, code, fieldErrors);
  }

  return mapObjectKeysDeep(parsedPayload as T, toSnakeCaseKey);
}

export const apiClient = {
  get: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'DELETE', body }),
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof Error) {
    return new ApiError(error.message, 0, undefined, undefined, {});
  }
  return new ApiError('Unexpected request failure', 0, undefined, undefined, {});
}

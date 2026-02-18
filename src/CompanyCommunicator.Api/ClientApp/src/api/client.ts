import { authentication } from '@microsoft/teams-js';
import type { ApiError } from '@/types';

// Token cache to avoid repeated SSO calls within a short window
let cachedToken: string | null = null;
let tokenExpiry: number = 0;
const TOKEN_BUFFER_MS = 60_000; // Refresh 1 minute before expiry

async function getTeamsToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  try {
    const token = await authentication.getAuthToken();
    // Teams SSO tokens are typically valid for ~1 hour; decode expiry
    // without external jwt libs by parsing the payload portion
    try {
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const payload = JSON.parse(atob(payloadBase64)) as { exp?: number };
        if (payload.exp) {
          tokenExpiry = payload.exp * 1000 - TOKEN_BUFFER_MS;
        } else {
          tokenExpiry = now + 50 * 60 * 1000; // default 50 min
        }
      }
    } catch {
      tokenExpiry = now + 50 * 60 * 1000;
    }
    cachedToken = token;
    return token;
  } catch (err) {
    throw new Error(`Teams SSO failed: ${String(err)}`);
  }
}

export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiry = 0;
}

export class ApiResponseError extends Error {
  public readonly status: number;
  public readonly detail: string | undefined;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = 'ApiResponseError';
    this.status = apiError.status;
    this.detail = apiError.detail;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, signal, headers: extraHeaders = {} } = options;

  const token = await getTeamsToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    let detail: string | undefined;

    try {
      const errorJson = (await response.json()) as {
        message?: string;
        title?: string;
        detail?: string;
        errors?: Record<string, string[]>;
      };
      message = errorJson.message ?? errorJson.title ?? message;
      detail = errorJson.detail;
      if (errorJson.errors) {
        const fieldErrors = Object.entries(errorJson.errors)
          .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
          .join('; ');
        detail = fieldErrors;
      }
    } catch {
      // ignore JSON parse error; use status text
    }

    throw new ApiResponseError({ status: response.status, message, detail });
  }

  // 204 No Content or similar
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

async function requestWithHeaders<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; headers: Headers }> {
  const { method = 'GET', body, signal, headers: extraHeaders = {} } = options;

  const token = await getTeamsToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    let detail: string | undefined;

    try {
      const errorJson = (await response.json()) as {
        message?: string;
        title?: string;
        detail?: string;
      };
      message = errorJson.message ?? errorJson.title ?? message;
      detail = errorJson.detail;
    } catch {
      // ignore
    }

    throw new ApiResponseError({ status: response.status, message, detail });
  }

  const data = (await response.json()) as T;
  return { data, headers: response.headers };
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', signal }),

  getWithHeaders: <T>(path: string, signal?: AbortSignal) =>
    requestWithHeaders<T>(path, { method: 'GET', signal }),

  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body, signal }),

  put: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PUT', body, signal }),

  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PATCH', body, signal }),

  delete: <T = void>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'DELETE', signal }),
};

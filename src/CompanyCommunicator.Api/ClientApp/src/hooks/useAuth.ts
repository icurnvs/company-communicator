import { useState, useCallback, useRef } from 'react';
import { authentication } from '@microsoft/teams-js';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  getToken: () => Promise<string>;
  clearToken: () => void;
}

// In-memory token cache shared across hook instances
let sharedToken: string | null = null;
let sharedExpiry: number = 0;
const TOKEN_BUFFER_MS = 60_000;

function parseTokenExpiry(token: string): number {
  try {
    const payload = token.split('.')[1];
    if (!payload) return Date.now() + 50 * 60_000;
    const decoded = JSON.parse(atob(payload)) as { exp?: number };
    if (decoded.exp) {
      return decoded.exp * 1000 - TOKEN_BUFFER_MS;
    }
  } catch {
    // ignore
  }
  return Date.now() + 50 * 60_000;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: sharedToken !== null && Date.now() < sharedExpiry,
    isLoading: false,
    error: null,
  });

  // Track in-flight request to avoid duplicate calls
  const pendingRequest = useRef<Promise<string> | null>(null);

  const getToken = useCallback(async (): Promise<string> => {
    // Return cached token if still valid
    if (sharedToken && Date.now() < sharedExpiry) {
      return sharedToken;
    }

    // Deduplicate concurrent token requests
    if (pendingRequest.current) {
      return pendingRequest.current;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const request = authentication
      .getAuthToken()
      .then((token) => {
        sharedToken = token;
        sharedExpiry = parseTokenExpiry(token);
        setState({
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        pendingRequest.current = null;
        return token;
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        sharedToken = null;
        sharedExpiry = 0;
        setState({
          isAuthenticated: false,
          isLoading: false,
          error: `Authentication failed: ${message}`,
        });
        pendingRequest.current = null;
        throw new Error(`Teams SSO failed: ${message}`);
      });

    pendingRequest.current = request;
    return request;
  }, []);

  const clearToken = useCallback(() => {
    sharedToken = null;
    sharedExpiry = 0;
    setState({
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    getToken,
    clearToken,
  };
}

'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, ApiError } from './api';
import type { AuthUser } from './types';

const TOKEN_KEY = 'bazar.token';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  /** fetch autenticado; em 401 encerra a sessão */
  request: <T>(path: string, init?: RequestInit & { idempotencyKey?: string }) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignora */
    }
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const saved = readToken();
    if (!saved) {
      setLoading(false);
      return;
    }
    apiFetch<AuthUser>('/api/auth/me', { token: saved })
      .then((u) => {
        setToken(saved);
        setUser(u);
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback((t: string, u: AuthUser) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* ignora */
    }
    setToken(t);
    setUser(u);
  }, []);

  const request = useCallback(
    async <T,>(path: string, init: RequestInit & { idempotencyKey?: string } = {}) => {
      try {
        return await apiFetch<T>(path, { ...init, token });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) logout();
        throw err;
      }
    },
    [token, logout],
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, request }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}

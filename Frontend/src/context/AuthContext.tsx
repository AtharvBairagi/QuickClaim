import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { User } from '../types';
import * as authApi from '../api/auth';
import { ApiError } from '../api/client';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  initialError: string | null;
  login: (credentials: authApi.LoginInput) => Promise<void>;
  register: (data: authApi.RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  retryInitialLoad: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    setInitialError(null);
    try {
      const res = await authApi.getMe();
      setUser(res.user);
      setIsAuthenticated(true);
      setInitialError(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        // Expected unauthenticated state — no cookie or expired session
        setUser(null);
        setIsAuthenticated(false);
        setInitialError(null);
      } else {
        // Network error, server offline, or HTTP 500
        setInitialError(err?.message || 'Failed to communicate with backend server.');
        // Do not assume user is definitely unauthenticated on server crash / network drop
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (credentials: authApi.LoginInput) => {
    const res = await authApi.login(credentials);
    setUser(res.user);
    setIsAuthenticated(true);
    setInitialError(null);
  };

  const register = async (data: authApi.RegisterInput) => {
    await authApi.register(data);
    // After registration, log in to set the HttpOnly authentication cookie
    const loginRes = await authApi.login({ email: data.email, password: data.password });
    setUser(loginRes.user);
    setIsAuthenticated(true);
    setInitialError(null);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear client state regardless of server logout response
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      setUser(res.user);
      setIsAuthenticated(true);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setIsAuthenticated(false);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        initialError,
        login,
        register,
        logout,
        refreshUser,
        retryInitialLoad: checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

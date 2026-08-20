import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth as authStorage } from '../lib/auth';
import api from '../lib/api';
import { User, AuthTokens } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check stored auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const storedUser = await authStorage.getUser();
      const token = await authStorage.getAccessToken();

      if (storedUser && token) {
        setUser(storedUser);
        // Verify token is still valid
        try {
          const response = await api.get('/auth/me');
          setUser(response.data);
          await authStorage.setUser(response.data);
        } catch {
          // Token expired, try refresh
          const refreshToken = await authStorage.getRefreshToken();
          if (refreshToken) {
            try {
              const response = await api.post('/auth/refresh', {
                refresh_token: refreshToken,
              });
              await authStorage.setTokens(
                response.data.access_token,
                response.data.refresh_token
              );
              await authStorage.setUser(response.data.user);
              setUser(response.data.user);
            } catch {
              await authStorage.clearAll();
              setUser(null);
            }
          } else {
            await authStorage.clearAll();
            setUser(null);
          }
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const data: AuthTokens = response.data;

    await authStorage.setTokens(data.access_token, data.refresh_token);
    await authStorage.setUser(data.user);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await authStorage.clearAll();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
      await authStorage.setUser(response.data);
    } catch (error) {
      console.error('Refresh user failed:', error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

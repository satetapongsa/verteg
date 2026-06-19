import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

interface User {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  twoFactorEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, code?: string) => Promise<{ twoFactorRequired?: boolean; token?: string }>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setup2FA: () => Promise<{ secret: string; qrCodeUrl: string }>;
  verify2FA: (code: string) => Promise<void>;
  disable2FA: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser) {
        try {
          // Verify token by querying balances as a heartbeat check
          await api.get('/wallet/balances');
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        } catch (err: any) {
          // Only log out if it is an explicit auth error (401 or 403). Ignore temporary network/server reboots.
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            logout();
          } else {
            // Keep user session during temporary drops
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          }
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string, code?: string) => {
    const res = await api.post('/auth/login', { email, password, code });
    if (res.data.twoFactorRequired) {
      return { twoFactorRequired: true };
    }
    const { token, user: loggedUser } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(loggedUser));
    setToken(token);
    setUser(loggedUser);
    return { token };
  };

  const register = async (email: string, password: string) => {
    await api.post('/auth/register', { email, password });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const setup2FA = async () => {
    const res = await api.post('/auth/2fa/setup');
    return res.data;
  };

  const verify2FA = async (code: string) => {
    await api.post('/auth/2fa/verify', { code });
    if (user) {
      const updatedUser = { ...user, twoFactorEnabled: true };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  const disable2FA = async (code: string) => {
    await api.post('/auth/2fa/disable', { code });
    if (user) {
      const updatedUser = { ...user, twoFactorEnabled: false };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, setup2FA, verify2FA, disable2FA }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
};

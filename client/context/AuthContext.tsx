import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, User as DbUser } from '../utils/db';

export interface User {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  is2faEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, code?: string) => Promise<{ twoFactorRequired?: boolean; message?: string }>;
  registerUser: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('accessToken');
      if (storedUser && storedToken) {
        const parsed = JSON.parse(storedUser);
        // Fetch fresh copy from database to see frozen or updated settings
        const users = db.getUsers();
        const fresh = users.find((u) => u.id === parsed.id);
        if (fresh) {
          if (fresh.isFrozen) {
            // Log out frozen user immediately
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            setUser(null);
            setToken(null);
            alert('Your account has been frozen by administration.');
          } else {
            const dataToSet = {
              id: fresh.id,
              email: fresh.email,
              role: fresh.role,
              is2faEnabled: fresh.is2faEnabled,
            };
            setUser(dataToSet);
            setToken(storedToken);
            localStorage.setItem('user', JSON.stringify(dataToSet));
          }
        } else {
          setUser(parsed);
          setToken(storedToken);
        }
      }
    } catch (err) {
      console.error('Failed to parse stored session user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    const handleSessionExpiry = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth_session_expired', handleSessionExpiry);
    return () => {
      window.removeEventListener('auth_session_expired', handleSessionExpiry);
    };
  }, []);

  const login = async (email: string, password: string, code?: string) => {
    const users = db.getUsers();
    const targetUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!targetUser || targetUser.passwordHash !== password) {
      throw new Error('Invalid email or password');
    }

    if (targetUser.isFrozen) {
      throw new Error('This account has been frozen by administration');
    }

    if (targetUser.is2faEnabled && !code) {
      return { twoFactorRequired: true, message: '2FA authentication required' };
    }

    if (targetUser.is2faEnabled && code && code !== '123456' && code !== targetUser.twoFactorSecret) {
      // Mock validation accepts "123456" or the secret key as valid
      throw new Error('Invalid 2FA code. Use mock code 123456');
    }

    const userData: User = {
      id: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      is2faEnabled: targetUser.is2faEnabled,
    };

    const mockToken = `mock-token-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('accessToken', mockToken);
    localStorage.setItem('user', JSON.stringify(userData));

    db.logAudit(targetUser.id, 'USER_LOGIN', `User logged in from simulated browser`);

    setUser(userData);
    setToken(mockToken);
    return {};
  };

  const registerUser = async (email: string, password: string) => {
    const users = db.getUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Email already exists');
    }

    const newUser: DbUser = {
      id: `u-${Math.random().toString(36).substring(2, 12)}`,
      email,
      passwordHash: password,
      role: 'USER',
      is2faEnabled: false,
      isFrozen: false,
      createdAt: new Date().toISOString(),
    };

    // Add user to database
    users.push(newUser);
    db.saveUsers(users);

    // Seed empty kyc entry
    const kycList = db.getKyc();
    kycList.push({
      id: `k-${Math.random().toString(36).substring(2, 12)}`,
      userId: newUser.id,
      firstName: '',
      lastName: '',
      documentId: '',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });
    db.saveKyc(kycList);

    // Create wallets with seeded trading funds
    const wallets = db.getWallets();
    const assets = db.getAssets();
    assets.forEach((asset) => {
      let initialBalance = 0;
      if (asset.symbol === 'USDT') initialBalance = 10000.0;
      else if (asset.symbol === 'BTC') initialBalance = 0.5;
      else if (asset.symbol === 'ETH') initialBalance = 5.0;
      else initialBalance = 100.0;

      wallets.push({
        id: `w-${newUser.id}-${asset.symbol}`,
        userId: newUser.id,
        assetId: asset.id,
        address: `0x${newUser.id.substring(0, 4)}${asset.symbol.toLowerCase()}${Math.random().toString(36).substring(2, 12)}`,
        balance: initialBalance,
        locked: 0,
      });
    });
    db.saveWallets(wallets);

    const userData: User = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      is2faEnabled: newUser.is2faEnabled,
    };

    const mockToken = `mock-token-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('accessToken', mockToken);
    localStorage.setItem('user', JSON.stringify(userData));

    db.logAudit(newUser.id, 'USER_REGISTER', `User created new account and wallets`);

    setUser(userData);
    setToken(mockToken);
  };

  const loginWithGoogle = async (email: string) => {
    const users = db.getUsers();
    let targetUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (targetUser) {
      if (targetUser.isFrozen) {
        throw new Error('This account has been frozen by administration');
      }
    } else {
      // Create new user for this Google account
      targetUser = {
        id: `u-${Math.random().toString(36).substring(2, 12)}`,
        email: email.toLowerCase(),
        passwordHash: 'google-oauth',
        role: 'USER',
        is2faEnabled: false,
        isFrozen: false,
        createdAt: new Date().toISOString(),
      };

      users.push(targetUser);
      db.saveUsers(users);

      // Seed empty kyc entry
      const kycList = db.getKyc();
      kycList.push({
        id: `k-${Math.random().toString(36).substring(2, 12)}`,
        userId: targetUser.id,
        firstName: '',
        lastName: '',
        documentId: '',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });
      db.saveKyc(kycList);

      // Create wallets with seeded trading funds
      const wallets = db.getWallets();
      const assets = db.getAssets();
      assets.forEach((asset) => {
        let initialBalance = 0;
        if (asset.symbol === 'USDT') initialBalance = 10000.0;
        else if (asset.symbol === 'BTC') initialBalance = 0.5;
        else if (asset.symbol === 'ETH') initialBalance = 5.0;
        else initialBalance = 100.0;

        wallets.push({
          id: `w-${targetUser!.id}-${asset.symbol}`,
          userId: targetUser!.id,
          assetId: asset.id,
          address: `0x${targetUser!.id.substring(0, 4)}${asset.symbol.toLowerCase()}${Math.random().toString(36).substring(2, 12)}`,
          balance: initialBalance,
          locked: 0,
        });
      });
      db.saveWallets(wallets);
    }

    const userData: User = {
      id: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      is2faEnabled: targetUser.is2faEnabled,
    };

    const mockToken = `google-token-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('accessToken', mockToken);
    localStorage.setItem('user', JSON.stringify(userData));

    db.logAudit(targetUser.id, 'USER_GOOGLE_LOGIN', `User logged in using Google account verification`);

    setUser(userData);
    setToken(mockToken);
  };

  const logout = async () => {
    if (user) {
      db.logAudit(user.id, 'USER_LOGOUT', `User logged out`);
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, registerUser, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// LocalStorage database simulator for the static Crypto Exchange SPA

export interface User {
  id: string;
  email: string;
  passwordHash: string; // we will store simple mock hashes or plain text
  role: 'USER' | 'ADMIN';
  is2faEnabled: boolean;
  twoFactorSecret?: string;
  isFrozen: boolean;
  createdAt: string;
}

export interface Kyc {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  documentId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  network: string;
  withdrawFee: number;
  minWithdraw: number;
  isActive: boolean;
}

export interface Wallet {
  id: string;
  userId: string;
  assetId: string;
  address: string;
  balance: number;
  locked: number;
}

export interface Order {
  id: string;
  userId: string;
  symbol: string; // e.g. "BTC/USDT"
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP';
  price?: number;
  stopPrice?: number;
  amount: number;
  filledAmount: number;
  status: 'PENDING' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  createdAt: string;
}

export interface Trade {
  id: string;
  symbol: string;
  price: number;
  amount: number;
  makerId: string;
  takerId: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  ipAddress?: string;
  details?: string;
  createdAt: string;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper to get or set localStorage data
function getTable<T>(tableName: string, defaultData: T[]): T[] {
  const data = localStorage.getItem(`db_${tableName}`);
  if (!data) {
    localStorage.setItem(`db_${tableName}`, JSON.stringify(defaultData));
    return defaultData;
  }
  return JSON.parse(data);
}

function saveTable<T>(tableName: string, data: T[]) {
  localStorage.setItem(`db_${tableName}`, JSON.stringify(data));
}

// Initial seed assets
const initialAssets: Asset[] = [
  { id: '1', symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', withdrawFee: 0.0005, minWithdraw: 0.001, isActive: true },
  { id: '2', symbol: 'ETH', name: 'Ethereum', network: 'Ethereum (ERC20)', withdrawFee: 0.005, minWithdraw: 0.01, isActive: true },
  { id: '3', symbol: 'USDT', name: 'Tether', network: 'Ethereum (ERC20)', withdrawFee: 1.0, minWithdraw: 5.0, isActive: true },
  { id: '4', symbol: 'BNB', name: 'Binance Coin', network: 'BNB Smart Chain (BEP20)', withdrawFee: 0.001, minWithdraw: 0.005, isActive: true },
  { id: '5', symbol: 'SOL', name: 'Solana', network: 'Solana', withdrawFee: 0.01, minWithdraw: 0.1, isActive: true },
  { id: '6', symbol: 'XRP', name: 'Ripple', network: 'Ripple', withdrawFee: 0.25, minWithdraw: 1.0, isActive: true },
  { id: '7', symbol: 'DOGE', name: 'Dogecoin', network: 'Dogecoin', withdrawFee: 2.0, minWithdraw: 5.0, isActive: true },
  { id: '8', symbol: 'ADA', name: 'Cardano', network: 'Cardano', withdrawFee: 1.0, minWithdraw: 2.0, isActive: true },
  { id: '9', symbol: 'TRX', name: 'Tron', network: 'Tron (TRC20)', withdrawFee: 1.0, minWithdraw: 5.0, isActive: true },
  { id: '10', symbol: 'MATIC', name: 'Polygon', network: 'Polygon', withdrawFee: 0.1, minWithdraw: 1.0, isActive: true },
];

// Seed initial users
const initialUsers: User[] = [
  {
    id: 'u-admin-1',
    email: 'admin@exchange.com',
    passwordHash: 'AdminSecurePass123!',
    role: 'ADMIN',
    is2faEnabled: false,
    isFrozen: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u-admin-2',
    email: 'admin@gmail.com',
    passwordHash: 'admin',
    role: 'ADMIN',
    is2faEnabled: false,
    isFrozen: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u-user-1',
    email: 'user@exchange.com',
    passwordHash: 'UserSecurePass123!',
    role: 'USER',
    is2faEnabled: false,
    isFrozen: false,
    createdAt: new Date().toISOString(),
  },
];

const initialKyc: Kyc[] = [
  {
    id: 'k-admin-1',
    userId: 'u-admin-1',
    firstName: 'System',
    lastName: 'Admin',
    documentId: 'ADM-001',
    status: 'APPROVED',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'k-admin-2',
    userId: 'u-admin-2',
    firstName: 'Alt',
    lastName: 'Admin',
    documentId: 'ADM-002',
    status: 'APPROVED',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'k-user-1',
    userId: 'u-user-1',
    firstName: 'John',
    lastName: 'Doe',
    documentId: 'US-998822',
    status: 'APPROVED',
    createdAt: new Date().toISOString(),
  },
];

// Seed initial wallets with balances
const initialWallets: Wallet[] = [];
initialUsers.forEach((user) => {
  initialAssets.forEach((asset) => {
    let initialBalance = 0;
    if (user.role === 'USER') {
      if (asset.symbol === 'USDT') initialBalance = 10000.0;
      else if (asset.symbol === 'BTC') initialBalance = 0.5;
      else if (asset.symbol === 'ETH') initialBalance = 5.0;
      else initialBalance = 100.0;
    } else {
      initialBalance = 1000000.0;
    }

    initialWallets.push({
      id: `w-${user.id}-${asset.symbol}`,
      userId: user.id,
      assetId: asset.id,
      address: `0x${user.id.substring(0, 4)}${asset.symbol.toLowerCase()}${Math.random().toString(36).substring(2, 12)}`,
      balance: initialBalance,
      locked: 0,
    });
  });
});

export interface Deposit {
  id: string;
  walletId: string;
  txHash: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  walletId: string;
  userId: string;
  toAddress: string;
  amount: number;
  fee: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
  txHash?: string;
  createdAt: string;
  updatedAt: string;
}

export const db = {
  getUsers: () => getTable<User>('users', initialUsers),
  saveUsers: (users: User[]) => saveTable<User>('users', users),

  getKyc: () => getTable<Kyc>('kyc', initialKyc),
  saveKyc: (kyc: Kyc[]) => saveTable<Kyc>('kyc', kyc),

  getAssets: () => getTable<Asset>('assets', initialAssets),
  saveAssets: (assets: Asset[]) => saveTable<Asset>('assets', assets),

  getWallets: () => getTable<Wallet>('wallets', initialWallets),
  saveWallets: (wallets: Wallet[]) => saveTable<Wallet>('wallets', wallets),

  getOrders: () => getTable<Order>('orders', []),
  saveOrders: (orders: Order[]) => saveTable<Order>('orders', orders),

  getTrades: () => getTable<Trade>('trades', []),
  saveTrades: (trades: Trade[]) => saveTable<Trade>('trades', trades),

  getNotifications: () => getTable<Notification>('notifications', []),
  saveNotifications: (notifications: Notification[]) => saveTable<Notification>('notifications', notifications),

  getAuditLogs: () => getTable<AuditLog>('audit_logs', []),
  saveAuditLogs: (logs: AuditLog[]) => saveTable<AuditLog>('audit_logs', logs),

  getDeposits: () => getTable<Deposit>('deposits', []),
  saveDeposits: (deposits: Deposit[]) => saveTable<Deposit>('deposits', deposits),

  getWithdrawals: () => getTable<Withdrawal>('withdrawals', []),
  saveWithdrawals: (withdrawals: Withdrawal[]) => saveTable<Withdrawal>('withdrawals', withdrawals),

  // DB Transaction helper simulation for security
  logAudit: (userId: string, action: string, details?: string) => {
    const logs = db.getAuditLogs();
    logs.unshift({
      id: generateId(),
      userId,
      action,
      details,
      ipAddress: '127.0.0.1 (Local Client)',
      createdAt: new Date().toISOString(),
    });
    db.saveAuditLogs(logs);
  },

  notify: (userId: string, title: string, message: string) => {
    const list = db.getNotifications();
    list.unshift({
      id: generateId(),
      userId,
      title,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    db.saveNotifications(list);
  }
};

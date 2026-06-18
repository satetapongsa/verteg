import { db, Wallet, Asset, Order, Trade, User } from './db';
import { matchingEngine } from './matchingEngine';

const mockResponse = (data: any, status = 200) => {
  return Promise.resolve({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {},
  });
};

const getUserIdFromSession = (): string => {
  const storedUser = localStorage.getItem('user');
  if (!storedUser) throw new Error('Unauthorized');
  const user = JSON.parse(storedUser);
  return user.id;
};

// Custom Mock API object to intercept all HTTP requests in the SPA
const mockApi = {
  get: async (url: string, config?: any): Promise<any> => {
    console.log(`[Mock API GET] -> ${url}`);
    try {
      const userId = getUserIdFromSession();

      // 1. Wallet Balances
      if (url.startsWith('/wallet/balances')) {
        const wallets = db.getWallets().filter((w) => w.userId === userId);
        const assets = db.getAssets();
        const data = wallets.map((w) => {
          const asset = assets.find((a) => a.id === w.assetId)!;
          return {
            id: w.id,
            asset: {
              id: asset.id,
              symbol: asset.symbol,
              name: asset.name,
              network: asset.network,
              withdrawFee: asset.withdrawFee,
              minWithdraw: asset.minWithdraw,
            },
            address: w.address,
            balance: w.balance,
            locked: w.locked,
          };
        });
        return mockResponse({ wallets: data });
      }

      // 2. Wallet History (Deposits & Withdrawals)
      if (url.startsWith('/wallet/history')) {
        const wallets = db.getWallets().filter((w) => w.userId === userId);
        const walletIds = wallets.map((w) => w.id);
        const assets = db.getAssets();

        const deposits = db.getDeposits()
          .filter((d) => walletIds.includes(d.walletId))
          .map((d) => {
            const wallet = wallets.find((w) => w.id === d.walletId)!;
            const asset = assets.find((a) => a.id === wallet.assetId)!;
            return {
              id: d.id,
              type: 'DEPOSIT',
              amount: d.amount,
              symbol: asset.symbol,
              status: d.status,
              address: wallet.address,
              txHash: d.txHash,
              createdAt: d.createdAt,
            };
          });

        const withdrawals = db.getWithdrawals()
          .filter((w) => w.userId === userId)
          .map((w) => {
            const wallet = wallets.find((wal) => wal.id === w.walletId)!;
            const asset = assets.find((a) => a.id === wallet.assetId)!;
            return {
              id: w.id,
              type: 'WITHDRAWAL',
              amount: w.amount,
              symbol: asset.symbol,
              status: w.status,
              address: w.toAddress,
              txHash: w.txHash,
              createdAt: w.createdAt,
            };
          });

        const combined = [...deposits, ...withdrawals].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return mockResponse({ history: combined });
      }

      // 3. Market Ticker
      if (url.startsWith('/market/ticker/')) {
        const symbol = url.replace('/market/ticker/', '');
        const currentPrice = matchingEngine.getMarketPrice(symbol);
        return mockResponse({
          symbol,
          lastPrice: currentPrice,
          high24h: Number((currentPrice * 1.05).toFixed(2)),
          low24h: Number((currentPrice * 0.95).toFixed(2)),
          volume24h: Number((Math.random() * 500000 + 10000).toFixed(2)),
          priceChangePercent: Number(((Math.random() - 0.4) * 5).toFixed(2)),
        });
      }

      // 4. Market Orderbook
      if (url.startsWith('/market/orderbook/')) {
        const symbol = url.replace('/market/orderbook/', '');
        const book = matchingEngine.getOrderBook(symbol);
        return mockResponse(book);
      }

      // 5. Market Trades History
      if (url.startsWith('/market/trades/')) {
        const symbol = url.replace('/market/trades/', '');
        const trades = db.getTrades()
          .filter((t) => t.symbol === symbol)
          .slice(0, 50)
          .map((t) => ({
            price: t.price,
            amount: t.amount,
            side: Math.random() > 0.5 ? 'BUY' : 'SELL', // mock side
            createdAt: t.createdAt,
          }));
        return mockResponse({ trades: trades });
      }

      // 6. Market Overview (all tickers)
      if (url.startsWith('/market/overview')) {
        const symbols = [
          'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT',
          'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'TRX/USDT', 'MATIC/USDT'
        ];
        const data = symbols.map((symbol) => {
          const currentPrice = matchingEngine.getMarketPrice(symbol);
          const nameMap: Record<string, string> = {
            'BTC/USDT': 'Bitcoin',
            'ETH/USDT': 'Ethereum',
            'BNB/USDT': 'Binance Coin',
            'SOL/USDT': 'Solana',
            'XRP/USDT': 'Ripple',
            'DOGE/USDT': 'Dogecoin',
            'ADA/USDT': 'Cardano',
            'TRX/USDT': 'TRON',
            'MATIC/USDT': 'Polygon',
          };
          return {
            symbol,
            name: nameMap[symbol] || symbol.split('/')[0],
            lastPrice: currentPrice,
            high: Number((currentPrice * 1.05).toFixed(2)),
            low: Number((currentPrice * 0.95).toFixed(2)),
            volume: Number((Math.random() * 500000 + 10000).toFixed(2)),
            priceChangePercent: Number(((Math.random() - 0.4) * 4).toFixed(2)),
          };
        });
        return mockResponse({ markets: data });
      }

      // 7. Open Orders
      if (url.startsWith('/trade/open-orders')) {
        const open = db.getOrders().filter(
          (o) => o.userId === userId && (o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED')
        );
        return mockResponse({ orders: open });
      }

      // 8. User Executed Trades
      if (url.startsWith('/trade/trades')) {
        const trades = db.getTrades().filter(
          (t) => t.makerId.startsWith(userId) || t.takerId.startsWith(userId)
        );
        return mockResponse({ trades: trades });
      }

      // 9. Auth 2FA Setup
      if (url.startsWith('/auth/2fa/setup')) {
        const users = db.getUsers();
        const userIdx = users.findIndex((u) => u.id === userId);
        const secret = Math.random().toString(36).substring(2, 18).toUpperCase();
        if (userIdx !== -1) {
          users[userIdx].twoFactorSecret = secret;
          db.saveUsers(users);
        }
        return mockResponse({
          secret,
          qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=0a0e17&data=otpauth://totp/CryptoExchange:${encodeURIComponent(users[userIdx].email)}?secret=${secret}&issuer=CryptoExchange`,
        });
      }

      // 10. Admin Users List
      if (url.startsWith('/admin/users')) {
        const users = db.getUsers();
        const kycList = db.getKyc();
        const data = users.map((u) => {
          const kyc = kycList.find((k) => k.userId === u.id);
          return {
            id: u.id,
            email: u.email,
            role: u.role,
            isFrozen: u.isFrozen,
            createdAt: u.createdAt,
            kyc: kyc ? {
              firstName: kyc.firstName,
              lastName: kyc.lastName,
              documentId: kyc.documentId,
              status: kyc.status,
            } : null,
          };
        });
        return mockResponse({ users: data });
      }

      // 11. Admin Withdrawals List
      if (url.startsWith('/admin/withdrawals')) {
        const withdrawals = db.getWithdrawals();
        const users = db.getUsers();
        const wallets = db.getWallets();
        const assets = db.getAssets();

        const data = withdrawals.map((w) => {
          const user = users.find((u) => u.id === w.userId)!;
          const wallet = wallets.find((wal) => wal.id === w.walletId)!;
          const asset = assets.find((a) => a.id === wallet.assetId)!;
          return {
            id: w.id,
            amount: w.amount,
            fee: w.fee,
            toAddress: w.toAddress,
            status: w.status,
            txHash: w.txHash,
            createdAt: w.createdAt,
            wallet: {
              asset: {
                symbol: asset.symbol,
              },
              user: {
                email: user.email,
              }
            }
          };
        });
        return mockResponse({ withdrawals: data });
      }

      // 12. Admin Dashboard Stats
      if (url.startsWith('/admin/stats')) {
        const usersCount = db.getUsers().length;
        const ordersCount = db.getOrders().length;
        const trades = db.getTrades();
        const volume = trades.reduce((acc, t) => acc + (t.amount * t.price), 0);
        const withdrawals = db.getWithdrawals();
        const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'PENDING').length;

        return mockResponse({
          stats: {
            totalUsers: usersCount,
            totalOrders: ordersCount,
            totalTrades: trades.length,
            totalVolume: volume,
            pendingWithdrawals: pendingWithdrawalsCount,
          }
        });
      }

      throw new Error(`Mock endpoint GET ${url} not implemented`);
    } catch (err: any) {
      console.error(err);
      return Promise.reject({ response: { status: 401, data: { message: err.message || 'Unauthorized' } } });
    }
  },

  post: async (url: string, data?: any, config?: any): Promise<any> => {
    console.log(`[Mock API POST] -> ${url}`, data);
    try {
      const userId = getUserIdFromSession();

      // 1. Wallet Mock Deposit
      if (url.startsWith('/wallet/deposit-mock')) {
        const { assetId, amount } = data;
        const wallets = db.getWallets();
        const wallet = wallets.find((w) => w.userId === userId && w.assetId === assetId);
        if (!wallet) throw new Error('Wallet not found');

        wallet.balance += Number(amount);
        db.saveWallets(wallets);

        // Record deposit
        const deposits = db.getDeposits();
        deposits.unshift({
          id: `d-${Math.random().toString(36).substring(2, 12)}`,
          walletId: wallet.id,
          txHash: `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
          amount: Number(amount),
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
        });
        db.saveDeposits(deposits);

        db.logAudit(userId, 'WALLET_DEPOSIT', `Deposited mock amount ${amount} for wallet ${wallet.id}`);
        db.notify(userId, 'Deposit Successful', `Your deposit of ${amount} has been credited.`);

        window.dispatchEvent(new CustomEvent('portfolio_updated'));

        return mockResponse({ message: 'Deposit successful' });
      }

      // 2. Wallet Withdrawal Request
      if (url.startsWith('/wallet/withdraw')) {
        const { assetId, amount, address } = data;
        const wallets = db.getWallets();
        const wallet = wallets.find((w) => w.userId === userId && w.assetId === assetId);
        if (!wallet) throw new Error('Wallet not found');

        const assets = db.getAssets();
        const asset = assets.find((a) => a.id === assetId)!;

        const wAmount = Number(amount);
        if (wAmount < asset.minWithdraw) throw new Error(`Minimum withdrawal is ${asset.minWithdraw}`);
        if (wallet.balance < wAmount) throw new Error('Insufficient balance');

        // Lock withdrawal funds
        wallet.balance -= wAmount;
        wallet.locked += wAmount;
        db.saveWallets(wallets);

        // Record pending withdrawal
        const withdrawals = db.getWithdrawals();
        const newWithdrawal = {
          id: `wdr-${Math.random().toString(36).substring(2, 12)}`,
          walletId: wallet.id,
          userId,
          toAddress: address,
          amount: wAmount,
          fee: asset.withdrawFee,
          status: 'PENDING' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        withdrawals.unshift(newWithdrawal);
        db.saveWithdrawals(withdrawals);

        db.logAudit(userId, 'WALLET_WITHDRAWAL_REQUEST', `Requested withdrawal of ${amount} ${asset.symbol}`);
        db.notify(userId, 'Withdrawal Requested', `Your withdrawal request of ${amount} ${asset.symbol} is pending admin approval.`);

        window.dispatchEvent(new CustomEvent('portfolio_updated'));

        return mockResponse({ message: 'Withdrawal request created' });
      }

      // 3. Enable 2FA Setup
      if (url.startsWith('/auth/2fa/enable')) {
        const { code } = data;
        const users = db.getUsers();
        const uIdx = users.findIndex((u) => u.id === userId);
        if (uIdx === -1) throw new Error('User not found');

        if (code !== '123456' && code !== users[uIdx].twoFactorSecret) {
          throw new Error('Invalid code. Use mock code 123456');
        }

        users[uIdx].is2faEnabled = true;
        db.saveUsers(users);

        // Update local session
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        stored.is2faEnabled = true;
        localStorage.setItem('user', JSON.stringify(stored));

        db.logAudit(userId, '2FA_ENABLE', 'Enabled two-factor authentication');

        return mockResponse({ message: '2FA enabled successfully' });
      }

      // 4. Submit Order
      if (url.startsWith('/trade/order')) {
        const { symbol, side, type, price, stopPrice, amount } = data;
        const wallets = db.getWallets();
        const [baseSymbol, quoteSymbol] = symbol.split('/');

        const assets = db.getAssets();
        const baseAsset = assets.find((a) => a.symbol === baseSymbol)!;
        const quoteAsset = assets.find((a) => a.symbol === quoteSymbol)!;

        const uAmount = Number(amount);
        const uPrice = price ? Number(price) : 0;
        const uCost = uAmount * uPrice;

        // Balance locks validation
        if (side === 'BUY') {
          // Locks quote asset (USDT)
          const wallet = wallets.find((w) => w.userId === userId && w.assetId === quoteAsset.id)!;
          const costToLock = type === 'MARKET' ? uAmount * matchingEngine.getMarketPrice(symbol) * 1.05 : uCost; // add buffer for market orders
          if (wallet.balance < costToLock) throw new Error('Insufficient USDT balance');
          
          if (type === 'LIMIT') {
            wallet.balance -= costToLock;
            wallet.locked += costToLock;
          }
        } else {
          // Locks base asset (BTC)
          const wallet = wallets.find((w) => w.userId === userId && w.assetId === baseAsset.id)!;
          if (wallet.balance < uAmount) throw new Error(`Insufficient ${baseSymbol} balance`);
          
          if (type === 'LIMIT') {
            wallet.balance -= uAmount;
            wallet.locked += uAmount;
          }
        }
        db.saveWallets(wallets);

        // Create order
        const orders = db.getOrders();
        const newOrder: Order = {
          id: `o-${Math.random().toString(36).substring(2, 12)}`,
          userId,
          symbol,
          side,
          type,
          price: type !== 'MARKET' ? uPrice : undefined,
          stopPrice: type === 'STOP' ? Number(stopPrice) : undefined,
          amount: uAmount,
          filledAmount: 0,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        };
        orders.unshift(newOrder);
        db.saveOrders(orders);

        db.logAudit(userId, 'ORDER_CREATION', `Placed ${type} ${side} order for ${amount} ${baseSymbol}`);

        // Run matching engine loop immediately
        matchingEngine.processNewOrder(newOrder.id);

        return mockResponse({ message: 'Order placed successfully', order: newOrder });
      }

      // 5. Admin Approve/Reject KYC
      // Wait, is there a kyc approval? Yes, KYC approvals are automatic or triggered on Admin page.
      // 6. Admin User Freeze Toggle
      if (url.startsWith('/admin/users/') && url.endsWith('/freeze')) {
        const targetUserId = url.split('/')[3];
        const users = db.getUsers();
        const idx = users.findIndex((u) => u.id === targetUserId);
        if (idx !== -1) {
          users[idx].isFrozen = !users[idx].isFrozen;
          db.saveUsers(users);
          db.logAudit(userId, 'ADMIN_USER_FREEZE', `Admin toggled freeze status for user ${targetUserId}`);
          return mockResponse({ message: 'User freeze status updated' });
        }
        throw new Error('User not found');
      }

      // 7. Admin Withdrawal Approval Settle
      if (url.startsWith('/admin/withdrawals/')) {
        const parts = url.split('/');
        const id = parts[3];
        const decision = parts[4]; // 'approve' or 'reject'

        const withdrawals = db.getWithdrawals();
        const wIdx = withdrawals.findIndex((w) => w.id === id);
        if (wIdx === -1) throw new Error('Withdrawal not found');

        const withdrawal = withdrawals[wIdx];
        if (withdrawal.status !== 'PENDING') throw new Error('Withdrawal already processed');

        const wallets = db.getWallets();
        const wallet = wallets.find((w) => w.id === withdrawal.walletId)!;

        if (decision === 'approve') {
          withdrawal.status = 'COMPLETED';
          withdrawal.txHash = `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;
          // Deduct from locked
          wallet.locked -= withdrawal.amount;
          db.notify(withdrawal.userId, 'Withdrawal Approved', `Your withdrawal of ${withdrawal.amount} has been processed.`);
          db.logAudit(userId, 'ADMIN_WITHDRAWAL_APPROVAL', `Approved withdrawal ${id}`);
        } else {
          withdrawal.status = 'REJECTED';
          // Return locked to balance
          wallet.locked -= withdrawal.amount;
          wallet.balance += withdrawal.amount;
          db.notify(withdrawal.userId, 'Withdrawal Rejected', `Your withdrawal of ${withdrawal.amount} was rejected. Funds returned.`);
          db.logAudit(userId, 'ADMIN_WITHDRAWAL_REJECTION', `Rejected withdrawal ${id}`);
        }

        withdrawal.updatedAt = new Date().toISOString();
        db.saveWithdrawals(withdrawals);
        db.saveWallets(wallets);

        window.dispatchEvent(new CustomEvent('portfolio_updated'));

        return mockResponse({ message: `Withdrawal successfully ${decision}d` });
      }

      throw new Error(`Mock endpoint POST ${url} not implemented`);
    } catch (err: any) {
      console.error(err);
      return Promise.reject({ response: { status: 400, data: { message: err.message || 'Error occurred' } } });
    }
  },

  delete: async (url: string, config?: any): Promise<any> => {
    console.log(`[Mock API DELETE] -> ${url}`);
    try {
      const userId = getUserIdFromSession();

      // Cancel Order
      if (url.startsWith('/trade/order/')) {
        const orderId = url.replace('/trade/order/', '');
        
        // Find order to extract symbol
        const orders = db.getOrders();
        const order = orders.find((o) => o.id === orderId && o.userId === userId);
        if (!order) throw new Error('Order not found');

        const success = matchingEngine.cancelOrder(userId, orderId, order.symbol);
        if (success) {
          return mockResponse({ message: 'Order cancelled successfully' });
        }
        throw new Error('Order could not be cancelled');
      }

      throw new Error(`Mock endpoint DELETE ${url} not implemented`);
    } catch (err: any) {
      console.error(err);
      return Promise.reject({ response: { status: 400, data: { message: err.message || 'Error occurred' } } });
    }
  }
};

export default mockApi;
export const api = mockApi;

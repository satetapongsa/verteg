import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import * as authCtrl from '../controllers/AuthController';
import * as walletCtrl from '../controllers/WalletController';
import * as tradeCtrl from '../controllers/TradingController';
import * as marketCtrl from '../controllers/MarketController';
import * as adminCtrl from '../controllers/AdminController';

const router = Router();

// --- Auth Endpoints ---
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.post('/auth/refresh', authCtrl.refreshToken);
router.post('/auth/logout', authCtrl.logout);
router.get('/auth/2fa/setup', requireAuth, authCtrl.get2faSetup);
router.post('/auth/2fa/enable', requireAuth, authCtrl.verifyAndEnable2fa);

// --- Wallet Endpoints ---
router.get('/wallet/balances', requireAuth, walletCtrl.getBalances);
router.get('/wallet/address/:symbol', requireAuth, walletCtrl.getDepositAddress);
router.post('/wallet/withdraw', requireAuth, walletCtrl.requestWithdrawal);
router.get('/wallet/history', requireAuth, walletCtrl.getTransactionHistory);
router.post('/wallet/deposit-mock', requireAuth, walletCtrl.mockDeposit);

// --- Trading Endpoints ---
router.post('/trade/order', requireAuth, tradeCtrl.placeOrder);
router.delete('/trade/order/:orderId', requireAuth, tradeCtrl.cancelOrder);
router.get('/trade/open-orders', requireAuth, tradeCtrl.getOpenOrders);
router.get('/trade/trades', requireAuth, tradeCtrl.getUserTrades);
router.get('/trade/history', requireAuth, tradeCtrl.getOrderHistory);

// --- Market Endpoints (Public) ---
router.get('/market/assets', marketCtrl.getAssets);
router.get('/market/orderbook/:symbol', marketCtrl.getOrderBook);
router.get('/market/trades/:symbol', marketCtrl.getRecentTrades);
router.get('/market/ticker/:symbol', marketCtrl.getTicker);
router.get('/market/overview', marketCtrl.getMarketOverview);

// --- Admin Endpoints ---
router.get('/admin/users', requireAuth, requireAdmin, adminCtrl.getUsers);
router.post('/admin/users/:userId/freeze', requireAuth, requireAdmin, adminCtrl.toggleUserFreeze);
router.get('/admin/withdrawals', requireAuth, requireAdmin, adminCtrl.getPendingWithdrawals);
router.post('/admin/withdrawals/:withdrawalId/approve', requireAuth, requireAdmin, adminCtrl.approveWithdrawal);
router.post('/admin/withdrawals/:withdrawalId/reject', requireAuth, requireAdmin, adminCtrl.rejectWithdrawal);
router.get('/admin/stats', requireAuth, requireAdmin, adminCtrl.getSystemStats);

export default router;

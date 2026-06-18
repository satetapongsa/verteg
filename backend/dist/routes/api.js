"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const authCtrl = __importStar(require("../controllers/AuthController"));
const walletCtrl = __importStar(require("../controllers/WalletController"));
const tradeCtrl = __importStar(require("../controllers/TradingController"));
const marketCtrl = __importStar(require("../controllers/MarketController"));
const adminCtrl = __importStar(require("../controllers/AdminController"));
const router = (0, express_1.Router)();
// --- Auth Endpoints ---
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.post('/auth/refresh', authCtrl.refreshToken);
router.post('/auth/logout', authCtrl.logout);
router.get('/auth/2fa/setup', auth_1.requireAuth, authCtrl.get2faSetup);
router.post('/auth/2fa/enable', auth_1.requireAuth, authCtrl.verifyAndEnable2fa);
// --- Wallet Endpoints ---
router.get('/wallet/balances', auth_1.requireAuth, walletCtrl.getBalances);
router.get('/wallet/address/:symbol', auth_1.requireAuth, walletCtrl.getDepositAddress);
router.post('/wallet/withdraw', auth_1.requireAuth, walletCtrl.requestWithdrawal);
router.get('/wallet/history', auth_1.requireAuth, walletCtrl.getTransactionHistory);
router.post('/wallet/deposit-mock', auth_1.requireAuth, walletCtrl.mockDeposit);
// --- Trading Endpoints ---
router.post('/trade/order', auth_1.requireAuth, tradeCtrl.placeOrder);
router.delete('/trade/order/:orderId', auth_1.requireAuth, tradeCtrl.cancelOrder);
router.get('/trade/open-orders', auth_1.requireAuth, tradeCtrl.getOpenOrders);
router.get('/trade/trades', auth_1.requireAuth, tradeCtrl.getUserTrades);
router.get('/trade/history', auth_1.requireAuth, tradeCtrl.getOrderHistory);
// --- Market Endpoints (Public) ---
router.get('/market/assets', marketCtrl.getAssets);
router.get('/market/orderbook/:symbol', marketCtrl.getOrderBook);
router.get('/market/trades/:symbol', marketCtrl.getRecentTrades);
router.get('/market/ticker/:symbol', marketCtrl.getTicker);
router.get('/market/overview', marketCtrl.getMarketOverview);
// --- Admin Endpoints ---
router.get('/admin/users', auth_1.requireAuth, auth_1.requireAdmin, adminCtrl.getUsers);
router.post('/admin/users/:userId/freeze', auth_1.requireAuth, auth_1.requireAdmin, adminCtrl.toggleUserFreeze);
router.get('/admin/withdrawals', auth_1.requireAuth, auth_1.requireAdmin, adminCtrl.getPendingWithdrawals);
router.post('/admin/withdrawals/:withdrawalId/approve', auth_1.requireAuth, auth_1.requireAdmin, adminCtrl.approveWithdrawal);
router.post('/admin/withdrawals/:withdrawalId/reject', auth_1.requireAuth, auth_1.requireAdmin, adminCtrl.rejectWithdrawal);
router.get('/admin/stats', auth_1.requireAuth, auth_1.requireAdmin, adminCtrl.getSystemStats);
exports.default = router;

import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';
import { requireAuth } from '../middleware/AuthMiddleware';

const router = Router();

router.get('/balances', requireAuth, WalletController.getBalances);
router.get('/deposit/:coinSymbol', requireAuth, WalletController.getDepositAddress);
router.post('/withdraw', requireAuth, WalletController.requestWithdrawal);
router.get('/transactions', requireAuth, WalletController.getTransactionHistory);

// Simulation/Sandbox endpoint
router.post('/simulate-deposit', requireAuth, WalletController.simulateDeposit);

export default router;

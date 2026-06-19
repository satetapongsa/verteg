import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { requireAuth, requireAdmin } from '../middleware/AuthMiddleware';

const router = Router();

// Apply auth and admin check to all admin routes
router.use(requireAuth, requireAdmin);

router.get('/users', AdminController.getUsers);
router.post('/users/:userId/freeze', AdminController.toggleFreezeUser);

router.get('/kyc', AdminController.getKycSubmissions);
router.post('/kyc/:kycId/review', AdminController.reviewKyc);

router.get('/withdrawals', AdminController.getPendingWithdrawals);
router.post('/withdrawals/:transactionId/review', AdminController.reviewWithdrawal);

router.get('/stats', AdminController.getSystemStats);
router.get('/logs', AdminController.getAuditLogs);

export default router;

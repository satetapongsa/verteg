import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { requireAuth } from '../middleware/AuthMiddleware';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

router.post('/2fa/setup', requireAuth, AuthController.setup2FA);
router.post('/2fa/verify', requireAuth, AuthController.verify2FA);
router.post('/2fa/disable', requireAuth, AuthController.disable2FA);

export default router;

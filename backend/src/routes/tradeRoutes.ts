import { Router } from 'express';
import { TradeController } from '../controllers/TradeController';
import { requireAuth } from '../middleware/AuthMiddleware';

const router = Router();

router.post('/order', requireAuth, TradeController.placeOrder);
router.delete('/order/:orderId', requireAuth, TradeController.cancelOrder);
router.get('/open', requireAuth, TradeController.getOpenOrders);
router.get('/history', requireAuth, TradeController.getOrderHistory);
router.get('/trades', requireAuth, TradeController.getTrades);

// Public trading endpoints
router.get('/orderbook/:pair', TradeController.getOrderBook);
router.get('/recent-trades/:pair', TradeController.getRecentTrades);
router.get('/pairs', TradeController.getPairs);

export default router;

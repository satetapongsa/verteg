import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';
import { MatchingEngine } from '../engine/MatchingEngine';

const prisma = new PrismaClient();
const matchingEngine = MatchingEngine.getInstance();

export class TradeController {
  public static async placeOrder(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    const { pair, side, type, price, quantity } = req.body;

    if (!pair || !side || !type || !quantity) {
      return res.status(400).json({ error: 'pair, side, type, and quantity are required' });
    }

    if (type === 'LIMIT' && !price) {
      return res.status(400).json({ error: 'price is required for limit orders' });
    }

    try {
      const result = await matchingEngine.submitOrder(userId, {
        pair,
        side,
        type,
        price: price ? parseFloat(price) : undefined,
        quantity: parseFloat(quantity)
      });
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  public static async cancelOrder(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    const { orderId } = req.params;

    try {
      await matchingEngine.cancelOrder(userId, orderId);
      return res.status(200).json({ message: 'Order successfully cancelled' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  public static async getOpenOrders(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    try {
      const orders = await prisma.order.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'PARTIALLY_FILLED'] }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(orders);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getOrderHistory(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    try {
      const orders = await prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(orders);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getTrades(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    try {
      const trades = await prisma.trade.findMany({
        where: {
          OR: [
            { makerOrder: { userId } },
            { takerOrder: { userId } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(trades);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getOrderBook(req: AuthenticatedRequest, res: Response) {
    const { pair } = req.params;
    const book = matchingEngine.getOrderBook(pair);
    if (!book) {
      return res.status(404).json({ error: 'Trading pair not supported' });
    }
    return res.status(200).json(book.getOrderBookSnapshot());
  }

  public static async getPairs(req: AuthenticatedRequest, res: Response) {
    return res.status(200).json(matchingEngine.getSupportedPairs());
  }

  public static async getRecentTrades(req: AuthenticatedRequest, res: Response) {
    const { pair } = req.params;
    try {
      const trades = await prisma.trade.findMany({
        where: { pair },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      return res.status(200).json(trades);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}

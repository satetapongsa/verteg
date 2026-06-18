import { Response } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { OrderSide, OrderType, OrderStatus } from '../types/db';
import { MatchingEngine } from '../services/MatchingEngine';

export const placeOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { symbol, side, type, price, amount, stopPrice } = req.body;

    if (!symbol || !side || !type || !amount) {
      return res.status(400).json({ message: 'Missing required fields (symbol, side, type, amount)' });
    }

    const orderSide = side as OrderSide;
    const orderType = type as OrderType;
    const orderAmount = parseFloat(amount);
    const orderPrice = price ? parseFloat(price) : null;
    const orderStopPrice = stopPrice ? parseFloat(stopPrice) : null;

    if (isNaN(orderAmount) || orderAmount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than zero' });
    }

    if (orderType === OrderType.LIMIT && (!orderPrice || isNaN(orderPrice) || orderPrice <= 0)) {
      return res.status(400).json({ message: 'Valid price is required for Limit orders' });
    }

    if (orderType === OrderType.STOP && (!orderStopPrice || isNaN(orderStopPrice) || orderStopPrice <= 0)) {
      return res.status(400).json({ message: 'Valid stop price is required for Stop orders' });
    }

    const [baseSymbol, quoteSymbol] = symbol.split('/');
    if (!baseSymbol || !quoteSymbol) {
      return res.status(400).json({ message: 'Invalid symbol format. Use BASE/QUOTE (e.g. BTC/USDT)' });
    }

    const baseAsset = await prisma.asset.findUnique({ where: { symbol: baseSymbol } });
    const quoteAsset = await prisma.asset.findUnique({ where: { symbol: quoteSymbol } });

    if (!baseAsset || !quoteAsset) {
      return res.status(400).json({ message: 'Assets not supported' });
    }

    // Get wallets
    const baseWallet = await prisma.wallet.findUnique({
      where: { userId_assetId: { userId, assetId: baseAsset.id } },
    });
    const quoteWallet = await prisma.wallet.findUnique({
      where: { userId_assetId: { userId, assetId: quoteAsset.id } },
    });

    if (!baseWallet || !quoteWallet) {
      return res.status(400).json({ message: 'User wallets not found. Please contact support.' });
    }

    // Balance check and locking
    let lockVolume = 0;
    let walletToLock = baseWallet;

    if (orderSide === OrderSide.BUY) {
      walletToLock = quoteWallet;
      if (orderType === OrderType.LIMIT) {
        lockVolume = orderAmount * orderPrice!;
      } else if (orderType === OrderType.STOP) {
        // Stop-limit or stop-market: we lock estimate using stop price or limit price
        lockVolume = orderAmount * (orderPrice || orderStopPrice!);
      } else {
        // Market BUY: check current market price
        const currentPrice = await MatchingEngine.getInstance().getMarketPrice(symbol);
        lockVolume = orderAmount * currentPrice;
      }
    } else {
      // SELL order: we lock the base asset
      walletToLock = baseWallet;
      lockVolume = orderAmount;
    }

    if (walletToLock.balance < lockVolume) {
      return res.status(400).json({
        message: `Insufficient balance. Required: ${lockVolume.toFixed(4)} ${
          orderSide === OrderSide.BUY ? quoteSymbol : baseSymbol
        }, Available: ${walletToLock.balance.toFixed(4)}`,
      });
    }

    // Create order and lock balance in DB transaction
    const newOrder = await prisma.$transaction(async (tx) => {
      // Lock balance in wallet (not for Market orders as they settle immediately, but let's lock them to avoid double spend during processing)
      await tx.wallet.update({
        where: { id: walletToLock.id },
        data: {
          balance: { decrement: lockVolume },
          locked: { increment: lockVolume },
        },
      });

      // Create Order DB entry
      return await tx.order.create({
        data: {
          userId,
          symbol,
          side: orderSide,
          type: orderType,
          price: orderPrice,
          stopPrice: orderStopPrice,
          amount: orderAmount,
          status: OrderStatus.PENDING,
        },
      });
    });

    // Send order to Matching Engine to execute asynchronous matching
    MatchingEngine.getInstance().processNewOrder(newOrder.id);

    return res.status(201).json({
      message: 'Order placed successfully',
      order: newOrder,
    });

  } catch (err) {
    console.error('Place order error:', err);
    return res.status(500).json({ message: 'Internal server error while placing order' });
  }
};

export const cancelOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId !== userId) {
      return res.status(403).json({ message: 'Unauthorized action' });
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PARTIALLY_FILLED) {
      return res.status(400).json({ message: `Order cannot be cancelled. Status: ${order.status}` });
    }

    const success = await MatchingEngine.getInstance().cancelOrder(userId, orderId, order.symbol);
    if (success) {
      return res.status(200).json({ message: 'Order cancelled successfully' });
    } else {
      return res.status(400).json({ message: 'Failed to cancel order' });
    }

  } catch (err) {
    console.error('Cancel order error:', err);
    return res.status(500).json({ message: 'Internal server error while cancelling order' });
  }
};

export const getOpenOrders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const orders = await prisma.order.findMany({
      where: {
        userId,
        status: { in: [OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ orders });
  } catch (err) {
    console.error('Get open orders error:', err);
    return res.status(500).json({ message: 'Internal server error fetching open orders' });
  }
};

export const getUserTrades = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const trades = await prisma.trade.findMany({
      where: {
        OR: [
          { maker: { userId } },
          { taker: { userId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ trades });
  } catch (err) {
    console.error('Get user trades error:', err);
    return res.status(500).json({ message: 'Internal server error fetching user trades' });
  }
};

export const getOrderHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const orders = await prisma.order.findMany({
      where: {
        userId,
        status: { notIn: [OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.status(200).json({ orders });
  } catch (err) {
    console.error('Get order history error:', err);
    return res.status(500).json({ message: 'Internal server error fetching order history' });
  }
};

import { PrismaClient } from '@prisma/client';
import { OrderBook } from './OrderBook';
import { OrderItem } from '../types';
import { WebSocketServer } from '../ws/WebSocketServer';

const prisma = new PrismaClient();

export class MatchingEngine {
  private static instance: MatchingEngine;
  private books: Map<string, OrderBook> = new Map();
  private wsServer?: WebSocketServer;

  private constructor() {
    const pairs = [
      'BTC_USDT', 'ETH_USDT', 'BNB_USDT', 'SOL_USDT',
      'XRP_USDT', 'DOGE_USDT', 'ADA_USDT', 'TRX_USDT', 'MATIC_USDT'
    ];
    pairs.forEach(pair => {
      this.books.set(pair, new OrderBook(pair));
    });
  }

  public static getInstance(): MatchingEngine {
    if (!MatchingEngine.instance) {
      MatchingEngine.instance = new MatchingEngine();
    }
    return MatchingEngine.instance;
  }

  public setWebSocketServer(ws: WebSocketServer) {
    this.wsServer = ws;
  }

  public getOrderBook(pair: string): OrderBook | undefined {
    return this.books.get(pair);
  }

  public getSupportedPairs(): string[] {
    return Array.from(this.books.keys());
  }

  /**
   * Loads pending orders from the database into the memory order book on startup
   */
  public async initializeFromDatabase() {
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIALLY_FILLED'] }
      },
      orderBy: { createdAt: 'asc' }
    });

    for (const order of pendingOrders) {
      const book = this.books.get(order.pair);
      if (book) {
        const item: OrderItem = {
          id: order.id,
          userId: order.userId,
          pair: order.pair,
          side: order.side,
          type: order.type,
          price: Number(order.price || 0),
          stopPrice: order.stopPrice ? Number(order.stopPrice) : undefined,
          quantity: Number(order.quantity),
          filledQty: Number(order.filledQty),
          status: order.status,
          createdAt: order.createdAt
        };
        if (item.side === 'BUY') {
          // Add sorted bids
          this.books.get(order.pair)?.bids.push(item);
        } else {
          // Add sorted asks
          this.books.get(order.pair)?.asks.push(item);
        }
      }
    }
    // Re-sort the books
    for (const book of this.books.values()) {
      book.bids.sort((a, b) => b.price - a.price || a.createdAt.getTime() - b.createdAt.getTime());
      book.asks.sort((a, b) => a.price - b.price || a.createdAt.getTime() - b.createdAt.getTime());
    }
  }

  /**
   * Submits a new order, updates database wallet balances, and executes matching
   */
  public async submitOrder(userId: string, orderData: {
    pair: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET';
    price?: number;
    quantity: number;
  }) {
    const book = this.books.get(orderData.pair);
    if (!book) throw new Error('Unsupported trading pair');

    const [baseCoin, quoteCoin] = orderData.pair.split('_');
    const coinToLock = orderData.side === 'BUY' ? quoteCoin : baseCoin;
    const amountToLock = orderData.side === 'BUY'
      ? (orderData.type === 'LIMIT' ? orderData.price! * orderData.quantity : 0) // Market order locks custom quote balance or checks availability
      : orderData.quantity;

    // Start a Prisma transaction to lock the balance and create the Order record
    const result = await prisma.$transaction(async (tx) => {
      // Find wallet
      const wallet = await tx.wallet.findUnique({
        where: { userId_coinSymbol: { userId, coinSymbol: coinToLock } }
      });

      if (!wallet) throw new Error(`Wallet not found for ${coinToLock}`);

      // Check balance
      if (orderData.type === 'LIMIT') {
        if (Number(wallet.balance) < amountToLock) {
          throw new Error('Insufficient balance');
        }
        // Lock balance
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: Number(wallet.balance) - amountToLock,
            locked: Number(wallet.locked) + amountToLock
          }
        });
      } else {
        // Market order checks:
        if (orderData.side === 'BUY') {
          // Market buy needs quote balances (USDT). Since price is not fixed, we will lock the user's USDT up to their total balance or check they have enough.
          // For simplicity, we match market orders immediately. We will check available balance during trade matching.
        } else {
          // Market sell needs base asset quantity (BTC)
          if (Number(wallet.balance) < orderData.quantity) {
            throw new Error('Insufficient balance');
          }
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: Number(wallet.balance) - orderData.quantity,
              locked: Number(wallet.locked) + orderData.quantity
            }
          });
        }
      }

      // Create order
      const order = await tx.order.create({
        data: {
          userId,
          pair: orderData.pair,
          side: orderData.side,
          type: orderData.type,
          price: orderData.price,
          quantity: orderData.quantity,
          status: 'PENDING'
        }
      });

      return order;
    });

    const takerItem: OrderItem = {
      id: result.id,
      userId: result.userId,
      pair: result.pair,
      side: result.side,
      type: result.type,
      price: Number(result.price || 0),
      quantity: Number(result.quantity),
      filledQty: 0,
      status: 'PENDING',
      createdAt: result.createdAt
    };

    // Match in-memory
    const trades = book.addOrder(takerItem);

    // Apply trades to database
    for (const trade of trades) {
      await this.persistTrade(trade, result.price ? Number(result.price) : undefined);
    }

    // Update taker order status in database if not completely filled during matchmaking
    await prisma.order.update({
      where: { id: takerItem.id },
      data: {
        filledQty: takerItem.filledQty,
        status: takerItem.status
      }
    });

    // Notify clients of order book change
    this.wsServer?.broadcastToPair(orderData.pair, 'orderbook_update', book.getOrderBookSnapshot());
    
    // Broadcast tickers & recent trade executions
    if (trades.length > 0) {
      this.wsServer?.broadcastToPair(orderData.pair, 'recent_trades', trades);
      // Calculate 24h ticker info and broadcast
      const tickerInfo = await this.getTickerInfo(orderData.pair);
      this.wsServer?.broadcast('ticker_update', { pair: orderData.pair, ...tickerInfo });
    }

    // Send order updates to individual users
    this.wsServer?.sendToUser(userId, 'order_update', takerItem);
    
    return { order: takerItem, trades };
  }

  /**
   * Cancel an open order and release locked funds
   */
  public async cancelOrder(userId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) throw new Error('Order not found');
    if (order.userId !== userId) throw new Error('Unauthorized');
    if (order.status === 'FILLED' || order.status === 'CANCELLED' || order.status === 'REJECTED') {
      throw new Error('Order is already closed');
    }

    const book = this.books.get(order.pair);
    if (!book) throw new Error('Unsupported pair');

    // Remove from in-memory orderbook
    const removed = book.cancelOrder(order.id, order.side);
    
    // Update DB
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' }
      });

      const [baseCoin, quoteCoin] = order.pair.split('_');
      const coinToUnlock = order.side === 'BUY' ? quoteCoin : baseCoin;
      
      const unfilledQty = Number(order.quantity) - Number(order.filledQty);
      const amountToUnlock = order.side === 'BUY'
        ? unfilledQty * Number(order.price || 0)
        : unfilledQty;

      const wallet = await tx.wallet.findUnique({
        where: { userId_coinSymbol: { userId, coinSymbol: coinToUnlock } }
      });

      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: Number(wallet.balance) + amountToUnlock,
            locked: Math.max(0, Number(wallet.locked) - amountToUnlock)
          }
        });
      }
    });

    // Notify UI
    this.wsServer?.broadcastToPair(order.pair, 'orderbook_update', book.getOrderBookSnapshot());
    this.wsServer?.sendToUser(userId, 'order_update', {
      id: order.id,
      status: 'CANCELLED',
      filledQty: Number(order.filledQty)
    });

    return true;
  }

  private async persistTrade(trade: any, takerLimitPrice?: number) {
    const [baseCoin, quoteCoin] = trade.pair.split('_');
    const tradePrice = trade.price;
    const tradeQty = trade.quantity;
    const tradeValue = tradePrice * tradeQty;

    await prisma.$transaction(async (tx) => {
      // 1. Create Trade Record
      await tx.trade.create({
        data: {
          pair: trade.pair,
          price: tradePrice,
          quantity: tradeQty,
          makerOrderId: trade.makerOrderId,
          takerOrderId: trade.takerOrderId,
          side: trade.side
        }
      });

      // 2. Fetch both maker and taker orders from DB
      const makerOrder = await tx.order.findUnique({ where: { id: trade.makerOrderId } });
      const takerOrder = await tx.order.findUnique({ where: { id: trade.takerOrderId } });

      if (!makerOrder || !takerOrder) throw new Error('Order not found during trade execution');

      // Update maker order filled quantity
      const newMakerFilled = Number(makerOrder.filledQty) + tradeQty;
      const isMakerFilled = newMakerFilled >= Number(makerOrder.quantity);
      await tx.order.update({
        where: { id: makerOrder.id },
        data: {
          filledQty: newMakerFilled,
          status: isMakerFilled ? 'FILLED' : 'PARTIALLY_FILLED'
        }
      });

      // 3. Balance Updates
      // Maker Balance Update
      const makerWalletBase = await tx.wallet.findUnique({ where: { userId_coinSymbol: { userId: makerOrder.userId, coinSymbol: baseCoin } } });
      const makerWalletQuote = await tx.wallet.findUnique({ where: { userId_coinSymbol: { userId: makerOrder.userId, coinSymbol: quoteCoin } } });
      
      // Taker Balance Update
      const takerWalletBase = await tx.wallet.findUnique({ where: { userId_coinSymbol: { userId: takerOrder.userId, coinSymbol: baseCoin } } });
      const takerWalletQuote = await tx.wallet.findUnique({ where: { userId_coinSymbol: { userId: takerOrder.userId, coinSymbol: quoteCoin } } });

      if (trade.side === 'BUY') {
        // Taker is BUY (receives base, spends quote), Maker is SELL (spends base, receives quote)
        // Maker Sell: Spends base (locked base decreases), receives quote (available quote increases)
        if (makerWalletBase) {
          await tx.wallet.update({
            where: { id: makerWalletBase.id },
            data: { locked: Math.max(0, Number(makerWalletBase.locked) - tradeQty) }
          });
        }
        if (makerWalletQuote) {
          await tx.wallet.update({
            where: { id: makerWalletQuote.id },
            data: { balance: Number(makerWalletQuote.balance) + tradeValue }
          });
        }

        // Taker Buy: Receives base (available base increases), spends quote (locked/available quote decreases)
        if (takerWalletBase) {
          await tx.wallet.update({
            where: { id: takerWalletBase.id },
            data: { balance: Number(takerWalletBase.balance) + tradeQty }
          });
        }

        if (takerWalletQuote) {
          if (takerOrder.type === 'LIMIT' && takerLimitPrice) {
            // For limit order, locked quote is based on limit price. Release tradeValue from locked.
            // If actual tradePrice is lower than takerLimitPrice, the difference is returned to available balance.
            const lockedValueSpent = takerLimitPrice * tradeQty;
            const savings = lockedValueSpent - tradeValue;
            await tx.wallet.update({
              where: { id: takerWalletQuote.id },
              data: {
                locked: Math.max(0, Number(takerWalletQuote.locked) - lockedValueSpent),
                balance: Number(takerWalletQuote.balance) + savings
              }
            });
          } else {
            // Market order: deduct directly from available balance
            await tx.wallet.update({
              where: { id: takerWalletQuote.id },
              data: { balance: Number(takerWalletQuote.balance) - tradeValue }
            });
          }
        }
      } else {
        // Taker is SELL (spends base, receives quote), Maker is BUY (receives base, spends quote)
        // Maker Buy: Spends quote (locked quote decreases), receives base (available base increases)
        if (makerWalletQuote) {
          const makerLimitPrice = Number(makerOrder.price || 0);
          const lockedValueSpent = makerLimitPrice * tradeQty;
          const savings = lockedValueSpent - tradeValue;
          await tx.wallet.update({
            where: { id: makerWalletQuote.id },
            data: {
              locked: Math.max(0, Number(makerWalletQuote.locked) - lockedValueSpent),
              balance: Number(makerWalletQuote.balance) + savings
            }
          });
        }
        if (makerWalletBase) {
          await tx.wallet.update({
            where: { id: makerWalletBase.id },
            data: { balance: Number(makerWalletBase.balance) + tradeQty }
          });
        }

        // Taker Sell: Spends base (locked base decreases), receives quote (available quote increases)
        if (takerWalletBase) {
          await tx.wallet.update({
            where: { id: takerWalletBase.id },
            data: { locked: Math.max(0, Number(takerWalletBase.locked) - tradeQty) }
          });
        }
        if (takerWalletQuote) {
          await tx.wallet.update({
            where: { id: takerWalletQuote.id },
            data: { balance: Number(takerWalletQuote.balance) + tradeValue }
          });
        }
      }
    });

    // Notify Maker user of order update
    const updatedMakerOrder = await prisma.order.findUnique({ where: { id: trade.makerOrderId } });
    if (updatedMakerOrder) {
      this.wsServer?.sendToUser(updatedMakerOrder.userId, 'order_update', {
        id: updatedMakerOrder.id,
        status: updatedMakerOrder.status,
        filledQty: Number(updatedMakerOrder.filledQty)
      });
    }
  }

  private async getTickerInfo(pair: string) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trades = await prisma.trade.findMany({
      where: {
        pair,
        createdAt: { gte: yesterday }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (trades.length === 0) {
      // Return static values or last known trade price
      const lastTrade = await prisma.trade.findFirst({
        where: { pair },
        orderBy: { createdAt: 'desc' }
      });
      const price = lastTrade ? Number(lastTrade.price) : 1.00;
      return { price, high24h: price, low24h: price, volume24h: 0, change24h: 0 };
    }

    const prices = trades.map(t => Number(t.price));
    const openPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const high24h = Math.max(...prices);
    const low24h = Math.min(...prices);
    const volume24h = trades.reduce((acc, t) => acc + Number(t.quantity), 0);
    const change24h = ((lastPrice - openPrice) / openPrice) * 100;

    return {
      price: lastPrice,
      high24h,
      low24h,
      volume24h,
      change24h
    };
  }
}

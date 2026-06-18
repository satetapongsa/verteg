import { prisma } from '../config/db';
import { OrderSide, OrderType, OrderStatus, TransactionStatus } from '../types/db';
import { WebSocketManager } from './WebSocketManager';

export interface OrderBookEntry {
  id: string;
  userId: string;
  symbol: string;
  price: number;
  amount: number;
  filledAmount: number;
  side: OrderSide;
  type: OrderType;
  stopPrice: number | null;
  createdAt: Date;
}

export interface TradeResult {
  tradeId: string;
  price: number;
  amount: number;
  makerOrderId: string;
  takerOrderId: string;
  createdAt: Date;
}

export class MatchingEngine {
  private static instance: MatchingEngine;
  private books: Map<string, { bids: OrderBookEntry[]; asks: OrderBookEntry[]; stopOrders: OrderBookEntry[] }> = new Map();
  private wsManager: WebSocketManager | null = null;

  private constructor() {}

  public static getInstance(): MatchingEngine {
    if (!MatchingEngine.instance) {
      MatchingEngine.instance = new MatchingEngine();
    }
    return MatchingEngine.instance;
  }

  public setWsManager(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
  }

  // Load all pending and partially filled orders from database on startup
  public async initialize() {
    console.log('Initializing matching engine...');
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED],
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`Loaded ${pendingOrders.length} pending orders from DB.`);

    for (const order of pendingOrders) {
      const symbol = order.symbol;
      if (!this.books.has(symbol)) {
        this.books.set(symbol, { bids: [], asks: [], stopOrders: [] });
      }

      const book = this.books.get(symbol)!;
      const entry: OrderBookEntry = {
        id: order.id,
        userId: order.userId,
        symbol: order.symbol,
        price: order.price || 0,
        amount: order.amount,
        filledAmount: order.filledAmount,
        side: order.side as OrderSide,
        type: order.type as OrderType,
        stopPrice: order.stopPrice,
        createdAt: order.createdAt,
      };

      if (order.type === OrderType.STOP) {
        book.stopOrders.push(entry);
      } else {
        if (order.side === OrderSide.BUY) {
          this.insertSorted(book.bids, entry, OrderSide.BUY);
        } else {
          this.insertSorted(book.asks, entry, OrderSide.SELL);
        }
      }
    }
    console.log('Matching engine initialized.');
  }

  // Helper to insert an order book entry into the correct sorted position
  private insertSorted(list: OrderBookEntry[], entry: OrderBookEntry, side: OrderSide) {
    if (side === OrderSide.BUY) {
      // Bids: descending by price. High prices first.
      // If price is equal, ascending by time (FIFO).
      const index = list.findIndex(
        (item) =>
          item.price < entry.price ||
          (item.price === entry.price && item.createdAt.getTime() > entry.createdAt.getTime())
      );
      if (index === -1) {
        list.push(entry);
      } else {
        list.splice(index, 0, entry);
      }
    } else {
      // Asks: ascending by price. Low prices first.
      // If price is equal, ascending by time (FIFO).
      const index = list.findIndex(
        (item) =>
          item.price > entry.price ||
          (item.price === entry.price && item.createdAt.getTime() > entry.createdAt.getTime())
      );
      if (index === -1) {
        list.push(entry);
      } else {
        list.splice(index, 0, entry);
      }
    }
  }

  // Get active order book structure
  public getOrderBook(symbol: string) {
    const book = this.books.get(symbol) || { bids: [], asks: [] };
    
    // Aggregate by price for UI presentation
    const bidsMap: Map<number, number> = new Map();
    const asksMap: Map<number, number> = new Map();

    book.bids.forEach((b) => {
      const remaining = b.amount - b.filledAmount;
      bidsMap.set(b.price, (bidsMap.get(b.price) || 0) + remaining);
    });

    book.asks.forEach((a) => {
      const remaining = a.amount - a.filledAmount;
      asksMap.set(a.price, (asksMap.get(a.price) || 0) + remaining);
    });

    const bids = Array.from(bidsMap.entries())
      .map(([price, amount]) => ({ price, amount }))
      .sort((a, b) => b.price - a.price); // Descending

    const asks = Array.from(asksMap.entries())
      .map(([price, amount]) => ({ price, amount }))
      .sort((a, b) => a.price - b.price); // Ascending

    return { bids, asks };
  }

  // Get market price (last trade price)
  public async getMarketPrice(symbol: string): Promise<number> {
    const lastTrade = await prisma.trade.findFirst({
      where: { symbol },
      orderBy: { createdAt: 'desc' },
    });
    if (lastTrade) return lastTrade.price;

    // Default base prices if no trades
    const defaults: Record<string, number> = {
      'BTC/USDT': 65000,
      'ETH/USDT': 35000,
      'BNB/USDT': 600,
      'SOL/USDT': 150,
      'XRP/USDT': 0.5,
      'DOGE/USDT': 0.12,
      'ADA/USDT': 0.45,
      'TRX/USDT': 0.11,
      'MATIC/USDT': 0.7,
    };
    return defaults[symbol] || 1.0;
  }

  // Add order to engine
  public async processNewOrder(orderId: string) {
    const dbOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!dbOrder) {
      console.error(`Order ${orderId} not found in database.`);
      return;
    }

    if (dbOrder.status !== OrderStatus.PENDING) {
      return;
    }

    const symbol = dbOrder.symbol;
    if (!this.books.has(symbol)) {
      this.books.set(symbol, { bids: [], asks: [], stopOrders: [] });
    }

    const book = this.books.get(symbol)!;
    const entry: OrderBookEntry = {
      id: dbOrder.id,
      userId: dbOrder.userId,
      symbol: dbOrder.symbol,
      price: dbOrder.price || 0,
      amount: dbOrder.amount,
      filledAmount: dbOrder.filledAmount,
      side: dbOrder.side as OrderSide,
      type: dbOrder.type as OrderType,
      stopPrice: dbOrder.stopPrice,
      createdAt: dbOrder.createdAt,
    };

    if (entry.type === OrderType.STOP) {
      book.stopOrders.push(entry);
      console.log(`Stop order ${entry.id} added to stop list.`);
      this.broadcastOrderBookUpdate(symbol);
      return;
    }

    // Run matching
    await this.matchOrder(symbol, entry);
  }

  // Match order
  private async matchOrder(symbol: string, taker: OrderBookEntry) {
    const book = this.books.get(symbol)!;
    const [baseSymbol, quoteSymbol] = symbol.split('/');

    let remainingTakerAmount = taker.amount - taker.filledAmount;
    let makerQueue = taker.side === OrderSide.BUY ? book.asks : book.bids;
    const trades: TradeResult[] = [];

    // Match loop
    while (remainingTakerAmount > 0 && makerQueue.length > 0) {
      const maker = makerQueue[0];

      // Check price matching compatibility
      if (taker.type === OrderType.LIMIT) {
        if (taker.side === OrderSide.BUY && taker.price < maker.price) break;
        if (taker.side === OrderSide.SELL && taker.price > maker.price) break;
      }

      const matchPrice = maker.price; // Maker's price is the matched execution price
      const remainingMakerAmount = maker.amount - maker.filledAmount;
      const fillAmount = Math.min(remainingTakerAmount, remainingMakerAmount);

      // Settle trade in database using a transactional chain
      try {
        const trade = await this.settleTradeInDb(symbol, baseSymbol, quoteSymbol, taker, maker, fillAmount, matchPrice);
        trades.push(trade);

        // Update levels in-memory
        taker.filledAmount += fillAmount;
        maker.filledAmount += fillAmount;
        remainingTakerAmount -= fillAmount;

        // If maker is filled, remove from list
        if (maker.filledAmount >= maker.amount) {
          makerQueue.shift();
        } else {
          // Maker is partially filled, update the book element in place
          makerQueue[0] = { ...maker };
        }

        // Broadcast user balance & order updates
        this.broadcastUserUpdates(taker.userId);
        this.broadcastUserUpdates(maker.userId);

      } catch (err) {
        console.error('Failed to settle trade in DB, matching cancelled for this step.', err);
        break;
      }
    }

    // Post match updates
    if (remainingTakerAmount > 0) {
      if (taker.type === OrderType.LIMIT) {
        // If taker has remaining amount, insert into takerQueue
        taker.filledAmount = taker.amount - remainingTakerAmount;
        const status = taker.filledAmount > 0 ? OrderStatus.PARTIALLY_FILLED : OrderStatus.PENDING;
        
        await prisma.order.update({
          where: { id: taker.id },
          data: { filledAmount: taker.filledAmount, status },
        });

        const takerQueue = taker.side === OrderSide.BUY ? book.bids : book.asks;
        this.insertSorted(takerQueue, taker, taker.side);
      } else {
        // Market order couldn't be completely filled, cancel or fill remaining as cancelled
        await prisma.order.update({
          where: { id: taker.id },
          data: {
            filledAmount: taker.amount - remainingTakerAmount,
            status: OrderStatus.FILLED, // Market order technically executes immediately, unfilled part is cancelled
          },
        });
      }
    } else {
      // Taker is fully filled
      await prisma.order.update({
        where: { id: taker.id },
        data: { filledAmount: taker.amount, status: OrderStatus.FILLED },
      });
    }

    // If trades occurred, evaluate Stop orders & broadcast
    if (trades.length > 0) {
      const lastPrice = trades[trades.length - 1].price;
      this.broadcastTrades(symbol, trades);
      this.broadcastOrderBookUpdate(symbol);
      this.broadcastTickerUpdate(symbol, lastPrice);

      // Check stop orders trigger condition
      await this.checkStopOrders(symbol, lastPrice);
    } else {
      this.broadcastOrderBookUpdate(symbol);
    }
  }

  // Settle trade balances and fill orders in database transaction
  private async settleTradeInDb(
    symbol: string,
    baseSymbol: string,
    quoteSymbol: string,
    taker: OrderBookEntry,
    maker: OrderBookEntry,
    amount: number,
    price: number
  ): Promise<TradeResult> {
    const cost = amount * price;

    return await prisma.$transaction(async (tx) => {
      // Find asset models
      const baseAsset = await tx.asset.findUniqueOrThrow({ where: { symbol: baseSymbol } });
      const quoteAsset = await tx.asset.findUniqueOrThrow({ where: { symbol: quoteSymbol } });

      // Find user wallets
      const takerBaseWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId_assetId: { userId: taker.userId, assetId: baseAsset.id } },
      });
      const takerQuoteWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId_assetId: { userId: taker.userId, assetId: quoteAsset.id } },
      });
      const makerBaseWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId_assetId: { userId: maker.userId, assetId: baseAsset.id } },
      });
      const makerQuoteWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId_assetId: { userId: maker.userId, assetId: quoteAsset.id } },
      });

      // Transfer assets and unlock
      if (taker.side === OrderSide.BUY) {
        // Taker (Buyer) gets baseAsset, pays quoteAsset.
        // Maker (Seller) gets quoteAsset, pays baseAsset.

        // Buyer (Taker) quote updates: Deduct from balance
        await tx.wallet.update({
          where: { id: takerQuoteWallet.id },
          data: { balance: { decrement: cost } }, // Note: Market orders are not pre-locked, Limit orders are locked
        });

        // Buyer (Taker) base updates: Add to balance
        await tx.wallet.update({
          where: { id: takerBaseWallet.id },
          data: { balance: { increment: amount } },
        });

        // Seller (Maker) base updates: Deduct from locked
        await tx.wallet.update({
          where: { id: makerBaseWallet.id },
          data: { locked: { decrement: amount } },
        });

        // Seller (Maker) quote updates: Add to balance
        await tx.wallet.update({
          where: { id: makerQuoteWallet.id },
          data: { balance: { increment: cost } },
        });
      } else {
        // Taker (Seller) gets quoteAsset, pays baseAsset.
        // Maker (Buyer) gets baseAsset, pays quoteAsset.

        // Seller (Taker) base updates: Deduct from balance
        await tx.wallet.update({
          where: { id: takerBaseWallet.id },
          data: { balance: { decrement: amount } },
        });

        // Seller (Taker) quote updates: Add to balance
        await tx.wallet.update({
          where: { id: takerQuoteWallet.id },
          data: { balance: { increment: cost } },
        });

        // Buyer (Maker) quote updates: Deduct from locked
        await tx.wallet.update({
          where: { id: makerQuoteWallet.id },
          data: { locked: { decrement: cost } },
        });

        // Buyer (Maker) base updates: Add to balance
        await tx.wallet.update({
          where: { id: makerBaseWallet.id },
          data: { balance: { increment: amount } },
        });
      }

      // Update maker order
      const makerStatus = maker.filledAmount + amount >= maker.amount ? OrderStatus.FILLED : OrderStatus.PARTIALLY_FILLED;
      await tx.order.update({
        where: { id: maker.id },
        data: {
          filledAmount: { increment: amount },
          status: makerStatus,
        },
      });

      // Create trade record
      const trade = await tx.trade.create({
        data: {
          symbol,
          price,
          amount,
          makerId: maker.id,
          takerId: taker.id,
        },
      });

      return {
        tradeId: trade.id,
        price: trade.price,
        amount: trade.amount,
        makerOrderId: trade.makerId,
        takerOrderId: trade.takerId,
        createdAt: trade.createdAt,
      };
    });
  }

  // Cancel an active order
  public async cancelOrder(userId: string, orderId: string, symbol: string) {
    const book = this.books.get(symbol);
    if (!book) return false;

    // Search in bids
    let index = book.bids.findIndex((o) => o.id === orderId && o.userId === userId);
    if (index !== -1) {
      const order = book.bids.splice(index, 1)[0];
      await this.unlockOrderBalance(order);
      await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
      this.broadcastOrderBookUpdate(symbol);
      this.broadcastUserUpdates(userId);
      return true;
    }

    // Search in asks
    index = book.asks.findIndex((o) => o.id === orderId && o.userId === userId);
    if (index !== -1) {
      const order = book.asks.splice(index, 1)[0];
      await this.unlockOrderBalance(order);
      await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
      this.broadcastOrderBookUpdate(symbol);
      this.broadcastUserUpdates(userId);
      return true;
    }

    // Search in stops
    index = book.stopOrders.findIndex((o) => o.id === orderId && o.userId === userId);
    if (index !== -1) {
      const order = book.stopOrders.splice(index, 1)[0];
      await this.unlockOrderBalance(order);
      await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
      this.broadcastUserUpdates(userId);
      return true;
    }

    return false;
  }

  // Unlock balance locked in order
  private async unlockOrderBalance(order: OrderBookEntry) {
    const [baseSymbol, quoteSymbol] = order.symbol.split('/');
    const assetSymbol = order.side === OrderSide.BUY ? quoteSymbol : baseSymbol;
    
    const asset = await prisma.asset.findUniqueOrThrow({ where: { symbol: assetSymbol } });
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId_assetId: { userId: order.userId, assetId: asset.id } },
    });

    const remainingAmount = order.amount - order.filledAmount;
    const unlockVolume = order.side === OrderSide.BUY ? remainingAmount * order.price : remainingAmount;

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        locked: { decrement: unlockVolume },
        balance: { increment: unlockVolume },
      },
    });
  }

  // Check and trigger stop orders when price changes
  private async checkStopOrders(symbol: string, price: number) {
    const book = this.books.get(symbol);
    if (!book || book.stopOrders.length === 0) return;

    const triggered: OrderBookEntry[] = [];
    const remaining: OrderBookEntry[] = [];

    // Scan through all stop orders for this pair
    for (const order of book.stopOrders) {
      const triggerPrice = order.stopPrice || 0;
      let shouldTrigger = false;

      // Stop Buy: triggers when price rises above stop price
      if (order.side === OrderSide.BUY && price >= triggerPrice) {
        shouldTrigger = true;
      }
      // Stop Sell: triggers when price falls below stop price
      if (order.side === OrderSide.SELL && price <= triggerPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        triggered.push(order);
      } else {
        remaining.push(order);
      }
    }

    book.stopOrders = remaining;

    for (const order of triggered) {
      console.log(`Triggering stop order ${order.id} at price ${price}.`);
      
      // Update order status in DB to PENDING and remove stopPrice constraint
      await prisma.order.update({
        where: { id: order.id },
        data: {
          type: OrderType.LIMIT, // Convert to Limit order
          status: OrderStatus.PENDING,
        },
      });

      // Recalculate properties and feed it back to matchOrder
      order.type = OrderType.LIMIT;
      await this.matchOrder(symbol, order);
    }
  }

  // WebSocket broadcast helpers
  private broadcastOrderBookUpdate(symbol: string) {
    if (this.wsManager) {
      const bookData = this.getOrderBook(symbol);
      this.wsManager.broadcastToChannel(`market:${symbol}:orderbook`, {
        event: 'orderbook_update',
        symbol,
        data: bookData,
      });
    }
  }

  private broadcastTrades(symbol: string, trades: TradeResult[]) {
    if (this.wsManager) {
      this.wsManager.broadcastToChannel(`market:${symbol}:trades`, {
        event: 'trades_update',
        symbol,
        data: trades.map((t) => ({
          price: t.price,
          amount: t.amount,
          createdAt: t.createdAt,
        })),
      });
    }
  }

  private broadcastTickerUpdate(symbol: string, price: number) {
    if (this.wsManager) {
      this.wsManager.broadcastToChannel(`market:${symbol}:ticker`, {
        event: 'ticker_update',
        symbol,
        price,
        timestamp: new Date(),
      });
    }
  }

  private broadcastUserUpdates(userId: string) {
    if (this.wsManager) {
      this.wsManager.sendToUser(userId, {
        event: 'portfolio_update',
        timestamp: new Date(),
      });
    }
  }
}

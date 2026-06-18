import { db, Order, Wallet, Trade, Asset } from './db';

export interface OrderBookEntry {
  id: string;
  userId: string;
  symbol: string;
  price: number;
  amount: number;
  filledAmount: number;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP';
  stopPrice?: number;
  createdAt: string;
}

export interface TradeResult {
  tradeId: string;
  price: number;
  amount: number;
  makerOrderId: string;
  takerOrderId: string;
  createdAt: string;
}

// In-memory representation of books for matching operations
class LocalMatchingEngine {
  private static instance: LocalMatchingEngine;
  private books: Map<string, { bids: OrderBookEntry[]; asks: OrderBookEntry[]; stopOrders: OrderBookEntry[] }> = new Map();

  private constructor() {}

  public static getInstance(): LocalMatchingEngine {
    if (!LocalMatchingEngine.instance) {
      LocalMatchingEngine.instance = new LocalMatchingEngine();
    }
    return LocalMatchingEngine.instance;
  }

  // Load all pending and partially filled orders from localStorage
  public initialize() {
    this.books.clear();
    const pendingOrders = db.getOrders().filter(
      (order) => order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED'
    );

    // Sort by createdAt ascending (FIFO)
    pendingOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    pendingOrders.forEach((order) => {
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
        side: order.side,
        type: order.type,
        stopPrice: order.stopPrice,
        createdAt: order.createdAt,
      };

      if (order.type === 'STOP') {
        book.stopOrders.push(entry);
      } else {
        if (order.side === 'BUY') {
          this.insertSorted(book.bids, entry, 'BUY');
        } else {
          this.insertSorted(book.asks, entry, 'SELL');
        }
      }
    });
  }

  // Helper to insert an order book entry into correct sorted position
  private insertSorted(list: OrderBookEntry[], entry: OrderBookEntry, side: 'BUY' | 'SELL') {
    if (side === 'BUY') {
      // Bids: descending by price (High prices first), then FIFO
      const index = list.findIndex(
        (item) =>
          item.price < entry.price ||
          (item.price === entry.price && new Date(item.createdAt).getTime() > new Date(entry.createdAt).getTime())
      );
      if (index === -1) {
        list.push(entry);
      } else {
        list.splice(index, 0, entry);
      }
    } else {
      // Asks: ascending by price (Low prices first), then FIFO
      const index = list.findIndex(
        (item) =>
          item.price > entry.price ||
          (item.price === entry.price && new Date(item.createdAt).getTime() > new Date(entry.createdAt).getTime())
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
    this.initialize(); // Always sync state before reading
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
  public getMarketPrice(symbol: string): number {
    const trades = db.getTrades().filter((t) => t.symbol === symbol);
    if (trades.length > 0) {
      // Sort to find latest
      trades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return trades[0].price;
    }

    const defaults: Record<string, number> = {
      'BTC/USDT': 65000,
      'ETH/USDT': 3500,
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

  // Place and match order
  public processNewOrder(orderId: string) {
    this.initialize(); // sync state

    const orders = db.getOrders();
    const dbOrder = orders.find((o) => o.id === orderId);
    if (!dbOrder) {
      console.error(`Order ${orderId} not found.`);
      return;
    }

    if (dbOrder.status !== 'PENDING') return;

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
      side: dbOrder.side,
      type: dbOrder.type,
      stopPrice: dbOrder.stopPrice,
      createdAt: dbOrder.createdAt,
    };

    if (entry.type === 'STOP') {
      book.stopOrders.push(entry);
      console.log(`Stop order ${entry.id} added to stop list.`);
      // Dispatch order book update event
      window.dispatchEvent(new CustomEvent('orderbook_updated', { detail: { symbol } }));
      return;
    }

    // Run matching
    this.matchOrder(symbol, entry);
  }

  // Match order logic
  private matchOrder(symbol: string, taker: OrderBookEntry) {
    const book = this.books.get(symbol)!;
    const [baseSymbol, quoteSymbol] = symbol.split('/');

    let remainingTakerAmount = taker.amount - taker.filledAmount;
    let makerQueue = taker.side === 'BUY' ? book.asks : book.bids;
    const trades: TradeResult[] = [];

    // Match loop
    while (remainingTakerAmount > 0 && makerQueue.length > 0) {
      const maker = makerQueue[0];

      // Check price matching compatibility
      if (taker.type === 'LIMIT') {
        if (taker.side === 'BUY' && taker.price < maker.price) break;
        if (taker.side === 'SELL' && taker.price > maker.price) break;
      }

      const matchPrice = maker.price; // Maker's price is execution price
      const remainingMakerAmount = maker.amount - maker.filledAmount;
      const fillAmount = Math.min(remainingTakerAmount, remainingMakerAmount);

      try {
        const trade = this.settleTrade(symbol, baseSymbol, quoteSymbol, taker, maker, fillAmount, matchPrice);
        trades.push(trade);

        taker.filledAmount += fillAmount;
        maker.filledAmount += fillAmount;
        remainingTakerAmount -= fillAmount;

        if (maker.filledAmount >= maker.amount) {
          makerQueue.shift();
        } else {
          makerQueue[0] = { ...maker };
        }

      } catch (err) {
        console.error('Failed to settle trade in client matching engine:', err);
        break;
      }
    }

    // Save taker status
    const orders = db.getOrders();
    const currentOrderIdx = orders.findIndex((o) => o.id === taker.id);
    if (currentOrderIdx !== -1) {
      if (remainingTakerAmount > 0) {
        if (taker.type === 'LIMIT') {
          taker.filledAmount = taker.amount - remainingTakerAmount;
          orders[currentOrderIdx].filledAmount = taker.filledAmount;
          orders[currentOrderIdx].status = taker.filledAmount > 0 ? 'PARTIALLY_FILLED' : 'PENDING';
          
          const takerQueue = taker.side === 'BUY' ? book.bids : book.asks;
          this.insertSorted(takerQueue, taker, taker.side);
        } else {
          // Market order couldn't be completely filled
          orders[currentOrderIdx].filledAmount = taker.amount - remainingTakerAmount;
          orders[currentOrderIdx].status = 'FILLED'; // filled up to what was available
        }
      } else {
        orders[currentOrderIdx].filledAmount = taker.amount;
        orders[currentOrderIdx].status = 'FILLED';
      }
      db.saveOrders(orders);
    }

    // If trades occurred, dispatch events and check Stop orders
    if (trades.length > 0) {
      const lastPrice = trades[trades.length - 1].price;
      
      // Dispatch events for UI triggers
      window.dispatchEvent(new CustomEvent('trades_updated', { detail: { symbol, trades } }));
      window.dispatchEvent(new CustomEvent('ticker_updated', { detail: { symbol, price: lastPrice } }));
      window.dispatchEvent(new CustomEvent('portfolio_updated'));
      window.dispatchEvent(new CustomEvent('orderbook_updated', { detail: { symbol } }));

      // Check Stop orders trigger
      this.checkStopOrders(symbol, lastPrice);
    } else {
      window.dispatchEvent(new CustomEvent('orderbook_updated', { detail: { symbol } }));
    }
  }

  // Settle trade balances and write to localStorage tables
  private settleTrade(
    symbol: string,
    baseSymbol: string,
    quoteSymbol: string,
    taker: OrderBookEntry,
    maker: OrderBookEntry,
    amount: number,
    price: number
  ): TradeResult {
    const cost = amount * price;

    const assets = db.getAssets();
    const baseAsset = assets.find((a) => a.symbol === baseSymbol)!;
    const quoteAsset = assets.find((a) => a.symbol === quoteSymbol)!;

    const wallets = db.getWallets();
    const takerBaseWallet = wallets.find((w) => w.userId === taker.userId && w.assetId === baseAsset.id)!;
    const takerQuoteWallet = wallets.find((w) => w.userId === taker.userId && w.assetId === quoteAsset.id)!;
    const makerBaseWallet = wallets.find((w) => w.userId === maker.userId && w.assetId === baseAsset.id)!;
    const makerQuoteWallet = wallets.find((w) => w.userId === maker.userId && w.assetId === quoteAsset.id)!;

    // Transfer balances
    if (taker.side === 'BUY') {
      // Taker (Buyer) pays quoteAsset, gets baseAsset
      // Maker (Seller) gets quoteAsset, pays baseAsset (locked funds)
      takerQuoteWallet.balance -= cost;
      takerBaseWallet.balance += amount;
      makerBaseWallet.locked -= amount; // Maker pre-locked this when placing Sell Limit
      makerQuoteWallet.balance += cost;
    } else {
      // Taker (Seller) pays baseAsset, gets quoteAsset
      // Maker (Buyer) gets baseAsset, pays quoteAsset (locked funds)
      takerBaseWallet.balance -= amount;
      takerQuoteWallet.balance += cost;
      makerQuoteWallet.locked -= cost; // Maker pre-locked this when placing Buy Limit
      makerBaseWallet.balance += amount;
    }

    db.saveWallets(wallets);

    // Update maker order status in DB
    const orders = db.getOrders();
    const makerOrderIdx = orders.findIndex((o) => o.id === maker.id);
    if (makerOrderIdx !== -1) {
      orders[makerOrderIdx].filledAmount += amount;
      const isFilled = orders[makerOrderIdx].filledAmount >= orders[makerOrderIdx].amount;
      orders[makerOrderIdx].status = isFilled ? 'FILLED' : 'PARTIALLY_FILLED';
      db.saveOrders(orders);
    }

    // Create trade record
    const trades = db.getTrades();
    const newTrade: Trade = {
      id: `t-${Math.random().toString(36).substring(2, 12)}`,
      symbol,
      price,
      amount,
      makerId: maker.id,
      takerId: taker.id,
      createdAt: new Date().toISOString(),
    };
    trades.unshift(newTrade);
    db.saveTrades(trades);

    // Log audits & notifications
    db.logAudit(taker.userId, 'TRADE_EXECUTION', `Executed trade for ${amount} ${baseSymbol} at ${price} USDT`);
    db.logAudit(maker.userId, 'TRADE_EXECUTION', `Executed trade for ${amount} ${baseSymbol} at ${price} USDT`);

    db.notify(taker.userId, 'Order Execution', `Your order was filled: ${amount} ${baseSymbol} at ${price} USDT`);
    db.notify(maker.userId, 'Order Execution', `Your order was filled: ${amount} ${baseSymbol} at ${price} USDT`);

    return {
      tradeId: newTrade.id,
      price: newTrade.price,
      amount: newTrade.amount,
      makerOrderId: newTrade.makerId,
      takerOrderId: newTrade.takerId,
      createdAt: newTrade.createdAt,
    };
  }

  // Cancel order in client
  public cancelOrder(userId: string, orderId: string, symbol: string): boolean {
    const orders = db.getOrders();
    const orderIdx = orders.findIndex((o) => o.id === orderId && o.userId === userId);
    if (orderIdx === -1) return false;

    const order = orders[orderIdx];
    if (order.status !== 'PENDING' && order.status !== 'PARTIALLY_FILLED') return false;

    // Unlock balance
    const [baseSymbol, quoteSymbol] = symbol.split('/');
    const lockAssetSymbol = order.side === 'BUY' ? quoteSymbol : baseSymbol;

    const assets = db.getAssets();
    const asset = assets.find((a) => a.symbol === lockAssetSymbol)!;

    const wallets = db.getWallets();
    const wallet = wallets.find((w) => w.userId === userId && w.assetId === asset.id)!;

    const remainingAmount = order.amount - order.filledAmount;
    const unlockVolume = order.side === 'BUY' ? remainingAmount * (order.price || 0) : remainingAmount;

    wallet.locked -= unlockVolume;
    wallet.balance += unlockVolume;

    db.saveWallets(wallets);

    // Mark cancelled
    orders[orderIdx].status = 'CANCELLED';
    db.saveOrders(orders);

    db.logAudit(userId, 'ORDER_CANCELLATION', `Cancelled order ${orderId} for ${symbol}`);

    window.dispatchEvent(new CustomEvent('portfolio_updated'));
    window.dispatchEvent(new CustomEvent('orderbook_updated', { detail: { symbol } }));

    return true;
  }

  // Check Stop orders trigger conditions
  private checkStopOrders(symbol: string, price: number) {
    const orders = db.getOrders();
    const stopOrders = orders.filter((o) => o.symbol === symbol && o.status === 'PENDING' && o.type === 'STOP');

    stopOrders.forEach((order) => {
      const triggerPrice = order.stopPrice || 0;
      let shouldTrigger = false;

      if (order.side === 'BUY' && price >= triggerPrice) {
        shouldTrigger = true;
      } else if (order.side === 'SELL' && price <= triggerPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        console.log(`Triggering stop order ${order.id} at ${price}`);
        // Convert to Limit order in DB
        const idx = orders.findIndex((o) => o.id === order.id);
        if (idx !== -1) {
          orders[idx].type = 'LIMIT'; // convert
          orders[idx].stopPrice = undefined;
          db.saveOrders(orders);

          // Process immediately inside match engine
          const entry: OrderBookEntry = {
            id: order.id,
            userId: order.userId,
            symbol: order.symbol,
            price: order.price || 0,
            amount: order.amount,
            filledAmount: order.filledAmount,
            side: order.side,
            type: 'LIMIT',
            createdAt: order.createdAt,
          };
          this.matchOrder(symbol, entry);
        }
      }
    });
  }
}

export const matchingEngine = LocalMatchingEngine.getInstance();
export const MatchingEngine = LocalMatchingEngine;

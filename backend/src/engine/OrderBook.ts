import { OrderItem, TradeResult, MatchResult } from '../types';

export class OrderBook {
  pair: string;
  bids: OrderItem[] = []; // BUY orders: sorted descending by price, then ascending by time
  asks: OrderItem[] = []; // SELL orders: sorted ascending by price, then ascending by time

  constructor(pair: string) {
    this.pair = pair;
  }

  addOrder(order: OrderItem): TradeResult[] {
    if (order.type === 'MARKET') {
      return this.matchMarketOrder(order);
    }
    
    // Check if limit order matches immediately
    const trades = this.matchLimitOrder(order);
    
    // If there is remaining quantity, insert into the book
    if (order.quantity > order.filledQty) {
      if (order.side === 'BUY') {
        this.insertSorted(this.bids, order, 'DESC');
      } else {
        this.insertSorted(this.asks, order, 'ASC');
      }
    }
    return trades;
  }

  cancelOrder(orderId: string, side: 'BUY' | 'SELL'): boolean {
    const list = side === 'BUY' ? this.bids : this.asks;
    const index = list.findIndex(o => o.id === orderId);
    if (index !== -1) {
      list.splice(index, 1);
      return true;
    }
    return false;
  }

  private insertSorted(list: OrderItem[], order: OrderItem, direction: 'ASC' | 'DESC') {
    let low = 0;
    let high = list.length;

    while (low < high) {
      const mid = (low + high) >> 1;
      const comparePrice = list[mid].price;
      
      if (direction === 'ASC') {
        if (order.price < comparePrice) {
          high = mid;
        } else if (order.price > comparePrice) {
          low = mid + 1;
        } else {
          // Same price, sort by time (createdAt)
          if (order.createdAt.getTime() < list[mid].createdAt.getTime()) {
            high = mid;
          } else {
            low = mid + 1;
          }
        }
      } else {
        // DESC
        if (order.price > comparePrice) {
          high = mid;
        } else if (order.price < comparePrice) {
          low = mid + 1;
        } else {
          // Same price, sort by time
          if (order.createdAt.getTime() < list[mid].createdAt.getTime()) {
            high = mid;
          } else {
            low = mid + 1;
          }
        }
      }
    }
    list.splice(low, 0, order);
  }

  private matchLimitOrder(taker: OrderItem): TradeResult[] {
    const trades: TradeResult[] = [];
    const makers = taker.side === 'BUY' ? this.asks : this.bids;
    
    while (makers.length > 0 && taker.quantity > taker.filledQty) {
      const maker = makers[0];
      
      // Check if price matches
      const isMatch = taker.side === 'BUY' 
        ? taker.price >= maker.price 
        : taker.price <= maker.price;

      if (!isMatch) break;

      const tradeQty = Math.min(taker.quantity - taker.filledQty, maker.quantity - maker.filledQty);
      if (tradeQty <= 0) break;

      // Update volumes
      taker.filledQty += tradeQty;
      maker.filledQty += tradeQty;
      
      taker.status = taker.quantity === taker.filledQty ? 'FILLED' : 'PARTIALLY_FILLED';
      maker.status = maker.quantity === maker.filledQty ? 'FILLED' : 'PARTIALLY_FILLED';

      trades.push({
        id: Math.random().toString(36).substring(2, 11),
        pair: this.pair,
        price: maker.price,
        quantity: tradeQty,
        makerOrderId: maker.id,
        takerOrderId: taker.id,
        side: taker.side,
        createdAt: new Date()
      });

      if (maker.status === 'FILLED') {
        makers.shift(); // Remove filled maker
      }
    }

    return trades;
  }

  private matchMarketOrder(taker: OrderItem): TradeResult[] {
    const trades: TradeResult[] = [];
    const makers = taker.side === 'BUY' ? this.asks : this.bids;

    while (makers.length > 0 && taker.quantity > taker.filledQty) {
      const maker = makers[0];
      const tradeQty = Math.min(taker.quantity - taker.filledQty, maker.quantity - maker.filledQty);
      if (tradeQty <= 0) break;

      taker.filledQty += tradeQty;
      maker.filledQty += tradeQty;

      taker.status = taker.quantity === taker.filledQty ? 'FILLED' : 'PARTIALLY_FILLED';
      maker.status = maker.quantity === maker.filledQty ? 'FILLED' : 'PARTIALLY_FILLED';

      trades.push({
        id: Math.random().toString(36).substring(2, 11),
        pair: this.pair,
        price: maker.price, // Market order fills at maker's price
        quantity: tradeQty,
        makerOrderId: maker.id,
        takerOrderId: taker.id,
        side: taker.side,
        createdAt: new Date()
      });

      if (maker.status === 'FILLED') {
        makers.shift();
      }
    }

    if (taker.quantity > taker.filledQty) {
      // Partially filled or completely unfilled market order gets rejected if liquidity runs out
      taker.status = taker.filledQty > 0 ? 'PARTIALLY_FILLED' : 'REJECTED';
    }

    return trades;
  }

  getOrderBookSnapshot() {
    return {
      bids: this.bids.slice(0, 50).map(o => ({ price: o.price, quantity: o.quantity - o.filledQty })),
      asks: this.asks.slice(0, 50).map(o => ({ price: o.price, quantity: o.quantity - o.filledQty }))
    };
  }
}

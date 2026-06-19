export interface OrderItem {
  id: string;
  userId: string;
  pair: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP';
  price: number;
  stopPrice?: number;
  quantity: number;
  filledQty: number;
  status: 'PENDING' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  createdAt: Date;
}

export interface TradeResult {
  id: string;
  pair: string;
  price: number;
  quantity: number;
  makerOrderId: string;
  takerOrderId: string;
  side: 'BUY' | 'SELL';
  createdAt: Date;
}

export interface MatchResult {
  trades: TradeResult[];
  filledTaker: boolean;
  takerFilledQty: number;
}

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { matchingEngine } from '../utils/matchingEngine';

interface WebSocketContextType {
  socket: any | null; // Mock websocket object
  subscribe: (channel: string, callback: (data: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const [tickerPrices, setTickerPrices] = useState<Record<string, number>>({
    'BTC/USDT': 65000,
    'ETH/USDT': 3500,
    'BNB/USDT': 600,
    'SOL/USDT': 150,
    'XRP/USDT': 0.5,
    'DOGE/USDT': 0.12,
    'ADA/USDT': 0.45,
    'TRX/USDT': 0.11,
    'MATIC/USDT': 0.7,
  });

  // Load starting market prices from engine
  useEffect(() => {
    const prices: Record<string, number> = { ...tickerPrices };
    Object.keys(prices).forEach((symbol) => {
      prices[symbol] = matchingEngine.getMarketPrice(symbol);
    });
    setTickerPrices(prices);
  }, []);

  // Helper to trigger callback updates for subscribers of a specific channel
  const triggerChannel = (channel: string, payload: any) => {
    const callbacks = subscribersRef.current.get(channel);
    if (callbacks) {
      callbacks.forEach((cb) => cb(payload));
    }
  };

  useEffect(() => {
    // 1. Setup simulated trading bots interval (updates prices, order books, and trades)
    const interval = setInterval(() => {
      const symbols = Object.keys(tickerPrices);
      
      symbols.forEach((symbol) => {
        // Random price fluctuation (±0.08%)
        const currentPrice = tickerPrices[symbol] || matchingEngine.getMarketPrice(symbol);
        const changePercent = (Math.random() - 0.5) * 0.0016;
        const newPrice = Number((currentPrice * (1 + changePercent)).toFixed(symbol.includes('USDT') && currentPrice < 10 ? 4 : 2));
        
        tickerPrices[symbol] = newPrice;
        
        // Broadcast ticker update
        triggerChannel(`market:${symbol}:ticker`, {
          event: 'ticker_update',
          symbol,
          price: newPrice,
          timestamp: new Date().toISOString(),
        });

        // Broadcast mock trades (50% chance each tick)
        if (Math.random() > 0.5) {
          const mockTradeAmount = Number((Math.random() * (symbol === 'BTC' ? 0.2 : 2.5)).toFixed(4));
          triggerChannel(`market:${symbol}:trades`, {
            event: 'trades_update',
            symbol,
            data: [
              {
                price: newPrice,
                amount: mockTradeAmount,
                createdAt: new Date().toISOString(),
              }
            ]
          });
        }

        // Broadcast order book depth (derived dynamically around the current price)
        const bookData = matchingEngine.getOrderBook(symbol);
        
        // Generate mock bids and asks spreads if order book is thin to keep UI looking premium
        const mockBids = [...bookData.bids];
        const mockAsks = [...bookData.asks];

        for (let i = 1; i <= 10; i++) {
          const bidPrice = Number((newPrice * (1 - i * 0.0005)).toFixed(2));
          const askPrice = Number((newPrice * (1 + i * 0.0005)).toFixed(2));
          const mockAmount = Number((Math.random() * 5 + 0.1).toFixed(3));

          if (!mockBids.some((b) => Math.abs(b.price - bidPrice) < 0.01)) {
            mockBids.push({ price: bidPrice, amount: mockAmount });
          }
          if (!mockAsks.some((a) => Math.abs(a.price - askPrice) < 0.01)) {
            mockAsks.push({ price: askPrice, amount: mockAmount });
          }
        }

        // Sort bids descending, asks ascending
        mockBids.sort((a, b) => b.price - a.price);
        mockAsks.sort((a, b) => a.price - b.price);

        triggerChannel(`market:${symbol}:orderbook`, {
          event: 'orderbook_update',
          symbol,
          data: {
            bids: mockBids.slice(0, 15),
            asks: mockAsks.slice(0, 15),
          }
        });
      });

      setTickerPrices({ ...tickerPrices });
    }, 2500);

    // 2. Setup event interceptors to connect real user operations (matchingEngine triggers) to WebSocket channels
    const handleOrderbookUpdate = (e: any) => {
      const { symbol } = e.detail;
      const bookData = matchingEngine.getOrderBook(symbol);
      triggerChannel(`market:${symbol}:orderbook`, {
        event: 'orderbook_update',
        symbol,
        data: bookData,
      });
    };

    const handleTradesUpdate = (e: any) => {
      const { symbol, trades } = e.detail;
      triggerChannel(`market:${symbol}:trades`, {
        event: 'trades_update',
        symbol,
        data: trades.map((t: any) => ({
          price: t.price,
          amount: t.amount,
          createdAt: t.createdAt,
        })),
      });
    };

    const handleTickerUpdate = (e: any) => {
      const { symbol, price } = e.detail;
      tickerPrices[symbol] = price;
      setTickerPrices({ ...tickerPrices });
      
      triggerChannel(`market:${symbol}:ticker`, {
        event: 'ticker_update',
        symbol,
        price,
        timestamp: new Date().toISOString(),
      });
    };

    const handlePortfolioUpdate = () => {
      triggerChannel('user:updates', {
        event: 'portfolio_update',
        timestamp: new Date().toISOString(),
      });
    };

    window.addEventListener('orderbook_updated', handleOrderbookUpdate);
    window.addEventListener('trades_updated', handleTradesUpdate);
    window.addEventListener('ticker_updated', handleTickerUpdate);
    window.addEventListener('portfolio_updated', handlePortfolioUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('orderbook_updated', handleOrderbookUpdate);
      window.removeEventListener('trades_updated', handleTradesUpdate);
      window.removeEventListener('ticker_updated', handleTickerUpdate);
      window.removeEventListener('portfolio_updated', handlePortfolioUpdate);
    };
  }, [tickerPrices]);

  // Subscribe function that returns an unsubscribe cleanup function
  const subscribe = (channel: string, callback: (data: any) => void) => {
    if (!subscribersRef.current.has(channel)) {
      subscribersRef.current.set(channel, new Set());
    }

    subscribersRef.current.get(channel)!.add(callback);

    // Immediately trigger initial update if it's an orderbook channel
    if (channel.includes(':orderbook')) {
      const symbol = channel.split(':')[1];
      const bookData = matchingEngine.getOrderBook(symbol);
      callback({
        event: 'orderbook_update',
        symbol,
        data: bookData,
      });
    }

    // Return cleanup unsubscribe function
    return () => {
      const callbacks = subscribersRef.current.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          subscribersRef.current.delete(channel);
        }
      }
    };
  };

  // Mock socket is always "online"
  const mockSocket = {
    readyState: 1, // OPEN
    send: (msg: string) => console.log('Mock WS Sent:', msg),
    close: () => {},
  };

  return (
    <WebSocketContext.Provider value={{ socket: mockSocket, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

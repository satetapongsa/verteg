import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  socket: WebSocket | null;
  subscribe: (channel: string, callback: (data: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  
  // Track subscribers by channel
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';
    const finalUrl = token ? `${wsUrl}?token=${token}` : wsUrl;

    console.log('Connecting to WebSocket server:', wsUrl);
    const ws = new WebSocket(finalUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket Connection Established');
      setConnected(true);
      
      // Resubscribe to existing channels if reconnected
      subscribersRef.current.forEach((_, channel) => {
        ws.send(JSON.stringify({ action: 'subscribe', channel }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        // Find which channel this message corresponds to
        let targetChannel = '';
        if (payload.event === 'orderbook_update') {
          targetChannel = `market:${payload.symbol}:orderbook`;
        } else if (payload.event === 'trades_update') {
          targetChannel = `market:${payload.symbol}:trades`;
        } else if (payload.event === 'ticker_update') {
          targetChannel = `market:${payload.symbol}:ticker`;
        } else if (payload.event === 'portfolio_update') {
          targetChannel = `user:updates`; // custom internal channel representation for portfolio
        }

        if (targetChannel) {
          const callbacks = subscribersRef.current.get(targetChannel);
          if (callbacks) {
            callbacks.forEach((cb) => cb(payload));
          }
        } else {
          // Special fallback checking
          subscribersRef.current.forEach((callbacks, channel) => {
            if (payload.channel === channel) {
              callbacks.forEach((cb) => cb(payload.data || payload));
            }
          });
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket Connection Closed. Reconnecting in 3 seconds...');
      setConnected(false);
      socketRef.current = null;
    };

    ws.onerror = (err) => {
      console.error('WebSocket client error:', err);
    };

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [token]);

  // Subscribe function that returns an unsubscribe cleanup function
  const subscribe = (channel: string, callback: (data: any) => void) => {
    if (!subscribersRef.current.has(channel)) {
      subscribersRef.current.set(channel, new Set());
      
      // Send subscription packet to backend if socket is open
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ action: 'subscribe', channel }));
      }
    }

    subscribersRef.current.get(channel)!.add(callback);

    // Return cleanup unsubscribe function
    return () => {
      const callbacks = subscribersRef.current.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          subscribersRef.current.delete(channel);
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ action: 'unsubscribe', channel }));
          }
        }
      }
    };
  };

  return (
    <WebSocketContext.Provider value={{ socket: socketRef.current, subscribe }}>
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

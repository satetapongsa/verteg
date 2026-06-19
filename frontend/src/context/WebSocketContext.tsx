import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  subscribeToPair: (pair: string) => void;
  unsubscribeFromPair: (pair: string) => void;
  registerListener: (event: string, callback: (data: any) => void) => () => void;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const activeSubscriptionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const defaultWsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const baseWsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl;
    const wsUrl = `${baseWsUrl}${token ? (baseWsUrl.includes('?') ? '&' : '?') + `token=${token}` : ''}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // Re-subscribe to any active pairs
      activeSubscriptionsRef.current.forEach(pair => {
        ws.send(JSON.stringify({ event: 'subscribe', data: { pair } }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const callbacks = listenersRef.current.get(payload.event);
        if (callbacks) {
          callbacks.forEach(cb => cb(payload.data));
        }
      } catch (err) {
        console.error('Failed to parse WS payload:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current === ws) {
          // Trigger a reload or reconnection logic if component still mounted
        }
      }, 3000);
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const subscribeToPair = (pair: string) => {
    activeSubscriptionsRef.current.add(pair);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'subscribe', data: { pair } }));
    }
  };

  const unsubscribeFromPair = (pair: string) => {
    activeSubscriptionsRef.current.delete(pair);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'unsubscribe', data: { pair } }));
    }
  };

  const registerListener = (event: string, callback: (data: any) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);

    // Return function to unsubscribe/cleanup
    return () => {
      const callbacks = listenersRef.current.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          listenersRef.current.delete(event);
        }
      }
    };
  };

  return (
    <WebSocketContext.Provider value={{ subscribeToPair, unsubscribeFromPair, registerListener, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used inside a WebSocketProvider');
  return context;
};

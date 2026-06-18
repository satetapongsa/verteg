import { IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import * as jwt from 'jsonwebtoken';

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  channels: Set<string>;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private connections: Map<WebSocket, ClientConnection> = new Map();

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.initialize();
  }

  private initialize() {
    console.log('Initializing WebSocket Manager...');

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // Parse query parameters
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');

      let userId: string | undefined;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'fallback_access_secret') as { userId: string };
          userId = decoded.userId;
          console.log(`WebSocket client authenticated. User ID: ${userId}`);
        } catch (err) {
          console.log('WebSocket client token authentication failed.');
        }
      }

      const connection: ClientConnection = {
        ws,
        userId,
        channels: new Set(),
      };

      this.connections.set(ws, connection);

      ws.on('message', (message: string) => {
        try {
          const payload = JSON.parse(message);
          this.handleMessage(connection, payload);
        } catch (err) {
          ws.send(JSON.stringify({ event: 'error', message: 'Invalid JSON payload' }));
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket client disconnected. User: ${connection.userId || 'Guest'}`);
        this.connections.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('WebSocket client error:', err);
      });

      // Send initial welcome message
      ws.send(JSON.stringify({ event: 'connected', authenticated: !!userId }));
    });
  }

  private handleMessage(conn: ClientConnection, payload: any) {
    const { action, channel } = payload;

    if (!action || !channel) {
      conn.ws.send(JSON.stringify({ event: 'error', message: 'Missing action or channel fields' }));
      return;
    }

    if (action === 'subscribe') {
      // Check if channel is private (e.g. user:*)
      if (channel.startsWith('user:')) {
        const expectedUser = channel.split(':')[1];
        if (!conn.userId || conn.userId !== expectedUser) {
          conn.ws.send(JSON.stringify({ event: 'error', message: 'Unauthorized channel subscription' }));
          return;
        }
      }

      conn.channels.add(channel);
      conn.ws.send(JSON.stringify({ event: 'subscribed', channel }));
      console.log(`Client ${conn.userId || 'Guest'} subscribed to ${channel}`);
    } 
    
    else if (action === 'unsubscribe') {
      conn.channels.delete(channel);
      conn.ws.send(JSON.stringify({ event: 'unsubscribed', channel }));
      console.log(`Client ${conn.userId || 'Guest'} unsubscribed from ${channel}`);
    } 
    
    else {
      conn.ws.send(JSON.stringify({ event: 'error', message: `Unknown action: ${action}` }));
    }
  }

  // Broadcast message to all clients subscribed to a specific channel
  public broadcastToChannel(channel: string, message: any) {
    const rawPayload = JSON.stringify(message);
    this.connections.forEach((conn) => {
      if (conn.channels.has(channel) && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(rawPayload);
      }
    });
  }

  // Send message directly to a specific user
  public sendToUser(userId: string, message: any) {
    const rawPayload = JSON.stringify(message);
    this.connections.forEach((conn) => {
      if (conn.userId === userId && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(rawPayload);
      }
    });
  }
}

import { Server } from 'http';
import { WebSocketServer as WS, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  subscribedPairs: Set<string>;
}

export class WebSocketServer {
  private wss: WS;
  private clients: Set<ClientConnection> = new Set();
  private jwtSecret = process.env.JWT_SECRET || 'supersecretkey';

  constructor(server: Server) {
    this.wss = new WS({ server, path: '/ws' });
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
  }

  private handleConnection(ws: WebSocket, req: any) {
    const connection: ClientConnection = {
      ws,
      subscribedPairs: new Set()
    };
    this.clients.add(connection);

    // Extract token from query params or auth message
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const token = urlParams.get('token');
    if (token) {
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };
        connection.userId = decoded.userId;
      } catch (err) {
        // Invalid token, ignore user channel, keep connection open for public feeds
      }
    }

    ws.on('message', (message: string) => {
      try {
        const payload = JSON.parse(message);
        this.handleMessage(connection, payload);
      } catch (err) {
        ws.send(JSON.stringify({ event: 'error', data: 'Invalid JSON message' }));
      }
    });

    ws.on('close', () => {
      this.clients.delete(connection);
    });
  }

  private handleMessage(connection: ClientConnection, payload: any) {
    const { event, data } = payload;

    switch (event) {
      case 'subscribe':
        if (data.pair) {
          connection.subscribedPairs.add(data.pair);
          connection.ws.send(JSON.stringify({ event: 'subscribed', data: { pair: data.pair } }));
        }
        break;
      case 'unsubscribe':
        if (data.pair) {
          connection.subscribedPairs.delete(data.pair);
          connection.ws.send(JSON.stringify({ event: 'unsubscribed', data: { pair: data.pair } }));
        }
        break;
      case 'auth':
        if (data.token) {
          try {
            const decoded = jwt.verify(data.token, this.jwtSecret) as { userId: string };
            connection.userId = decoded.userId;
            connection.ws.send(JSON.stringify({ event: 'authenticated', data: { userId: decoded.userId } }));
          } catch (err) {
            connection.ws.send(JSON.stringify({ event: 'error', data: 'Authentication failed' }));
          }
        }
        break;
      case 'ping':
        connection.ws.send(JSON.stringify({ event: 'pong' }));
        break;
      default:
        connection.ws.send(JSON.stringify({ event: 'error', data: `Unknown event: ${event}` }));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(event: string, data: any) {
    const payload = JSON.stringify({ event, data });
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  /**
   * Broadcast message to users subscribed to a specific trading pair
   */
  public broadcastToPair(pair: string, event: string, data: any) {
    const payload = JSON.stringify({ event, data, pair });
    for (const client of this.clients) {
      if (client.subscribedPairs.has(pair) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  /**
   * Send message to a specific authenticated user
   */
  public sendToUser(userId: string, event: string, data: any) {
    const payload = JSON.stringify({ event, data });
    for (const client of this.clients) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}

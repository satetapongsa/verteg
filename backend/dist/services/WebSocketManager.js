"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
const ws_1 = require("ws");
const jwt = __importStar(require("jsonwebtoken"));
class WebSocketManager {
    wss;
    connections = new Map();
    constructor(wss) {
        this.wss = wss;
        this.initialize();
    }
    initialize() {
        console.log('Initializing WebSocket Manager...');
        this.wss.on('connection', (ws, req) => {
            // Parse query parameters
            const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
            const token = url.searchParams.get('token');
            let userId;
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'fallback_access_secret');
                    userId = decoded.userId;
                    console.log(`WebSocket client authenticated. User ID: ${userId}`);
                }
                catch (err) {
                    console.log('WebSocket client token authentication failed.');
                }
            }
            const connection = {
                ws,
                userId,
                channels: new Set(),
            };
            this.connections.set(ws, connection);
            ws.on('message', (message) => {
                try {
                    const payload = JSON.parse(message);
                    this.handleMessage(connection, payload);
                }
                catch (err) {
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
    handleMessage(conn, payload) {
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
    broadcastToChannel(channel, message) {
        const rawPayload = JSON.stringify(message);
        this.connections.forEach((conn) => {
            if (conn.channels.has(channel) && conn.ws.readyState === ws_1.WebSocket.OPEN) {
                conn.ws.send(rawPayload);
            }
        });
    }
    // Send message directly to a specific user
    sendToUser(userId, message) {
        const rawPayload = JSON.stringify(message);
        this.connections.forEach((conn) => {
            if (conn.userId === userId && conn.ws.readyState === ws_1.WebSocket.OPEN) {
                conn.ws.send(rawPayload);
            }
        });
    }
}
exports.WebSocketManager = WebSocketManager;

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load env variables
dotenv.config();

import authRoutes from './routes/authRoutes';
import walletRoutes from './routes/walletRoutes';
import tradeRoutes from './routes/tradeRoutes';
import adminRoutes from './routes/adminRoutes';

import { WebSocketServer } from './ws/WebSocketServer';
import { MatchingEngine } from './engine/MatchingEngine';

const app = express();
const server = http.createServer(app);

// Enable security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Basic rate limiting (relaxed for local development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 10000, // 10,000 requests for development
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/admin', adminRoutes);

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize WebSocket Server
const wsServer = new WebSocketServer(server);

// Bind WebSocket to matching engine
const matchingEngine = MatchingEngine.getInstance();
matchingEngine.setWebSocketServer(wsServer);

// Startup matching engine and boot server
const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    console.log('Syncing matching engine order book state from Database...');
    await matchingEngine.initializeFromDatabase();
    console.log('Matching engine initialized.');

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`WebSockets active at /ws`);
    });
  } catch (err) {
    console.error('Failed to initialize platform services:', err);
    process.exit(1);
  }
}

bootstrap();
export { app, server };

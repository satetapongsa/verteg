import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import apiRouter from './routes/api';
import { WebSocketManager } from './services/WebSocketManager';
import { MatchingEngine } from './services/MatchingEngine';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Security settings
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173', // Vite default port
    credentials: true,
  })
);
app.use(express.json());

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(globalLimiter);

// Auth Route Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // stricter limit for login/register
  message: 'Too many authentication attempts, please try again later',
});
app.use('/api/auth/*', authLimiter);

// Mount API routes
app.use('/api', apiRouter);

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

// Setup WebSockets
const wss = new WebSocketServer({ noServer: true });
const wsManager = new WebSocketManager(wss);

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Start Server & Matching Engine
const startServer = async () => {
  try {
    // Inject WebSocket dependency into matching engine
    const engine = MatchingEngine.getInstance();
    engine.setWsManager(wsManager);
    
    // Load historical open orders from the database
    await engine.initialize();

    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`  Crypto Exchange Server running on port ${PORT}`);
      console.log(`  WebSocket Server attached and ready`);
      console.log(`===============================================`);
    });
  } catch (error) {
    console.error('Failed to start servers:', error);
    process.exit(1);
  }
};

startServer();

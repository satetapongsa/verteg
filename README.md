# Verteg - Enterprise Crypto Exchange Platform

Verteg is an enterprise-grade cryptocurrency trading platform featuring sub-millisecond in-memory order book matching, full multi-network wallet address generation, Google 2FA security, real-time WebSocket price updates, and responsive dashboard panels.

---

## Repository Structure

```
platfrome/
├── docker-compose.yml       # Orchestrates PostgreSQL, Node, and Nginx
├── package.json             # Root monorepo dev scripts
├── backend/
│   ├── prisma/              # Prisma DB schemas (PostgreSQL)
│   ├── src/
│   │   ├── engine/          # Matching engine (OrderBook, MatchingEngine)
│   │   ├── controllers/     # API request handlers
│   │   ├── middleware/      # Auth, rate limiting
│   │   ├── routes/          # Route maps
│   │   ├── services/        # Crypto, Wallet generator
│   │   ├── ws/              # WebSocket Server
│   │   └── app.ts           # App bootstrap
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── components/      # Shared components (Navbar)
    │   ├── context/         # Auth & WS Providers
    │   ├── pages/           # Landing, Trade, Wallet, Admin, Settings
    │   ├── store/           # Redux Toolkit UI state
    │   └── App.tsx
    ├── tailwind.config.js
    └── index.html
```

---

## Matching Engine Architecture

The platform uses a deterministic in-memory Order Book matching engine. 

1. **Balance Lock (Escrow)**: Placing a LIMIT Buy order locks `price * quantity` of the quote asset (e.g. USDT) in the user's wallet. Placing a SELL order locks the base asset quantity (e.g. BTC).
2. **Order Queues**: Buy orders (bids) are sorted descending by price, then ascending by time. Sell orders (asks) are sorted ascending by price, then ascending by time.
3. **Execution**: Incoming orders are matched against opposing queues. Partially filled maker orders are updated in-place. Fully matched orders are removed.
4. **Database Persistence**: Matches generate Trade records, update Order states, and release/adjust corresponding Wallet locked balances asynchronously inside single atomic database transactions.
5. **WebSocket Broadcast**: Matched executions trigger real-time orderbook snapshots, recent trades list, 24h ticker info, and direct user order update notifications.

---

## API Endpoints Reference

### Authentication API
- `POST /api/auth/register`: Create account. Generates 10 default wallets.
- `POST /api/auth/login`: Email/password login. Checks 2FA code if active. Returns JWT session token.
- `POST /api/auth/2fa/setup`: Generates Google Authenticator secret key and QR code data URL.
- `POST /api/auth/2fa/verify`: Submits 6-digit TOTP token to activate 2FA permanent check.
- `POST /api/auth/2fa/disable`: Disables 2FA verification.

### Wallet API
- `GET /api/wallet/balances`: List active balances (available & locked) for all 10 coins.
- `GET /api/wallet/deposit/:coinSymbol`: Fetch generated deposit address and scan QR code.
- `POST /api/wallet/withdraw`: Submit withdrawal request. Deducts funds and locks in escrow. Enforces 2FA.
- `GET /api/wallet/transactions`: Fetch transaction history.
- `POST /api/wallet/simulate-deposit`: Sandbox simulator to test deposits.

### Trading API
- `POST /api/trade/order`: Submit a LIMIT or MARKET order.
- `DELETE /api/trade/order/:orderId`: Cancel a pending order and release locked funds.
- `GET /api/trade/open`: Fetch user's active open orders.
- `GET /api/trade/history`: Fetch user's order placement history.
- `GET /api/trade/orderbook/:pair`: Public endpoint for current order book spread.
- `GET /api/trade/recent-trades/:pair`: Public list of the latest matched trades.

### Admin API (Restricted)
- `GET /api/admin/users`: List users and freeze statuses.
- `POST /api/admin/users/:userId/freeze`: Toggle account freeze.
- `GET /api/admin/withdrawals`: Fetch pending withdrawal approvals.
- `POST /api/admin/withdrawals/:transactionId/review`: Approve or reject withdrawal.
- `GET /api/admin/stats`: Get trade volumes and cumulative fees.
- `GET /api/admin/logs`: Access security event audit logs.

---

## Running the Platform

### Option 1: Docker Compose (Recommended)

To launch the full production-ready suite (PostgreSQL database, Node backend, and Nginx serving the compiled React client) run:

```bash
docker-compose up --build
```

- **Frontend Interface**: Access at `http://localhost` (Port 80).
- **Backend API**: Accessible at `http://localhost:5000`.
- **Admin Accounts**: Any user registration ending with `@exchange.admin` (e.g. `root@exchange.admin`) is automatically assigned the `ADMIN` role.

### Option 2: Local Development

1. **Spin up local PostgreSQL** instance and set environment variables in `backend/.env`.
2. **Setup Backend**:
   ```bash
   cd backend
   npm install
   npx prisma migrate dev
   npm run dev
   ```
3. **Setup Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

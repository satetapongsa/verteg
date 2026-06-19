# VERTEX PRO - Complete Conversation History & System Architecture Report

This report summarizes the entire development lifecycle, architectural design, debugging cycles, and final production deployment configurations of the **VERTEX PRO** crypto exchange platform. 

---

## 1. Phase 1: Core Setup & Database Architecture

We initiated a monorepo structure separating `/backend` (Node/Express/TS) and `/frontend` (Vite/React 19/TS).

### Database Schema (`backend/prisma/schema.prisma`)
Configured a PostgreSQL schema via Prisma defining the core transactional models:
* `User`: Managed profiles, passwords (hashed), role definitions (`USER` / `ADMIN`), freezing parameters, and Google 2FA details.
* `Wallet`: Monitored balances and escrow locks (`locked`) for assets (BTC, ETH, USDT, BNB, SOL, XRP, DOGE, ADA, TRX, MATIC). Stored encrypted address private keys.
* `Order`: Managed Limit, Market, and Stop orders.
* `Trade`: Tracked executed order match transactions.
* `Transaction`: Audited deposits, withdrawals, and transfer trails.
* `KycDetails` & `AuditLog` & `Session` & `Notification`: Provided compliance auditing, notifications, and security logs.

---

## 2. Phase 2: High-Performance Backend & Matching Engine

### In-Memory Matching Engine (`backend/src/engine/`)
To achieve sub-millisecond execution times, we built a stateful, in-memory matching engine:
* **`OrderBook.ts`**: Maintained binary-sorted collections of bids (sorted descending by price) and asks (sorted ascending). Supports instantaneous limit and market order matches, extracting trade results, and pruning completed orders.
* **`MatchingEngine.ts`**: The central coordinator managing matching queues for each asset pair. It loads pending order queues from the database on startup, coordinates matches, updates DB balances atomically, and triggers WebSocket broadcasts.

### Security & Compliance Services (`backend/src/services/`)
* **`CryptoService.ts`**: Implemented AES-256-GCM symmetric encryption to securely store mock wallet private keys in the PostgreSQL database.
* **`WalletService.ts`**: Automated address generation mockups for BTC, EVM, SOL, TRX, and DOGE.
* **TOTP Multi-Factor Authentication**: Integrated Google Authenticator verification protocols using `otplib` and `qrcode` generation.

---

## 3. Phase 3: Premium Frontend Build (React 19 & Tailwind)

Designed a premium dark-themed visual architecture (`#0A0E17` background, `#111827` cards, custom scrollbars) utilizing Redux Toolkit state stores and responsive layouts:
* `LandingPage.tsx`: Implemented hero features, animated stats, and direct Binance WebSocket tickers.
* `LoginPage.tsx` & `RegisterPage.tsx`: Standard forms with Google 2FA checks and password visibility eye-toggles.
* `DashboardPage.tsx`: Rendered total portfolio values, Recharts asset allocation pie-charts, and recent transaction history.
* `TradingPage.tsx`: Responsive terminal placing the fullscreen-enabled TradingView chart on the left, and the Buy/Sell entry panel + scrolling compact Order Book on the right.
* `WalletPage.tsx`: Interactive dashboard to copy deposit addresses, trigger network simulators, and request withdrawals with 2FA TOTP verification.
* `SettingsPage.tsx`: Generated QR codes for instant Google Authenticator onboarding.
* `AdminDashboardPage.tsx`: Review user verification submissions, approve withdrawals, freeze accounts, and review audit logs.

---

## 4. Phase 4: Production Deployment

Orchestrated a secure cloud release using two different approaches:
1. **Container Orchestration (`docker-compose.yml` & `nginx.conf`)**: Enables complete execution of backend server, frontend proxy, and PostgresDB inside any VPS (DigitalOcean/AWS).
2. **Cloud Server Platforms**:
   * **Backend (`Render.com`)**: Configured dynamic Node environment running backend Docker container connecting directly to Neon.tech AWS hosted PostgreSQL server.
   * **Frontend (`Vercel.com`)**: Pushed React build pipeline directly connected to Render REST and WebSockets.

---

## 5. Critical Debugging & Hotfix Log

During deployment, we solved several critical production-level issues:

### 1. Vercel SPA Refresh 404
* **Problem**: Refreshing sub-routes like `/register` or `/trade` returned a Vercel 404 error because the build was optimized for static asset paths.
* **Fix**: Created `frontend/vercel.json` configuring rewrites redirection:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

### 2. Vercel Peer Dependencies Conflict (React 19)
* **Problem**: Vercel `npm install` failed due to conflicting peer requirements on packages like `lucide-react` looking for React 18.
* **Fix**: Placed `.npmrc` inside `frontend/` folder to bypass peer dependency warnings automatically:
  ```text
  legacy-peer-deps=true
  ```

### 3. TypeScript Strict Compiler Warnings
* **Problem**: `"noUnusedLocals": true` and `"noUnusedParameters": true` inside `tsconfig.json` threw syntax errors during Vercel build.
* **Fix**: Set parameters to `false` and added `"types": ["vite/client"]` to resolve the `import.meta.env` type resolution.

### 4. Render Database Client Runtime Failure
* **Problem**: Docker run stage threw `@prisma/client did not initialize yet`.
* **Fix**: Added `RUN npx prisma generate` inside the production runtime step of the `backend/Dockerfile`.

### 5. API Endpoint URL Disconnection
* **Problem**: Setting `VITE_API_URL` to `https://verteg-backend.onrender.com` without `/api` threw `Endpoint not found` backend 404.
* **Fix**: Added dynamic URL sanitization inside `frontend/src/utils/api.ts` to automatically format endpoints with `/api` suffix.

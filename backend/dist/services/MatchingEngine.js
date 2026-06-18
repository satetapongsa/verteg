"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchingEngine = void 0;
const db_1 = require("../config/db");
const db_2 = require("../types/db");
class MatchingEngine {
    static instance;
    books = new Map();
    wsManager = null;
    constructor() { }
    static getInstance() {
        if (!MatchingEngine.instance) {
            MatchingEngine.instance = new MatchingEngine();
        }
        return MatchingEngine.instance;
    }
    setWsManager(wsManager) {
        this.wsManager = wsManager;
    }
    // Load all pending and partially filled orders from database on startup
    async initialize() {
        console.log('Initializing matching engine...');
        const pendingOrders = await db_1.prisma.order.findMany({
            where: {
                status: {
                    in: [db_2.OrderStatus.PENDING, db_2.OrderStatus.PARTIALLY_FILLED],
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
        console.log(`Loaded ${pendingOrders.length} pending orders from DB.`);
        for (const order of pendingOrders) {
            const symbol = order.symbol;
            if (!this.books.has(symbol)) {
                this.books.set(symbol, { bids: [], asks: [], stopOrders: [] });
            }
            const book = this.books.get(symbol);
            const entry = {
                id: order.id,
                userId: order.userId,
                symbol: order.symbol,
                price: order.price || 0,
                amount: order.amount,
                filledAmount: order.filledAmount,
                side: order.side,
                type: order.type,
                stopPrice: order.stopPrice,
                createdAt: order.createdAt,
            };
            if (order.type === db_2.OrderType.STOP) {
                book.stopOrders.push(entry);
            }
            else {
                if (order.side === db_2.OrderSide.BUY) {
                    this.insertSorted(book.bids, entry, db_2.OrderSide.BUY);
                }
                else {
                    this.insertSorted(book.asks, entry, db_2.OrderSide.SELL);
                }
            }
        }
        console.log('Matching engine initialized.');
    }
    // Helper to insert an order book entry into the correct sorted position
    insertSorted(list, entry, side) {
        if (side === db_2.OrderSide.BUY) {
            // Bids: descending by price. High prices first.
            // If price is equal, ascending by time (FIFO).
            const index = list.findIndex((item) => item.price < entry.price ||
                (item.price === entry.price && item.createdAt.getTime() > entry.createdAt.getTime()));
            if (index === -1) {
                list.push(entry);
            }
            else {
                list.splice(index, 0, entry);
            }
        }
        else {
            // Asks: ascending by price. Low prices first.
            // If price is equal, ascending by time (FIFO).
            const index = list.findIndex((item) => item.price > entry.price ||
                (item.price === entry.price && item.createdAt.getTime() > entry.createdAt.getTime()));
            if (index === -1) {
                list.push(entry);
            }
            else {
                list.splice(index, 0, entry);
            }
        }
    }
    // Get active order book structure
    getOrderBook(symbol) {
        const book = this.books.get(symbol) || { bids: [], asks: [] };
        // Aggregate by price for UI presentation
        const bidsMap = new Map();
        const asksMap = new Map();
        book.bids.forEach((b) => {
            const remaining = b.amount - b.filledAmount;
            bidsMap.set(b.price, (bidsMap.get(b.price) || 0) + remaining);
        });
        book.asks.forEach((a) => {
            const remaining = a.amount - a.filledAmount;
            asksMap.set(a.price, (asksMap.get(a.price) || 0) + remaining);
        });
        const bids = Array.from(bidsMap.entries())
            .map(([price, amount]) => ({ price, amount }))
            .sort((a, b) => b.price - a.price); // Descending
        const asks = Array.from(asksMap.entries())
            .map(([price, amount]) => ({ price, amount }))
            .sort((a, b) => a.price - b.price); // Ascending
        return { bids, asks };
    }
    // Get market price (last trade price)
    async getMarketPrice(symbol) {
        const lastTrade = await db_1.prisma.trade.findFirst({
            where: { symbol },
            orderBy: { createdAt: 'desc' },
        });
        if (lastTrade)
            return lastTrade.price;
        // Default base prices if no trades
        const defaults = {
            'BTC/USDT': 65000,
            'ETH/USDT': 35000,
            'BNB/USDT': 600,
            'SOL/USDT': 150,
            'XRP/USDT': 0.5,
            'DOGE/USDT': 0.12,
            'ADA/USDT': 0.45,
            'TRX/USDT': 0.11,
            'MATIC/USDT': 0.7,
        };
        return defaults[symbol] || 1.0;
    }
    // Add order to engine
    async processNewOrder(orderId) {
        const dbOrder = await db_1.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!dbOrder) {
            console.error(`Order ${orderId} not found in database.`);
            return;
        }
        if (dbOrder.status !== db_2.OrderStatus.PENDING) {
            return;
        }
        const symbol = dbOrder.symbol;
        if (!this.books.has(symbol)) {
            this.books.set(symbol, { bids: [], asks: [], stopOrders: [] });
        }
        const book = this.books.get(symbol);
        const entry = {
            id: dbOrder.id,
            userId: dbOrder.userId,
            symbol: dbOrder.symbol,
            price: dbOrder.price || 0,
            amount: dbOrder.amount,
            filledAmount: dbOrder.filledAmount,
            side: dbOrder.side,
            type: dbOrder.type,
            stopPrice: dbOrder.stopPrice,
            createdAt: dbOrder.createdAt,
        };
        if (entry.type === db_2.OrderType.STOP) {
            book.stopOrders.push(entry);
            console.log(`Stop order ${entry.id} added to stop list.`);
            this.broadcastOrderBookUpdate(symbol);
            return;
        }
        // Run matching
        await this.matchOrder(symbol, entry);
    }
    // Match order
    async matchOrder(symbol, taker) {
        const book = this.books.get(symbol);
        const [baseSymbol, quoteSymbol] = symbol.split('/');
        let remainingTakerAmount = taker.amount - taker.filledAmount;
        let makerQueue = taker.side === db_2.OrderSide.BUY ? book.asks : book.bids;
        const trades = [];
        // Match loop
        while (remainingTakerAmount > 0 && makerQueue.length > 0) {
            const maker = makerQueue[0];
            // Check price matching compatibility
            if (taker.type === db_2.OrderType.LIMIT) {
                if (taker.side === db_2.OrderSide.BUY && taker.price < maker.price)
                    break;
                if (taker.side === db_2.OrderSide.SELL && taker.price > maker.price)
                    break;
            }
            const matchPrice = maker.price; // Maker's price is the matched execution price
            const remainingMakerAmount = maker.amount - maker.filledAmount;
            const fillAmount = Math.min(remainingTakerAmount, remainingMakerAmount);
            // Settle trade in database using a transactional chain
            try {
                const trade = await this.settleTradeInDb(symbol, baseSymbol, quoteSymbol, taker, maker, fillAmount, matchPrice);
                trades.push(trade);
                // Update levels in-memory
                taker.filledAmount += fillAmount;
                maker.filledAmount += fillAmount;
                remainingTakerAmount -= fillAmount;
                // If maker is filled, remove from list
                if (maker.filledAmount >= maker.amount) {
                    makerQueue.shift();
                }
                else {
                    // Maker is partially filled, update the book element in place
                    makerQueue[0] = { ...maker };
                }
                // Broadcast user balance & order updates
                this.broadcastUserUpdates(taker.userId);
                this.broadcastUserUpdates(maker.userId);
            }
            catch (err) {
                console.error('Failed to settle trade in DB, matching cancelled for this step.', err);
                break;
            }
        }
        // Post match updates
        if (remainingTakerAmount > 0) {
            if (taker.type === db_2.OrderType.LIMIT) {
                // If taker has remaining amount, insert into takerQueue
                taker.filledAmount = taker.amount - remainingTakerAmount;
                const status = taker.filledAmount > 0 ? db_2.OrderStatus.PARTIALLY_FILLED : db_2.OrderStatus.PENDING;
                await db_1.prisma.order.update({
                    where: { id: taker.id },
                    data: { filledAmount: taker.filledAmount, status },
                });
                const takerQueue = taker.side === db_2.OrderSide.BUY ? book.bids : book.asks;
                this.insertSorted(takerQueue, taker, taker.side);
            }
            else {
                // Market order couldn't be completely filled, cancel or fill remaining as cancelled
                await db_1.prisma.order.update({
                    where: { id: taker.id },
                    data: {
                        filledAmount: taker.amount - remainingTakerAmount,
                        status: db_2.OrderStatus.FILLED, // Market order technically executes immediately, unfilled part is cancelled
                    },
                });
            }
        }
        else {
            // Taker is fully filled
            await db_1.prisma.order.update({
                where: { id: taker.id },
                data: { filledAmount: taker.amount, status: db_2.OrderStatus.FILLED },
            });
        }
        // If trades occurred, evaluate Stop orders & broadcast
        if (trades.length > 0) {
            const lastPrice = trades[trades.length - 1].price;
            this.broadcastTrades(symbol, trades);
            this.broadcastOrderBookUpdate(symbol);
            this.broadcastTickerUpdate(symbol, lastPrice);
            // Check stop orders trigger condition
            await this.checkStopOrders(symbol, lastPrice);
        }
        else {
            this.broadcastOrderBookUpdate(symbol);
        }
    }
    // Settle trade balances and fill orders in database transaction
    async settleTradeInDb(symbol, baseSymbol, quoteSymbol, taker, maker, amount, price) {
        const cost = amount * price;
        return await db_1.prisma.$transaction(async (tx) => {
            // Find asset models
            const baseAsset = await tx.asset.findUniqueOrThrow({ where: { symbol: baseSymbol } });
            const quoteAsset = await tx.asset.findUniqueOrThrow({ where: { symbol: quoteSymbol } });
            // Find user wallets
            const takerBaseWallet = await tx.wallet.findUniqueOrThrow({
                where: { userId_assetId: { userId: taker.userId, assetId: baseAsset.id } },
            });
            const takerQuoteWallet = await tx.wallet.findUniqueOrThrow({
                where: { userId_assetId: { userId: taker.userId, assetId: quoteAsset.id } },
            });
            const makerBaseWallet = await tx.wallet.findUniqueOrThrow({
                where: { userId_assetId: { userId: maker.userId, assetId: baseAsset.id } },
            });
            const makerQuoteWallet = await tx.wallet.findUniqueOrThrow({
                where: { userId_assetId: { userId: maker.userId, assetId: quoteAsset.id } },
            });
            // Transfer assets and unlock
            if (taker.side === db_2.OrderSide.BUY) {
                // Taker (Buyer) gets baseAsset, pays quoteAsset.
                // Maker (Seller) gets quoteAsset, pays baseAsset.
                // Buyer (Taker) quote updates: Deduct from balance
                await tx.wallet.update({
                    where: { id: takerQuoteWallet.id },
                    data: { balance: { decrement: cost } }, // Note: Market orders are not pre-locked, Limit orders are locked
                });
                // Buyer (Taker) base updates: Add to balance
                await tx.wallet.update({
                    where: { id: takerBaseWallet.id },
                    data: { balance: { increment: amount } },
                });
                // Seller (Maker) base updates: Deduct from locked
                await tx.wallet.update({
                    where: { id: makerBaseWallet.id },
                    data: { locked: { decrement: amount } },
                });
                // Seller (Maker) quote updates: Add to balance
                await tx.wallet.update({
                    where: { id: makerQuoteWallet.id },
                    data: { balance: { increment: cost } },
                });
            }
            else {
                // Taker (Seller) gets quoteAsset, pays baseAsset.
                // Maker (Buyer) gets baseAsset, pays quoteAsset.
                // Seller (Taker) base updates: Deduct from balance
                await tx.wallet.update({
                    where: { id: takerBaseWallet.id },
                    data: { balance: { decrement: amount } },
                });
                // Seller (Taker) quote updates: Add to balance
                await tx.wallet.update({
                    where: { id: takerQuoteWallet.id },
                    data: { balance: { increment: cost } },
                });
                // Buyer (Maker) quote updates: Deduct from locked
                await tx.wallet.update({
                    where: { id: makerQuoteWallet.id },
                    data: { locked: { decrement: cost } },
                });
                // Buyer (Maker) base updates: Add to balance
                await tx.wallet.update({
                    where: { id: makerBaseWallet.id },
                    data: { balance: { increment: amount } },
                });
            }
            // Update maker order
            const makerStatus = maker.filledAmount + amount >= maker.amount ? db_2.OrderStatus.FILLED : db_2.OrderStatus.PARTIALLY_FILLED;
            await tx.order.update({
                where: { id: maker.id },
                data: {
                    filledAmount: { increment: amount },
                    status: makerStatus,
                },
            });
            // Create trade record
            const trade = await tx.trade.create({
                data: {
                    symbol,
                    price,
                    amount,
                    makerId: maker.id,
                    takerId: taker.id,
                },
            });
            return {
                tradeId: trade.id,
                price: trade.price,
                amount: trade.amount,
                makerOrderId: trade.makerId,
                takerOrderId: trade.takerId,
                createdAt: trade.createdAt,
            };
        });
    }
    // Cancel an active order
    async cancelOrder(userId, orderId, symbol) {
        const book = this.books.get(symbol);
        if (!book)
            return false;
        // Search in bids
        let index = book.bids.findIndex((o) => o.id === orderId && o.userId === userId);
        if (index !== -1) {
            const order = book.bids.splice(index, 1)[0];
            await this.unlockOrderBalance(order);
            await db_1.prisma.order.update({ where: { id: orderId }, data: { status: db_2.OrderStatus.CANCELLED } });
            this.broadcastOrderBookUpdate(symbol);
            this.broadcastUserUpdates(userId);
            return true;
        }
        // Search in asks
        index = book.asks.findIndex((o) => o.id === orderId && o.userId === userId);
        if (index !== -1) {
            const order = book.asks.splice(index, 1)[0];
            await this.unlockOrderBalance(order);
            await db_1.prisma.order.update({ where: { id: orderId }, data: { status: db_2.OrderStatus.CANCELLED } });
            this.broadcastOrderBookUpdate(symbol);
            this.broadcastUserUpdates(userId);
            return true;
        }
        // Search in stops
        index = book.stopOrders.findIndex((o) => o.id === orderId && o.userId === userId);
        if (index !== -1) {
            const order = book.stopOrders.splice(index, 1)[0];
            await this.unlockOrderBalance(order);
            await db_1.prisma.order.update({ where: { id: orderId }, data: { status: db_2.OrderStatus.CANCELLED } });
            this.broadcastUserUpdates(userId);
            return true;
        }
        return false;
    }
    // Unlock balance locked in order
    async unlockOrderBalance(order) {
        const [baseSymbol, quoteSymbol] = order.symbol.split('/');
        const assetSymbol = order.side === db_2.OrderSide.BUY ? quoteSymbol : baseSymbol;
        const asset = await db_1.prisma.asset.findUniqueOrThrow({ where: { symbol: assetSymbol } });
        const wallet = await db_1.prisma.wallet.findUniqueOrThrow({
            where: { userId_assetId: { userId: order.userId, assetId: asset.id } },
        });
        const remainingAmount = order.amount - order.filledAmount;
        const unlockVolume = order.side === db_2.OrderSide.BUY ? remainingAmount * order.price : remainingAmount;
        await db_1.prisma.wallet.update({
            where: { id: wallet.id },
            data: {
                locked: { decrement: unlockVolume },
                balance: { increment: unlockVolume },
            },
        });
    }
    // Check and trigger stop orders when price changes
    async checkStopOrders(symbol, price) {
        const book = this.books.get(symbol);
        if (!book || book.stopOrders.length === 0)
            return;
        const triggered = [];
        const remaining = [];
        // Scan through all stop orders for this pair
        for (const order of book.stopOrders) {
            const triggerPrice = order.stopPrice || 0;
            let shouldTrigger = false;
            // Stop Buy: triggers when price rises above stop price
            if (order.side === db_2.OrderSide.BUY && price >= triggerPrice) {
                shouldTrigger = true;
            }
            // Stop Sell: triggers when price falls below stop price
            if (order.side === db_2.OrderSide.SELL && price <= triggerPrice) {
                shouldTrigger = true;
            }
            if (shouldTrigger) {
                triggered.push(order);
            }
            else {
                remaining.push(order);
            }
        }
        book.stopOrders = remaining;
        for (const order of triggered) {
            console.log(`Triggering stop order ${order.id} at price ${price}.`);
            // Update order status in DB to PENDING and remove stopPrice constraint
            await db_1.prisma.order.update({
                where: { id: order.id },
                data: {
                    type: db_2.OrderType.LIMIT, // Convert to Limit order
                    status: db_2.OrderStatus.PENDING,
                },
            });
            // Recalculate properties and feed it back to matchOrder
            order.type = db_2.OrderType.LIMIT;
            await this.matchOrder(symbol, order);
        }
    }
    // WebSocket broadcast helpers
    broadcastOrderBookUpdate(symbol) {
        if (this.wsManager) {
            const bookData = this.getOrderBook(symbol);
            this.wsManager.broadcastToChannel(`market:${symbol}:orderbook`, {
                event: 'orderbook_update',
                symbol,
                data: bookData,
            });
        }
    }
    broadcastTrades(symbol, trades) {
        if (this.wsManager) {
            this.wsManager.broadcastToChannel(`market:${symbol}:trades`, {
                event: 'trades_update',
                symbol,
                data: trades.map((t) => ({
                    price: t.price,
                    amount: t.amount,
                    createdAt: t.createdAt,
                })),
            });
        }
    }
    broadcastTickerUpdate(symbol, price) {
        if (this.wsManager) {
            this.wsManager.broadcastToChannel(`market:${symbol}:ticker`, {
                event: 'ticker_update',
                symbol,
                price,
                timestamp: new Date(),
            });
        }
    }
    broadcastUserUpdates(userId) {
        if (this.wsManager) {
            this.wsManager.sendToUser(userId, {
                event: 'portfolio_update',
                timestamp: new Date(),
            });
        }
    }
}
exports.MatchingEngine = MatchingEngine;

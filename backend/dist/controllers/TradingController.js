"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderHistory = exports.getUserTrades = exports.getOpenOrders = exports.cancelOrder = exports.placeOrder = void 0;
const db_1 = require("../config/db");
const db_2 = require("../types/db");
const MatchingEngine_1 = require("../services/MatchingEngine");
const placeOrder = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { symbol, side, type, price, amount, stopPrice } = req.body;
        if (!symbol || !side || !type || !amount) {
            return res.status(400).json({ message: 'Missing required fields (symbol, side, type, amount)' });
        }
        const orderSide = side;
        const orderType = type;
        const orderAmount = parseFloat(amount);
        const orderPrice = price ? parseFloat(price) : null;
        const orderStopPrice = stopPrice ? parseFloat(stopPrice) : null;
        if (isNaN(orderAmount) || orderAmount <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than zero' });
        }
        if (orderType === db_2.OrderType.LIMIT && (!orderPrice || isNaN(orderPrice) || orderPrice <= 0)) {
            return res.status(400).json({ message: 'Valid price is required for Limit orders' });
        }
        if (orderType === db_2.OrderType.STOP && (!orderStopPrice || isNaN(orderStopPrice) || orderStopPrice <= 0)) {
            return res.status(400).json({ message: 'Valid stop price is required for Stop orders' });
        }
        const [baseSymbol, quoteSymbol] = symbol.split('/');
        if (!baseSymbol || !quoteSymbol) {
            return res.status(400).json({ message: 'Invalid symbol format. Use BASE/QUOTE (e.g. BTC/USDT)' });
        }
        const baseAsset = await db_1.prisma.asset.findUnique({ where: { symbol: baseSymbol } });
        const quoteAsset = await db_1.prisma.asset.findUnique({ where: { symbol: quoteSymbol } });
        if (!baseAsset || !quoteAsset) {
            return res.status(400).json({ message: 'Assets not supported' });
        }
        // Get wallets
        const baseWallet = await db_1.prisma.wallet.findUnique({
            where: { userId_assetId: { userId, assetId: baseAsset.id } },
        });
        const quoteWallet = await db_1.prisma.wallet.findUnique({
            where: { userId_assetId: { userId, assetId: quoteAsset.id } },
        });
        if (!baseWallet || !quoteWallet) {
            return res.status(400).json({ message: 'User wallets not found. Please contact support.' });
        }
        // Balance check and locking
        let lockVolume = 0;
        let walletToLock = baseWallet;
        if (orderSide === db_2.OrderSide.BUY) {
            walletToLock = quoteWallet;
            if (orderType === db_2.OrderType.LIMIT) {
                lockVolume = orderAmount * orderPrice;
            }
            else if (orderType === db_2.OrderType.STOP) {
                // Stop-limit or stop-market: we lock estimate using stop price or limit price
                lockVolume = orderAmount * (orderPrice || orderStopPrice);
            }
            else {
                // Market BUY: check current market price
                const currentPrice = await MatchingEngine_1.MatchingEngine.getInstance().getMarketPrice(symbol);
                lockVolume = orderAmount * currentPrice;
            }
        }
        else {
            // SELL order: we lock the base asset
            walletToLock = baseWallet;
            lockVolume = orderAmount;
        }
        if (walletToLock.balance < lockVolume) {
            return res.status(400).json({
                message: `Insufficient balance. Required: ${lockVolume.toFixed(4)} ${orderSide === db_2.OrderSide.BUY ? quoteSymbol : baseSymbol}, Available: ${walletToLock.balance.toFixed(4)}`,
            });
        }
        // Create order and lock balance in DB transaction
        const newOrder = await db_1.prisma.$transaction(async (tx) => {
            // Lock balance in wallet (not for Market orders as they settle immediately, but let's lock them to avoid double spend during processing)
            await tx.wallet.update({
                where: { id: walletToLock.id },
                data: {
                    balance: { decrement: lockVolume },
                    locked: { increment: lockVolume },
                },
            });
            // Create Order DB entry
            return await tx.order.create({
                data: {
                    userId,
                    symbol,
                    side: orderSide,
                    type: orderType,
                    price: orderPrice,
                    stopPrice: orderStopPrice,
                    amount: orderAmount,
                    status: db_2.OrderStatus.PENDING,
                },
            });
        });
        // Send order to Matching Engine to execute asynchronous matching
        MatchingEngine_1.MatchingEngine.getInstance().processNewOrder(newOrder.id);
        return res.status(201).json({
            message: 'Order placed successfully',
            order: newOrder,
        });
    }
    catch (err) {
        console.error('Place order error:', err);
        return res.status(500).json({ message: 'Internal server error while placing order' });
    }
};
exports.placeOrder = placeOrder;
const cancelOrder = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { orderId } = req.params;
        const order = await db_1.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.userId !== userId) {
            return res.status(403).json({ message: 'Unauthorized action' });
        }
        if (order.status !== db_2.OrderStatus.PENDING && order.status !== db_2.OrderStatus.PARTIALLY_FILLED) {
            return res.status(400).json({ message: `Order cannot be cancelled. Status: ${order.status}` });
        }
        const success = await MatchingEngine_1.MatchingEngine.getInstance().cancelOrder(userId, orderId, order.symbol);
        if (success) {
            return res.status(200).json({ message: 'Order cancelled successfully' });
        }
        else {
            return res.status(400).json({ message: 'Failed to cancel order' });
        }
    }
    catch (err) {
        console.error('Cancel order error:', err);
        return res.status(500).json({ message: 'Internal server error while cancelling order' });
    }
};
exports.cancelOrder = cancelOrder;
const getOpenOrders = async (req, res) => {
    try {
        const userId = req.user.userId;
        const orders = await db_1.prisma.order.findMany({
            where: {
                userId,
                status: { in: [db_2.OrderStatus.PENDING, db_2.OrderStatus.PARTIALLY_FILLED] },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({ orders });
    }
    catch (err) {
        console.error('Get open orders error:', err);
        return res.status(500).json({ message: 'Internal server error fetching open orders' });
    }
};
exports.getOpenOrders = getOpenOrders;
const getUserTrades = async (req, res) => {
    try {
        const userId = req.user.userId;
        const trades = await db_1.prisma.trade.findMany({
            where: {
                OR: [
                    { maker: { userId } },
                    { taker: { userId } },
                ],
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({ trades });
    }
    catch (err) {
        console.error('Get user trades error:', err);
        return res.status(500).json({ message: 'Internal server error fetching user trades' });
    }
};
exports.getUserTrades = getUserTrades;
const getOrderHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const orders = await db_1.prisma.order.findMany({
            where: {
                userId,
                status: { notIn: [db_2.OrderStatus.PENDING, db_2.OrderStatus.PARTIALLY_FILLED] },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return res.status(200).json({ orders });
    }
    catch (err) {
        console.error('Get order history error:', err);
        return res.status(500).json({ message: 'Internal server error fetching order history' });
    }
};
exports.getOrderHistory = getOrderHistory;

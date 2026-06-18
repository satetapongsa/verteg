"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketOverview = exports.getTicker = exports.getRecentTrades = exports.getOrderBook = exports.getAssets = void 0;
const db_1 = require("../config/db");
const MatchingEngine_1 = require("../services/MatchingEngine");
const getAssets = async (req, res) => {
    try {
        const assets = await db_1.prisma.asset.findMany({
            where: { isActive: true },
            orderBy: { symbol: 'asc' },
        });
        return res.status(200).json({ assets });
    }
    catch (err) {
        console.error('Get assets error:', err);
        return res.status(500).json({ message: 'Internal server error while fetching assets' });
    }
};
exports.getAssets = getAssets;
const getOrderBook = async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!symbol) {
            return res.status(400).json({ message: 'Symbol parameter is required' });
        }
        const orderBook = MatchingEngine_1.MatchingEngine.getInstance().getOrderBook(symbol);
        return res.status(200).json(orderBook);
    }
    catch (err) {
        console.error('Get orderbook error:', err);
        return res.status(500).json({ message: 'Internal server error fetching orderbook' });
    }
};
exports.getOrderBook = getOrderBook;
const getRecentTrades = async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!symbol) {
            return res.status(400).json({ message: 'Symbol parameter is required' });
        }
        const trades = await db_1.prisma.trade.findMany({
            where: { symbol },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                price: true,
                amount: true,
                createdAt: true,
            },
        });
        return res.status(200).json({ trades });
    }
    catch (err) {
        console.error('Get recent trades error:', err);
        return res.status(500).json({ message: 'Internal server error fetching recent trades' });
    }
};
exports.getRecentTrades = getRecentTrades;
const getTicker = async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!symbol) {
            return res.status(400).json({ message: 'Symbol parameter is required' });
        }
        const lastPrice = await MatchingEngine_1.MatchingEngine.getInstance().getMarketPrice(symbol);
        // Calculate 24h stats
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const trades = await db_1.prisma.trade.findMany({
            where: {
                symbol,
                createdAt: { gte: oneDayAgo },
            },
            orderBy: { createdAt: 'asc' },
        });
        let high = lastPrice;
        let low = lastPrice;
        let volume = 0;
        let openPrice = lastPrice;
        let priceChange = 0;
        let priceChangePercent = 0;
        if (trades.length > 0) {
            openPrice = trades[0].price;
            const prices = trades.map((t) => t.price);
            high = Math.max(...prices, lastPrice);
            low = Math.min(...prices, lastPrice);
            volume = trades.reduce((sum, t) => sum + t.amount, 0);
            priceChange = lastPrice - openPrice;
            priceChangePercent = (priceChange / openPrice) * 100;
        }
        return res.status(200).json({
            symbol,
            lastPrice,
            high,
            low,
            volume,
            priceChange,
            priceChangePercent,
        });
    }
    catch (err) {
        console.error('Get ticker error:', err);
        return res.status(500).json({ message: 'Internal server error fetching ticker data' });
    }
};
exports.getTicker = getTicker;
const getMarketOverview = async (req, res) => {
    try {
        const assets = await db_1.prisma.asset.findMany({
            where: { isActive: true, symbol: { not: 'USDT' } },
        });
        const overview = [];
        for (const asset of assets) {
            const symbol = `${asset.symbol}/USDT`;
            const lastPrice = await MatchingEngine_1.MatchingEngine.getInstance().getMarketPrice(symbol);
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const trades = await db_1.prisma.trade.findMany({
                where: {
                    symbol,
                    createdAt: { gte: oneDayAgo },
                },
                orderBy: { createdAt: 'asc' },
            });
            let high = lastPrice;
            let low = lastPrice;
            let volume = 0;
            let openPrice = lastPrice;
            let priceChangePercent = 0;
            if (trades.length > 0) {
                openPrice = trades[0].price;
                const prices = trades.map((t) => t.price);
                high = Math.max(...prices, lastPrice);
                low = Math.min(...prices, lastPrice);
                volume = trades.reduce((sum, t) => sum + t.amount, 0);
                priceChangePercent = ((lastPrice - openPrice) / openPrice) * 100;
            }
            else {
                // Mock some small randomized movements to make frontend dashboard look alive
                const seedValue = Math.sin(asset.symbol.charCodeAt(0) + Date.now() / 10000000);
                priceChangePercent = seedValue * 5; // -5% to +5%
                high = lastPrice * (1 + Math.abs(priceChangePercent) / 100);
                low = lastPrice * (1 - Math.abs(priceChangePercent) / 100);
                volume = Math.floor(Math.abs(seedValue) * 10000);
            }
            overview.push({
                symbol,
                name: asset.name,
                lastPrice,
                high,
                low,
                volume,
                priceChangePercent,
            });
        }
        return res.status(200).json({ markets: overview });
    }
    catch (err) {
        console.error('Get market overview error:', err);
        return res.status(500).json({ message: 'Internal server error fetching markets' });
    }
};
exports.getMarketOverview = getMarketOverview;

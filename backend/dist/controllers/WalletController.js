"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockDeposit = exports.getTransactionHistory = exports.requestWithdrawal = exports.getDepositAddress = exports.getBalances = void 0;
const db_1 = require("../config/db");
const db_2 = require("../types/db");
const getBalances = async (req, res) => {
    try {
        const userId = req.user.userId;
        const wallets = await db_1.prisma.wallet.findMany({
            where: { userId },
            include: {
                asset: true,
            },
            orderBy: {
                asset: {
                    symbol: 'asc',
                },
            },
        });
        return res.status(200).json({
            wallets: wallets.map((w) => ({
                id: w.id,
                symbol: w.asset.symbol,
                name: w.asset.name,
                network: w.asset.network,
                balance: w.balance,
                locked: w.locked,
                address: w.address,
            })),
        });
    }
    catch (err) {
        console.error('Get balances error:', err);
        return res.status(500).json({ message: 'Internal server error while fetching balances' });
    }
};
exports.getBalances = getBalances;
const getDepositAddress = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { symbol } = req.params;
        const asset = await db_1.prisma.asset.findUnique({ where: { symbol } });
        if (!asset || !asset.isActive) {
            return res.status(404).json({ message: 'Asset not found or inactive' });
        }
        const wallet = await db_1.prisma.wallet.findUnique({
            where: {
                userId_assetId: {
                    userId,
                    assetId: asset.id,
                },
            },
        });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found for this asset' });
        }
        return res.status(200).json({
            symbol: asset.symbol,
            network: asset.network,
            address: wallet.address,
        });
    }
    catch (err) {
        console.error('Get deposit address error:', err);
        return res.status(500).json({ message: 'Internal server error fetching deposit address' });
    }
};
exports.getDepositAddress = getDepositAddress;
// Request withdrawal of funds
const requestWithdrawal = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { symbol, amount, address } = req.body;
        if (!symbol || !amount || !address) {
            return res.status(400).json({ message: 'Symbol, amount, and destination address are required' });
        }
        const withdrawAmount = parseFloat(amount);
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
            return res.status(400).json({ message: 'Amount must be positive' });
        }
        const asset = await db_1.prisma.asset.findUnique({ where: { symbol } });
        if (!asset || !asset.isActive) {
            return res.status(400).json({ message: 'Asset not found or inactive' });
        }
        if (withdrawAmount < asset.minWithdraw) {
            return res.status(400).json({ message: `Minimum withdrawal is ${asset.minWithdraw} ${symbol}` });
        }
        const fee = asset.withdrawFee;
        const totalDeduction = withdrawAmount + fee;
        const wallet = await db_1.prisma.wallet.findUnique({
            where: { userId_assetId: { userId, assetId: asset.id } },
        });
        if (!wallet || wallet.balance < totalDeduction) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }
        // Perform transaction: Deduct balance, add to locked, create withdrawal request
        const withdrawal = await db_1.prisma.$transaction(async (tx) => {
            await tx.wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: { decrement: totalDeduction },
                    locked: { increment: totalDeduction },
                },
            });
            const w = await tx.withdrawal.create({
                data: {
                    walletId: wallet.id,
                    toAddress: address,
                    amount: withdrawAmount,
                    fee,
                    status: db_2.TransactionStatus.PENDING,
                },
            });
            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'WITHDRAW_REQUEST',
                    details: `Requested withdrawal of ${withdrawAmount} ${symbol} to ${address}. Fee: ${fee}`,
                },
            });
            return w;
        });
        return res.status(201).json({
            message: 'Withdrawal request submitted successfully. Awaiting admin approval.',
            withdrawal: {
                id: withdrawal.id,
                amount: withdrawal.amount,
                fee: withdrawal.fee,
                status: withdrawal.status,
                createdAt: withdrawal.createdAt,
            },
        });
    }
    catch (err) {
        console.error('Withdrawal error:', err);
        return res.status(500).json({ message: 'Internal server error during withdrawal request' });
    }
};
exports.requestWithdrawal = requestWithdrawal;
// Get transaction history (deposits + withdrawals)
const getTransactionHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const wallets = await db_1.prisma.wallet.findMany({
            where: { userId },
            select: { id: true, asset: { select: { symbol: true } } },
        });
        const walletIds = wallets.map((w) => w.id);
        const walletSymbolMap = wallets.reduce((acc, curr) => {
            acc[curr.id] = curr.asset.symbol;
            return acc;
        }, {});
        const deposits = await db_1.prisma.deposit.findMany({
            where: { walletId: { in: walletIds } },
            orderBy: { createdAt: 'desc' },
        });
        const withdrawals = await db_1.prisma.withdrawal.findMany({
            where: { walletId: { in: walletIds } },
            orderBy: { createdAt: 'desc' },
        });
        // Format together
        const formattedDeposits = deposits.map((d) => ({
            id: d.id,
            type: 'DEPOSIT',
            symbol: walletSymbolMap[d.walletId],
            amount: d.amount,
            fee: 0.0,
            status: d.status,
            address: 'Internal Chain',
            txHash: d.txHash,
            createdAt: d.createdAt,
        }));
        const formattedWithdrawals = withdrawals.map((w) => ({
            id: w.id,
            type: 'WITHDRAWAL',
            symbol: walletSymbolMap[w.walletId],
            amount: w.amount,
            fee: w.fee,
            status: w.status,
            address: w.toAddress,
            txHash: w.txHash,
            createdAt: w.createdAt,
        }));
        const history = [...formattedDeposits, ...formattedWithdrawals].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return res.status(200).json({ history });
    }
    catch (err) {
        console.error('History fetch error:', err);
        return res.status(500).json({ message: 'Internal server error fetching transactions' });
    }
};
exports.getTransactionHistory = getTransactionHistory;
// MOCK DEPOSIT (For development & demo testing)
const mockDeposit = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { symbol, amount } = req.body;
        if (!symbol || !amount) {
            return res.status(400).json({ message: 'Symbol and amount are required' });
        }
        const depositAmount = parseFloat(amount);
        if (isNaN(depositAmount) || depositAmount <= 0) {
            return res.status(400).json({ message: 'Deposit amount must be positive' });
        }
        const asset = await db_1.prisma.asset.findUnique({ where: { symbol } });
        if (!asset || !asset.isActive) {
            return res.status(400).json({ message: 'Asset not found or inactive' });
        }
        const wallet = await db_1.prisma.wallet.findUnique({
            where: { userId_assetId: { userId, assetId: asset.id } },
        });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' });
        }
        const txHash = `mock_tx_${Math.random().toString(36).substring(2, 15)}${Date.now().toString(36)}`;
        // DB transaction: Credit balance and record deposit
        const deposit = await db_1.prisma.$transaction(async (tx) => {
            await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: depositAmount } },
            });
            const dep = await tx.deposit.create({
                data: {
                    walletId: wallet.id,
                    txHash,
                    amount: depositAmount,
                    status: db_2.TransactionStatus.COMPLETED,
                },
            });
            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'DEPOSIT_MOCK',
                    details: `Simulated deposit of ${depositAmount} ${symbol}. TxHash: ${txHash}`,
                },
            });
            return dep;
        });
        return res.status(201).json({
            message: `Deposit of ${depositAmount} ${symbol} successful (Mock Blockchain Sync)`,
            deposit,
        });
    }
    catch (err) {
        console.error('Mock deposit error:', err);
        return res.status(500).json({ message: 'Internal server error simulating deposit' });
    }
};
exports.mockDeposit = mockDeposit;

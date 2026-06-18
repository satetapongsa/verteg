"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemStats = exports.rejectWithdrawal = exports.approveWithdrawal = exports.getPendingWithdrawals = exports.toggleUserFreeze = exports.getUsers = void 0;
const db_1 = require("../config/db");
const db_2 = require("../types/db");
const getUsers = async (req, res) => {
    try {
        const users = await db_1.prisma.user.findMany({
            include: {
                kyc: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({
            users: users.map((u) => ({
                id: u.id,
                email: u.email,
                role: u.role,
                isFrozen: u.isFrozen,
                is2faEnabled: u.is2faEnabled,
                createdAt: u.createdAt,
                kyc: u.kyc ? {
                    firstName: u.kyc.firstName,
                    lastName: u.kyc.lastName,
                    documentId: u.kyc.documentId,
                    status: u.kyc.status,
                } : null,
            })),
        });
    }
    catch (err) {
        console.error('Admin getUsers error:', err);
        return res.status(500).json({ message: 'Internal server error listing users' });
    }
};
exports.getUsers = getUsers;
const toggleUserFreeze = async (req, res) => {
    try {
        const { userId } = req.params;
        const { freeze } = req.body; // boolean
        if (freeze === undefined) {
            return res.status(400).json({ message: 'Freeze flag status required' });
        }
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.role === db_2.Role.ADMIN) {
            return res.status(400).json({ message: 'Cannot freeze administrator accounts' });
        }
        const updatedUser = await db_1.prisma.user.update({
            where: { id: userId },
            data: { isFrozen: freeze },
        });
        await db_1.prisma.auditLog.create({
            data: {
                userId: req.user.userId,
                action: freeze ? 'FREEZE_USER' : 'UNFREEZE_USER',
                details: `${freeze ? 'Froze' : 'Unfroze'} user account: ${user.email} (${userId})`,
            },
        });
        return res.status(200).json({
            message: `User account has been successfully ${freeze ? 'frozen' : 'unfrozen'}.`,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                isFrozen: updatedUser.isFrozen,
            },
        });
    }
    catch (err) {
        console.error('Admin freeze toggle error:', err);
        return res.status(500).json({ message: 'Internal server error toggling freeze state' });
    }
};
exports.toggleUserFreeze = toggleUserFreeze;
const getPendingWithdrawals = async (req, res) => {
    try {
        const withdrawals = await db_1.prisma.withdrawal.findMany({
            where: { status: db_2.TransactionStatus.PENDING },
            include: {
                wallet: {
                    include: {
                        user: { select: { email: true } },
                        asset: { select: { symbol: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({
            withdrawals: withdrawals.map((w) => ({
                id: w.id,
                email: w.wallet.user.email,
                symbol: w.wallet.asset.symbol,
                address: w.toAddress,
                amount: w.amount,
                fee: w.fee,
                status: w.status,
                createdAt: w.createdAt,
            })),
        });
    }
    catch (err) {
        console.error('Admin pending withdrawals error:', err);
        return res.status(500).json({ message: 'Internal server error loading pending withdrawals' });
    }
};
exports.getPendingWithdrawals = getPendingWithdrawals;
const approveWithdrawal = async (req, res) => {
    try {
        const { withdrawalId } = req.params;
        const withdrawal = await db_1.prisma.withdrawal.findUnique({
            where: { id: withdrawalId },
            include: { wallet: { include: { asset: true } } },
        });
        if (!withdrawal) {
            return res.status(404).json({ message: 'Withdrawal request not found' });
        }
        if (withdrawal.status !== db_2.TransactionStatus.PENDING) {
            return res.status(400).json({ message: `Withdrawal already processed. Status: ${withdrawal.status}` });
        }
        const txHash = `0x${Math.random().toString(36).substring(2, 15)}${Date.now().toString(36)}`;
        const totalDeduction = withdrawal.amount + withdrawal.fee;
        await db_1.prisma.$transaction(async (tx) => {
            // Deduct from locked balance
            await tx.wallet.update({
                where: { id: withdrawal.walletId },
                data: {
                    locked: { decrement: totalDeduction },
                },
            });
            // Update withdrawal record
            await tx.withdrawal.update({
                where: { id: withdrawalId },
                data: {
                    status: db_2.TransactionStatus.COMPLETED,
                    txHash,
                },
            });
            // Log action
            await tx.auditLog.create({
                data: {
                    userId: req.user.userId,
                    action: 'APPROVE_WITHDRAWAL',
                    details: `Approved withdrawal of ${withdrawal.amount} ${withdrawal.wallet.asset.symbol} (ID: ${withdrawalId})`,
                },
            });
        });
        return res.status(200).json({
            message: 'Withdrawal approved successfully',
            txHash,
        });
    }
    catch (err) {
        console.error('Admin approve withdrawal error:', err);
        return res.status(500).json({ message: 'Internal server error approving withdrawal' });
    }
};
exports.approveWithdrawal = approveWithdrawal;
const rejectWithdrawal = async (req, res) => {
    try {
        const { withdrawalId } = req.params;
        const withdrawal = await db_1.prisma.withdrawal.findUnique({
            where: { id: withdrawalId },
            include: { wallet: { include: { asset: true } } },
        });
        if (!withdrawal) {
            return res.status(404).json({ message: 'Withdrawal request not found' });
        }
        if (withdrawal.status !== db_2.TransactionStatus.PENDING) {
            return res.status(400).json({ message: `Withdrawal already processed. Status: ${withdrawal.status}` });
        }
        const totalDeduction = withdrawal.amount + withdrawal.fee;
        await db_1.prisma.$transaction(async (tx) => {
            // Revert from locked to standard balance
            await tx.wallet.update({
                where: { id: withdrawal.walletId },
                data: {
                    locked: { decrement: totalDeduction },
                    balance: { increment: totalDeduction },
                },
            });
            // Update withdrawal record
            await tx.withdrawal.update({
                where: { id: withdrawalId },
                data: {
                    status: db_2.TransactionStatus.REJECTED,
                },
            });
            // Log action
            await tx.auditLog.create({
                data: {
                    userId: req.user.userId,
                    action: 'REJECT_WITHDRAWAL',
                    details: `Rejected withdrawal of ${withdrawal.amount} ${withdrawal.wallet.asset.symbol} (ID: ${withdrawalId})`,
                },
            });
        });
        return res.status(200).json({
            message: 'Withdrawal rejected successfully. Funds returned.',
        });
    }
    catch (err) {
        console.error('Admin reject withdrawal error:', err);
        return res.status(500).json({ message: 'Internal server error rejecting withdrawal' });
    }
};
exports.rejectWithdrawal = rejectWithdrawal;
const getSystemStats = async (req, res) => {
    try {
        const totalUsers = await db_1.prisma.user.count();
        // Sum of successful deposits
        const deposits = await db_1.prisma.deposit.aggregate({
            _sum: { amount: true },
        });
        // Sum of successful withdrawals & fees
        const withdrawals = await db_1.prisma.withdrawal.aggregate({
            where: { status: db_2.TransactionStatus.COMPLETED },
            _sum: { amount: true, fee: true },
        });
        // Total Trades & Volume
        const trades = await db_1.prisma.trade.findMany({});
        const totalTrades = trades.length;
        const totalVolume = trades.reduce((sum, t) => sum + (t.amount * t.price), 0);
        return res.status(200).json({
            stats: {
                totalUsers,
                totalDeposited: deposits._sum.amount || 0,
                totalWithdrawn: withdrawals._sum.amount || 0,
                totalRevenue: withdrawals._sum.fee || 0, // withdrawal fees make up platform revenue
                totalTrades,
                totalTradingVolume: totalVolume,
            },
        });
    }
    catch (err) {
        console.error('Admin stats error:', err);
        return res.status(500).json({ message: 'Internal server error getting system stats' });
    }
};
exports.getSystemStats = getSystemStats;

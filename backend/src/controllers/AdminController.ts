import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';

const prisma = new PrismaClient();

export class AdminController {
  public static async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          isFrozen: true,
          twoFactorEnabled: true,
          createdAt: true,
          kyc: {
            select: {
              id: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(users);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async toggleFreezeUser(req: AuthenticatedRequest, res: Response) {
    const { userId } = req.params;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isFrozen: !user.isFrozen }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.userId!,
          action: updatedUser.isFrozen ? 'FREEZE_USER' : 'UNFREEZE_USER',
          ipAddress: req.ip || '127.0.0.1',
          details: `Target User ID: ${userId}`
        }
      });

      return res.status(200).json({ message: `User account status updated`, isFrozen: updatedUser.isFrozen });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getKycSubmissions(req: AuthenticatedRequest, res: Response) {
    try {
      const submissions = await prisma.kycDetails.findMany({
        include: {
          user: {
            select: { email: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });
      return res.status(200).json(submissions);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async reviewKyc(req: AuthenticatedRequest, res: Response) {
    const { kycId } = req.params;
    const { status } = req.body; // APPROVED or REJECTED

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid KYC status' });
    }

    try {
      const kyc = await prisma.kycDetails.update({
        where: { id: kycId },
        data: { status }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId: req.userId!,
          action: `KYC_${status}`,
          ipAddress: req.ip || '127.0.0.1',
          details: `Target KYC ID: ${kycId}`
        }
      });

      return res.status(200).json({ message: `KYC submission ${status.toLowerCase()}`, kyc });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getPendingWithdrawals(req: AuthenticatedRequest, res: Response) {
    try {
      const withdrawals = await prisma.transaction.findMany({
        where: {
          type: 'WITHDRAWAL',
          status: 'PENDING'
        },
        include: {
          wallet: {
            include: {
              user: {
                select: { email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(withdrawals);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async reviewWithdrawal(req: AuthenticatedRequest, res: Response) {
    const { transactionId } = req.params;
    const { action } = req.body; // APPROVE or REJECT

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be APPROVE or REJECT' });
    }

    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { wallet: true }
      });

      if (!transaction || transaction.type !== 'WITHDRAWAL' || transaction.status !== 'PENDING') {
        return res.status(400).json({ error: 'Invalid or closed transaction' });
      }

      const totalDeduction = Number(transaction.amount) + Number(transaction.fee);

      await prisma.$transaction(async (tx) => {
        if (action === 'APPROVE') {
          // Release locked and complete
          await tx.wallet.update({
            where: { id: transaction.walletId },
            data: {
              locked: Math.max(0, Number(transaction.wallet.locked) - totalDeduction)
            }
          });

          await tx.transaction.update({
            where: { id: transactionId },
            data: { status: 'COMPLETED' }
          });
        } else {
          // Reject: Refund locked to balance
          await tx.wallet.update({
            where: { id: transaction.walletId },
            data: {
              balance: Number(transaction.wallet.balance) + totalDeduction,
              locked: Math.max(0, Number(transaction.wallet.locked) - totalDeduction)
            }
          });

          await tx.transaction.update({
            where: { id: transactionId },
            data: { status: 'REJECTED' }
          });
        }

        // Audit Log
        await tx.auditLog.create({
          data: {
            userId: req.userId!,
            action: action === 'APPROVE' ? 'WITHDRAWAL_APPROVED' : 'WITHDRAWAL_REJECTED',
            ipAddress: req.ip || '127.0.0.1',
            details: `Txn ID: ${transactionId}`
          }
        });
      });

      return res.status(200).json({ message: `Withdrawal successfully ${action === 'APPROVE' ? 'approved' : 'rejected'}` });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getSystemStats(req: AuthenticatedRequest, res: Response) {
    try {
      const totalUsers = await prisma.user.count();
      const totalTradesCount = await prisma.trade.count();
      
      const withdrawals = await prisma.transaction.findMany({
        where: { type: 'WITHDRAWAL', status: 'COMPLETED' },
        select: { fee: true }
      });
      const totalFeesCollected = withdrawals.reduce((sum, w) => sum + Number(w.fee), 0);

      const trades = await prisma.trade.findMany({
        select: { price: true, quantity: true }
      });
      const totalVolume = trades.reduce((sum, t) => sum + (Number(t.price) * Number(t.quantity)), 0);

      return res.status(200).json({
        totalUsers,
        totalTradesCount,
        totalVolume,
        totalFeesCollected
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getAuditLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const logs = await prisma.auditLog.findMany({
        include: {
          user: {
            select: { email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      });
      return res.status(200).json(logs);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}

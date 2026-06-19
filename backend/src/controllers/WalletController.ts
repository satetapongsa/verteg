import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { authenticator } from 'otplib';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';
import { WalletService } from '../services/WalletService';

const prisma = new PrismaClient();

export class WalletController {
  public static async getBalances(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    try {
      const wallets = await prisma.wallet.findMany({
        where: { userId },
        orderBy: { coinSymbol: 'asc' }
      });
      return res.status(200).json(wallets);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getDepositAddress(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    const { coinSymbol } = req.params;

    try {
      const wallet = await prisma.wallet.findUnique({
        where: { userId_coinSymbol: { userId, coinSymbol } }
      });

      if (!wallet) {
        return res.status(404).json({ error: `Wallet for ${coinSymbol} not found` });
      }

      // Generate QR Code data URL
      const qrCodeUrl = await QRCode.toDataURL(wallet.address);

      return res.status(200).json({
        coinSymbol,
        address: wallet.address,
        qrCodeUrl
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async requestWithdrawal(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    const { coinSymbol, amount, destinationAddress, twoFactorCode } = req.body;

    if (!coinSymbol || !amount || !destinationAddress) {
      return res.status(400).json({ error: 'coinSymbol, amount, and destinationAddress are required' });
    }

    try {
      // Security Check: enforce 2FA verification if enabled
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (user.twoFactorEnabled) {
        if (!twoFactorCode) {
          return res.status(400).json({ error: '2FA code is required for withdrawals' });
        }
        const verified = authenticator.verify({
          token: twoFactorCode,
          secret: user.twoFactorSecret || ''
        });
        if (!verified) {
          return res.status(401).json({ error: 'Invalid 2FA code' });
        }
      }

      const transaction = await WalletService.requestWithdrawal(userId, coinSymbol, parseFloat(amount), destinationAddress);

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'WITHDRAWAL_REQUEST',
          ipAddress: req.ip || '127.0.0.1',
          details: JSON.stringify({ txnId: transaction.id, coinSymbol, amount })
        }
      });

      return res.status(200).json({ message: 'Withdrawal request submitted', transaction });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  public static async getTransactionHistory(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          wallet: { userId }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(transactions);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Sandbox/Mocking API: simulate crypto deposit trigger
   */
  public static async simulateDeposit(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    const { coinSymbol, amount } = req.body;

    if (!coinSymbol || !amount) {
      return res.status(400).json({ error: 'coinSymbol and amount are required' });
    }

    try {
      const transaction = await WalletService.simulateDeposit(userId, coinSymbol, parseFloat(amount));
      return res.status(200).json({ message: 'Deposit simulated successfully', transaction });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
}

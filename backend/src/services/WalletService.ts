import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { CryptoService } from './CryptoService';

const prisma = new PrismaClient();

export class WalletService {
  /**
   * Generates local addresses and encrypted private keys for all supported coins for a user
   */
  public static async createWalletsForUser(userId: string) {
    const coins = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'TRX', 'MATIC'];
    
    for (const coin of coins) {
      const { address, privateKey } = this.generateAddressPair(coin);
      const encryptedKey = CryptoService.encrypt(privateKey);

      await prisma.wallet.create({
        data: {
          userId,
          coinSymbol: coin,
          address,
          privateKey: encryptedKey,
          balance: 0,
          locked: 0
        }
      });
    }
  }

  private static generateAddressPair(coin: string): { address: string; privateKey: string } {
    const rawKey = crypto.randomBytes(32).toString('hex');
    let address = '';

    if (coin === 'BTC') {
      address = 'bc1q' + crypto.randomBytes(18).toString('hex');
    } else if (['ETH', 'USDT', 'BNB', 'MATIC'].includes(coin)) {
      address = '0x' + crypto.randomBytes(20).toString('hex');
    } else if (coin === 'SOL') {
      address = crypto.randomBytes(22).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 44);
    } else if (coin === 'TRX') {
      address = 'T' + crypto.randomBytes(16).toString('hex').slice(0, 33);
    } else if (coin === 'DOGE') {
      address = 'D' + crypto.randomBytes(16).toString('hex').slice(0, 33);
    } else if (coin === 'ADA') {
      address = 'addr1' + crypto.randomBytes(24).toString('hex');
    } else if (coin === 'XRP') {
      address = 'r' + crypto.randomBytes(16).toString('hex').slice(0, 33);
    } else {
      address = '0x' + crypto.randomBytes(20).toString('hex');
    }

    return {
      address,
      privateKey: rawKey
    };
  }

  /**
   * Simulates blockchain network deposit detection (for sandbox/demo purposes)
   */
  public static async simulateDeposit(userId: string, coinSymbol: string, amount: number, txHash?: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId_coinSymbol: { userId, coinSymbol } }
    });

    if (!wallet) throw new Error('Wallet not found');

    const generatedHash = txHash || '0x' + crypto.randomBytes(32).toString('hex');

    const transaction = await prisma.$transaction(async (tx) => {
      // Create completed deposit record
      const txn = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          amount,
          fee: 0,
          network: this.getNetworkName(coinSymbol),
          address: wallet.address,
          txHash: generatedHash,
          status: 'COMPLETED'
        }
      });

      // Update wallet balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: Number(wallet.balance) + amount
        }
      });

      // Add audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DEPOSIT_COMPLETED',
          ipAddress: '127.0.0.1',
          details: JSON.stringify({ coinSymbol, amount, txHash: generatedHash })
        }
      });

      return txn;
    });

    return transaction;
  }

  /**
   * Processes withdrawal requests. Locks balance and triggers approval pipeline.
   */
  public static async requestWithdrawal(userId: string, coinSymbol: string, amount: number, destinationAddress: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId_coinSymbol: { userId, coinSymbol } }
    });

    if (!wallet) throw new Error('Wallet not found');

    // Calculate fee (e.g. 0.1% or static network fee)
    const fee = this.getWithdrawalFee(coinSymbol);
    const totalDeduction = amount + fee;

    if (Number(wallet.balance) < totalDeduction) {
      throw new Error('Insufficient balance to cover withdrawal amount + network fee');
    }

    const transaction = await prisma.$transaction(async (tx) => {
      // Deduct from balance, add to locked (escrow for pending withdrawal)
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: Number(wallet.balance) - totalDeduction,
          locked: Number(wallet.locked) + totalDeduction
        }
      });

      // Create transaction record
      const txn = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount,
          fee,
          network: this.getNetworkName(coinSymbol),
          address: destinationAddress,
          status: 'PENDING'
        }
      });

      return txn;
    });

    return transaction;
  }

  private static getNetworkName(coin: string): string {
    if (coin === 'BTC') return 'Bitcoin';
    if (['ETH', 'USDT', 'MATIC'].includes(coin)) return 'Ethereum (ERC20)';
    if (coin === 'BNB') return 'BNB Chain (BEP20)';
    if (coin === 'SOL') return 'Solana';
    if (coin === 'TRX') return 'Tron (TRC20)';
    return 'Mainnet';
  }

  private static getWithdrawalFee(coin: string): number {
    const fees: Record<string, number> = {
      BTC: 0.0005,
      ETH: 0.005,
      USDT: 1.0,
      BNB: 0.001,
      SOL: 0.01,
      XRP: 0.25,
      DOGE: 1.0,
      ADA: 1.0,
      TRX: 1.0,
      MATIC: 1.0
    };
    return fees[coin] || 0.01;
  }
}

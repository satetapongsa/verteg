import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/AuthMiddleware';
import { WalletService } from '../services/WalletService';

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || 'supersecretkey';

export class AuthController {
  public static async register(req: AuthenticatedRequest, res: Response) {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: email.endsWith('@exchange.admin') ? 'ADMIN' : 'USER'
        }
      });

      // Generate initial wallets for user
      await WalletService.createWalletsForUser(user.id);

      // Log registration
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'REGISTER',
          ipAddress: req.ip || '127.0.0.1',
          details: 'Account created'
        }
      });

      return res.status(201).json({ message: 'Registration successful', userId: user.id });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async login(req: AuthenticatedRequest, res: Response) {
    const { email, password, code } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (user.isFrozen) {
        return res.status(403).json({ error: 'Account is frozen' });
      }

      // Check 2FA
      if (user.twoFactorEnabled) {
        if (!code) {
          return res.status(200).json({ twoFactorRequired: true, userId: user.id });
        }
        const verified = authenticator.verify({
          token: code,
          secret: user.twoFactorSecret || ''
        });
        if (!verified) {
          return res.status(401).json({ error: 'Invalid 2FA code' });
        }
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        jwtSecret,
        { expiresIn: '1d' }
      );

      // Create session
      await prisma.session.create({
        data: {
          userId: user.id,
          token,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          ipAddress: req.ip || '127.0.0.1'
        }
      });

      return res.status(200).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async setup2FA(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const secret = authenticator.generateSecret();
      const otpauthUrl = authenticator.keyuri(user.email, 'Verteg', secret);
      const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

      // Save secret temporarily but do not enable 2FA yet until verified
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret }
      });

      return res.status(200).json({ secret, qrCodeUrl });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async verify2FA(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: '2FA verification code is required' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.twoFactorSecret) {
        return res.status(404).json({ error: '2FA not initialized' });
      }

      const verified = authenticator.verify({
        token: code,
        secret: user.twoFactorSecret
      });

      if (!verified) {
        return res.status(400).json({ error: 'Invalid 2FA token' });
      }

      // Enable 2FA permanently
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'ENABLE_2FA',
          ipAddress: req.ip || '127.0.0.1'
        }
      });

      return res.status(200).json({ success: true, message: '2FA successfully enabled' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async disable2FA(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId!;
    const { code } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.twoFactorSecret) {
        return res.status(404).json({ error: 'User 2FA not found' });
      }

      const verified = authenticator.verify({
        token: code,
        secret: user.twoFactorSecret
      });

      if (!verified) {
        return res.status(400).json({ error: 'Invalid 2FA token' });
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null
        }
      });

      return res.status(200).json({ success: true, message: '2FA successfully disabled' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}

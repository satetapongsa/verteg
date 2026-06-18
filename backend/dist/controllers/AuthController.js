"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAndEnable2fa = exports.get2faSetup = exports.logout = exports.refreshToken = exports.login = exports.register = void 0;
const db_1 = require("../config/db");
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const otplib_1 = require("otplib");
const QRCode = __importStar(require("qrcode"));
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
const generateTokens = (userId, role) => {
    const accessToken = jwt.sign({ userId, role }, ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, role }, REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};
const register = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        const existingUser = await db_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await db_1.prisma.$transaction(async (tx) => {
            // Create user
            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    role: 'USER',
                },
            });
            // Get all active assets
            const assets = await tx.asset.findMany({ where: { isActive: true } });
            // Create default wallets
            for (const asset of assets) {
                const mockAddress = `0x${user.id.substring(0, 4)}${asset.symbol.toLowerCase()}${Math.random().toString(36).substring(2, 12)}`;
                await tx.wallet.create({
                    data: {
                        userId: user.id,
                        assetId: asset.id,
                        address: mockAddress,
                        balance: asset.symbol === 'USDT' ? 5000.0 : 0.0, // Give some default demo USDT to test trades
                    },
                });
            }
            // Create audit log
            await tx.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'REGISTER',
                    details: `Registered new account: ${email}`,
                },
            });
            return user;
        });
        const { accessToken, refreshToken } = generateTokens(newUser.id, newUser.role);
        // Set refresh token in httpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.status(201).json({
            message: 'User registered successfully',
            accessToken,
            user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
                is2faEnabled: newUser.is2faEnabled,
            },
        });
    }
    catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({ message: 'Internal server error during registration' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password, code } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        const user = await db_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }
        if (user.isFrozen) {
            return res.status(403).json({ message: 'Account is frozen. Contact support.' });
        }
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }
        // 2FA check
        if (user.is2faEnabled) {
            if (!code) {
                return res.status(200).json({
                    twoFactorRequired: true,
                    message: 'Two-Factor Authentication code is required',
                });
            }
            const isValid2fa = otplib_1.authenticator.verify({
                token: code,
                secret: user.twoFactorSecret || '',
            });
            if (!isValid2fa) {
                return res.status(400).json({ message: 'Invalid Two-Factor Authentication code' });
            }
        }
        const { accessToken, refreshToken } = generateTokens(user.id, user.role);
        // Update audit log
        await db_1.prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'LOGIN',
                details: 'User logged in successfully',
            },
        });
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.status(200).json({
            message: 'Login successful',
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                is2faEnabled: user.is2faEnabled,
            },
        });
    }
    catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Internal server error during login' });
    }
};
exports.login = login;
const refreshToken = async (req, res) => {
    try {
        const token = req.cookies.refreshToken || req.body.refreshToken;
        if (!token) {
            return res.status(401).json({ message: 'Refresh token required' });
        }
        const decoded = jwt.verify(token, REFRESH_SECRET);
        const user = await db_1.prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || user.isFrozen) {
            return res.status(403).json({ message: 'User does not exist or is frozen' });
        }
        const tokens = generateTokens(user.id, user.role);
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.status(200).json({
            accessToken: tokens.accessToken,
        });
    }
    catch (err) {
        return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
};
exports.refreshToken = refreshToken;
const logout = async (req, res) => {
    res.clearCookie('refreshToken');
    return res.status(200).json({ message: 'Logged out successfully' });
};
exports.logout = logout;
const get2faSetup = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await db_1.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.is2faEnabled) {
            return res.status(400).json({ message: '2FA is already enabled' });
        }
        const secret = otplib_1.authenticator.generateSecret();
        const otpauthUrl = otplib_1.authenticator.keyuri(user.email, 'EnterpriseExchange', secret);
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
        // Store temp secret in db or return it so user can confirm
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { twoFactorSecret: secret },
        });
        return res.status(200).json({
            secret,
            qrCode: qrCodeDataUrl,
        });
    }
    catch (err) {
        console.error('2FA setup error:', err);
        return res.status(500).json({ message: 'Internal server error during 2FA setup' });
    }
};
exports.get2faSetup = get2faSetup;
const verifyAndEnable2fa = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ message: 'Verification code is required' });
        }
        const user = await db_1.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (!user.twoFactorSecret) {
            return res.status(400).json({ message: 'No 2FA secret found. Setup 2FA first.' });
        }
        const isValid = otplib_1.authenticator.verify({
            token: code,
            secret: user.twoFactorSecret,
        });
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { is2faEnabled: true },
        });
        await db_1.prisma.auditLog.create({
            data: {
                userId,
                action: 'ENABLE_2FA',
                details: '2FA successfully enabled',
            },
        });
        return res.status(200).json({ message: '2FA enabled successfully' });
    }
    catch (err) {
        console.error('2FA verification error:', err);
        return res.status(500).json({ message: 'Internal server error during 2FA verification' });
    }
};
exports.verifyAndEnable2fa = verifyAndEnable2fa;

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER',
};

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding assets...');

  const assetsData = [
    { symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', withdrawFee: 0.0005, minWithdraw: 0.001 },
    { symbol: 'ETH', name: 'Ethereum', network: 'Ethereum (ERC20)', withdrawFee: 0.005, minWithdraw: 0.01 },
    { symbol: 'USDT', name: 'Tether', network: 'Ethereum (ERC20)', withdrawFee: 1.0, minWithdraw: 5.0 },
    { symbol: 'BNB', name: 'Binance Coin', network: 'BNB Smart Chain (BEP20)', withdrawFee: 0.001, minWithdraw: 0.005 },
    { symbol: 'SOL', name: 'Solana', network: 'Solana', withdrawFee: 0.01, minWithdraw: 0.1 },
    { symbol: 'XRP', name: 'Ripple', network: 'Ripple', withdrawFee: 0.25, minWithdraw: 1.0 },
    { symbol: 'DOGE', name: 'Dogecoin', network: 'Dogecoin', withdrawFee: 2.0, minWithdraw: 5.0 },
    { symbol: 'ADA', name: 'Cardano', network: 'Cardano', withdrawFee: 1.0, minWithdraw: 2.0 },
    { symbol: 'TRX', name: 'Tron', network: 'Tron (TRC20)', withdrawFee: 1.0, minWithdraw: 5.0 },
    { symbol: 'MATIC', name: 'Polygon', network: 'Polygon', withdrawFee: 0.1, minWithdraw: 1.0 },
  ];

  const assets = [];
  for (const data of assetsData) {
    const asset = await prisma.asset.upsert({
      where: { symbol: data.symbol },
      update: {},
      create: data,
    });
    assets.push(asset);
  }
  console.log(`Seeded ${assets.length} assets.`);

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'AdminSecurePass123!';
  const userPassword = process.env.SEED_USER_PASSWORD || 'UserSecurePass123!';

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const userPasswordHash = await bcrypt.hash(userPassword, 10);

  // Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@exchange.com' },
    update: {},
    create: {
      email: 'admin@exchange.com',
      passwordHash,
      role: Role.ADMIN,
      kyc: {
        create: {
          firstName: 'System',
          lastName: 'Admin',
          documentId: 'ADM-001',
          status: 'APPROVED',
        },
      },
    },
  });
  console.log('Admin user seeded:', admin.email);

  // New Admin User (admin@gmail.com / admin)
  const newAdminPasswordHash = await bcrypt.hash('admin', 10);
  const secondaryAdmin = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {},
    create: {
      email: 'admin@gmail.com',
      passwordHash: newAdminPasswordHash,
      role: Role.ADMIN,
      kyc: {
        create: {
          firstName: 'Alt',
          lastName: 'Admin',
          documentId: 'ADM-002',
          status: 'APPROVED',
        },
      },
    },
  });
  console.log('Secondary Admin user seeded:', secondaryAdmin.email);

  // Normal User
  const normalUser = await prisma.user.upsert({
    where: { email: 'user@exchange.com' },
    update: {},
    create: {
      email: 'user@exchange.com',
      passwordHash: userPasswordHash,
      role: Role.USER,
      kyc: {
        create: {
          firstName: 'John',
          lastName: 'Doe',
          documentId: 'US-998822',
          status: 'APPROVED',
        },
      },
    },
  });
  console.log('Normal user seeded:', normalUser.email);

  // Create wallets for seeded users
  const users = [admin, secondaryAdmin, normalUser];
  for (const user of users) {
    for (const asset of assets) {
      // Mock wallet address generation
      const mockAddress = `0x${user.id.substring(0, 4)}${asset.symbol.toLowerCase()}${Math.random().toString(36).substring(2, 12)}`;
      
      // Let's seed some default balance for normal user to trade!
      let initialBalance = 0;
      if (user.role === Role.USER) {
        if (asset.symbol === 'USDT') {
          initialBalance = 10000.0; // Seed with $10,000 USDT for trading
        } else if (asset.symbol === 'BTC') {
          initialBalance = 0.5; // Seed with 0.5 BTC
        } else if (asset.symbol === 'ETH') {
          initialBalance = 5.0; // Seed with 5 ETH
        } else {
          initialBalance = 100.0; // Seed other assets with 100 coins
        }
      } else {
        // Give admin infinite liquidity
        initialBalance = 1000000.0;
      }

      await prisma.wallet.upsert({
        where: {
          userId_assetId: {
            userId: user.id,
            assetId: asset.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          assetId: asset.id,
          address: mockAddress,
          balance: initialBalance,
        },
      });
    }
  }
  console.log('Wallets and balances seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

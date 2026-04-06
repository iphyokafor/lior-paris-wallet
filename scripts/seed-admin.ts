import 'reflect-metadata';

/* eslint-disable @typescript-eslint/prefer-top-level-await */

import * as argon from 'argon2';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Users } from '../src/features/users/entities/user.entity';
import { Wallet } from '../src/features/wallet/entities/wallet.entity';
import { generateWalletTag } from '../src/shared/utils/generate-wallet-tag';
import { resolveLogLevels } from '../src/shared/logging/log-levels';
import { UserRole, DEFAULT_CURRENCY } from '../src/shared/constants';

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

const getNumberEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const value = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const logger = new Logger('seed:admin');

const main = async () => {
  const logLevels = resolveLogLevels(process.env.LOG_LEVEL);
  if (logLevels) {
    Logger.overrideLogger(logLevels);
  }

  const host = process.env.MYSQL_HOST ?? 'localhost';
  const port = getNumberEnv('MYSQL_PORT', 3306);
  const username = getRequiredEnv('MYSQL_USER');
  const password = process.env.MYSQL_PASS ?? '';
  const database = getRequiredEnv('MYSQL_DB');

  const adminEmail = getRequiredEnv('ADMIN_EMAIL');
  const adminPassword = getRequiredEnv('ADMIN_PASSWORD');
  const adminName = process.env.ADMIN_NAME ?? 'Admin';

    const dataSource = new DataSource({
      type: 'mysql',
      host,
      port,
      username,
      password,
      database,
      entities: [Users, Wallet],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();
    try {
      const usersRepo = dataSource.getRepository(Users);

      const existing = await usersRepo.findOne({ where: { email: adminEmail } });
      if (existing) {
        if (existing.role === UserRole.Admin) {
          logger.log(`Admin already exists: ${adminEmail}`);
          return;
        }

        existing.role = UserRole.Admin;
        await usersRepo.save(existing);
        logger.log(`Promoted existing user to ADMIN: ${adminEmail}`);
        return;
      }

      const hashedPassword = await argon.hash(adminPassword);

      const admin = usersRepo.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: UserRole.Admin,
      });

      await usersRepo.save(admin);
      logger.log(`Seeded ADMIN user: ${adminEmail}`);

      const walletRepo = dataSource.getRepository(Wallet);
      const wallet = walletRepo.create({
        user_id: admin.id,
        balance: 0,
        currency: DEFAULT_CURRENCY,
        wallet_tag: generateWalletTag(adminName),
      });
      await walletRepo.save(wallet);
      logger.log(`Created default ${DEFAULT_CURRENCY} wallet for admin`);
    } finally {
      await dataSource.destroy();
    }
}

process.on('unhandledRejection', (err) => {
  logger.error(err);
  process.exitCode = 1;
});

process.on('uncaughtException', (err) => {
  logger.error(err);
  process.exitCode = 1;
});

void main();

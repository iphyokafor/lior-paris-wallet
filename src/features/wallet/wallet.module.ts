import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisStore } from 'cache-manager-redis-yet';
import { getRequiredString, getNumber } from '../../shared/config/config.utils';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Transaction } from './entities/transaction.entity';
import { Wallet } from './entities/wallet.entity';
import { StripeWebhookController } from './stripe-webhook.controller';
import { WalletController } from './wallet.controller';
import { WalletEventListener } from './wallet.event-listener';
import { WalletRepository } from './wallet.repository';
import { WalletService } from './wallet.service';
import { UsersModule } from '../users/users.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, LedgerEntry, Transaction]),
    UsersModule,
    PaymentsModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: getRequiredString(config, 'REDIS_HOST'),
            port: getNumber(config, 'REDIS_PORT', 6379),
          },
        }),
      }),
    }),
  ],
  controllers: [WalletController, StripeWebhookController],
  providers: [WalletService, WalletRepository, WalletEventListener],
  exports: [WalletService, WalletRepository],
})
export class WalletModule {}

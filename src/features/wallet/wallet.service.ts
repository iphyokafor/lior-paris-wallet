import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DomainEventName } from '../../shared/events';
import { CreateWalletDto } from './dto/create-wallet.input';
import { DepositDto } from './dto/deposit.input';
import { LedgerEntryType } from './entities/ledger-entry.entity';
import {
  TransactionType,
  TransactionStatus,
} from './entities/transaction.entity';
import { Wallet } from './entities/wallet.entity';
import { PaymentGatewayRegistry } from '../payments/gateways/payment-gateway.registry';
import { WalletRepository } from './wallet.repository';
import { UsersRepository } from '../users/repository/users.repository';

const BALANCE_CACHE_TTL_MS = 60_000;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly gatewayRegistry: PaymentGatewayRegistry,
    private readonly usersRepository: UsersRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async createWallet(
    userId: string,
    userName: string,
    input: CreateWalletDto,
  ): Promise<Wallet> {
    const existing = await this.walletRepository.findByUserIdAndCurrency(
      userId,
      input.currency,
    );

    if (existing) {
      throw new ConflictException(
        `Wallet already exists for currency ${input.currency}`,
      );
    }

    return this.walletRepository.ensureWallet(userId, input.currency, userName);
  }

  async getBalance(userId: string, currency: string): Promise<Wallet> {
    const cacheKey = `wallet:balance:${userId}:${currency}`;
    const cached = await this.cache.get<Wallet>(cacheKey);
    if (cached) return cached;

    const wallet = await this.walletRepository.findByUserIdAndCurrency(
      userId,
      currency,
    );

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    await this.cache.set(cacheKey, wallet, BALANCE_CACHE_TTL_MS);
    return wallet;
  }

  async deposit(
    userId: string,
    input: DepositDto,
  ): Promise<{ checkoutUrl?: string }> {
    const existing =
      await this.walletRepository.findTransactionByIdempotencyKey(
        input.idempotencyKey,
      );

    if (existing) {
      this.logger.log(`Duplicate deposit ignored: ${input.idempotencyKey}`);
      return {};
    }

    const wallet = await this.walletRepository.findByUserIdAndCurrency(
      userId,
      input.currency,
    );

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const transaction = await this.walletRepository.createTransaction({
      user_id: userId,
      type: TransactionType.Deposit,
      amount: input.amount,
      currency: input.currency,
      payment_method: input.paymentMethod,
      idempotency_key: input.idempotencyKey,
    });
    const gateway = this.gatewayRegistry.resolve(input.paymentMethod);
    const gatewayResult = await gateway.processDeposit(
      input.amount,
      input.currency,
      input.paymentMethod,
      { transactionId: transaction.id, userId },
    );

    if (!gatewayResult.success) {
      await this.walletRepository.failTransaction(
        transaction,
        gatewayResult.failureReason ?? 'Payment provider declined',
      );
      throw new BadRequestException('Deposit declined by payment provider');
    }

    if (gatewayResult.providerRef) {
      await this.walletRepository.updateTransactionProviderRef(
        transaction.id,
        gatewayResult.providerRef,
      );
    }

    // Stripe: leave transaction PENDING, webhook will settle it
    if (gatewayResult.requiresWebhook) {
      this.logger.log(
        `Deposit ${transaction.id} awaiting webhook confirmation (provider_ref: ${gatewayResult.providerRef})`,
      );
      return { checkoutUrl: gatewayResult.checkoutUrl };
    }

    // Should not be reached — all gateways use webhooks
    throw new BadRequestException('No settlement path available for gateway');
  }

  async settleByProviderRef(providerRef: string): Promise<void> {
    const transaction =
      await this.walletRepository.findTransactionByProviderRef(providerRef);

    if (!transaction) {
      this.logger.warn(`No transaction found for provider_ref: ${providerRef}`);
      return;
    }

    if (transaction.status !== TransactionStatus.Pending) {
      this.logger.log(
        `Transaction ${transaction.id} already ${transaction.status}, skipping`,
      );
      return;
    }

    const wallet = await this.walletRepository.findByUserIdAndCurrency(
      transaction.user_id,
      transaction.currency,
    );

    if (!wallet) {
      this.logger.error(
        `Wallet not found for user ${transaction.user_id} / ${transaction.currency}`,
      );
      return;
    }

    const outboxPayload = this.buildOutboxPayload(
      DomainEventName.DepositSucceeded,
      wallet.id,
      transaction.user_id,
      Number(transaction.amount),
      transaction.currency,
      await this.getUserEmail(transaction.user_id),
    );

    await this.walletRepository.settleTransaction(
      wallet.id,
      transaction,
      LedgerEntryType.Deposit,
      Number(transaction.amount),
      outboxPayload,
    );

    await this.invalidateBalanceCache(
      transaction.user_id,
      transaction.currency,
    );
    this.logger.log(`Deposit settled via webhook: ${transaction.id}`);
  }

  async failByProviderRef(providerRef: string, reason: string): Promise<void> {
    const transaction =
      await this.walletRepository.findTransactionByProviderRef(providerRef);

    if (!transaction) {
      this.logger.warn(`No transaction found for provider_ref: ${providerRef}`);
      return;
    }

    if (transaction.status !== TransactionStatus.Pending) {
      this.logger.log(
        `Transaction ${transaction.id} already ${transaction.status}, skipping`,
      );
      return;
    }

    await this.walletRepository.failTransaction(transaction, reason);
    this.logger.log(
      `Deposit failed via webhook: ${transaction.id} — ${reason}`,
    );
  }

  async invalidateBalanceCache(
    userId: string,
    currency: string,
  ): Promise<void> {
    await this.cache.del(`wallet:balance:${userId}:${currency}`);
  }

  private async getUserEmail(userId: string): Promise<string | undefined> {
    const user = await this.usersRepository.findUserById(userId);
    return user?.email;
  }

  private buildOutboxPayload(
    eventName: DomainEventName,
    walletId: string,
    userId: string,
    amount: number,
    currency: string,
    userEmail?: string,
  ): Record<string, unknown> {
    return {
      event_name: eventName,
      aggregate_id: walletId,
      payload_json: { userId, walletId, amount, currency, userEmail },
      occurred_at: new Date(),
      processed_at: null,
      retry_count: 0,
    };
  }
}

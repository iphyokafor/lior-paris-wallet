import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { generateWalletTag } from '../../shared/utils/generate-wallet-tag';
import { Wallet } from './entities/wallet.entity';
import { LedgerEntry, LedgerEntryType } from './entities/ledger-entry.entity';
import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { OutboxEvent } from '../../infrastructure/outbox/entities/outbox-event.entity';

@Injectable()
export class WalletRepository {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  async findByUserIdAndCurrency(
    userId: string,
    currency: string,
  ): Promise<Wallet | null> {
    return this.walletRepo.findOne({
      where: { user_id: userId, currency },
    });
  }

  async findByWalletTag(walletTag: string): Promise<Wallet | null> {
    return this.walletRepo.findOne({ where: { wallet_tag: walletTag } });
  }

  async findTransactionByIdempotencyKey(
    key: string,
  ): Promise<Transaction | null> {
    return this.transactionRepo.findOne({ where: { idempotency_key: key } });
  }

  async findTransactionByProviderRef(
    providerRef: string,
  ): Promise<Transaction | null> {
    return this.transactionRepo.findOne({
      where: { provider_ref: providerRef },
    });
  }

  async updateTransactionProviderRef(
    transactionId: string,
    providerRef: string,
  ): Promise<void> {
    await this.transactionRepo.update(transactionId, {
      provider_ref: providerRef,
    });
  }

  async ensureWallet(
    userId: string,
    currency: string,
    userName: string,
  ): Promise<Wallet> {
    const existing = await this.walletRepo.findOneBy({
      user_id: userId,
      currency,
    });
    if (existing) return existing;

    const wallet = this.walletRepo.create({
      user_id: userId,
      balance: 0,
      currency,
      wallet_tag: generateWalletTag(userName),
    });
    return this.walletRepo.save(wallet);
  }

  async createTransaction(data: Partial<Transaction>): Promise<Transaction> {
    const transaction = this.transactionRepo.create(data);
    return this.transactionRepo.save(transaction);
  }

  async failTransaction(
    transaction: Transaction,
    reason: string,
  ): Promise<void> {
    await this.transactionRepo.update(transaction.id, {
      status: TransactionStatus.Failed,
      failure_reason: reason,
    });
  }

  async settleTransaction(
    walletId: string,
    transaction: Transaction,
    entryType: LedgerEntryType,
    balanceChange: number,
    outboxPayload: Record<string, unknown>,
  ): Promise<LedgerEntry> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { id: walletId },
        lock: { mode: 'pessimistic_write' },
      });

      const newBalance = Number(wallet.balance) + balanceChange;

      if (newBalance < 0) {
        throw new BadRequestException('Insufficient balance');
      }

      await manager.update(Wallet, walletId, { balance: newBalance });

      const entry = manager.create(LedgerEntry, {
        wallet_id: walletId,
        type: entryType,
        amount: transaction.amount,
        currency: wallet.currency,
        balance_after: newBalance,
        idempotency_key: transaction.idempotency_key,
      });
      const savedEntry = await manager.save(entry);

      await manager.update(Transaction, transaction.id, {
        status: TransactionStatus.Completed,
      });

      const outboxItem = manager.create(OutboxEvent, outboxPayload);
      await manager.save(outboxItem);

      return savedEntry;
    });
  }
}

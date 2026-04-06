import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  LedgerEntry,
  LedgerEntryType,
} from '../../features/wallet/entities/ledger-entry.entity';
import { Wallet } from '../../features/wallet/entities/wallet.entity';
import { OutboxEvent } from '../../infrastructure/outbox/entities/outbox-event.entity';
import { Transfer, TransferStatus } from './entities/transfer.entity';

@Injectable()
export class TransfersRepository {
  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepo: Repository<Transfer>,
    private readonly dataSource: DataSource,
  ) {}

  async findByIdempotencyKey(key: string): Promise<Transfer | null> {
    return this.transferRepo.findOne({ where: { idempotency_key: key } });
  }

  async createTransfer(data: Partial<Transfer>): Promise<Transfer> {
    const transfer = this.transferRepo.create(data);
    return this.transferRepo.save(transfer);
  }

  async failTransfer(transfer: Transfer, reason: string): Promise<void> {
    await this.transferRepo.update(transfer.id, {
      status: TransferStatus.Failed,
      failure_reason: reason,
    });
  }

  async executeTransfer(
    transfer: Transfer,
    fromWalletId: string,
    toWalletId: string,
    outboxPayload: Record<string, unknown>,
  ): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      // Acquire locks on both wallets in a consistent order to prevent deadlocks
      // The technique is called lock ordering - always acquire locks in the same order based on a unique identifier (e.g., wallet ID)
      const [walletIdFirst, walletIdSecond] =
        fromWalletId < toWalletId
          ? [fromWalletId, toWalletId]
          : [toWalletId, fromWalletId];

      const firstWallet = await manager.findOne(Wallet, {
        where: { id: walletIdFirst },
        lock: { mode: 'pessimistic_write' },
      });

      const secondWallet = await manager.findOne(Wallet, {
        where: { id: walletIdSecond },
        lock: { mode: 'pessimistic_write' },
      });

      const fromWallet =
        firstWallet.id === fromWalletId ? firstWallet : secondWallet;
      const toWallet =
        firstWallet.id === toWalletId ? firstWallet : secondWallet;

      const senderNewBalance = Number(fromWallet.balance) - transfer.amount;
      if (senderNewBalance < 0) {
        throw new BadRequestException('Insufficient balance');
      }

      const receiverNewBalance = Number(toWallet.balance) + transfer.amount;

      await manager.update(Wallet, fromWallet.id, {
        balance: senderNewBalance,
      });
      await manager.update(Wallet, toWallet.id, {
        balance: receiverNewBalance,
      });

      const debitEntry = manager.create(LedgerEntry, {
        wallet_id: fromWallet.id,
        type: LedgerEntryType.TransferOut,
        amount: transfer.amount,
        currency: transfer.currency,
        balance_after: senderNewBalance,
        idempotency_key: `${transfer.idempotency_key}:out`,
      });

      const creditEntry = manager.create(LedgerEntry, {
        wallet_id: toWallet.id,
        type: LedgerEntryType.TransferIn,
        amount: transfer.amount,
        currency: transfer.currency,
        balance_after: receiverNewBalance,
        idempotency_key: `${transfer.idempotency_key}:in`,
      });

      await manager.save([debitEntry, creditEntry]);

      await manager.update(Transfer, transfer.id, {
        status: TransferStatus.Completed,
      });

      const outboxItem = manager.create(OutboxEvent, outboxPayload);
      await manager.save(outboxItem);
    });
  }
}

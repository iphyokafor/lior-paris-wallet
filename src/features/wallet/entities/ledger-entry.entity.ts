import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { TABLES } from '../../../shared/constants';

export enum LedgerEntryType {
  Deposit = 'DEPOSIT',
  TransferOut = 'TRANSFER_OUT',
  TransferIn = 'TRANSFER_IN',
}

@Entity(TABLES.ledger_entry)
@Index(['wallet_id'])
@Index(['idempotency_key'], { unique: true })
export class LedgerEntry extends BaseEntity {
  @Column({ nullable: false })
  wallet_id: string;

  @Column({ type: 'enum', enum: LedgerEntryType, nullable: false })
  type: LedgerEntryType;

  @Column({ type: 'bigint', nullable: false })
  amount: number;

  @Column({ length: 3, nullable: false })
  currency: string;

  @Column({ type: 'bigint', nullable: false })
  balance_after: number;

  @Column({ nullable: false })
  idempotency_key: string;
}

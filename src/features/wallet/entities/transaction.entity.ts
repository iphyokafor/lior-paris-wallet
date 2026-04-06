import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { TABLES } from '../../../shared/constants';

export enum TransactionStatus {
  Pending = 'PENDING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
}

export enum TransactionType {
  Deposit = 'DEPOSIT',
}

@Entity(TABLES.transaction)
@Index(['idempotency_key'], { unique: true })
export class Transaction extends BaseEntity {
  @Column({ nullable: false })
  user_id: string;

  @Column({ type: 'enum', enum: TransactionType, nullable: false })
  type: TransactionType;

  @Column({ type: 'bigint', nullable: false })
  amount: number;

  @Column({ length: 3, nullable: false })
  currency: string;

  @Column({ nullable: false })
  payment_method: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.Pending,
    nullable: false,
  })
  status: TransactionStatus;

  @Column({ nullable: false })
  idempotency_key: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_ref: string | null;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;
}

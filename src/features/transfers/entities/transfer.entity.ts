import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { TABLES } from '../../../shared/constants';

export enum TransferStatus {
  Pending = 'PENDING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
}

@Entity(TABLES.transfer)
@Index(['idempotency_key'], { unique: true })
@Index(['from_user_id'])
@Index(['to_user_id'])
export class Transfer extends BaseEntity {
  @Column({ nullable: false })
  from_user_id: string;

  @Column({ nullable: false })
  to_user_id: string;

  @Column({ type: 'bigint', nullable: false })
  amount: number;

  @Column({ length: 3, nullable: false })
  currency: string;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.Pending,
    nullable: false,
  })
  status: TransferStatus;

  @Column({ nullable: false })
  idempotency_key: string;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;
}

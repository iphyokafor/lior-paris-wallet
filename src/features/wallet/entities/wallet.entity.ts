import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { TABLES } from '../../../shared/constants';
import { Users } from '../../users/entities/user.entity';

@Entity(TABLES.wallet)
@Index(['user_id', 'currency'], { unique: true })
export class Wallet extends BaseEntity {
  @Column({ nullable: false })
  user_id: string;

  @ManyToOne(() => Users, (user) => user.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @Column({ type: 'bigint', default: 0, nullable: false })
  balance: number;

  @Column({ length: 3, nullable: false })
  currency: string;

  @Index({ unique: true })
  @Column({ length: 15, nullable: false })
  wallet_tag: string;
}

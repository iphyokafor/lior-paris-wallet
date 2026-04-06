import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { TABLES, UserRole } from '../../../shared/constants';
import { Wallet } from '../../wallet/entities/wallet.entity';

@Entity(TABLES.user)
export class Users extends BaseEntity {
  @Column({ nullable: false })
  name: string;

  @Column({ unique: true, nullable: false })
  email: string;

  @Column({ nullable: false })
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.User,
    nullable: false,
  })
  role: UserRole;

  @OneToMany(() => Wallet, (wallet) => wallet.user)
  wallets: Wallet[];
}

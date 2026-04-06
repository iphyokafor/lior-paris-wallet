import { Wallet } from '../../wallet/entities/wallet.entity';

export class UserResultDto {
  id: string;
  name: string;
  email: string;
  role: string;
  access_token?: string;
  wallets?: Wallet[];
  created_at: Date;
  updated_at: Date;
}

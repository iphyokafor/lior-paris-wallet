import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { SupportedCurrency } from '../../../shared/constants';

export class InitiateTransferDto {
  @IsString()
  @IsNotEmpty()
  toWalletTag: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsEnum(SupportedCurrency)
  currency: SupportedCurrency;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

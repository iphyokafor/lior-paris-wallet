import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { SupportedCurrency } from '../../../shared/constants';

export class DepositDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsEnum(SupportedCurrency)
  currency: SupportedCurrency;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

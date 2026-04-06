import { IsEnum } from 'class-validator';
import { SupportedCurrency } from '../../../shared/constants';

export class CreateWalletDto {
  @IsEnum(SupportedCurrency)
  currency: SupportedCurrency;
}

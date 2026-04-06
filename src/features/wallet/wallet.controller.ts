import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
} from '@nestjs/common';
import {
  JsonApiResource,
  jsonApiData,
  jsonApiMeta,
} from '../../shared/jsonapi/jsonapi';
import { CreateWalletDto } from './dto/create-wallet.input';
import { DepositDto } from './dto/deposit.input';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('/')
  @HttpCode(201)
  async createWallet(@Request() req, @Body() input: CreateWalletDto) {
    const wallet = await this.walletService.createWallet(
      req.user.id,
      req.user.name,
      input,
    );
    const resource: JsonApiResource<Record<string, unknown>> = {
      type: 'wallets',
      id: wallet.id,
      attributes: {
        balance: wallet.balance,
        currency: wallet.currency,
        walletTag: wallet.wallet_tag,
      },
    };
    return jsonApiData(resource);
  }

  @Get('/:currency')
  async getBalance(@Request() req, @Param('currency') currency: string) {
    const wallet = await this.walletService.getBalance(
      req.user.id,
      currency.toUpperCase(),
    );
    const resource: JsonApiResource<Record<string, unknown>> = {
      type: 'wallets',
      id: wallet.id,
      attributes: {
        balance: wallet.balance,
        currency: wallet.currency,
        walletTag: wallet.wallet_tag,
      },
    };
    return jsonApiData(resource);
  }

  @Post('/deposit')
  @HttpCode(202)
  async deposit(@Request() req, @Body() input: DepositDto) {
    const result = await this.walletService.deposit(req.user.id, input);
    return jsonApiMeta({
      message: result.checkoutUrl
        ? 'Deposit initiated — complete payment via checkout URL'
        : 'Deposit accepted',
      ...(result.checkoutUrl && { checkoutUrl: result.checkoutUrl }),
    });
  }
}

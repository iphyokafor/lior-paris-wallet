import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DomainEventName } from '../../shared/events';
import { WalletRepository } from '../wallet/wallet.repository';
import { WalletService } from '../wallet/wallet.service';
import { InitiateTransferDto } from './dto/initiate-transfer.input';
import { TransfersRepository } from './transfers.repository';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly transfersRepository: TransfersRepository,
    private readonly walletRepository: WalletRepository,
    private readonly walletService: WalletService,
  ) {}

  async initiateTransfer(
    fromUserId: string,
    fromUserEmail: string,
    input: InitiateTransferDto,
  ): Promise<void> {
    const toWallet = await this.walletRepository.findByWalletTag(
      input.toWalletTag,
    );

    if (!toWallet) {
      throw new NotFoundException('Recipient wallet not found');
    }

    if (toWallet.currency !== input.currency) {
      throw new BadRequestException(
        'Recipient wallet currency does not match transfer currency',
      );
    }

    if (fromUserId === toWallet.user_id) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    const existing = await this.transfersRepository.findByIdempotencyKey(
      input.idempotencyKey,
    );

    if (existing) {
      this.logger.log(`Duplicate transfer ignored: ${input.idempotencyKey}`);
      return;
    }

    const fromWallet = await this.walletRepository.findByUserIdAndCurrency(
      fromUserId,
      input.currency,
    );

    if (!fromWallet) {
      throw new NotFoundException('Sender wallet not found');
    }

    const transfer = await this.transfersRepository.createTransfer({
      from_user_id: fromUserId,
      to_user_id: toWallet.user_id,
      amount: input.amount,
      currency: input.currency,
      idempotency_key: input.idempotencyKey,
    });

    await this.transfersRepository.executeTransfer(
      transfer,
      fromWallet.id,
      toWallet.id,
      {
        event_name: DomainEventName.TransferCompleted,
        aggregate_id: transfer.id,
        payload_json: {
          transferId: transfer.id,
          fromUserId,
          toUserId: toWallet.user_id,
          amount: input.amount,
          currency: input.currency,
          userEmail: fromUserEmail,
        },
        occurred_at: new Date(),
        processed_at: null,
        retry_count: 0,
      },
    );

    await Promise.all([
      this.walletService.invalidateBalanceCache(fromUserId, input.currency),
      this.walletService.invalidateBalanceCache(
        toWallet.user_id,
        input.currency,
      ),
    ]);
  }
}

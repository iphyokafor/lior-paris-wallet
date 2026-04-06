import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DEFAULT_CURRENCY } from '../../shared/constants';
import { DomainEventName } from '../../shared/events';
import { UserRegisteredPayload } from '../../shared/events/domain-events';
import { WalletRepository } from './wallet.repository';

@Injectable()
export class WalletEventListener {
  private readonly logger = new Logger(WalletEventListener.name);

  constructor(private readonly walletRepository: WalletRepository) {}

  @OnEvent(DomainEventName.UserRegistered)
  async handleUserRegistered(payload: UserRegisteredPayload): Promise<void> {
    await this.walletRepository.ensureWallet(
      payload.userId,
      DEFAULT_CURRENCY,
      payload.name,
    );
    this.logger.log(`Wallet created for user ${payload.userId}`);
  }
}

import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe = require('stripe');
import { Public } from '../../shared/decorators/public.decorator';
import { WalletService } from './wallet.service';

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      payment_status?: string;
    };
  };
}

@Controller('stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  private readonly stripe: Stripe.Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly walletService: WalletService,
    private readonly config: ConfigService,
  ) {
    this.stripe = Stripe(this.config.get<string>('STRIPE_SECRET_KEY'));
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: StripeWebhookEvent;
    try {
      event = this.stripe.webhooks.constructEvent(
        req.body as Buffer,
        signature,
        this.webhookSecret,
      ) as unknown as StripeWebhookEvent;
    } catch (err) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Stripe event received: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed': {
        if (event.data.object.payment_status === 'paid') {
          await this.walletService.settleByProviderRef(event.data.object.id);
        }
        break;
      }

      case 'checkout.session.expired': {
        await this.walletService.failByProviderRef(
          event.data.object.id,
          'Checkout session expired',
        );
        break;
      }

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }
}

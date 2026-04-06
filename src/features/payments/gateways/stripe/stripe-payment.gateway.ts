import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe = require('stripe');
import { CircuitBreaker } from '../../../../shared/circuit-breaker/circuit-breaker';
import {
  PaymentGateway,
  PaymentGatewayResult,
} from '../payment-gateway.interface';

@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(StripePaymentGateway.name);
  private readonly stripe: Stripe.Stripe;
  private readonly circuitBreaker: CircuitBreaker;

  readonly supportedMethods = ['stripe'];

  constructor(private readonly config: ConfigService) {
    this.stripe = Stripe(this.config.get<string>('STRIPE_SECRET_KEY'));
    this.circuitBreaker = new CircuitBreaker('Stripe', {
      errorThresholdPercentage: 50,
      resetTimeout: 30_000,
      volumeThreshold: 5,
      timeout: 10_000,
    });
  }

  async processDeposit(
    amount: number,
    currency: string,
    _paymentMethod: string,
    metadata?: Record<string, string>,
  ): Promise<PaymentGatewayResult> {
    return this.circuitBreaker.fire(async () => {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: amount,
              product_data: { name: `Wallet Deposit (${currency})` },
            },
            quantity: 1,
          },
        ],
        metadata: metadata ?? {},
        success_url: this.config.get<string>('STRIPE_SUCCESS_URL'),
        cancel_url: this.config.get<string>('STRIPE_CANCEL_URL'),
      });

      this.logger.log(
        `Checkout session created: ${session.id} (${amount} ${currency})`,
      );

      return {
        success: true,
        providerRef: session.id,
        checkoutUrl: session.url,
        requiresWebhook: true,
      };
    });
  }
}

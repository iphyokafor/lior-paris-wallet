import { Module } from '@nestjs/common';
import { PAYMENT_GATEWAYS } from './gateways/payment-gateway.interface';
import { PaymentGatewayRegistry } from './gateways/payment-gateway.registry';
import { StripePaymentGateway } from './gateways/stripe/stripe-payment.gateway';

@Module({
  providers: [
    StripePaymentGateway,
    PaymentGatewayRegistry,
    {
      provide: PAYMENT_GATEWAYS,
      useFactory: (stripe: StripePaymentGateway) => [stripe],
      inject: [StripePaymentGateway],
    },
  ],
  exports: [PaymentGatewayRegistry],
})
export class PaymentsModule {}

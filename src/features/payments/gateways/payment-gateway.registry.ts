import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PaymentGateway, PAYMENT_GATEWAYS } from './payment-gateway.interface';

@Injectable()
export class PaymentGatewayRegistry {
  private readonly methodToGateway = new Map<string, PaymentGateway>();

  constructor(
    @Inject(PAYMENT_GATEWAYS)
    gateways: PaymentGateway[],
  ) {
    for (const gateway of gateways) {
      for (const method of gateway.supportedMethods) {
        this.methodToGateway.set(method, gateway);
      }
    }
  }

  resolve(paymentMethod: string): PaymentGateway {
    const gateway = this.methodToGateway.get(paymentMethod);
    if (!gateway) {
      throw new BadRequestException(
        `Unsupported payment method: ${paymentMethod}`,
      );
    }
    return gateway;
  }
}

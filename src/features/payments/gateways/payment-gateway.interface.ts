export interface PaymentGatewayResult {
  success: boolean;
  providerRef?: string;
  checkoutUrl?: string;
  requiresWebhook?: boolean;
  failureReason?: string;
}

export interface PaymentGateway {
  readonly supportedMethods: string[];

  processDeposit(
    amount: number,
    currency: string,
    paymentMethod: string,
    metadata?: Record<string, string>,
  ): Promise<PaymentGatewayResult>;
}

export const PAYMENT_GATEWAYS = 'PAYMENT_GATEWAYS';

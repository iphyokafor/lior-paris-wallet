import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeWebhookController } from '../../../src/features/wallet/stripe-webhook.controller';
import { WalletService } from '../../../src/features/wallet/wallet.service';

const mockWalletService = {
  settleByProviderRef: jest.fn(),
  failByProviderRef: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const values: Record<string, string> = {
      STRIPE_SECRET_KEY: 'sk_test_fake',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
    };
    return values[key];
  }),
};

// Mock Stripe module
jest.mock('stripe', () => {
  const constructEvent = jest.fn();
  const stripeFactory = () => ({
    webhooks: { constructEvent },
  });
  stripeFactory._constructEvent = constructEvent;
  return stripeFactory;
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const stripeMock = require('stripe') as any;

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new StripeWebhookController(
      mockWalletService as unknown as WalletService,
      mockConfigService as unknown as ConfigService,
    );
  });

  const makeReq = (body: Buffer = Buffer.from('{}')) => ({ body }) as any;

  it('throws BadRequestException when stripe-signature header is missing', async () => {
    await expect(
      controller.handleWebhook(makeReq(), undefined),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when signature verification fails', async () => {
    stripeMock._constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    await expect(
      controller.handleWebhook(makeReq(), 'bad-sig'),
    ).rejects.toThrow(BadRequestException);
  });

  it('settles deposit on checkout.session.completed with paid status', async () => {
    stripeMock._constructEvent.mockReturnValue({
      id: 'evt_0',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_abc',
          payment_status: 'paid',
        },
      },
    });

    const result = await controller.handleWebhook(
      makeReq(Buffer.from('payload')),
      'valid-sig',
    );

    expect(mockWalletService.settleByProviderRef).toHaveBeenCalledWith(
      'cs_test_abc',
    );
    expect(result).toEqual({ received: true });
  });

  it('does not settle checkout.session.completed when payment_status is not paid', async () => {
    stripeMock._constructEvent.mockReturnValue({
      id: 'evt_0b',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_abc',
          payment_status: 'unpaid',
        },
      },
    });

    const result = await controller.handleWebhook(
      makeReq(Buffer.from('payload')),
      'valid-sig',
    );

    expect(mockWalletService.settleByProviderRef).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true });
  });

  it('fails deposit on checkout.session.expired', async () => {
    stripeMock._constructEvent.mockReturnValue({
      id: 'evt_exp',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_test_expired' } },
    });

    const result = await controller.handleWebhook(
      makeReq(Buffer.from('payload')),
      'valid-sig',
    );

    expect(mockWalletService.failByProviderRef).toHaveBeenCalledWith(
      'cs_test_expired',
      'Checkout session expired',
    );
    expect(result).toEqual({ received: true });
  });

  it('handles unknown event types gracefully', async () => {
    stripeMock._constructEvent.mockReturnValue({
      id: 'evt_3',
      type: 'customer.created',
      data: { object: { id: 'cus_1' } },
    });

    const result = await controller.handleWebhook(
      makeReq(Buffer.from('payload')),
      'valid-sig',
    );

    expect(mockWalletService.settleByProviderRef).not.toHaveBeenCalled();
    expect(mockWalletService.failByProviderRef).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true });
  });
});

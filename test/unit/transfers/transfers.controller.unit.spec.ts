import { Test, TestingModule } from '@nestjs/testing';
import { TransfersController } from '../../../src/features/transfers/transfers.controller';
import { TransfersService } from '../../../src/features/transfers/transfers.service';
import { SupportedCurrency } from '../../../src/shared/constants';

const mockTransfersService = {
  initiateTransfer: jest.fn(),
};

describe('TransfersController', () => {
  let controller: TransfersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransfersController],
      providers: [
        { provide: TransfersService, useValue: mockTransfersService },
      ],
    }).compile();

    controller = module.get<TransfersController>(TransfersController);
    jest.clearAllMocks();
  });

  it('delegates to service and returns JSON:API meta', async () => {
    mockTransfersService.initiateTransfer.mockResolvedValue(undefined);

    const req = { user: { id: 'user-sender' } };
    const input = {
      toWalletTag: 'user-receiver-a1b2',
      amount: 3000,
      currency: SupportedCurrency.EUR,
      idempotencyKey: 'txfr-1',
    };

    const result = await controller.initiateTransfer(req, input);

    expect(mockTransfersService.initiateTransfer).toHaveBeenCalledWith(
      'user-sender',
      undefined,
      input,
    );
    expect(result).toEqual({
      meta: { message: 'Transfer accepted' },
    });
  });
});

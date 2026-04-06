import { Test, TestingModule } from '@nestjs/testing';
import { WalletEventListener } from '../../../src/features/wallet/wallet.event-listener';
import { WalletRepository } from '../../../src/features/wallet/wallet.repository';

const mockWalletRepository = {
  ensureWallet: jest.fn(),
};

describe('WalletEventListener', () => {
  let listener: WalletEventListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletEventListener,
        { provide: WalletRepository, useValue: mockWalletRepository },
      ],
    }).compile();

    listener = module.get<WalletEventListener>(WalletEventListener);
    jest.clearAllMocks();
  });

  it('creates a wallet with the default currency when a user registers', async () => {
    mockWalletRepository.ensureWallet.mockResolvedValue({
      id: 'wallet-1',
      user_id: 'user-1',
      balance: 0,
      currency: 'EUR',
    });

    await listener.handleUserRegistered({
      userId: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    });

    expect(mockWalletRepository.ensureWallet).toHaveBeenCalledWith(
      'user-1',
      'EUR',
      'Test User',
    );
  });
});

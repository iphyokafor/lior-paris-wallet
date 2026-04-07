import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TransfersService } from '../../../src/features/transfers/transfers.service';
import { TransfersRepository } from '../../../src/features/transfers/transfers.repository';
import { WalletRepository } from '../../../src/features/wallet/wallet.repository';
import { WalletService } from '../../../src/features/wallet/wallet.service';
import { UsersRepository } from '../../../src/features/users/repository/users.repository';
import { SupportedCurrency } from '../../../src/shared/constants';

const mockFromWallet = {
  id: 'wallet-sender',
  user_id: 'user-sender',
  balance: 10000,
  currency: SupportedCurrency.EUR,
};

const mockToWallet = {
  id: 'wallet-receiver',
  user_id: 'user-receiver',
  balance: 5000,
  currency: SupportedCurrency.EUR,
};

const mockTransfer = {
  id: 'transfer-1',
  from_user_id: 'user-sender',
  to_user_id: 'user-receiver',
  amount: 3000,
  currency: SupportedCurrency.EUR,
  status: 'PENDING',
  idempotency_key: 'txfr-1',
  failure_reason: null,
};

const mockTransfersRepository = {
  findByIdempotencyKey: jest.fn(),
  createTransfer: jest.fn(),
  executeTransfer: jest.fn(),
  failTransfer: jest.fn(),
};

const mockWalletRepository = {
  findByUserIdAndCurrency: jest.fn(),
  findByWalletTag: jest.fn(),
};

const mockWalletService = {
  invalidateBalanceCache: jest.fn(),
};

const mockUsersRepository = {
  findUserById: jest.fn(),
};

describe('TransfersService', () => {
  let service: TransfersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: TransfersRepository, useValue: mockTransfersRepository },
        { provide: WalletRepository, useValue: mockWalletRepository },
        { provide: WalletService, useValue: mockWalletService },
        { provide: UsersRepository, useValue: mockUsersRepository },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
    jest.clearAllMocks();
  });

  const transferInput = {
    toWalletTag: 'user-receiver-a1b2',
    amount: 3000,
    currency: SupportedCurrency.EUR,
    idempotencyKey: 'txfr-1',
  };

  it('transfers funds between two users', async () => {
    mockWalletRepository.findByWalletTag.mockResolvedValue(mockToWallet);
    mockTransfersRepository.findByIdempotencyKey.mockResolvedValue(null);
    mockWalletRepository.findByUserIdAndCurrency.mockResolvedValue(
      mockFromWallet,
    );
    mockUsersRepository.findUserById.mockImplementation((id: string) => {
      if (id === 'user-sender')
        return { name: 'Alice', email: 'sender@test.com' };
      if (id === 'user-receiver')
        return { name: 'Bob', email: 'receiver@test.com' };
      return null;
    });
    mockTransfersRepository.createTransfer.mockResolvedValue(mockTransfer);
    mockTransfersRepository.executeTransfer.mockResolvedValue(undefined);

    await service.initiateTransfer(
      'user-sender',
      'sender@test.com',
      transferInput,
    );

    expect(mockWalletRepository.findByWalletTag).toHaveBeenCalledWith(
      'user-receiver-a1b2',
    );
    expect(mockWalletRepository.findByUserIdAndCurrency).toHaveBeenCalledWith(
      'user-sender',
      'EUR',
    );
    expect(mockTransfersRepository.createTransfer).toHaveBeenCalledWith({
      from_user_id: 'user-sender',
      to_user_id: 'user-receiver',
      amount: 3000,
      currency: SupportedCurrency.EUR,
      idempotency_key: 'txfr-1',
    });
    expect(mockTransfersRepository.executeTransfer).toHaveBeenCalledWith(
      mockTransfer,
      'wallet-sender',
      'wallet-receiver',
      expect.objectContaining({
        event_name: 'TransferCompleted',
        aggregate_id: 'transfer-1',
      }),
    );
  });

  it('throws BadRequestException when transferring to yourself', async () => {
    const selfWallet = { ...mockToWallet, user_id: 'user-sender' };
    mockWalletRepository.findByWalletTag.mockResolvedValue(selfWallet);

    await expect(
      service.initiateTransfer('user-sender', 'sender@test.com', transferInput),
    ).rejects.toThrow(BadRequestException);

    expect(mockTransfersRepository.findByIdempotencyKey).not.toHaveBeenCalled();
  });

  it('skips processing when the idempotency key was already used', async () => {
    mockWalletRepository.findByWalletTag.mockResolvedValue(mockToWallet);
    mockTransfersRepository.findByIdempotencyKey.mockResolvedValue(
      mockTransfer,
    );

    await service.initiateTransfer(
      'user-sender',
      'sender@test.com',
      transferInput,
    );

    expect(mockTransfersRepository.createTransfer).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when recipient wallet does not exist', async () => {
    mockWalletRepository.findByWalletTag.mockResolvedValue(null);

    await expect(
      service.initiateTransfer('user-sender', 'sender@test.com', transferInput),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when sender wallet does not exist', async () => {
    mockWalletRepository.findByWalletTag.mockResolvedValue(mockToWallet);
    mockTransfersRepository.findByIdempotencyKey.mockResolvedValue(null);
    mockWalletRepository.findByUserIdAndCurrency.mockResolvedValue(null);

    await expect(
      service.initiateTransfer('user-sender', 'sender@test.com', transferInput),
    ).rejects.toThrow(NotFoundException);
  });
});

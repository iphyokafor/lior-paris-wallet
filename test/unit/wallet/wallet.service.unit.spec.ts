import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from '../../../src/features/wallet/wallet.service';
import { WalletRepository } from '../../../src/features/wallet/wallet.repository';
import { PaymentGatewayRegistry } from '../../../src/features/payments/gateways/payment-gateway.registry';
import { UsersRepository } from '../../../src/features/users/repository/users.repository';
import { SupportedCurrency } from '../../../src/shared/constants';

const mockWallet = {
  id: 'wallet-1',
  user_id: 'user-1',
  balance: 10000,
  currency: SupportedCurrency.EUR,
  created_at: new Date(),
  updated_at: new Date(),
};

const mockTransaction = {
  id: 'txn-1',
  user_id: 'user-1',
  type: 'DEPOSIT',
  amount: 5000,
  currency: SupportedCurrency.EUR,
  payment_method: 'stripe',
  status: 'PENDING',
  idempotency_key: 'dep-1',
  failure_reason: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const mockLedgerEntry = {
  id: 'entry-1',
  wallet_id: 'wallet-1',
  type: 'DEPOSIT',
  amount: 5000,
  currency: SupportedCurrency.EUR,
  balance_after: 15000,
  idempotency_key: 'dep-1',
  created_at: new Date(),
  updated_at: new Date(),
};

const mockWalletRepository = {
  findByUserIdAndCurrency: jest.fn(),
  findTransactionByIdempotencyKey: jest.fn(),
  findTransactionByProviderRef: jest.fn(),
  updateTransactionProviderRef: jest.fn(),
  ensureWallet: jest.fn(),
  createTransaction: jest.fn(),
  failTransaction: jest.fn(),
  settleTransaction: jest.fn(),
};

const mockPaymentGateway = {
  supportedMethods: ['stripe'],
  processDeposit: jest.fn(),
};

const mockGatewayRegistry = {
  resolve: jest.fn().mockReturnValue(mockPaymentGateway),
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockUsersRepository = {
  findUserById: jest.fn().mockResolvedValue({ email: 'user@example.com' }),
};

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: WalletRepository, useValue: mockWalletRepository },
        { provide: PaymentGatewayRegistry, useValue: mockGatewayRegistry },
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('returns the wallet for the given user', async () => {
      mockCache.get.mockResolvedValue(null);
      mockWalletRepository.findByUserIdAndCurrency.mockResolvedValue(
        mockWallet,
      );

      const result = await service.getBalance('user-1', 'EUR');

      expect(result).toEqual(mockWallet);
      expect(mockWalletRepository.findByUserIdAndCurrency).toHaveBeenCalledWith(
        'user-1',
        'EUR',
      );
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('returns cached wallet when available', async () => {
      mockCache.get.mockResolvedValue(mockWallet);

      const result = await service.getBalance('user-1', 'EUR');

      expect(result).toEqual(mockWallet);
      expect(
        mockWalletRepository.findByUserIdAndCurrency,
      ).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when wallet does not exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockWalletRepository.findByUserIdAndCurrency.mockResolvedValue(null);

      await expect(service.getBalance('user-1', 'EUR')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deposit', () => {
    const depositInput = {
      amount: 5000,
      currency: SupportedCurrency.EUR,
      paymentMethod: 'stripe',
      idempotencyKey: 'dep-1',
    };

    it('creates transaction, calls gateway, and returns checkoutUrl', async () => {
      mockWalletRepository.findTransactionByIdempotencyKey.mockResolvedValue(
        null,
      );
      mockWalletRepository.findByUserIdAndCurrency.mockResolvedValue(
        mockWallet,
      );
      mockWalletRepository.createTransaction.mockResolvedValue(mockTransaction);
      mockPaymentGateway.processDeposit.mockResolvedValue({
        success: true,
        providerRef: 'cs_test_123',
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123',
        requiresWebhook: true,
      });

      const result = await service.deposit('user-1', depositInput);

      expect(result).toEqual({
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123',
      });
      expect(mockWalletRepository.findByUserIdAndCurrency).toHaveBeenCalledWith(
        'user-1',
        'EUR',
      );
      expect(mockWalletRepository.createTransaction).toHaveBeenCalled();
      expect(mockPaymentGateway.processDeposit).toHaveBeenCalledWith(
        5000,
        'EUR',
        'stripe',
        { transactionId: 'txn-1', userId: 'user-1' },
      );
      expect(
        mockWalletRepository.updateTransactionProviderRef,
      ).toHaveBeenCalledWith('txn-1', 'cs_test_123');
      expect(mockWalletRepository.settleTransaction).not.toHaveBeenCalled();
    });

    it('skips processing when the idempotency key was already used', async () => {
      mockWalletRepository.findTransactionByIdempotencyKey.mockResolvedValue(
        mockTransaction,
      );

      await service.deposit('user-1', depositInput);

      expect(mockWalletRepository.createTransaction).not.toHaveBeenCalled();
      expect(mockPaymentGateway.processDeposit).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when wallet does not exist', async () => {
      mockWalletRepository.findTransactionByIdempotencyKey.mockResolvedValue(
        null,
      );
      mockWalletRepository.findByUserIdAndCurrency.mockResolvedValue(null);

      await expect(service.deposit('user-1', depositInput)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('fails the transaction when the payment gateway declines', async () => {
      mockWalletRepository.findTransactionByIdempotencyKey.mockResolvedValue(
        null,
      );
      mockWalletRepository.findByUserIdAndCurrency.mockResolvedValue(
        mockWallet,
      );
      mockWalletRepository.createTransaction.mockResolvedValue(mockTransaction);
      mockPaymentGateway.processDeposit.mockResolvedValue({
        success: false,
        failureReason: 'Card declined',
      });

      await expect(service.deposit('user-1', depositInput)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockWalletRepository.failTransaction).toHaveBeenCalledWith(
        mockTransaction,
        'Card declined',
      );
      expect(mockWalletRepository.settleTransaction).not.toHaveBeenCalled();
    });
  });

  describe('settleByProviderRef', () => {
    it('settles a pending transaction found by provider_ref', async () => {
      const pendingTxn = {
        ...mockTransaction,
        status: 'PENDING',
        provider_ref: 'pi_123',
      };
      mockWalletRepository.findTransactionByProviderRef.mockResolvedValue(
        pendingTxn,
      );
      mockWalletRepository.findByUserIdAndCurrency.mockResolvedValue(
        mockWallet,
      );
      mockWalletRepository.settleTransaction.mockResolvedValue(mockLedgerEntry);

      await service.settleByProviderRef('pi_123');

      expect(
        mockWalletRepository.findTransactionByProviderRef,
      ).toHaveBeenCalledWith('pi_123');
      expect(mockWalletRepository.settleTransaction).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalled();
    });

    it('does nothing when no transaction matches the provider_ref', async () => {
      mockWalletRepository.findTransactionByProviderRef.mockResolvedValue(null);

      await service.settleByProviderRef('pi_unknown');

      expect(mockWalletRepository.settleTransaction).not.toHaveBeenCalled();
    });

    it('skips transactions that are not PENDING', async () => {
      const completedTxn = { ...mockTransaction, status: 'COMPLETED' };
      mockWalletRepository.findTransactionByProviderRef.mockResolvedValue(
        completedTxn,
      );

      await service.settleByProviderRef('pi_123');

      expect(mockWalletRepository.settleTransaction).not.toHaveBeenCalled();
    });
  });

  describe('failByProviderRef', () => {
    it('fails a pending transaction found by provider_ref', async () => {
      const pendingTxn = {
        ...mockTransaction,
        status: 'PENDING',
        provider_ref: 'pi_123',
      };
      mockWalletRepository.findTransactionByProviderRef.mockResolvedValue(
        pendingTxn,
      );

      await service.failByProviderRef('pi_123', 'Card declined');

      expect(mockWalletRepository.failTransaction).toHaveBeenCalledWith(
        pendingTxn,
        'Card declined',
      );
    });

    it('does nothing when no transaction matches the provider_ref', async () => {
      mockWalletRepository.findTransactionByProviderRef.mockResolvedValue(null);

      await service.failByProviderRef('pi_unknown', 'reason');

      expect(mockWalletRepository.failTransaction).not.toHaveBeenCalled();
    });

    it('skips transactions that are not PENDING', async () => {
      const completedTxn = { ...mockTransaction, status: 'COMPLETED' };
      mockWalletRepository.findTransactionByProviderRef.mockResolvedValue(
        completedTxn,
      );

      await service.failByProviderRef('pi_123', 'reason');

      expect(mockWalletRepository.failTransaction).not.toHaveBeenCalled();
    });
  });
});

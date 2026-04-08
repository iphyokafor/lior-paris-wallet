import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SupportedCurrency } from '../../../src/shared/constants';
import { WalletService } from '../../../src/features/wallet/wallet.service';
import { WalletRepository } from '../../../src/features/wallet/wallet.repository';
import { Wallet } from '../../../src/features/wallet/entities/wallet.entity';
import { LedgerEntry } from '../../../src/features/wallet/entities/ledger-entry.entity';
import { Transaction } from '../../../src/features/wallet/entities/transaction.entity';
import { OutboxEvent } from '../../../src/infrastructure/outbox/entities/outbox-event.entity';
import { PaymentGatewayRegistry } from '../../../src/features/payments/gateways/payment-gateway.registry';
import { PAYMENT_GATEWAYS } from '../../../src/features/payments/gateways/payment-gateway.interface';
import { UsersRepository } from '../../../src/features/users/repository/users.repository';
import { Users } from '../../../src/features/users/entities/user.entity';
import { mysqlDataSource } from '../db/mysql/int-container';

const mockCache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

const mockGateway = {
  supportedMethods: ['stripe'],
  processDeposit: jest.fn().mockResolvedValue({
    success: true,
    providerRef: 'cs_int_test',
    checkoutUrl: 'https://checkout.stripe.com/pay/cs_int_test',
    requiresWebhook: true,
  }),
};

describe('WalletService Integration', () => {
  let service: WalletService;
  let repository: WalletRepository;
  let walletRepo: Repository<Wallet>;
  let outboxRepo: Repository<OutboxEvent>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        WalletRepository,
        PaymentGatewayRegistry,
        {
          provide: PAYMENT_GATEWAYS,
          useValue: [mockGateway],
        },
        { provide: CACHE_MANAGER, useValue: mockCache },
        {
          provide: UsersRepository,
          useValue: {
            findUserById: jest
              .fn()
              .mockResolvedValue({ email: 'test@test.com' }),
          },
        },
        { provide: DataSource, useValue: mysqlDataSource },
        {
          provide: getRepositoryToken(Wallet),
          useValue: mysqlDataSource.getRepository(Wallet),
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mysqlDataSource.getRepository(Transaction),
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    repository = module.get<WalletRepository>(WalletRepository);
    walletRepo = mysqlDataSource.getRepository(Wallet);
    outboxRepo = mysqlDataSource.getRepository(OutboxEvent);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await mysqlDataSource.getRepository(LedgerEntry).delete({});
    await mysqlDataSource.getRepository(Transaction).delete({});
    await outboxRepo.delete({});
    await walletRepo.delete({});
    await mysqlDataSource.getRepository(Users).delete({});
  });

  const createUser = async (id: string, name: string): Promise<Users> => {
    const repo = mysqlDataSource.getRepository(Users);
    const user = repo.create({
      id,
      name,
      email: `${id}@test.com`,
      password: 'hashed',
    });
    return repo.save(user);
  };

  it('deposits funds and creates a ledger entry + outbox event', async () => {
    await createUser('int-user-1', 'Test User');
    const wallet = await repository.ensureWallet(
      'int-user-1',
      'EUR',
      'Test User',
    );
    mockCache.get.mockResolvedValue(null);

    const result = await service.deposit('int-user-1', {
      amount: 5000,
      currency: SupportedCurrency.EUR,
      paymentMethod: 'stripe',
      idempotencyKey: 'int-dep-1',
    });

    expect(result.checkoutUrl).toBe(
      'https://checkout.stripe.com/pay/cs_int_test',
    );

    // Transaction is PENDING until webhook settles it
    const pendingWallet = await walletRepo.findOneBy({
      user_id: 'int-user-1',
    });
    expect(Number(pendingWallet.balance)).toBe(0);

    // Simulate webhook settlement
    await service.settleByProviderRef('cs_int_test');

    const updatedWallet = await walletRepo.findOneBy({
      user_id: 'int-user-1',
    });
    expect(Number(updatedWallet.balance)).toBe(5000);

    const entries = await mysqlDataSource.getRepository(LedgerEntry).find({
      where: { wallet_id: wallet.id },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('DEPOSIT');
    expect(Number(entries[0].balance_after)).toBe(5000);

    const outboxEvents = await outboxRepo.find({
      where: { event_name: 'DepositSucceeded' },
    });
    expect(outboxEvents).toHaveLength(1);
  });

  it('rejects duplicate deposits via idempotency key', async () => {
    await createUser('int-user-2', 'Test User');
    await repository.ensureWallet('int-user-2', 'EUR', 'Test User');
    mockCache.get.mockResolvedValue(null);

    const input = {
      amount: 3000,
      currency: SupportedCurrency.EUR,
      paymentMethod: 'stripe',
      idempotencyKey: 'int-dep-dup',
    };

    await service.deposit('int-user-2', input);
    await service.deposit('int-user-2', input);

    // Settle once — only one transaction should exist
    await service.settleByProviderRef('cs_int_test');

    const wallet = await walletRepo.findOneBy({ user_id: 'int-user-2' });
    expect(Number(wallet.balance)).toBe(3000);
  });

  it('throws NotFoundException when wallet does not exist', async () => {
    mockCache.get.mockResolvedValue(null);

    await expect(service.getBalance('non-existent', 'EUR')).rejects.toThrow(
      NotFoundException,
    );
  });
});

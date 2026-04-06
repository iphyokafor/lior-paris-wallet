import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SupportedCurrency } from '../../../src/shared/constants';
import { TransfersService } from '../../../src/features/transfers/transfers.service';
import { TransfersRepository } from '../../../src/features/transfers/transfers.repository';
import { Transfer } from '../../../src/features/transfers/entities/transfer.entity';
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
    providerRef: 'int-test-ref',
  }),
};

describe('TransfersService Integration', () => {
  let service: TransfersService;
  let walletRepository: WalletRepository;
  let walletRepo: Repository<Wallet>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        TransfersRepository,
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
        {
          provide: getRepositoryToken(Transfer),
          useValue: mysqlDataSource.getRepository(Transfer),
        },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
    walletRepository = module.get<WalletRepository>(WalletRepository);
    walletRepo = mysqlDataSource.getRepository(Wallet);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await mysqlDataSource.getRepository(LedgerEntry).delete({});
    await mysqlDataSource.getRepository(Transaction).delete({});
    await mysqlDataSource.getRepository(Transfer).delete({});
    await mysqlDataSource.getRepository(OutboxEvent).delete({});
    await walletRepo.delete({});
    await mysqlDataSource.getRepository(Users).delete({});
  });

  async function createUser(id: string, name: string): Promise<Users> {
    const repo = mysqlDataSource.getRepository(Users);
    const user = repo.create({
      id,
      name,
      email: `${id}@test.com`,
      password: 'hashed',
    });
    return repo.save(user);
  }

  it('transfers funds between two wallets atomically', async () => {
    await createUser('sender-1', 'Sender One');
    await createUser('receiver-1', 'Receiver One');
    await walletRepository.ensureWallet('sender-1', 'EUR', 'Sender One');
    const receiverWallet = await walletRepository.ensureWallet(
      'receiver-1',
      'EUR',
      'Receiver One',
    );

    const senderWallet = await walletRepo.findOneBy({ user_id: 'sender-1' });
    await walletRepo.update(senderWallet.id, { balance: 10000 });

    mockCache.get.mockResolvedValue(null);

    await service.initiateTransfer('sender-1', 'sender-1@test.com', {
      toWalletTag: receiverWallet.wallet_tag,
      amount: 3000,
      currency: SupportedCurrency.EUR,
      idempotencyKey: 'int-txfr-1',
    });

    const updatedSender = await walletRepo.findOneBy({ user_id: 'sender-1' });
    const updatedReceiver = await walletRepo.findOneBy({
      user_id: 'receiver-1',
    });

    expect(Number(updatedSender.balance)).toBe(7000);
    expect(Number(updatedReceiver.balance)).toBe(3000);

    const entries = await mysqlDataSource.getRepository(LedgerEntry).find();
    expect(entries).toHaveLength(2);

    const outTypes = entries.map((e) => e.type).sort();
    expect(outTypes).toEqual(['TRANSFER_IN', 'TRANSFER_OUT']);

    const outboxEvents = await mysqlDataSource
      .getRepository(OutboxEvent)
      .find({ where: { event_name: 'TransferCompleted' } });
    expect(outboxEvents).toHaveLength(1);
  });

  it('rejects transfer when sender has insufficient balance', async () => {
    await createUser('sender-2', 'Sender Two');
    await createUser('receiver-2', 'Receiver Two');
    await walletRepository.ensureWallet('sender-2', 'EUR', 'Sender Two');
    const receiverWallet = await walletRepository.ensureWallet(
      'receiver-2',
      'EUR',
      'Receiver Two',
    );

    await expect(
      service.initiateTransfer('sender-2', 'sender-2@test.com', {
        toWalletTag: receiverWallet.wallet_tag,
        amount: 5000,
        currency: SupportedCurrency.EUR,
        idempotencyKey: 'int-txfr-fail',
      }),
    ).rejects.toThrow(BadRequestException);

    const sender = await walletRepo.findOneBy({ user_id: 'sender-2' });
    expect(Number(sender.balance)).toBe(0);
  });

  it('rejects self-transfers', async () => {
    await createUser('sender-3', 'Sender Three');
    const senderWallet = await walletRepository.ensureWallet(
      'sender-3',
      'EUR',
      'Sender Three',
    );

    await expect(
      service.initiateTransfer('sender-3', 'sender-3@test.com', {
        toWalletTag: senderWallet.wallet_tag,
        amount: 1000,
        currency: SupportedCurrency.EUR,
        idempotencyKey: 'int-txfr-self',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate transfers via idempotency key', async () => {
    await createUser('sender-4', 'Sender Four');
    await createUser('receiver-4', 'Receiver Four');
    await walletRepository.ensureWallet('sender-4', 'EUR', 'Sender Four');
    const receiverWallet = await walletRepository.ensureWallet(
      'receiver-4',
      'EUR',
      'Receiver Four',
    );

    const senderWallet = await walletRepo.findOneBy({ user_id: 'sender-4' });
    await walletRepo.update(senderWallet.id, { balance: 10000 });

    mockCache.get.mockResolvedValue(null);

    const input = {
      toWalletTag: receiverWallet.wallet_tag,
      amount: 2000,
      currency: SupportedCurrency.EUR,
      idempotencyKey: 'int-txfr-dup',
    };

    await service.initiateTransfer('sender-4', 'sender-4@test.com', input);
    await service.initiateTransfer('sender-4', 'sender-4@test.com', input);

    const sender = await walletRepo.findOneBy({ user_id: 'sender-4' });
    expect(Number(sender.balance)).toBe(8000);
  });
});

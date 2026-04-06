import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { createConnection } from 'mysql2/promise';
import { DataSource } from 'typeorm';
import { Users } from '../../../../src/features/users/entities/user.entity';
import { Wallet } from '../../../../src/features/wallet/entities/wallet.entity';
import { LedgerEntry } from '../../../../src/features/wallet/entities/ledger-entry.entity';
import { Transaction } from '../../../../src/features/wallet/entities/transaction.entity';
import { Transfer } from '../../../../src/features/transfers/entities/transfer.entity';
import { OutboxEvent } from '../../../../src/infrastructure/outbox/entities/outbox-event.entity';

let mysqlContainer: StartedMySqlContainer;
let mysqlClient: any;
let mysqlDataSource: DataSource;

beforeAll(async () => {
  mysqlContainer = await new MySqlContainer().start();

  mysqlClient = await createConnection({
    host: mysqlContainer.getHost(),
    port: mysqlContainer.getPort(),
    database: mysqlContainer.getDatabase(),
    user: mysqlContainer.getUsername(),
    password: 'test',
  });

  let connected = false;
  const maxRetries = 3;
  let attempts = 0;
  let lastError: unknown;

  while (!connected && attempts < maxRetries) {
    try {
      await mysqlClient.query('SELECT 1');
      connected = true;
    } catch (err) {
      lastError = err;
      attempts++;
      await new Promise((res) => setTimeout(res, 3000));
    }
  }

  if (!connected) {
    throw lastError ?? new Error('Failed to connect to the test database');
  }

  const databaseUrl = `mysql://${mysqlContainer.getUsername()}:test@${mysqlContainer.getHost()}:${mysqlContainer.getPort()}/${mysqlContainer.getDatabase()}`;

  mysqlDataSource = new DataSource({
    type: 'mysql',
    url: databaseUrl,
    entities: [Users, Wallet, LedgerEntry, Transaction, Transfer, OutboxEvent],
    synchronize: true,
    logging: false,
  });

  await mysqlDataSource.initialize();
}, 60_000);

afterAll(async () => {
  try {
    await mysqlDataSource?.destroy();
  } catch (err) {
    const error = err as { name?: string } | undefined;
    if (error?.name !== 'CannotExecuteNotConnectedError') {
      throw err;
    }
  } finally {
    await mysqlClient?.end();
    await mysqlContainer?.stop();
  }
}, 60_000);

jest.setTimeout(30000);
export { mysqlClient, mysqlDataSource };

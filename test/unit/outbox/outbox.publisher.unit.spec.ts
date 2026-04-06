import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { OutboxPublisher } from '../../../src/infrastructure/outbox/outbox.publisher';
import { OutboxService } from '../../../src/infrastructure/outbox/outbox.service';
import { QUEUE_NAMES } from '../../../src/infrastructure/queue/queue.constants';

const mockOutboxService = {
  findUnprocessed: jest.fn(),
  markProcessed: jest.fn(),
  markFailedAttempt: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

describe('OutboxPublisher', () => {
  let publisher: OutboxPublisher;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxPublisher,
        { provide: OutboxService, useValue: mockOutboxService },
        {
          provide: getQueueToken(QUEUE_NAMES.DOMAIN_EVENTS),
          useValue: mockQueue,
        },
      ],
    }).compile();

    publisher = module.get<OutboxPublisher>(OutboxPublisher);
    jest.clearAllMocks();
  });

  it('publishes pending outbox events to the queue and marks them processed', async () => {
    const outboxEvent = {
      id: 'outbox-1',
      event_name: 'DepositSucceeded',
      aggregate_id: 'wallet-1',
      payload_json: { userId: 'user-1', amount: 5000 },
      occurred_at: new Date(),
    };

    mockOutboxService.findUnprocessed.mockResolvedValue([outboxEvent]);
    mockQueue.add.mockResolvedValue({});
    mockOutboxService.markProcessed.mockResolvedValue(undefined);

    await publisher.publishPendingEvents();

    expect(mockQueue.add).toHaveBeenCalledWith('DepositSucceeded', {
      outboxId: 'outbox-1',
      eventName: 'DepositSucceeded',
      aggregateId: 'wallet-1',
      payload: outboxEvent.payload_json,
      occurredAt: outboxEvent.occurred_at,
    });
    expect(mockOutboxService.markProcessed).toHaveBeenCalledWith('outbox-1');
  });

  it('does nothing when there are no pending events', async () => {
    mockOutboxService.findUnprocessed.mockResolvedValue([]);

    await publisher.publishPendingEvents();

    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('marks the event as failed when publishing throws', async () => {
    const outboxEvent = {
      id: 'outbox-2',
      event_name: 'TransferCompleted',
      aggregate_id: 'transfer-1',
      payload_json: {},
      occurred_at: new Date(),
    };

    mockOutboxService.findUnprocessed.mockResolvedValue([outboxEvent]);
    mockQueue.add.mockRejectedValue(new Error('Redis down'));
    mockOutboxService.markFailedAttempt.mockResolvedValue(undefined);

    await publisher.publishPendingEvents();

    expect(mockOutboxService.markFailedAttempt).toHaveBeenCalledWith(
      'outbox-2',
    );
    expect(mockOutboxService.markProcessed).not.toHaveBeenCalled();
  });
});

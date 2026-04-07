import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { DomainEventsProcessor } from '../../../src/features/notifications/domain-events.processor';
import { QUEUE_NAMES } from '../../../src/infrastructure/queue/queue.constants';

const mockNotificationsQueue = {
  add: jest.fn(),
};

describe('DomainEventsProcessor', () => {
  let processor: DomainEventsProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainEventsProcessor,
        {
          provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS),
          useValue: mockNotificationsQueue,
        },
      ],
    }).compile();

    processor = module.get<DomainEventsProcessor>(DomainEventsProcessor);
    jest.clearAllMocks();
  });

  it('routes DepositSucceeded to the notifications queue', async () => {
    const job = {
      data: {
        eventName: 'DepositSucceeded',
        payload: { userId: 'user-1', amount: 5000 },
      },
    };

    await processor.process(job as any);

    expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
      'DepositSucceeded',
      expect.objectContaining({
        eventName: 'DepositSucceeded',
        payload: { userId: 'user-1', amount: 5000 },
      }),
    );
  });

  it('routes TransferCompleted to two notification jobs', async () => {
    const job = {
      data: {
        eventName: 'TransferCompleted',
        payload: { fromUserId: 'user-1', toUserId: 'user-2' },
      },
    };

    await processor.process(job as any);

    expect(mockNotificationsQueue.add).toHaveBeenCalledTimes(2);
    expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
      'TransferSent',
      expect.objectContaining({
        eventName: 'TransferSent',
        payload: { fromUserId: 'user-1', toUserId: 'user-2' },
      }),
    );
    expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
      'TransferReceived',
      expect.objectContaining({
        eventName: 'TransferReceived',
        payload: { fromUserId: 'user-1', toUserId: 'user-2' },
      }),
    );
  });

  it('does not enqueue notifications for unknown event types', async () => {
    const job = {
      data: {
        eventName: 'SomeInternalEvent',
        payload: {},
      },
    };

    await processor.process(job as any);

    expect(mockNotificationsQueue.add).not.toHaveBeenCalled();
  });
});

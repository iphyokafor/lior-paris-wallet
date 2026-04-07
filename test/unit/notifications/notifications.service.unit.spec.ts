import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../../../src/features/notifications/notifications.service';

const mockConfigService = {
  get: jest.fn().mockReturnValue(undefined),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('logs a deposit notification', async () => {
    const logSpy = jest.spyOn(service['logger'], 'log');

    await service.send('DepositSucceeded', {
      userId: 'user-1',
      amount: 5000,
      currency: 'EUR',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('deposit of 5000 EUR'),
    );
  });

  it('logs a transfer sent notification', async () => {
    const logSpy = jest.spyOn(service['logger'], 'log');

    await service.send('TransferSent', {
      fromUserId: 'user-1',
      toUserId: 'user-2',
      amount: 3000,
      currency: 'EUR',
      fromUserName: 'Alice',
      toUserName: 'Bob',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('transfer of 3000 EUR to Bob is complete'),
    );
  });

  it('logs a transfer received notification', async () => {
    const logSpy = jest.spyOn(service['logger'], 'log');

    await service.send('TransferReceived', {
      fromUserId: 'user-1',
      toUserId: 'user-2',
      amount: 3000,
      currency: 'EUR',
      fromUserName: 'Alice',
      toUserName: 'Bob',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('received 3000 EUR from Alice'),
    );
  });

  it('logs a generic notification for unknown events', async () => {
    const logSpy = jest.spyOn(service['logger'], 'log');

    await service.send('UnknownEvent', { data: 'test' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('UnknownEvent'),
    );
  });
});

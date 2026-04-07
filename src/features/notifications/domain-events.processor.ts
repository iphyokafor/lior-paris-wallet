import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { DomainEventName } from '../../shared/events/domain-event-name';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';

@Processor(QUEUE_NAMES.DOMAIN_EVENTS)
export class DomainEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(DomainEventsProcessor.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { eventName, payload } = job.data;
    this.logger.log(`Processing domain event: ${eventName}`);

    if (eventName === DomainEventName.TransferCompleted) {
      await this.notificationsQueue.add(DomainEventName.TransferSent, {
        eventName: DomainEventName.TransferSent,
        payload,
        enqueuedAt: new Date().toISOString(),
      });
      await this.notificationsQueue.add(DomainEventName.TransferReceived, {
        eventName: DomainEventName.TransferReceived,
        payload,
        enqueuedAt: new Date().toISOString(),
      });
      return;
    }

    const notifyEvents: string[] = [DomainEventName.DepositSucceeded];

    if (notifyEvents.includes(eventName)) {
      await this.notificationsQueue.add(eventName, {
        eventName,
        payload,
        enqueuedAt: new Date().toISOString(),
      });
    }
  }
}

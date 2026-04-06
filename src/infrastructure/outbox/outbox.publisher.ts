import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private processing = false;

  constructor(
    private readonly outboxService: OutboxService,
    @InjectQueue(QUEUE_NAMES.DOMAIN_EVENTS)
    private readonly domainEventsQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async publishPendingEvents(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    try {
      const events = await this.outboxService.findUnprocessed();
      if (events.length === 0) return;

      for (const event of events) {
        try {
          await this.domainEventsQueue.add(event.event_name, {
            outboxId: event.id,
            eventName: event.event_name,
            aggregateId: event.aggregate_id,
            payload: event.payload_json,
            occurredAt: event.occurred_at,
          });

          await this.outboxService.markProcessed(event.id);
        } catch (error) {
          this.logger.error(
            `Failed to publish outbox event ${event.id}: ${error.message}`,
          );
          await this.outboxService.markFailedAttempt(event.id);
        }
      }

      this.logger.log(`Published ${events.length} outbox events`);
    } finally {
      this.processing = false;
    }
  }
}

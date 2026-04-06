import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { NotificationsService } from './notifications.service';

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectQueue(QUEUE_NAMES.DEAD_LETTER)
    private readonly deadLetterQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { eventName, payload } = job.data;
    this.logger.log(`Sending notification for: ${eventName}`);

    await this.notificationsService.send(eventName, payload);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error): Promise<void> {
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      this.logger.warn(
        `Job ${job.id} exhausted all attempts — moving to DLQ: ${error.message}`,
      );

      await this.deadLetterQueue.add(`dlq:${job.name}`, {
        originalQueue: QUEUE_NAMES.NOTIFICATIONS,
        originalJobId: job.id,
        originalJobName: job.name,
        data: job.data,
        dlqCount: job.data._dlqMeta?.dlqCount ?? 0,
        failedReason: error.message,
        failedAt: new Date().toISOString(),
        attemptsMade: job.attemptsMade,
      });
    }
  }
}

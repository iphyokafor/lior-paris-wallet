import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';

const MAX_DLQ_REPROCESS = 3;

@Processor(QUEUE_NAMES.DEAD_LETTER)
export class DeadLetterProcessor extends WorkerHost {
  private readonly logger = new Logger(DeadLetterProcessor.name);
  private readonly queueMap: Record<string, Queue>;

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DOMAIN_EVENTS)
    private readonly domainEventsQueue: Queue,
  ) {
    super();
    this.queueMap = {
      [QUEUE_NAMES.NOTIFICATIONS]: this.notificationsQueue,
      [QUEUE_NAMES.DOMAIN_EVENTS]: this.domainEventsQueue,
    };
  }

  async process(job: Job): Promise<void> {
    const { originalQueue, originalJobName, data, dlqCount = 0 } = job.data;

    if (dlqCount >= MAX_DLQ_REPROCESS) {
      this.logger.error(
        `Job ${job.id} exceeded max DLQ reprocess limit (${MAX_DLQ_REPROCESS}). Permanently failed.`,
      );
      return;
    }

    const targetQueue = this.queueMap[originalQueue];
    if (!targetQueue) {
      this.logger.error(`Unknown original queue: ${originalQueue}`);
      return;
    }

    this.logger.log(
      `Reprocessing DLQ job ${job.id} → ${originalQueue}:${originalJobName} (dlqCount: ${dlqCount + 1}/${MAX_DLQ_REPROCESS})`,
    );

    await targetQueue.add(originalJobName, {
      ...data,
      _dlqMeta: { dlqCount: dlqCount + 1 },
    });
  }
}

import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRequiredString, getNumber } from '../../shared/config/config.utils';
import { QUEUE_NAMES } from './queue.constants';
import { DeadLetterProcessor } from './dead-letter.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: getRequiredString(config, 'REDIS_HOST'),
          port: getNumber(config, 'REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.DOMAIN_EVENTS,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { age: 86400, count: 200 },
          removeOnFail: { age: 604800, count: 500 },
        },
      },
      {
        name: QUEUE_NAMES.NOTIFICATIONS,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { age: 86400, count: 200 },
          removeOnFail: { age: 604800, count: 500 },
        },
      },
      {
        name: QUEUE_NAMES.DEAD_LETTER,
        defaultJobOptions: {
          removeOnComplete: { age: 604800, count: 1000 },
        },
      },
    ),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature(
      { name: QUEUE_NAMES.DOMAIN_EVENTS, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.NOTIFICATIONS, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.DEAD_LETTER, adapter: BullMQAdapter },
    ),
  ],
  exports: [BullModule],
  providers: [DeadLetterProcessor],
})
export class QueueModule {}

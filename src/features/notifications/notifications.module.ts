import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { DomainEventsProcessor } from './domain-events.processor';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [QueueModule, ConfigModule],
  providers: [
    NotificationsService,
    DomainEventsProcessor,
    NotificationsProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

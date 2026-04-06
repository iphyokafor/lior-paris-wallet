import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';

const MAX_RETRIES = 5;

@Injectable()
export class OutboxService {
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
  ) {}

  async findUnprocessed(limit: number = 50): Promise<OutboxEvent[]> {
    return this.outboxRepository.find({
      where: {
        processed_at: IsNull(),
        retry_count: LessThan(MAX_RETRIES),
      },
      order: { created_at: 'ASC' },
      take: limit,
    });
  }

  async markProcessed(id: string): Promise<void> {
    await this.outboxRepository.update(id, {
      processed_at: new Date(),
    });
  }

  async markFailedAttempt(id: string): Promise<void> {
    await this.outboxRepository.increment({ id }, 'retry_count', 1);
  }
}

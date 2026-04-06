import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/base/base.entity';
import { TABLES } from '../../../shared/constants';

@Entity(TABLES.outbox_event)
@Index(['processed_at'])
@Index(['event_name'])
export class OutboxEvent extends BaseEntity {
  @Column({ nullable: false })
  event_name: string;

  @Column({ nullable: false })
  aggregate_id: string;

  @Column({ type: 'json', nullable: false })
  payload_json: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: false })
  occurred_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  processed_at: Date | null;

  @Column({ type: 'int', default: 0, nullable: false })
  retry_count: number;
}

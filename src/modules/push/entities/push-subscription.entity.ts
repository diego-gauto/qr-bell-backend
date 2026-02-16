import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('push_subscriptions')
export class PushSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_push_subscriptions_owner_id')
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Index('UQ_push_subscriptions_endpoint', { unique: true })
  @Column({ type: 'varchar', length: 1024 })
  endpoint!: string;

  @Column({ name: 'p256dh_key', type: 'varchar', length: 512 })
  p256dhKey!: string;

  @Column({ name: 'auth_key', type: 'varchar', length: 512 })
  authKey!: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @Column({ name: 'last_notified_at', type: 'timestamptz', nullable: true })
  lastNotifiedAt!: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

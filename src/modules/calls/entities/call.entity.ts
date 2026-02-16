import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type CallStatus = 'ringing' | 'accepted' | 'missed';

@Entity('calls')
export class CallEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_calls_home_id')
  @Column({ name: 'home_id', type: 'uuid' })
  homeId!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: CallStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'answered_at', type: 'timestamptz', nullable: true })
  answeredAt!: Date | null;

  @Column({ name: 'missed_at', type: 'timestamptz', nullable: true })
  missedAt!: Date | null;
}

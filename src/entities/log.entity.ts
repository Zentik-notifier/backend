import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LogLevel } from './log-output.entity';

@ObjectType()
@Entity('logs')
@Index('idx_logs_timestamp', ['timestamp'])
@Index('idx_logs_level', ['level'])
@Index('idx_logs_context', ['context'])
export class Log {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => LogLevel)
  @ApiProperty({ enum: LogLevel })
  @Column({
    type: 'enum',
    enum: LogLevel,
    enumName: 'log_level_enum',
  })
  level: LogLevel;

  @Field()
  @ApiProperty()
  @Column({ type: 'text' })
  message: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  context?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  trace?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Field()
  @ApiProperty()
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}

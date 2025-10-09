import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
export enum LogOutputType {
  PROMTAIL = 'PROMTAIL',
  SYSLOG = 'SYSLOG',
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly',
}

registerEnumType(LogOutputType, { name: 'LogOutputType' });
registerEnumType(LogLevel, { name: 'LogLevel' });

@ObjectType()
@Entity('log_outputs')
export class LogOutput {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Field(() => LogOutputType)
  @ApiProperty({ enum: LogOutputType })
  @Column({
    type: 'enum',
    enum: LogOutputType,
    enumName: 'log_output_type_enum',
  })
  type: LogOutputType;

  @Field()
  @ApiProperty()
  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  // Promtail specific fields (pushes logs to Loki)
  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true })
  promtailUrl?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  promtailUsername?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  promtailPassword?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'jsonb', nullable: true })
  promtailLabels?: Record<string, string>;

  // Syslog specific fields
  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  syslogHost?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true })
  syslogPort?: number;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 10, nullable: true })
  syslogProtocol?: string; // 'tcp', 'udp', or 'tls'

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  syslogAppName?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 50, nullable: true })
  syslogFacility?: string;

  // Common fields
  @Field(() => LogLevel)
  @ApiProperty({ enum: LogLevel, default: LogLevel.INFO })
  @Column({
    type: 'enum',
    enum: LogLevel,
    enumName: 'log_level_enum',
    default: LogLevel.INFO,
  })
  minLevel: LogLevel;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  additionalConfig?: string;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}

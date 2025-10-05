import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum ExecutionType {
  WEBHOOK = 'WEBHOOK',
  PAYLOAD_MAPPER = 'PAYLOAD_MAPPER',
}

registerEnumType(ExecutionType, {
  name: 'ExecutionType',
  description: 'Types of executions that are tracked',
});

export enum ExecutionStatus {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  TIMEOUT = 'TIMEOUT',
  SKIPPED = 'SKIPPED',
}

registerEnumType(ExecutionStatus, {
  name: 'ExecutionStatus',
  description: 'Status of the execution',
});

@ObjectType()
@Entity('entity_executions')
export class EntityExecution {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ExecutionType)
  @ApiProperty({ enum: ExecutionType })
  @Column({ type: 'enum', enum: ExecutionType })
  type: ExecutionType;

  @Field(() => ExecutionStatus)
  @ApiProperty({ enum: ExecutionStatus })
  @Column({ type: 'enum', enum: ExecutionStatus })
  status: ExecutionStatus;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Name or identifier of the executed entity',
  })
  @Column({ nullable: true })
  entityName?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'ID of the executed entity' })
  @Column({ nullable: true })
  entityId?: string;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Field()
  @ApiProperty()
  @Column()
  userId: string;

  @Field()
  @ApiProperty({ description: 'Input data as string' })
  @Column({ type: 'text' })
  input: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Output data as string' })
  @Column({ type: 'text', nullable: true })
  output?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Error message as string' })
  @Column({ type: 'text', nullable: true })
  errors?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Duration in milliseconds' })
  @Column({ type: 'bigint', nullable: true })
  durationMs?: number;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}

import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GraphQLJSON } from '../common/types/json.type';

export enum UserLogType {
  FEEDBACK = 'FEEDBACK',
  APP_LOG = 'APP_LOG',
}

registerEnumType(UserLogType, {
  name: 'UserLogType',
  description: 'Type of user log entry',
});

@ObjectType()
@Entity('user_logs')
export class UserLog {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => UserLogType)
  @Column({
    type: 'enum',
    enum: UserLogType,
    nullable: false,
  })
  type: UserLogType;

  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Field(() => GraphQLJSON)
  @Column({ type: 'jsonb', nullable: false })
  payload: Record<string, any>;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}



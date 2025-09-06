import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum EventType {
  LOGIN = 'LOGIN',
  LOGIN_OAUTH = 'LOGIN_OAUTH',
  LOGOUT = 'LOGOUT',
  REGISTER = 'REGISTER',
  PUSH_PASSTHROUGH = 'PUSH_PASSTHROUGH',
  MESSAGE = 'MESSAGE',
  NOTIFICATION = 'NOTIFICATION',
  BUCKET_SHARING = 'BUCKET_SHARING',
  BUCKET_UNSHARING = 'BUCKET_UNSHARING',
  DEVICE_REGISTER = 'DEVICE_REGISTER',
  DEVICE_UNREGISTER = 'DEVICE_UNREGISTER',
  ACCOUNT_DELETE = 'ACCOUNT_DELETE',
}

registerEnumType(EventType, {
  name: 'EventType',
  description: 'Tipo di evento tracciato',
});

@ObjectType()
@Entity('events')
export class Event {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => EventType)
  @Column({
    type: 'enum',
    enum: EventType,
    nullable: false,
  })
  type: EventType;

  @Field({ nullable: true })
  @Column({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  objectId?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}

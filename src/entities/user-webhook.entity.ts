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
import { GraphQLJSON } from '../common/types/json.type';
import { User } from './user.entity';

@ObjectType()
export class WebhookBody {
  @Field(() => String, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Webhook body content as JSON string',
  })
  content?: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Content type of the webhook body',
  })
  contentType?: string;
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

registerEnumType(HttpMethod, {
  name: 'HttpMethod',
  description: 'HTTP methods for webhooks',
});

@ObjectType()
export class WebhookHeader {
  @Field()
  @ApiProperty({ description: 'Header key' })
  key: string;

  @Field()
  @ApiProperty({ description: 'Header value' })
  value: string;
}

@ObjectType()
@Entity('user_webhooks')
export class UserWebhook {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty()
  @Column()
  name: string;

  @Field(() => HttpMethod)
  @ApiProperty({ enum: HttpMethod })
  @Column({ type: 'enum', enum: HttpMethod })
  method: HttpMethod;

  @Field()
  @ApiProperty()
  @Column({ type: 'text' })
  url: string;

  @Field(() => [WebhookHeader])
  @ApiProperty({ type: [WebhookHeader] })
  @Column({ type: 'jsonb', default: [] })
  headers: WebhookHeader[];

  @Field(() => GraphQLJSON, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Webhook body content as JSON object',
  })
  @Column({ type: 'jsonb', nullable: true })
  body?: any;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.webhooks, { onDelete: 'CASCADE' })
  user: User;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}

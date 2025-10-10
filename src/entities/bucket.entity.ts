import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityPermission } from './entity-permission.entity';
import { Message } from './message.entity';
import { UserBucket } from './user-bucket.entity';
import { User } from './user.entity';

@ObjectType()
@Entity('buckets')
export class Bucket {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty()
  @Column()
  name: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  icon: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  description: string;

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Hex color code for the bucket (e.g., #FF5733)',
  })
  @Column({ nullable: true })
  color?: string;

  @Field({ nullable: true })
  @ApiProperty({
    description: 'Whether the bucket is protected from deletion',
    default: false,
    required: false,
  })
  @Column({ default: false })
  isProtected?: boolean;

  @Field({ nullable: true })
  @ApiProperty({
    description: 'Whether the bucket is publicly accessible',
    default: false,
    required: false,
  })
  @Column({ default: false })
  isPublic?: boolean;

  @Field({ nullable: true })
  @ApiProperty({
    description: 'Whether the bucket is an admin-only system bucket',
    default: false,
    required: false,
  })
  @Column({ default: false })
  isAdmin?: boolean;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.buckets, { onDelete: 'CASCADE' })
  user: User;

  @Field(() => [Message], { nullable: true })
  @ApiProperty({ type: [Message] })
  @OneToMany(() => Message, (message) => message.bucket)
  messages: Message[];

  @Field(() => [UserBucket], { nullable: true })
  @ApiProperty({ type: [UserBucket], required: false })
  @OneToMany(() => UserBucket, (userBucket) => userBucket.bucket)
  userBuckets?: UserBucket[];

  @Field(() => UserBucket, { nullable: true })
  userBucket?: UserBucket;

  @Field(() => [EntityPermission], { nullable: true })
  @ApiProperty({ type: [EntityPermission], required: false })
  permissions?: EntityPermission[];

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}

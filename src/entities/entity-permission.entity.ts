import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { Permission } from 'src/auth/dto/auth.dto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@ObjectType()
@Entity('entity_permissions')
@Unique(['resourceType', 'resourceId', 'user'])
@Index(['resourceType', 'resourceId'])
export class EntityPermission {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty({
    description:
      'Type of the resource (e.g., bucket, notification, user_webhook)',
  })
  @Column()
  resourceType: string;

  @Field()
  @ApiProperty({ description: 'ID of the resource' })
  @Column('uuid')
  resourceId: string;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  user: User;

  @Field(() => User, { nullable: true })
  @ApiProperty({
    type: () => User,
    required: false,
    description: 'User who granted these permissions',
  })
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  grantedBy: User;

  @Field(() => [Permission])
  @ApiProperty({ enum: Permission, isArray: true })
  @Column('simple-array')
  permissions: Permission[];

  @Field({ nullable: true })
  @ApiProperty({
    required: false,
    description: 'Optional expiration date for the permissions',
  })
  @Column({ nullable: true })
  expiresAt: Date;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}

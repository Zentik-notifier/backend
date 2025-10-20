import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Permission, ResourceType } from '../auth/dto/auth.dto';

@ObjectType()
@Entity('invite_codes')
export class InviteCode {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String, { description: 'Unique invite code' })
  @Column({ unique: true })
  @Index()
  code: string;

  @Field(() => String, { description: 'Resource type (BUCKET, etc.)' })
  @Column({ type: 'enum', enum: ResourceType })
  resourceType: ResourceType;

  @Field(() => String, { description: 'Resource ID this code grants access to' })
  @Column()
  @Index()
  resourceId: string;

  @Field(() => String, { description: 'User who created this code' })
  @Column()
  createdBy: string;

  @Field(() => User)
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @Field(() => [String], { description: 'Permissions granted by this code' })
  @Column('simple-array')
  permissions: Permission[];

  @Field(() => String, { nullable: true, description: 'Expiration date for this code' })
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Field(() => Number, { description: 'Number of times this code has been used' })
  @Column({ default: 0 })
  usageCount: number;

  @Field(() => Number, { nullable: true, description: 'Maximum number of uses (null = unlimited)' })
  @Column({ nullable: true })
  maxUses: number | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}


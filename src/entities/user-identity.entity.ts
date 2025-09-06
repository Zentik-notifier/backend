import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@ObjectType()
@Entity('user_identities')
@Unique(['provider', 'providerId'])
export class UserIdentity {
  @Field(() => ID)
  @ApiProperty({ example: 'uuid-string' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty({ example: 'github' })
  @Index()
  @Column()
  provider: string;

  @Field()
  @ApiProperty({ example: '123456' })
  @Column()
  providerId: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({ example: 'octocat@example.com', required: false })
  @Column({ type: 'text', nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({
    example: 'https://avatars.githubusercontent.com/u/1',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  avatarUrl?: string | null;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field()
  @ApiProperty({ example: 'uuid-string' })
  @Column({ type: 'uuid' })
  userId: string;

  @Field()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;
}

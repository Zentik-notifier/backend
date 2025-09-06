import { Field, ObjectType } from '@nestjs/graphql';
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

@Entity('user_access_tokens')
@ObjectType()
export class UserAccessToken {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  @Field()
  id: string;

  @Column()
  @ApiProperty()
  @Field()
  name: string;

  @Column({ unique: true })
  @ApiProperty()
  tokenHash: string; // Store hashed version of the token

  @Column({ nullable: true })
  @ApiProperty({ required: false })
  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  @Column('simple-array', { nullable: true })
  @ApiProperty({ type: [String], required: false })
  @Field(() => [String], { nullable: true })
  scopes?: string[];

  @Column({ nullable: true })
  @ApiProperty({ required: false })
  @Field(() => Date, { nullable: true })
  lastUsed?: Date;

  @CreateDateColumn()
  @ApiProperty()
  @Field()
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty()
  @Field()
  updatedAt: Date;

  @Column()
  @ApiProperty()
  @Field()
  userId: string;

  @ManyToOne(() => User, (user) => user.accessTokens, { onDelete: 'CASCADE' })
  @ApiProperty({ type: () => User })
  @Field(() => User)
  user: User;

  // Virtual field to check if token is expired
  @Field()
  get isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }
}

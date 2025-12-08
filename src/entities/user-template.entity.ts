import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@ObjectType()
@Entity('user_templates')
export class UserTemplate {
  @Field(() => ID)
  @ApiProperty({ example: 'uuid-string' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty({ description: 'Template name' })
  @Column()
  name: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Template description' })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Title template' })
  @Column({ type: 'text', nullable: true })
  title?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Subtitle template' })
  @Column({ type: 'text', nullable: true })
  subtitle?: string;

  @Field()
  @ApiProperty({ description: 'Body template (required)' })
  @Column({ type: 'text' })
  body: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Input data for the template' })
  @Column({ type: 'text', nullable: true })
  input?: string;

  @Field({ nullable: true })
  @ApiProperty({ required: false, description: 'Output data from the template' })
  @Column({ type: 'text', nullable: true })
  output?: string;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
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

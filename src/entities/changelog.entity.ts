import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@ObjectType()
export class ChangelogEntry {
  @Field(() => String)
  @ApiProperty({ description: 'Entry type', example: 'feature' })
  type: string;

  @Field(() => String)
  @ApiProperty({ description: 'Entry text' })
  text: string;
}

@ObjectType()
@Entity('changelogs')
export class Changelog {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String, { description: 'iOS app version' })
  @ApiProperty({ description: 'iOS app version' })
  @Column({ type: 'character varying', length: 50 })
  iosVersion: string;

  @Field(() => String, { description: 'Android app version' })
  @ApiProperty({ description: 'Android app version' })
  @Column({ type: 'character varying', length: 50 })
  androidVersion: string;

  @Field(() => String, { description: 'Web/UI version' })
  @ApiProperty({ description: 'Web/UI version' })
  @Column({ type: 'character varying', length: 50 })
  uiVersion: string;

  @Field(() => String, { description: 'Backend/server version' })
  @ApiProperty({ description: 'Backend/server version' })
  @Column({ type: 'character varying', length: 50 })
  backendVersion: string;

  @Field(() => String, { description: 'Combined changelog description' })
  @ApiProperty({ description: 'Combined changelog description' })
  @Column({ type: 'text' })
  description: string;

  @Field(() => Boolean, {
    description: 'Whether this changelog is active and should be shown',
  })
  @ApiProperty({ description: 'Whether this changelog is active', default: true })
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Field(() => [ChangelogEntry], {
    nullable: true,
    description: 'Structured changelog entries (type + text)',
  })
  @ApiProperty({
    description: 'Structured changelog entries',
    required: false,
    type: () => [ChangelogEntry],
  })
  @Column({ type: 'jsonb', nullable: true })
  entries?: ChangelogEntry[] | null;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}

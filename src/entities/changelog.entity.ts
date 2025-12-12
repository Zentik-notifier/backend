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

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}

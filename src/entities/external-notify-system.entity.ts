import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
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
import { Bucket } from './bucket.entity';
import { User } from './user.entity';

export enum ExternalNotifySystemType {
  NTFY = 'NTFY',
  Gotify = 'Gotify',
}

registerEnumType(ExternalNotifySystemType, {
  name: 'ExternalNotifySystemType',
  description: 'Type of external notification system (each has its own publish/subscribe implementation)',
});

@ObjectType()
@Entity('external_notify_systems')
export class ExternalNotifySystem {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ExternalNotifySystemType)
  @ApiProperty({ enum: ExternalNotifySystemType })
  @Column({
    type: 'enum',
    enum: ExternalNotifySystemType,
    enumName: 'external_notify_system_type_enum',
    default: ExternalNotifySystemType.NTFY,
  })
  type: ExternalNotifySystemType;

  @Field()
  @ApiProperty({ description: 'User-defined name for this system (e.g. "NTFY Casa")' })
  @Column()
  name: string;

  @Field()
  @ApiProperty({ description: 'Base URL of the external notification service' })
  @Column()
  baseUrl: string;

  @Field()
  @ApiProperty({
    description:
      'Generic target identifier: topic (NTFY), app id (Gotify), channel, etc.',
  })
  @Column()
  channel: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false, description: 'Icon URL for the system' })
  @Column({ type: 'varchar', nullable: true })
  iconUrl?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({
    required: false,
    description: 'Hex color code (e.g. #FF5733)',
  })
  @Column({ type: 'varchar', nullable: true })
  color?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false, description: 'Auth username for the external system' })
  @Column({ type: 'varchar', nullable: true })
  authUser?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false, description: 'Auth password for the external system' })
  @Column({ type: 'varchar', nullable: true })
  authPassword?: string | null;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false, description: 'Auth token for the external system' })
  @Column({ type: 'varchar', nullable: true })
  authToken?: string | null;

  @Column()
  userId: string;

  @Field(() => User)
  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.externalNotifySystems, {
    onDelete: 'CASCADE',
  })
  user: User;

  @OneToMany(() => Bucket, (bucket) => bucket.externalNotifySystem)
  buckets: Bucket[];

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}

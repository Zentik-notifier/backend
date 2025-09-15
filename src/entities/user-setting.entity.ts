import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
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
import { UserDevice } from './user-device.entity';

export enum UserSettingType {
  Timezone = 'Timezone',
  Language = 'Language',
  UnencryptOnBigPayload = 'UnencryptOnBigPayload',
  AddIconOnNoMedias = 'AddIconOnNoMedias',
}

registerEnumType(UserSettingType, { name: 'UserSettingType' });

@ObjectType()
@Entity('user_settings')
export class UserSetting {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @ApiProperty()
  @Column()
  userId: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'uuid', nullable: true })
  deviceId?: string | null;

  @Field(() => UserSettingType)
  @ApiProperty({ enum: UserSettingType })
  @Column({ type: 'enum', enum: UserSettingType, enumName: 'user_setting_type_enum' })
  configType: UserSettingType;

  @Field(() => String, { nullable: true, description: 'String value for the setting, when applicable' })
  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  valueText?: string | null;

  @Field(() => Boolean, { nullable: true, description: 'Boolean value for the setting, when applicable' })
  @ApiProperty({ required: false })
  @Column({ type: 'boolean', nullable: true })
  valueBool?: boolean | null;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => User)
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field(() => UserDevice, { nullable: true })
  @ManyToOne(() => UserDevice, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deviceId' })
  device?: UserDevice | null;
}



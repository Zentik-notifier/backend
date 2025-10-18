import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
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
import { UserSettingType } from './user-setting.types';

export enum PayloadMapperBuiltInType {
  ZENTIK_AUTHENTIK = 'ZENTIK_AUTHENTIK',
  ZENTIK_SERVARR = 'ZENTIK_SERVARR',
  ZENTIK_RAILWAY = 'ZENTIK_RAILWAY',
  ZENTIK_GITHUB = 'ZENTIK_GITHUB',
  ZENTIK_EXPO = 'ZENTIK_EXPO',
}

registerEnumType(PayloadMapperBuiltInType, {
  name: 'PayloadMapperBuiltInType',
  description: 'Built-in payload mapper types',
});

@ObjectType()
@Entity('payload_mappers')
export class PayloadMapper {
  @Field(() => ID)
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID, { nullable: true })
  @ApiProperty({ required: false })
  @Column({ nullable: true })
  userId?: string;

  @Field()
  @ApiProperty()
  @Column()
  name: string;

  @Field(() => PayloadMapperBuiltInType, { nullable: true })
  @ApiProperty({ enum: PayloadMapperBuiltInType, required: false })
  @Column({
    type: 'enum',
    enum: PayloadMapperBuiltInType,
    nullable: true,
  })
  builtInName?: PayloadMapperBuiltInType;

  @Field(() => [UserSettingType], { nullable: true })
  @ApiProperty({
    type: [Object],
    required: false,
    description: 'Array of required user setting types for this payload mapper',
  })
  @Column({
    type: 'enum',
    enum: UserSettingType,
    enumName: 'UserSettingType',
    array: true,
    nullable: true,
  })
  requiredUserSettings?: UserSettingType[];

  @Field()
  @ApiProperty({
    description: 'JavaScript function as stringified code for payload mapping',
  })
  @Column('text')
  jsEvalFn: string;

  @Field(() => User, { nullable: true })
  @ApiProperty({ type: () => User, required: false })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user?: User;

  @Field()
  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}

import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { UserRole } from '../users.types';

@InputType()
export class UpdateUserRoleInput {
  @Field()
  @ApiProperty()
  @IsUUID()
  userId: string;

  @Field(() => UserRole)
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

@InputType()
export class ConfirmEmailDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Confirmation code must be exactly 6 characters' })
  code: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  locale?: string;
}

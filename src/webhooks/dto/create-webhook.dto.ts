import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { GraphQLJSON } from '../../common/types/json.type';
import { HttpMethod } from '../../entities/user-webhook.entity';

@InputType()
export class WebhookHeaderDto {
  @Field()
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  key: string;

  @Field()
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  value: string;
}

@InputType()
export class CreateWebhookDto {
  @Field()
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @Field(() => HttpMethod)
  @ApiProperty({ enum: HttpMethod })
  @IsNotEmpty()
  @IsEnum(HttpMethod)
  method: HttpMethod;

  @Field()
  @ApiProperty()
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @Field(() => [WebhookHeaderDto])
  @ApiProperty({ type: [WebhookHeaderDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebhookHeaderDto)
  headers?: WebhookHeaderDto[];

  @Field(() => GraphQLJSON, { nullable: true })
  @ApiProperty({ required: false, description: 'Webhook body as JSON object' })
  @IsOptional()
  @IsObject()
  body?: any;
}

import { Field, InputType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { GraphQLJSON } from '../../common/types/json.type';
import { HttpMethod } from '../../entities/user-webhook.entity';
import { WebhookHeaderDto } from './create-webhook.dto';

@InputType()
export class UpdateWebhookDto {
  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @Field(() => HttpMethod, { nullable: true })
  @ApiProperty({ enum: HttpMethod, required: false })
  @IsOptional()
  @IsEnum(HttpMethod)
  method?: HttpMethod;

  @Field({ nullable: true })
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  url?: string;

  @Field(() => [WebhookHeaderDto], { nullable: true })
  @ApiProperty({ type: [WebhookHeaderDto], required: false })
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

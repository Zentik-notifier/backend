import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EmailConfirmationResponseDto {
  @Field()
  message: string;

  @Field()
  success: boolean;
}

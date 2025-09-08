import { Field, ObjectType } from '@nestjs/graphql';
import { PayloadMapper, PayloadMapperBuiltInType } from '../../entities/payload-mapper.entity';

@ObjectType()
export class PayloadMapperWithBuiltin extends PayloadMapper {
  @Field(() => PayloadMapperBuiltInType, { nullable: true })
  builtInName?: PayloadMapperBuiltInType;
}

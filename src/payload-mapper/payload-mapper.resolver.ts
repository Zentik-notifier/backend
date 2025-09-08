import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PayloadMapperService } from './payload-mapper.service';
import { PayloadMapper } from '../entities/payload-mapper.entity';
import { CreatePayloadMapperDto, UpdatePayloadMapperDto, PayloadMapperWithBuiltin } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UseGuards } from '@nestjs/common';
import { JwtOrAccessTokenGuard } from 'src/auth/guards/jwt-or-access-token.guard';

@Resolver(() => PayloadMapper)
@UseGuards(JwtOrAccessTokenGuard)
export class PayloadMapperResolver {
  constructor(private readonly payloadMapperService: PayloadMapperService) {}

  @Mutation(() => PayloadMapper)
  createPayloadMapper(
    @CurrentUser('id') userId: string,
    @Args('input') createPayloadMapperDto: CreatePayloadMapperDto,
  ): Promise<PayloadMapper> {
    return this.payloadMapperService.create(userId, createPayloadMapperDto);
  }

  @Query(() => [PayloadMapperWithBuiltin])
  payloadMappers(@CurrentUser('id') userId: string): Promise<PayloadMapperWithBuiltin[]> {
    return this.payloadMapperService.findAll(userId);
  }

  @Query(() => PayloadMapper)
  payloadMapper(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<PayloadMapper> {
    return this.payloadMapperService.findOne(id, userId);
  }

  @Mutation(() => PayloadMapper)
  updatePayloadMapper(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
    @Args('input') updatePayloadMapperDto: UpdatePayloadMapperDto,
  ): Promise<PayloadMapper> {
    return this.payloadMapperService.update(id, userId, updatePayloadMapperDto);
  }

  @Mutation(() => Boolean)
  async deletePayloadMapper(
    @Args('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.payloadMapperService.remove(id, userId);
    return true;
  }
}

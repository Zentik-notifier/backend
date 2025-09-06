import { Module } from '@nestjs/common';
import { GraphQLSubscriptionService } from './services/graphql-subscription.service';

@Module({
  providers: [GraphQLSubscriptionService],
  exports: [GraphQLSubscriptionService],
})
export class GraphQLSharedModule {}

import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { BucketsModule } from '../buckets/buckets.module';
import { EntityExecutionModule } from '../entity-execution/entity-execution.module';
import { EntityPermissionModule } from '../entity-permission/entity-permission.module';
import { EventsModule } from '../events/events.module';
import { MessagesModule } from '../messages/messages.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OAuthProvidersModule } from '../oauth-providers/oauth-providers.module';
import { PayloadMapperModule } from '../payload-mapper/payload-mapper.module';
import { UsersModule } from '../users/users.module';
import { GraphQLSharedModule } from './graphql-shared.module';
import { AuthResolver } from './resolvers/auth.resolver';
import { BucketsResolver } from './resolvers/buckets.resolver';
import { EntityExecutionsResolver } from './resolvers/entity-executions.resolver';
import { EntityPermissionsResolver } from './resolvers/entity-permissions.resolver';
import { EventsResolver } from './resolvers/events.resolver';
import { MessagesResolver } from './resolvers/messages.resolver';
import { PayloadMapperResolver } from '../payload-mapper/payload-mapper.resolver';
import { UsersResolver } from './resolvers/users.resolver';

const GRAPHQL_PATH = `${process.env.BACKEND_API_PREFIX}/graphql`;

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [AuthModule],
      inject: [AuthService],
      useFactory: async () => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        path: GRAPHQL_PATH,
        subscriptions: {
          'graphql-ws': {
            path: GRAPHQL_PATH,
          },
          'subscriptions-transport-ws': false,
        },
        context: ({ req, extra, connectionParams }) => {
          if (extra?.request) {
            return {
              req: {
                ...extra?.request,
                headers: {
                  ...extra?.request?.headers,
                  ...connectionParams,
                },
              },
            };
          }

          return { req };
        },
      }),
    }),
    NotificationsModule,
    MessagesModule,
    BucketsModule,
    UsersModule,
    AuthModule,
    EntityExecutionModule,
    EntityPermissionModule,
    EventsModule,
    GraphQLSharedModule,
    OAuthProvidersModule,
    PayloadMapperModule,
    AttachmentsModule,
  ],
  providers: [
    AuthResolver,
    MessagesResolver,
    BucketsResolver,
    EntityExecutionsResolver,
    EntityPermissionsResolver,
    EventsResolver,
    PayloadMapperResolver,
    UsersResolver,
  ],
  exports: [],
})
export class GraphqlModule {}

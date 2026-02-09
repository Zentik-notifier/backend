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
import { ServerManagerModule } from '../server-manager/server-manager.module';
import { GraphQLSharedModule } from './graphql-shared.module';
import { PayloadMapperResolver } from '../payload-mapper/payload-mapper.resolver';
import { AuthResolver } from 'src/auth/auth.resolver';
import { BucketsResolver } from 'src/buckets/buckets.resolver';
import { EntityExecutionsResolver } from 'src/entity-execution/entity-executions.resolver';
import { EntityPermissionsResolver } from 'src/entity-permission/entity-permissions.resolver';
import { EventsResolver } from 'src/events/events.resolver';
import { UserLogsResolver } from 'src/events/user-logs.resolver';
import { UsersResolver } from 'src/users/users.resolver';
import { ChangelogModule } from 'src/changelog/changelog.module';
import { ChangelogResolver } from 'src/changelog/changelog.resolver';

const GRAPHQL_PATH = `/api/v1/graphql`;

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
              websocketHeader: connectionParams
                ? { connectionParams }
                : undefined,
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
    ServerManagerModule,
    ChangelogModule,
  ],
  providers: [
    AuthResolver,
    BucketsResolver,
    EntityExecutionsResolver,
    EntityPermissionsResolver,
    EventsResolver,
    UserLogsResolver,
    PayloadMapperResolver,
    UsersResolver,
    ChangelogResolver,
  ],
  exports: [],
})
export class GraphqlModule {}

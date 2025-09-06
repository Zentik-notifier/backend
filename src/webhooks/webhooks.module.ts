import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserWebhook } from '../entities';
import { EntityPermissionModule } from '../entity-permission/entity-permission.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksResolver } from './webhooks.resolver';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserWebhook]), AuthModule, EntityPermissionModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksResolver],
  exports: [WebhooksService],
})
export class WebhooksModule {}

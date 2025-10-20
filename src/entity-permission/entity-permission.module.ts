import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { EntityPermission } from '../entities/entity-permission.entity';
import { InviteCode } from '../entities/invite-code.entity';
import { User } from '../entities/user.entity';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';
import { EntityPermissionService } from './entity-permission.service';
import { EntityPermissionsController } from './entity-permissions.controller';
import { InviteCodeService } from './invite-code.service';
import { InviteCodeController } from './invite-code.controller';
import { InviteCodeResolver } from './invite-code.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([EntityPermission, InviteCode, User]),
    AuthModule,
    UsersModule,
    EventsModule,
  ],
  controllers: [EntityPermissionsController, InviteCodeController],
  providers: [EntityPermissionService, InviteCodeService, InviteCodeResolver],
  exports: [EntityPermissionService, InviteCodeService],
})
export class EntityPermissionModule {}

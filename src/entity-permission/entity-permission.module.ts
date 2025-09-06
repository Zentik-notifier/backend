import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { EntityPermission } from '../entities/entity-permission.entity';
import { User } from '../entities/user.entity';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';
import { EntityPermissionService } from './entity-permission.service';
import { EntityPermissionsController } from './entity-permissions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EntityPermission, User]),
    AuthModule,
    UsersModule,
    EventsModule,
  ],
  controllers: [EntityPermissionsController],
  providers: [EntityPermissionService],
  exports: [EntityPermissionService],
})
export class EntityPermissionModule {}

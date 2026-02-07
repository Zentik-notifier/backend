import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ExternalNotifySystem } from '../entities/external-notify-system.entity';
import { User } from '../entities/user.entity';
import { EntityPermissionModule } from '../entity-permission/entity-permission.module';
import { NtfyModule } from '../ntfy/ntfy.module';
import { ExternalNotifySystemController } from './external-notify-system.controller';
import { ExternalNotifySystemResolver } from './external-notify-system.resolver';
import { ExternalNotifySystemService } from './external-notify-system.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExternalNotifySystem, User]),
    AuthModule,
    EntityPermissionModule,
    forwardRef(() => NtfyModule),
  ],
  controllers: [ExternalNotifySystemController],
  providers: [ExternalNotifySystemService, ExternalNotifySystemResolver],
  exports: [ExternalNotifySystemService],
})
export class ExternalNotifySystemModule {}

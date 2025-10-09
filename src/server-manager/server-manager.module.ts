import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ServerSetting } from '../entities/server-setting.entity';
import { ServerManagerService } from './server-manager.service';
import { ServerManagerResolver } from './server-manager.resolver';
import { ServerManagerController } from './server-manager.controller';
import { ServerSettingsService } from './server-settings.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ServerSetting]),
    forwardRef(() => AuthModule),
  ],
  controllers: [ServerManagerController],
  providers: [ServerManagerService, ServerManagerResolver, ServerSettingsService],
  exports: [ServerManagerService, ServerSettingsService],
})
export class ServerManagerModule {}

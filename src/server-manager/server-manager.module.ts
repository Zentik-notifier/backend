import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServerManagerService } from './server-manager.service';
import { ServerManagerResolver } from './server-manager.resolver';
import { ServerManagerController } from './server-manager.controller';
import { ServerSettingsModule } from '../server-settings/server-settings.module';

@Module({
  imports: [ConfigModule, ServerSettingsModule],
  controllers: [ServerManagerController],
  providers: [ServerManagerService, ServerManagerResolver],
  exports: [ServerManagerService],
})
export class ServerManagerModule {}

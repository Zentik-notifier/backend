import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ServerSetting } from '../entities/server-setting.entity';
import { ServerSettingsService } from './server-settings.service';
import { ServerSettingsController } from './server-settings.controller';
import { ServerSettingsResolver } from './server-settings.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServerSetting]),
    forwardRef(() => AuthModule),
  ],
  controllers: [ServerSettingsController],
  providers: [ServerSettingsService, ServerSettingsResolver],
  exports: [ServerSettingsService],
})
export class ServerSettingsModule {}

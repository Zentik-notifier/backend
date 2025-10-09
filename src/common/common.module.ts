import { Module } from '@nestjs/common';
import { ServerSettingsModule } from '../server-settings/server-settings.module';
import { LocaleService } from './services/locale.service';
import { UrlBuilderService } from './services/url-builder.service';

@Module({
  imports: [ServerSettingsModule],
  providers: [UrlBuilderService, LocaleService],
  exports: [UrlBuilderService, LocaleService],
})
export class CommonModule {}

import { Module } from '@nestjs/common';
import { ServerManagerModule } from '../server-manager/server-manager.module';
import { LocaleService } from './services/locale.service';
import { UrlBuilderService } from './services/url-builder.service';

@Module({
  imports: [ServerManagerModule],
  providers: [UrlBuilderService, LocaleService],
  exports: [UrlBuilderService, LocaleService],
})
export class CommonModule {}

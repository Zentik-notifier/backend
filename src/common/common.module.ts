import { Module } from '@nestjs/common';
import { LocaleService } from './services/locale.service';
import { UrlBuilderService } from './services/url-builder.service';

@Module({
  imports: [],
  providers: [UrlBuilderService, LocaleService],
  exports: [UrlBuilderService, LocaleService],
})
export class CommonModule {}

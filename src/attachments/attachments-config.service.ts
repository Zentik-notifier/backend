import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AttachmentsConfigService {
  constructor(private readonly configService: ConfigService) {}

  get isEnabled(): boolean {
    const enabledRaw = this.configService.get<string>('ATTACHMENTS_ENABLED');
    return (enabledRaw || '').toLowerCase() === 'true' || enabledRaw === '1';
  }

  get isDisabled(): boolean {
    return !this.isEnabled;
  }
}

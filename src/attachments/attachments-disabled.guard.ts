import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AttachmentsConfigService } from './attachments-config.service';

@Injectable()
export class AttachmentsDisabledGuard implements CanActivate {
  constructor(
    private readonly attachmentsConfigService: AttachmentsConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.attachmentsConfigService.isDisabled) {
      throw new ForbiddenException('Attachments are currently disabled');
    }

    return true;
  }
}

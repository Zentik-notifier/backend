import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service';

@Injectable()
export class AttachmentsDisabledGuard implements CanActivate {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.attachmentsService.isAttachmentsEnabled()) {
      throw new ForbiddenException('Attachments are currently disabled');
    }

    return true;
  }
}

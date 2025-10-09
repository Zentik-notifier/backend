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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await this.attachmentsService.isAttachmentsEnabled())) {
      throw new ForbiddenException('Attachments are currently disabled');
    }

    return true;
  }
}

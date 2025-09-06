import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AttachmentsConfigService } from '../attachments-config.service';

@Injectable()
export class ConfigInjectorInterceptor implements NestInterceptor {
  constructor(private readonly attachmentsConfigService: AttachmentsConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (request.body) {
      (request.body as any).attachmentsConfigService = this.attachmentsConfigService;
    }
    return next.handle();
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Attachment } from '../entities/attachment.entity';
import { AttachmentsConfigService } from './attachments-config.service';
import { AttachmentsDisabledGuard } from './attachments-disabled.guard';
import { AttachmentsCleanupScheduler } from './attachments.cleanup.scheduler';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { ConfigInjectorInterceptor } from './interceptors/config-injector.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment]), AuthModule],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    AttachmentsCleanupScheduler,
    AttachmentsDisabledGuard,
    ConfigInjectorInterceptor,
    AttachmentsConfigService,
  ],
  exports: [AttachmentsService, AttachmentsConfigService],
})
export class AttachmentsModule {}

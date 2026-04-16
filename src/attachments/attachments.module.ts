import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Attachment } from '../entities/attachment.entity';
import { ServerManagerModule } from '../server-manager/server-manager.module';
import { AttachmentsDisabledGuard } from './attachments-disabled.guard';
import { AttachmentsCleanupScheduler } from './attachments.cleanup.scheduler';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsCronResolver } from './attachments-cron.resolver';
import { AttachmentsResolver } from './attachments.resolver';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment]), AuthModule, ServerManagerModule],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    AttachmentsResolver,
    AttachmentsCleanupScheduler,
    AttachmentsCronResolver,
    AttachmentsDisabledGuard,
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}

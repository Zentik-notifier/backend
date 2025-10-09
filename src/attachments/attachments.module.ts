import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Attachment } from '../entities/attachment.entity';
import { ServerSettingsModule } from '../server-settings/server-settings.module';
import { AttachmentsDisabledGuard } from './attachments-disabled.guard';
import { AttachmentsCleanupScheduler } from './attachments.cleanup.scheduler';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment]), AuthModule, ServerSettingsModule],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    AttachmentsCleanupScheduler,
    AttachmentsDisabledGuard,
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}

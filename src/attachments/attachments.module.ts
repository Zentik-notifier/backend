import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Attachment } from '../entities/attachment.entity';
import { ServerManagerModule } from '../server-manager/server-manager.module';
import { AttachmentsDisabledGuard } from './attachments-disabled.guard';
import { AttachmentsCleanupScheduler } from './attachments.cleanup.scheduler';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment]), AuthModule, ServerManagerModule],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    AttachmentsCleanupScheduler,
    AttachmentsDisabledGuard,
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}

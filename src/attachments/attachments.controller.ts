import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { resolve } from 'path';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { Attachment } from '../entities/attachment.entity';
import { AttachmentsDisabledGuard } from './attachments-disabled.guard';
import { AttachmentsService } from './attachments.service';
import { DownloadFromUrlDto, UploadAttachmentDto } from './dto';

@ApiTags('Attachments')
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('upload')
  @UseGuards(JwtOrAccessTokenGuard, AttachmentsDisabledGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a new attachment (independent of message)' })
  @ApiResponse({
    status: 201,
    description: 'Attachment uploaded successfully',
    type: Attachment,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({
    status: 403,
    description: 'Attachments are currently disabled',
  })
  uploadAttachment(
    @GetUser('id') userId: string,
    @Body() uploadAttachmentDto: UploadAttachmentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    
    return this.attachmentsService.uploadAttachment(
      userId,
      uploadAttachmentDto,
      file,
    );
  }

  @Post('download-from-url')
  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download and save attachment from URL' })
  @ApiResponse({
    status: 201,
    description: 'Attachment downloaded and saved successfully',
    type: Attachment,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  downloadFromUrl(
    @GetUser('id') userId: string,
    @Body() downloadDto: DownloadFromUrlDto,
  ) {
    return this.attachmentsService.downloadAndSaveFromUrl(
      userId,
      downloadDto.url,
      downloadDto.filename,
      downloadDto.mediaType,
    );
  }

  @Get(':id')
  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific attachment by ID' })
  @ApiResponse({
    status: 200,
    description: 'Attachment details',
    type: Attachment,
  })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  findOne(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.attachmentsService.findOne(id, userId);
  }

  @Get(':id/download')
  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Download attachment file (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async downloadFile(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Res() res: Response,
  ) {
    const attachment = await this.attachmentsService.findOne(id, userId);

    // Set appropriate headers
    res.setHeader('Content-Type', this.getMimeType(attachment.filename));
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.filename}"`,
    );

    res.sendFile(attachment.filepath);
  }

  @Get(':id/download/public')
  @ApiOperation({ summary: 'Download attachment file (public access)' })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async downloadFilePublic(@Param('id') id: string, @Res() res: Response) {
    const attachment = await this.attachmentsService.findOnePublic(id);

    res.setHeader('Content-Type', this.getMimeType(attachment.filename));
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.filename}"`,
    );

    const absolutePath = resolve(attachment.filepath);
    
    const fs = require('fs');
    if (!fs.existsSync(absolutePath)) {
      console.error(`[ERROR] File does not exist: ${absolutePath}`);
      return res.status(404).json({ error: 'File not found' });
    }
    
    const stats = fs.statSync(absolutePath);
    
    res.sendFile(absolutePath);
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      pdf: 'application/pdf',
      txt: 'text/plain',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  @Get('message/:messageId')
  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all attachments for a specific message' })
  @ApiResponse({
    status: 200,
    description: 'List of attachments',
    type: [Attachment],
  })
  findByMessage(
    @Param('messageId') messageId: string,
    @GetUser('id') userId: string,
  ) {
    return this.attachmentsService.findByMessage(messageId, userId);
  }

  @Delete(':id')
  @UseGuards(JwtOrAccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiResponse({ status: 200, description: 'Attachment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  remove(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.attachmentsService.remove(id, userId);
  }
}

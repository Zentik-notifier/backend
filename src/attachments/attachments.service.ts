import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, rm, writeFile } from 'fs/promises';
import * as http from 'http';
import * as https from 'https';
import { extname, join } from 'path';
import { LessThan, Repository } from 'typeorm';
import { URL } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { Attachment } from '../entities/attachment.entity';
import { MediaType } from '../notifications/notifications.types';
import { UploadAttachmentDto } from './dto';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentsRepository: Repository<Attachment>,
    private readonly configService: ConfigService,
  ) {}

  private async getStoragePath(): Promise<string> {
    const storagePath =
      this.configService.get<string>('ATTACHMENTS_STORAGE_PATH') ||
      './storage/attachments';
    await mkdir(storagePath, { recursive: true });
    return storagePath;
  }

  private async getUserMediaTypePath(userId: string, mediaType: MediaType, attachmentId: string): Promise<string> {
    const basePath = await this.getStoragePath();
    const userPath = join(basePath, userId);
    const mediaTypePath = join(userPath, mediaType.toLowerCase());
    const attachmentPath = join(mediaTypePath, attachmentId);
    
    await mkdir(attachmentPath, { recursive: true });
    return attachmentPath;
  }

  async uploadAttachment(
    userId: string,
    uploadAttachmentDto: UploadAttachmentDto,
    file: Express.Multer.File,
  ): Promise<Attachment> {
    const { filename, mediaType } = uploadAttachmentDto;

    // Generate unique attachment ID
    const attachmentId = uuidv4();
    const fileExtension = extname(filename);
    const uniqueFilename = `${attachmentId}${fileExtension}`;

    // Determine final media type
    let finalMediaType = mediaType;
    if (!mediaType) {
      if (file.mimetype.startsWith('image/')) {
        finalMediaType = MediaType.IMAGE;
      } else if (file.mimetype.startsWith('video/')) {
        finalMediaType = MediaType.VIDEO;
      } else if (file.mimetype.startsWith('audio/')) {
        finalMediaType = MediaType.AUDIO;
      } else if (file.mimetype === 'application/pdf') {
        finalMediaType = MediaType.ICON; // Use ICON as fallback for documents
      } else {
        finalMediaType = MediaType.ICON; // Default fallback for other file types
      }
    }

    // Get user-specific media type path: /attachments/userid/mediatype/id/
    const attachmentPath = await this.getUserMediaTypePath(userId, finalMediaType!, attachmentId);

    // Validate file size
    const maxFileSize =
      this.configService.get<number>('ATTACHMENTS_MAX_FILE_SIZE') || 10485760;
    if (file.size > maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${maxFileSize} bytes`,
      );
    }

    // Validate MIME type
    const allowedMimeTypes = this.configService
      .get<string>('ATTACHMENTS_ALLOWED_MIME_TYPES')
      ?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'application/pdf',
      'text/plain',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`,
      );
    }

    // Full file path: /attachments/userid/mediatype/id/filename
    const filepath = join(attachmentPath, uniqueFilename);

    // Debug file buffer
    this.logger.log(`[DEBUG] File buffer info: size=${file.buffer?.length || 0} originalSize=${file.size} mimetype=${file.mimetype}`);
    
    // Write file to storage
    await writeFile(filepath, file.buffer);
    this.logger.log(
      `Attachment file saved on filesystem: path=${filepath} size=${file.size}B userId=${userId}`,
    );
    
    // Verify file was written correctly
    const fs = require('fs');
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      this.logger.log(`[DEBUG] File verification: exists=${fs.existsSync(filepath)} size=${stats.size} bytes`);
    } else {
      this.logger.error(`[ERROR] File was not created: ${filepath}`);
    }

    // Create attachment record
    const attachment = this.attachmentsRepository.create({
      id: attachmentId,
      filename,
      filepath,
      mediaType: finalMediaType,
      userId,
    });

    const saved = await this.attachmentsRepository.save(attachment);
    this.logger.log(
      `Attachment entity created: id=${saved.id} filename=${filename} path=${filepath} mediaType=${finalMediaType}`,
    );
    return saved;
  }

  async downloadAndSaveFromUrl(
    userId: string,
    url: string,
    filename?: string,
    mediaType?: MediaType,
  ): Promise<Attachment> {
    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      return new Promise((resolve, reject) => {
        const request = protocol.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new BadRequestException(
                `Failed to download file from URL: ${response.statusCode}`,
              ),
            );
            return;
          }

          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(chunk));

          response.on('end', async () => {
            try {
              const buffer = Buffer.concat(chunks);

              // Validate file size
              const maxFileSize =
                this.configService.get<number>('ATTACHMENTS_MAX_FILE_SIZE') ||
                10485760;
              if (buffer.length > maxFileSize) {
                reject(
                  new BadRequestException(
                    `File size exceeds maximum allowed size of ${maxFileSize} bytes`,
                  ),
                );
                return;
              }

              // Get filename from URL if not provided
              const finalFilename =
                filename ||
                urlObj.pathname.split('/').pop() ||
                'downloaded_file';

              // Generate unique attachment ID
              const attachmentId = uuidv4();
              const fileExtension = extname(finalFilename);
              const uniqueFilename = `${attachmentId}${fileExtension}`;

              // Determine final media type
              let finalMediaType = mediaType;
              if (!finalMediaType) {
                // Try to infer from URL or filename
                if (finalFilename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                  finalMediaType = MediaType.IMAGE;
                } else if (finalFilename.match(/\.(mp4|webm|avi|mov)$/i)) {
                  finalMediaType = MediaType.VIDEO;
                } else if (finalFilename.match(/\.(mp3|wav|ogg|m4a)$/i)) {
                  finalMediaType = MediaType.AUDIO;
                } else {
                  finalMediaType = MediaType.ICON; // Default fallback
                }
              }

              // Get user-specific media type path: /attachments/userid/mediatype/id/
              const attachmentPath = await this.getUserMediaTypePath(userId, finalMediaType, attachmentId);

              // Full file path: /attachments/userid/mediatype/id/filename
              const filepath = join(attachmentPath, uniqueFilename);

              // Write file to storage
              await writeFile(filepath, buffer);
              this.logger.log(
                `Attachment file saved on filesystem: path=${filepath} size=${buffer.length}B userId=${userId}`,
              );

              // Create attachment record
              const attachment = this.attachmentsRepository.create({
                id: attachmentId,
                filename: finalFilename,
                filepath,
                mediaType: finalMediaType,
                userId,
              });

              const savedAttachment =
                await this.attachmentsRepository.save(attachment);
              this.logger.log(
                `Attachment entity created: id=${savedAttachment.id} filename=${finalFilename} path=${filepath} mediaType=${finalMediaType}`,
              );
              resolve(savedAttachment);
            } catch (error) {
              reject(error);
            }
          });
        });

        request.on('error', (error) => {
          reject(
            new BadRequestException(
              `Failed to download file: ${error.message}`,
            ),
          );
        });

        request.setTimeout(30000, () => {
          request.destroy();
          reject(new BadRequestException('Download timeout'));
        });
      });
    } catch (error) {
      throw new BadRequestException(`Invalid URL: ${error.message}`);
    }
  }

  async linkAttachmentToMessage(
    attachmentId: string,
    messageId: string,
  ): Promise<Attachment> {
    const attachment = await this.findOne(attachmentId, 'system'); // Use system user for linking
    attachment.messageId = messageId;
    return this.attachmentsRepository.save(attachment);
  }

  async findOne(id: string, userId: string): Promise<Attachment> {
    const attachment = await this.attachmentsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (userId !== 'system' && attachment.userId !== userId) {
      throw new NotFoundException('You do not have access to this attachment');
    }

    return attachment;
  }

  async findOnePublic(id: string): Promise<Attachment> {
    const attachment = await this.attachmentsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // For public access, we only allow attachments that are linked to messages
    // or are bucket icons (MediaType.ICON)
    // This provides some security by not exposing all user uploads
    if (!attachment.messageId && attachment.mediaType !== MediaType.ICON) {
      throw new NotFoundException('This attachment is not publicly accessible');
    }

    return attachment;
  }

  async findByMessage(
    messageId: string,
    userId: string,
  ): Promise<Attachment[]> {
    return this.attachmentsRepository.find({
      where: { messageId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const attachment = await this.findOne(id, userId);
    try {
      await rm(attachment.filepath, { force: true });
    } catch {}
    await this.attachmentsRepository.remove(attachment);
  }

  async deleteAttachmentsOlderThan(
    maxAgeMs: number,
  ): Promise<{ deletedAttachments: number }> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const oldAttachments = await this.attachmentsRepository.find({
      where: { createdAt: LessThan(cutoff) },
    });

    let deleted = 0;
    for (const att of oldAttachments) {
      try {
        await rm(att.filepath, { force: true });
      } catch {}
      await this.attachmentsRepository.remove(att);
      deleted += 1;
    }
    return { deletedAttachments: deleted };
  }

  isAttachmentsEnabled(): boolean {
    const attachmentsEnabled =
      this.configService.get<string>('ATTACHMENTS_ENABLED', 'true') ?? 'true';
    return attachmentsEnabled.toLowerCase() === 'true';
  }
}

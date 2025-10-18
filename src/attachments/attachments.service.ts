import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, rm, writeFile } from 'fs/promises';
import * as http from 'http';
import * as https from 'https';
import { extname, join } from 'path';
import { LessThan, Not, Repository } from 'typeorm';
import { URL } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { Attachment } from '../entities/attachment.entity';
import { MediaType } from '../notifications/notifications.types';
import { UploadAttachmentDto } from './dto';
import { ServerSettingsService } from '../server-manager/server-settings.service';
import { ServerSettingType } from '../entities/server-setting.entity';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentsRepository: Repository<Attachment>,
    private readonly serverSettingsService: ServerSettingsService,
  ) { }

  private async getStoragePath(): Promise<string> {
    const storagePath =
      (await this.serverSettingsService.getSettingByType(ServerSettingType.AttachmentsStoragePath))?.valueText ||
      './storage/attachments';
    await mkdir(storagePath, { recursive: true });
    return storagePath;
  }

  private async getUserMediaTypePath(
    userId: string,
    mediaType: MediaType,
    attachmentId: string,
  ): Promise<string> {
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
    const attachmentPath = await this.getUserMediaTypePath(
      userId,
      finalMediaType!,
      attachmentId,
    );

    // Validate file size
    const maxFileSize =
      (await this.serverSettingsService.getSettingByType(ServerSettingType.AttachmentsMaxFileSize))?.valueNumber || 10485760;
    if (file.size > maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${maxFileSize} bytes`,
      );
    }

    // Validate MIME type
    const allowedMimeTypes = (await this.serverSettingsService.getSettingByType(ServerSettingType.AttachmentsAllowedMimeTypes))?.valueText
      ?.split(',') || [
        'image/*',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'application/pdf',
        'text/plain',
      ];
    
    // Check if mime type is allowed (supports wildcards like image/*)
    const isAllowed = allowedMimeTypes.some(allowedType => {
      if (allowedType.endsWith('/*')) {
        const prefix = allowedType.slice(0, -2);
        return file.mimetype.startsWith(prefix + '/');
      }
      return allowedType === file.mimetype;
    });
    
    if (!isAllowed) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`,
      );
    }

    // Full file path: /attachments/userid/mediatype/id/filename
    const filepath = join(attachmentPath, uniqueFilename);

    // Debug file buffer
    this.logger.debug(
      `File buffer info: size=${file.buffer?.length || 0} originalSize=${file.size} mimetype=${file.mimetype}`,
    );

    // Write file to storage
    await writeFile(filepath, file.buffer);
    this.logger.debug(
      `Attachment file saved on filesystem: path=${filepath} size=${file.size}B userId=${userId}`,
    );

    // Verify file was written correctly
    const fs = require('fs');
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      this.logger.debug(
        `File verification: exists=${fs.existsSync(filepath)} size=${stats.size} bytes`,
      );
    } else {
      this.logger.error(`File was not created: ${filepath}`);
    }

    // Create attachment record
    const attachment = this.attachmentsRepository.create({
      id: attachmentId,
      filename,
      originalFilename: file.originalname,
      size: file.size,
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

  /**
   * Helper method to download a file from URL with automatic redirect following
   * @param url - The URL to download from
   * @param maxFileSize - Maximum allowed file size in bytes
   * @param maxRedirects - Maximum number of redirects to follow (default 5)
   * @returns Promise<Buffer> - The downloaded file as a Buffer
   */
  private async downloadFromUrlWithRedirects(
    url: string,
    maxFileSize: number,
    maxRedirects: number = 5,
  ): Promise<Buffer> {
    // Check if we've exceeded max redirects
    if (maxRedirects <= 0) {
      throw new BadRequestException('Too many redirects');
    }

    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const request = protocol.get(url, async (response) => {
        const statusCode = response.statusCode || 0;

        // Handle redirects (3xx) - follow them automatically
        if (statusCode >= 300 && statusCode < 400) {
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            reject(
              new BadRequestException(
                `Received redirect (${statusCode}) but no Location header provided`,
              ),
            );
            return;
          }

          this.logger.log(`Following redirect ${statusCode} to: ${redirectUrl}`);

          // Recursively follow the redirect
          try {
            const buffer = await this.downloadFromUrlWithRedirects(
              redirectUrl,
              maxFileSize,
              maxRedirects - 1,
            );
            resolve(buffer);
          } catch (error) {
            reject(error);
          }
          return;
        }

        // Check for successful response
        if (statusCode !== 200) {
          const errorMsg = `Failed to download file from URL - Status: ${statusCode}, Status Message: ${response.statusMessage}`;
          if (statusCode >= 400) {
            this.logger.error(errorMsg);
          } else {
            this.logger.warn(errorMsg);
          }
          reject(new BadRequestException(errorMsg));
          return;
        }

        // Check content length for security
        const contentLength = response.headers['content-length'];
        if (contentLength && parseInt(contentLength) > maxFileSize) {
          reject(
            new BadRequestException(
              `File size exceeds maximum allowed size of ${maxFileSize} bytes`,
            ),
          );
          return;
        }

        const chunks: Buffer[] = [];
        let totalSize = 0;

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          totalSize += chunk.length;

          // Check size as we go to avoid memory issues
          if (totalSize > maxFileSize) {
            request.destroy();
            reject(
              new BadRequestException(`File too large: ${totalSize} bytes`),
            );
            return;
          }
        });

        response.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            this.logger.log(`Download completed - Received ${buffer.length} bytes`);
            resolve(buffer);
          } catch (error) {
            reject(error);
          }
        });

        response.on('error', (error) => {
          this.logger.error(`Response stream error for ${url}:`, error);
          reject(new BadRequestException(`Response error: ${error.message}`));
        });
      });

      request.on('error', (error) => {
        this.logger.error(`Request error for ${url}:`, error);
        this.logger.error(`Error details: ${JSON.stringify({
          message: error.message,
          code: (error as any).code,
          errno: (error as any).errno,
          syscall: (error as any).syscall,
          hostname: (error as any).hostname,
        })}`);
        reject(
          new BadRequestException(`Failed to download file: ${error.message}`),
        );
      });

      request.setTimeout(30000, () => {
        this.logger.warn(`Download timeout (30s) for URL: ${url}`);
        request.destroy();
        reject(new BadRequestException('Download timeout'));
      });
    });
  }

  async proxyMediaFromUrl(url: string, res: any): Promise<void> {
    try {
      const urlObj = new URL(url);

      // Load max file size before downloading
      const maxFileSize =
        (await this.serverSettingsService.getSettingByType(ServerSettingType.AttachmentsMaxFileSize))?.valueNumber ||
        10485760; // 10MB default

      // Use the common download helper with redirect support
      const buffer = await this.downloadFromUrlWithRedirects(url, maxFileSize);

      // Determine MIME type from URL or filename
      const filename = urlObj.pathname.split('/').pop() || 'file';
      const mimeType = this.getMimeType(filename);

      // Set appropriate headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      // Send the binary data
      res.end(buffer);

      this.logger.log(
        `Media proxied successfully: url=${url} size=${buffer.length}B mimeType=${mimeType}`,
      );
    } catch (error) {
      this.logger.error(`Failed to proxy media from URL ${url}:`, error);
      throw error;
    }
  }

  async downloadAndSaveFromUrl(
    userId: string,
    url: string,
    filename?: string,
    mediaType?: MediaType,
  ): Promise<Attachment> {
    try {
      const urlObj = new URL(url);

      // Load max file size
      const maxFileSize =
        (await this.serverSettingsService.getSettingByType(ServerSettingType.AttachmentsMaxFileSize))?.valueNumber ||
        10485760;

      // Use the common download helper with redirect support
      const buffer = await this.downloadFromUrlWithRedirects(url, maxFileSize);

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
      const attachmentPath = await this.getUserMediaTypePath(
        userId,
        finalMediaType,
        attachmentId,
      );

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
        originalFilename: finalFilename,
        size: buffer.length,
        filepath,
        mediaType: finalMediaType,
        userId,
      });

      const savedAttachment =
        await this.attachmentsRepository.save(attachment);
      this.logger.log(
        `Attachment entity created: id=${savedAttachment.id} filename=${finalFilename} path=${filepath} mediaType=${finalMediaType}`,
      );
      return savedAttachment;
    } catch (error) {
      this.logger.error(`Invalid URL or download error for ${url}:`, error);
      throw new BadRequestException(`Failed to download: ${error.message}`);
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
    } catch { }
    await this.attachmentsRepository.remove(attachment);
  }

  async deleteAttachmentsOlderThan(
    maxAgeMs: number,
  ): Promise<{ deletedAttachments: number }> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const oldAttachments = await this.attachmentsRepository.find({
      where: {
        createdAt: LessThan(cutoff),
        mediaType: Not(MediaType.ICON), // Exclude icons from cleanup
      },
    });

    let deleted = 0;
    for (const att of oldAttachments) {
      try {
        await rm(att.filepath, { force: true });
      } catch { }
      await this.attachmentsRepository.remove(att);
      deleted += 1;
    }
    return { deletedAttachments: deleted };
  }

  async isAttachmentsEnabled(): Promise<boolean> {
    const attachmentsEnabled =
      (await this.serverSettingsService.getSettingByType(ServerSettingType.AttachmentsEnabled))?.valueBool ?? true;
    return attachmentsEnabled;
  }

  async findByUser(userId: string): Promise<Attachment[]> {
    return this.attachmentsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  /**
   * Generate and save bucket icon as attachment
   * Returns the attachment with public URL
   */
  async generateAndSaveBucketIcon(
    userId: string,
    bucketId: string,
    bucketName: string,
    bucketColor: string = '#007AFF',
    iconUrl?: string,
    generateWithInitials: boolean = true,
  ): Promise<Attachment> {
    const sharp = require('sharp');
    const https = require('https');
    const http = require('http');
    const size = 200;

    this.logger.log(
      `Generating bucket icon: "${bucketName}" | color: ${bucketColor} | ` +
      `url: ${iconUrl ? 'yes' : 'no'} | initials: ${generateWithInitials}`
    );

    try {
      let finalBuffer: Buffer;
      let iconType: 'svg' | 'image' | 'generated';
      let iconBuffer: Buffer | null = null;

      if (iconUrl) {
        // Try to download and process the icon URL (could be SVG or image)
        try {
          iconBuffer = await this.downloadImageFromUrl(iconUrl);
        } catch (downloadError) {
          this.logger.warn(`Failed to download icon from ${iconUrl}`, {
            error: downloadError.message,
            bucketName,
            fallback: 'Generating icon with initials instead'
          });
          // Continue without iconUrl - will generate with initials
          iconBuffer = null;
        }
      }

      if (iconBuffer) {
        const metadata = await sharp(iconBuffer).metadata();

        if (metadata.format === 'svg') {
          iconType = 'svg';
          
          // Parse color
          const colorMatch = bucketColor.match(/#([0-9A-Fa-f]{6})/);
          if (!colorMatch) {
            throw new Error(`Invalid color format: ${bucketColor}`);
          }
          const r = parseInt(colorMatch[1].substring(0, 2), 16);
          const g = parseInt(colorMatch[1].substring(2, 4), 16);
          const b = parseInt(colorMatch[1].substring(4, 6), 16);
          
          // Step 1: Create colored circular background directly with sharp
          const circleBackground = await sharp({
            create: {
              width: size,
              height: size,
              channels: 4,
              background: { r, g, b, alpha: 1 }
            }
          })
          .png()
          .toBuffer();
          
          // Apply circular mask
          const circleMask = Buffer.from(
            `<svg width="${size}" height="${size}">
              <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
            </svg>`
          );
          
          const maskedBackground = await sharp(circleBackground)
            .composite([{
              input: circleMask,
              blend: 'dest-in'
            }])
            .png()
            .toBuffer();
          
          // Step 2: Render SVG to PNG (transparent, full size)
          const svgPng = await sharp(iconBuffer)
            .resize(size, size, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
          
          // Step 3: Composite SVG icon on top of colored circle
          finalBuffer = await sharp(maskedBackground)
            .composite([
              {
                input: svgPng,
                gravity: 'center',
              }
            ])
            .png()
            .toBuffer();
        } else {
          iconType = 'image';
          
          // Parse color
          const colorMatch = bucketColor.match(/#([0-9A-Fa-f]{6})/);
          if (!colorMatch) {
            throw new Error(`Invalid color format: ${bucketColor}`);
          }
          const r = parseInt(colorMatch[1].substring(0, 2), 16);
          const g = parseInt(colorMatch[1].substring(2, 4), 16);
          const b = parseInt(colorMatch[1].substring(4, 6), 16);
          
          // Create colored circular background directly with sharp
          const circleBackground = await sharp({
            create: {
              width: size,
              height: size,
              channels: 4,
              background: { r, g, b, alpha: 1 }
            }
          })
          .png()
          .toBuffer();
          
          // Apply circular mask
          const circleMask = Buffer.from(
            `<svg width="${size}" height="${size}">
              <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
            </svg>`
          );
          
          const maskedBackground = await sharp(circleBackground)
            .composite([{
              input: circleMask,
              blend: 'dest-in'
            }])
            .png()
            .toBuffer();

          // Resize icon to full size (background visible only for transparent areas)
          const resizedIcon = await sharp(iconBuffer)
            .resize(size, size, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();

          // Composite icon on colored background
          finalBuffer = await sharp(maskedBackground)
            .composite([
              {
                input: resizedIcon,
                gravity: 'center',
              }
            ])
            .png()
            .toBuffer();
        }
      } else {
        iconType = 'generated';
        // No URL: Generate with background color (and initials if enabled)
        finalBuffer = await this.generateBucketIcon(bucketName, bucketColor, generateWithInitials);
      }

      // Save as attachment
      const filename = `bucket-icon-${bucketId}.png`;
      const mediaType = MediaType.ICON;

      // Create attachment record first to get the ID
      const attachment = this.attachmentsRepository.create({
        userId,
        filename,
        filepath: 'temp', // Temporary, will be updated
        size: finalBuffer.length,
        mediaType,
      });

      const saved = await this.attachmentsRepository.save(attachment);

      // Now create the actual file path using the generated attachment ID
      const attachmentPath = await this.getUserMediaTypePath(userId, mediaType, saved.id);
      const filepath = join(attachmentPath, filename);

      await writeFile(filepath, finalBuffer);

      // Update with correct filepath
      saved.filepath = filepath;
      await this.attachmentsRepository.save(saved);

      this.logger.log(
        `Bucket icon generated: "${bucketName}" [${iconType}] - ` +
        `${Math.round(finalBuffer.length / 1024)}KB | color: ${bucketColor} | ` +
        `initials: ${generateWithInitials} | attachment: ${saved.id}`
      );

      return saved;
    } catch (error) {
      this.logger.error(`Failed to generate/save bucket icon for ${bucketName}`, error.stack);
      throw new BadRequestException('Failed to generate bucket icon');
    }
  }

  /**
   * Download image from URL with proper headers
   */
  private async downloadImageFromUrl(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': `${urlObj.protocol}//${urlObj.hostname}/`,
        }
      };
      
      protocol.get(options, (response) => {
        // Follow redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.downloadImageFromUrl(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image from ${urlObj.hostname}: HTTP ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', (error) => {
        reject(new Error(`Network error downloading from ${urlObj.hostname}: ${error.message}`));
      });
    });
  }

  /**
   * Generate bucket icon as PNG
   * Returns Buffer with PNG data
   */
  async generateBucketIcon(
    bucketName: string,
    bucketColor: string = '#007AFF',
    includeInitials: boolean = true,
  ): Promise<Buffer> {
    const sharp = require('sharp');
    const size = 200;
    
    // Generate initials from bucket name (same logic as Swift/React)
    const generateInitials = (name: string): string => {
      const words = name.split(' ').filter(w => w.length > 0);
      
      if (words.length >= 2) {
        return words[0][0] + words[1][0];
      } else if (words.length === 1 && words[0].length >= 2) {
        return words[0].substring(0, 2);
      } else if (words.length === 1) {
        return words[0][0];
      }
      
      return '?';
    };

    let svg: string;
    
    if (includeInitials) {
      const initials = generateInitials(bucketName).toUpperCase();
      svg = `
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${size}" height="${size}" fill="${bucketColor}"/>
          <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${bucketColor}"/>
          <text 
            x="50%" 
            y="50%" 
            font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" 
            font-size="${size * 0.4}" 
            font-weight="500" 
            fill="white" 
            text-anchor="middle" 
            dominant-baseline="central"
          >${initials}</text>
        </svg>
      `;
    } else {
      // Only bucket color, no initials
      svg = `
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${size}" height="${size}" fill="${bucketColor}"/>
          <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${bucketColor}"/>
        </svg>
      `;
    }

    // Convert SVG to PNG using sharp
    try {
      const pngBuffer = await sharp(Buffer.from(svg))
        .resize(size, size)
        .png({ 
          compressionLevel: 9,
          adaptiveFiltering: true,
        })
        .toBuffer();

      return pngBuffer;
    } catch (error) {
      this.logger.error(`Failed to generate bucket icon for ${bucketName}`, error.stack);
      throw new BadRequestException('Failed to generate bucket icon');
    }
  }
}

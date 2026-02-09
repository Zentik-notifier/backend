import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequireMessageBucketCreation } from '../auth/decorators/require-scopes.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { MagicCodeGuard } from '../auth/guards/magic-code.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { GraphQLSubscriptionService } from '../graphql/services/graphql-subscription.service';
import { CreateMessageResponseDto } from './dto/create-message-response.dto';
import { CreateMessageWithAttachmentDto } from './dto/create-message-with-attachment.dto';
import { CreateMessageDto } from './dto/create-message.dto';

import { CombineMessageSources } from './decorators/combine-message-sources.decorator';
import { MessagesStreamService, StreamEvent } from './messages-stream.service';
import { MessagesService } from './messages.service';

const POLL_TIMEOUT_MS = 28_000;
const POLL_MAX_SINCE_AGE_MS = 60 * 60 * 1000;

@UseGuards(MagicCodeGuard)
@Controller('')
@ApiTags('Messages (Root)')
@ApiBearerAuth()
export class MessagesRootController {
  private readonly logger = new Logger(MessagesRootController.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly subscriptionService: GraphQLSubscriptionService,
    private readonly streamService: MessagesStreamService,
  ) {}

  @Post('message')
  @UseGuards(ScopesGuard)
  @RequireMessageBucketCreation('bucketId')
  @ApiOperation({
    summary: 'Create a message and send notifications (Root Endpoint)',
    description:
      'Supports multiple content types and data sources. Data can be combined from body, query parameters, path parameters, and headers (x-message-*). Headers take highest precedence, followed by path params, query params, and body. If multipart/form-data is used, it supports file upload.',
  })
  @ApiConsumes(
    'application/json',
    'application/x-www-form-urlencoded',
    'text/plain',
    'multipart/form-data',
  )
  @UseInterceptors(FileInterceptor('file'))
  @ApiBody({
    description: 'Message data (optional when using other sources)',
    type: CreateMessageWithAttachmentDto,
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: 'Message created and notifications scheduled',
    type: CreateMessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or missing required fields',
  })
  @ApiResponse({
    status: 403,
    description: 'Access token does not have permission to create messages in this bucket',
  })
  async create(
    @GetUser('id') userId: string | undefined,
    @CombineMessageSources() input: CreateMessageWithAttachmentDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<CreateMessageResponseDto> {
    if (file) {
      // If file is present, use createWithAttachment logic
      // We need to ensure input is treated as CreateMessageWithAttachmentDto
      // The CombineMessageSources decorator should handle parsing
      if (!userId) {
        throw new BadRequestException('User ID is required for file upload');
      }
      const { message, notificationsCount } =
        await this.messagesService.createWithAttachment(input, userId, file);
      return { message, notificationsCount };
    } else {
      // If no file, use standard create logic
      // input is compatible with CreateMessageDto since CreateMessageWithAttachmentDto extends it
      const { message, notificationsCount } = await this.messagesService.create(
        input,
        userId,
      );
      return { message, notificationsCount };
    }
  }



  @Get('message')
  @UseGuards(AccessTokenGuard, ScopesGuard)
  @RequireMessageBucketCreation('bucketId')
  @ApiOperation({
    summary: 'Send a message via GET request (Root Endpoint)',
    description:
      'Create and send a message using GET parameters. Requires access token authentication (Bearer zat_...).',
  })
  @ApiResponse({
    status: 200,
    description: 'Message sent successfully',
    type: CreateMessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing access token',
  })
  @ApiResponse({
    status: 403,
    description: 'Access token does not have permission to create messages in this bucket',
  })
  @ApiBody({ type: CreateMessageDto })
  async sendMessage(
    @GetUser('id') userId: string,
    @Query() input: CreateMessageDto,
  ): Promise<CreateMessageResponseDto> {
    const { message, notificationsCount } = await this.messagesService.create(
      input,
      userId,
    );
    return { message, notificationsCount };
  }

  @Post('transform')
  @UseGuards(ScopesGuard)
  @RequireMessageBucketCreation('bucketId')
  @ApiOperation({
    summary: 'Transform payload using builtin parser and create message (Root Endpoint)',
    description:
      'Transform a payload using a builtin parser (e.g., Authentik) and create a message with the transformed data. Requires bucketId or magicCode query parameter to specify the target bucket. MagicCodeGuard will automatically resolve magicCode to bucketId.',
  })
  @ApiConsumes('application/json')
  @ApiResponse({
    status: 201,
    description: 'Message created successfully from transformed payload',
    type: CreateMessageResponseDto,
  })
  @ApiResponse({
    status: 204,
    description: 'Parser was skipped - no content produced',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid payload, missing required parameters (parser, bucketId or magicCode), or parser not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access token does not have permission to create messages in this bucket',
  })
  @ApiResponse({
    status: 404,
    description: 'Parser not found',
  })
  async transformAndCreate(
    @GetUser('id') userId: string,
    @Query('parser') parserName: string,
    @Query('bucketId') bucketId: string,
    @Query('magicCode') magicCode: string,
    @Body() payload: any,
    @Headers() headers?: Record<string, string>,
    @Req() request?: any,
  ) {
    if (!parserName) {
      throw new BadRequestException('Parameter "parser" is required');
    }
    // MagicCodeGuard should have resolved magicCode to bucketId, but we check both
    const resolvedBucketId = bucketId || magicCode;
    if (!resolvedBucketId) {
      throw new BadRequestException('Parameter "bucketId" or "magicCode" is required');
    }

    // Extract request info for error logging
    const method = request.method || 'POST';
    const url = request.url || 'UNKNOWN';
    const ip = request.ip || request.headers?.['x-forwarded-for'] || 'UNKNOWN';
    
    try {
      const result = await this.messagesService.transformAndCreate(
        parserName,
        payload,
        userId,
        resolvedBucketId,
        headers,
      );

      if (result) {
        this.logger.log(
          `Message created successfully | MessageId: ${result.message.id} | Parser: ${parserName} | Notifications: ${result.notificationsCount}`,
        );
      } else {
        this.logger.log(
          `Parser skipped (no content) | Parser: ${parserName}`,
        );
      }

      // If parser was skipped, return undefined (will result in 204 No Content)
      return result;
    } catch (error: any) {
      // Determine status code
      const statusCode = error.status || error.statusCode || 500;
      
      // Log error with details
      const payloadPreview = JSON.stringify(payload).substring(0, 200);
      this.logger.error(
        `Error ${statusCode} | Parser: ${parserName} | BucketId: ${resolvedBucketId} | UserId: ${userId} | IP: ${ip} | Method: ${method} | URL: ${url} | Error: ${error.message} | Payload: ${payloadPreview}`,
      );
      
      // Log stack trace for 500 errors
      if (statusCode === 500) {
        this.logger.error(`Stack trace: ${error.stack}`);
      }
      
      // Re-throw to maintain existing behavior
      throw error;
    }
  }

  @Post('template')
  @UseGuards(ScopesGuard)
  @RequireMessageBucketCreation('bucketId')
  @ApiOperation({
    summary: 'Create a message using a template (Root Endpoint)',
    description:
      'Create a message using a user template. The body contains only the templateData (input parameters for the template). All other DTO parameters (template, bucketId or magicCode, etc.) can be sent via query parameters or headers (x-message-*). MagicCodeGuard will automatically resolve magicCode to bucketId.',
  })
  @ApiConsumes('application/json')
  @ApiBody({
    description: 'Template data (input parameters for the template)',
    required: true,
    schema: {
      type: 'object',
      additionalProperties: true,
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Message created successfully from template',
    type: CreateMessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid template data, missing required parameters (template, bucketId or magicCode), or template not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access token does not have permission to create messages in this bucket',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async createFromTemplate(
    @GetUser('id') userId: string,
    @Query('template') template: string,
    @Query('bucketId') bucketId: string,
    @Query('magicCode') magicCode: string,
    @Body() templateData: Record<string, any>,
    @Headers() headers?: Record<string, string>,
    @Query() queryParams?: Record<string, any>,
  ) {
    if (!template) {
      throw new BadRequestException('Parameter "template" is required');
    }
    // MagicCodeGuard should have resolved magicCode to bucketId, but we check both
    const resolvedBucketId = bucketId || magicCode;
    if (!resolvedBucketId) {
      throw new BadRequestException('Parameter "bucketId" or "magicCode" is required');
    }

    // Initialize template data
    const finalTemplateData = { ...templateData };

    // Build CreateMessageDto starting with bucketId
    // MagicCodeGuard has already resolved magicCode to bucketId if it was provided
    const createMessageDto: Partial<CreateMessageDto> = {
      bucketId: resolvedBucketId,
      title: '', // Placeholder, will be replaced by template
      deliveryType: 'NORMAL' as any,
    };

    // Helper function to parse JSON strings
    const parseIfJson = (value: any): any => {
      if (typeof value === 'string' && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
      return value;
    };

    // Collect other DTO parameters from query params (excluding template and bucketId)
    // Note: magicCode is already resolved to bucketId by MagicCodeGuard
    if (queryParams) {
      Object.keys(queryParams).forEach((key) => {
        if (
          key !== 'template' &&
          key !== 'bucketId' &&
          key !== 'magicCode' &&
          queryParams[key] !== undefined &&
          queryParams[key] !== null
        ) {
          createMessageDto[key as keyof CreateMessageDto] = parseIfJson(queryParams[key]);
        }
      });
    }

    // Collect from headers (x-message-* prefix takes precedence over query)
    if (headers) {
      Object.keys(headers).forEach((key) => {
        if (
          key.startsWith('x-message-') &&
          headers[key] !== undefined &&
          headers[key] !== null
        ) {
          const cleanKey = key.replace('x-message-', '');
          createMessageDto[cleanKey as keyof CreateMessageDto] = parseIfJson(headers[key]);
        }
      });
    }

    // Merge template-* headers into templateData
    if (headers) {
      Object.keys(headers).forEach((key) => {
        if (
          key.startsWith('template-') &&
          headers[key] !== undefined &&
          headers[key] !== null
        ) {
          const cleanKey = key.replace('template-', '');
          finalTemplateData[cleanKey] = parseIfJson(headers[key]);
        }
      });
    }

    // Apply template explicitly
    await this.messagesService.applyTemplate(
      createMessageDto as CreateMessageDto,
      userId,
      template,
      finalTemplateData,
    );

    // Create the message using the standard create method
    const result = await this.messagesService.create(
      createMessageDto as CreateMessageDto,
      userId,
    );

    this.logger.log(
      `Message created successfully from template | MessageId: ${result.message.id} | Template: ${template} | Notifications: ${result.notificationsCount}`,
    );

    return result;
  }

  @Get('stream')
  @UseGuards(JwtOrAccessTokenGuard)
  @ApiOperation({
    summary: 'SSE stream of new messages (Root). Same as GET /messages/stream.',
  })
  async stream(
    @Res({ passthrough: false }) res: Response,
    @GetUser('id') userId: string | undefined,
    @Query('bucketId') bucketId?: string,
  ): Promise<void> {
    if (!userId) throw new UnauthorizedException();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeEvent = (event: string, data: Record<string, unknown>) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (res as Response & { flush?: () => void }).flush?.();
    };
    writeEvent('open', { event: 'open', time: Math.floor(Date.now() / 1000) });

    const KEEPALIVE_INTERVAL_MS = 25_000;
    const keepaliveId = setInterval(() => {
      if (res.writableEnded) return;
      writeEvent('keepalive', { event: 'keepalive', time: Math.floor(Date.now() / 1000) });
    }, KEEPALIVE_INTERVAL_MS);

    const iterator = this.subscriptionService.messageCreated() as AsyncIterable<{
      userId: string;
      messageCreated?: { bucketId?: string } & Record<string, unknown>;
    }>;
    let closed = false;
    res.on('close', () => {
      closed = true;
      clearInterval(keepaliveId);
    });

    try {
      for await (const payload of iterator) {
        if (closed) break;
        if (payload?.userId !== userId) continue;
        const message = payload.messageCreated;
        if (!message) continue;
        if (bucketId != null && bucketId !== '' && message.bucketId !== bucketId) continue;
        const data = { ...message, event: 'message', time: Math.floor(Date.now() / 1000) };
        writeEvent('message', data as Record<string, unknown>);
      }
    } catch (err) {
      if (!closed) this.logger.warn('SSE message stream error', err);
    } finally {
      clearInterval(keepaliveId);
      res.end();
    }
  }

  @Get('poll')
  @UseGuards(JwtOrAccessTokenGuard)
  @ApiOperation({
    summary: 'Long poll: new message events (Root). Same as GET /messages/poll.',
  })
  async poll(
    @GetUser('id') userId: string | undefined,
    @Query('since') sinceParam?: string,
    @Query('bucketId') bucketId?: string,
  ): Promise<{ events: StreamEventDto[]; nextSince: number }> {
    if (!userId) throw new UnauthorizedException();
    const since = this.parseStreamSince(sinceParam);
    const events = this.streamService.getEvents(userId, bucketId ?? undefined, since);
    if (events.length > 0) {
      const nextSince = Math.max(...events.map((e) => e.at));
      return { events: events.map(streamEventToDto), nextSince };
    }
    const hadNew = await this.streamService.waitForNext(
      userId,
      bucketId ?? undefined,
      POLL_TIMEOUT_MS,
    );
    const nextSince = Date.now();
    const after = hadNew
      ? this.streamService.getEvents(userId, bucketId ?? undefined, since)
      : [];
    return {
      events: after.map(streamEventToDto),
      nextSince:
        after.length > 0 ? Math.max(...after.map((e) => e.at)) : nextSince,
    };
  }

  private parseStreamSince(sinceParam: string | undefined): number {
    if (sinceParam == null || sinceParam === '') return 0;
    const n = Number(sinceParam);
    if (!Number.isFinite(n) || n < 0) return 0;
    const maxAge = Date.now() - POLL_MAX_SINCE_AGE_MS;
    return Math.max(n, maxAge);
  }
}

interface StreamEventDto {
  at: number;
  type: 'message_created' | 'message_deleted';
  message?: Record<string, unknown>;
  messageId?: string;
}

function streamEventToDto(e: StreamEvent): StreamEventDto {
  const dto: StreamEventDto = { at: e.at, type: e.type };
  if (e.message) dto.message = e.message;
  if (e.messageId) dto.messageId = e.messageId;
  return dto;
}
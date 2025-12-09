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
import { AttachmentsDisabledGuard } from '../attachments/attachments-disabled.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequireMessageBucketCreation } from '../auth/decorators/require-scopes.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { MagicCodeGuard } from '../auth/guards/magic-code.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { Message } from '../entities';
import { CreateMessageWithAttachmentDto } from './dto/create-message-with-attachment.dto';
import { CreateMessageDto } from './dto/create-message.dto';

import { CombineMessageSources } from './decorators/combine-message-sources.decorator';
import { MessagesService } from './messages.service';

@UseGuards(MagicCodeGuard)
@Controller('messages')
@ApiTags('Messages')
@ApiBearerAuth()
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @UseGuards(ScopesGuard)
  @RequireMessageBucketCreation('bucketId')
  @ApiOperation({
    summary: 'Create a message and send notifications',
    description:
      'Supports multiple content types and data sources. Data can be combined from body, query parameters, path parameters, and headers (x-message-*). Headers take highest precedence, followed by path params, query params, and body.',
  })
  @ApiConsumes(
    'application/json',
    'application/x-www-form-urlencoded',
    'text/plain',
  )
  @ApiBody({
    description: 'Message data (optional when using other sources)',
    type: CreateMessageDto,
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: 'Notifications created successfully',
    type: Message,
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
    @CombineMessageSources() input: CreateMessageDto,
  ) {
    const result = await this.messagesService.create(input, userId);
    return result;
  }

  @Post('with-attachment')
  @UseGuards(AttachmentsDisabledGuard, ScopesGuard)
  @RequireMessageBucketCreation('bucketId')
  @ApiOperation({
    summary:
      'Create a message with an uploaded attachment and send notifications',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBody({ type: CreateMessageWithAttachmentDto })
  @ApiResponse({
    status: 201,
    description: 'Message created successfully with attachment',
    type: Message,
  })
  @ApiResponse({
    status: 403,
    description: 'Attachments are currently disabled or access token does not have permission',
  })
  async createWithAttachment(
    @GetUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() input: CreateMessageWithAttachmentDto,
  ) {
    const saved = await this.messagesService.createWithAttachment(
      input,
      userId,
      file,
    );
    return saved;
  }

  @Get()
  @UseGuards(AccessTokenGuard, ScopesGuard)
  @RequireMessageBucketCreation('bucketId')
  @ApiOperation({
    summary: 'Send a message via GET request',
    description:
      'Create and send a message using GET parameters. Requires access token authentication (Bearer zat_...).',
  })
  @ApiResponse({
    status: 200,
    description: 'Message sent successfully',
    type: Message,
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
  ) {
    const result = await this.messagesService.create(input, userId);
    return result;
  }

  @Post('transform')
  @UseGuards(ScopesGuard)
  @RequireMessageBucketCreation('bucketId')
  @ApiOperation({
    summary: 'Transform payload using builtin parser and create message',
    description:
      'Transform a payload using a builtin parser (e.g., Authentik) and create a message with the transformed data. Requires bucketId or magicCode query parameter to specify the target bucket. MagicCodeGuard will automatically resolve magicCode to bucketId.',
  })
  @ApiConsumes('application/json')
  @ApiResponse({
    status: 201,
    description: 'Message created successfully from transformed payload',
    type: Message,
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
          `Message created successfully | MessageId: ${result.id} | Parser: ${parserName}`,
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
    summary: 'Create a message using a template',
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
    type: Message,
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

    // Build CreateMessageDto starting with template and bucketId
    // MagicCodeGuard has already resolved magicCode to bucketId if it was provided
    const createMessageDto: Partial<CreateMessageDto> = {
      template,
      bucketId: resolvedBucketId,
      templateData,
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
          if (!createMessageDto.templateData) {
            createMessageDto.templateData = {};
          }
          createMessageDto.templateData[cleanKey] = parseIfJson(headers[key]);
        }
      });
    }

    // Create the message using the standard create method
    // It will automatically apply the template via applyTemplate
    const result = await this.messagesService.create(
      createMessageDto as CreateMessageDto,
      userId,
    );

    this.logger.log(
      `Message created successfully from template | MessageId: ${result.id} | Template: ${template}`,
    );

    return result;
  }
}

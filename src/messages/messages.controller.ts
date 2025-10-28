import {
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
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { Message } from '../entities';
import { CreateMessageWithAttachmentDto } from './dto/create-message-with-attachment.dto';
import { CreateMessageDto } from './dto/create-message.dto';

import { CombineMessageSources } from './decorators/combine-message-sources.decorator';
import { MessagesService } from './messages.service';

@UseGuards(JwtOrAccessTokenGuard)
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
    @GetUser('id') userId: string,
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
  // @ApiBody({ schema: CreateMessageWithAttachmentApiBodySchema as any })
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
      'Transform a payload using a builtin parser (e.g., Authentik) and create a message with the transformed data. Requires bucketId query parameter to specify the target bucket.',
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
      'Invalid payload, missing required parameters (parser, bucketId), or parser not found',
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
    @Body() payload: any,
    @Headers() headers?: Record<string, string>,
    @Req() request?: any,
  ) {
    if (!parserName) {
      throw new Error('Parameter "parser" is required');
    }
    if (!bucketId) {
      throw new Error('Parameter "bucketId" is required');
    }

    const isAccessToken = !!request?.accessTokenScopes;
    const authType = isAccessToken ? 'AccessToken' : 'JWT';
    
    // Extract request info for error logging
    const method = request.method || 'POST';
    const url = request.url || 'UNKNOWN';
    const ip = request.ip || request.headers?.['x-forwarded-for'] || 'UNKNOWN';
    
    try {
      const result = await this.messagesService.transformAndCreate(
        parserName,
        payload,
        userId,
        bucketId,
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
        `Error ${statusCode} | Parser: ${parserName} | BucketId: ${bucketId} | UserId: ${userId} | IP: ${ip} | Method: ${method} | URL: ${url} | Error: ${error.message} | Payload: ${payloadPreview}`,
      );
      
      // Log stack trace for 500 errors
      if (statusCode === 500) {
        this.logger.error(`Stack trace: ${error.stack}`);
      }
      
      // Re-throw to maintain existing behavior
      throw error;
    }
  }
}

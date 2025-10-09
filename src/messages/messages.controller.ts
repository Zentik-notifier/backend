import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
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
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
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
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
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
  async create(
    @GetUser('id') userId: string,
    @CombineMessageSources() input: CreateMessageDto,
  ) {
    const result = await this.messagesService.create(input, userId);
    return result;
  }

  @Post('with-attachment')
  @UseGuards(JwtOrAccessTokenGuard, AttachmentsDisabledGuard)
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
    description: 'Attachments are currently disabled',
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
  @UseGuards(AccessTokenGuard)
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
  @ApiBody({ type: CreateMessageDto })
  async sendMessage(
    @GetUser('id') userId: string,
    @Query() input: CreateMessageDto,
  ) {
    const result = await this.messagesService.create(input, userId);
    return result;
  }

  @Post('transform')
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
    status: 400,
    description:
      'Invalid payload, missing required parameters (parser, bucketId), or parser not found',
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
  ) {
    if (!parserName) {
      throw new Error('Parameter "parser" is required');
    }
    if (!bucketId) {
      throw new Error('Parameter "bucketId" is required');
    }
    // console.log(parserName, JSON.stringify(payload));

    return this.messagesService.transformAndCreate(
      parserName,
      payload,
      userId,
      bucketId,
    );
  }
}

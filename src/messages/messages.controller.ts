import {
  Body,
  Controller,
  Get,
  Logger,
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
import { Throttle } from '@nestjs/throttler';
import { AttachmentsDisabledGuard } from '../attachments/attachments-disabled.guard';
import { ConfigInjectorInterceptor } from '../attachments/interceptors/config-injector.interceptor';
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
  private readonly logger = new Logger(MessagesController.name);

  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @Throttle({
    messagesCreate: {
      limit: () => Number(process.env.RATE_LIMIT_MESSAGES_RPS ?? 10),
      ttl: () => Number(process.env.RATE_LIMIT_MESSAGES_TTL_MS ?? 1000),
    },
  })
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
    // schema: CreateMessageApiBodySchema as any,
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
    this.logger.log(
      `Creating message for user ${userId} with flexible data sources`,
    );
    const result = await this.messagesService.create(input, userId);
    return result;
  }

  @Post('with-attachment')
  @Throttle({
    messagesCreateWithAttachment: {
      limit: () => Number(process.env.RATE_LIMIT_MESSAGES_RPS ?? 10),
      ttl: () => Number(process.env.RATE_LIMIT_MESSAGES_TTL_MS ?? 1000),
    },
  })
  @UseGuards(JwtOrAccessTokenGuard, AttachmentsDisabledGuard)
  @ApiOperation({
    summary:
      'Create a message with an uploaded attachment and send notifications',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'), ConfigInjectorInterceptor)
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
  @Throttle({
    messagesCreate: {
      limit: () => Number(process.env.RATE_LIMIT_MESSAGES_RPS ?? 10),
      ttl: () => Number(process.env.RATE_LIMIT_MESSAGES_TTL_MS ?? 1000),
    },
  })
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
    this.logger.log(`Sending message via GET for user ${userId}`);

    const result = await this.messagesService.create(input, userId);
    return result;
  }
}

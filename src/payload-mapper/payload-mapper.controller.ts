import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PayloadMapperService } from './payload-mapper.service';
import { CreatePayloadMapperDto, UpdatePayloadMapperDto } from './dto';
import { JwtOrAccessTokenGuard } from 'src/auth/guards/jwt-or-access-token.guard';
import { BuiltinParserService } from './builtin';

@ApiTags('Payload Mappers')
@Controller('payload-mappers')
@UseGuards(JwtOrAccessTokenGuard)
export class PayloadMapperController {
  constructor(
    private readonly payloadMapperService: PayloadMapperService,
    private readonly builtinParserService: BuiltinParserService,
  ) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() createPayloadMapperDto: CreatePayloadMapperDto,
  ) {
    return this.payloadMapperService.create(userId, createPayloadMapperDto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.payloadMapperService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.payloadMapperService.findOne(id, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() updatePayloadMapperDto: UpdatePayloadMapperDto,
  ) {
    return this.payloadMapperService.update(id, userId, updatePayloadMapperDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.payloadMapperService.remove(id, userId);
  }
}

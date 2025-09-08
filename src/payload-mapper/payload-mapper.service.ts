import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayloadMapper } from '../entities/payload-mapper.entity';
import { CreatePayloadMapperDto, UpdatePayloadMapperDto, PayloadMapperWithBuiltin } from './dto';
import { BuiltinParserService } from './builtin';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { NotificationDeliveryType } from '../notifications/notifications.types';

@Injectable()
export class PayloadMapperService {
  constructor(
    @InjectRepository(PayloadMapper)
    private readonly payloadMapperRepository: Repository<PayloadMapper>,
    private readonly builtinParserService: BuiltinParserService,
  ) { }

  async create(
    userId: string,
    createPayloadMapperDto: CreatePayloadMapperDto,
  ): Promise<PayloadMapper> {
    const payloadMapper = this.payloadMapperRepository.create({
      ...createPayloadMapperDto,
      userId,
      user: { id: userId },
    });

    const saved = await this.payloadMapperRepository.save(payloadMapper);
    return this.findOne(saved.id, userId);
  }

  async findAll(userId: string): Promise<PayloadMapperWithBuiltin[]> {
    // Get user's payload mappers
    const userPayloadMappers = await this.payloadMapperRepository.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const result: PayloadMapperWithBuiltin[] = [...userPayloadMappers];

    const allBuiltinParsers = this.builtinParserService.getAllParsers();
    allBuiltinParsers.forEach(parser => {
      // Create a virtual entry for the builtin parser
      const virtualBuiltin: PayloadMapperWithBuiltin = {
        id: `builtin-${parser.type.toLowerCase()}`,
        builtInName: parser.type,
        name: parser.name,
        jsEvalFn: '', // Empty for builtin parsers
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      result.push(virtualBuiltin);
    });

    return result;
  }

  async findOne(id: string, userId: string): Promise<PayloadMapper> {
    const payloadMapper = await this.payloadMapperRepository.findOne({
      where: [
        { id, userId },
      ],
      relations: ['user'],
    });

    if (!payloadMapper) {
      throw new NotFoundException('Payload mapper not found');
    }

    return payloadMapper;
  }

  async update(
    id: string,
    userId: string,
    updatePayloadMapperDto: UpdatePayloadMapperDto,
  ): Promise<PayloadMapper> {
    const payloadMapper = await this.findOne(id, userId);

    // Only allow updating user's own mappers, not built-in ones
    if (!payloadMapper.userId || payloadMapper.userId !== userId) {
      throw new ForbiddenException('Cannot update built-in or other user mappers');
    }

    Object.assign(payloadMapper, updatePayloadMapperDto);
    const saved = await this.payloadMapperRepository.save(payloadMapper);
    return this.findOne(saved.id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const payloadMapper = await this.findOne(id, userId);

    // Only allow deleting user's own mappers, not built-in ones
    if (!payloadMapper.userId || payloadMapper.userId !== userId) {
      throw new ForbiddenException('Cannot delete built-in or other user mappers');
    }

    await this.payloadMapperRepository.remove(payloadMapper);
  }

  /**
   * Transform payload using parser (builtin or user-created)
   */
  async transformPayload(parserName: string, payload: any, userId: string, bucketId: string): Promise<CreateMessageDto> {
    // Check if it's a builtin parser
    if (this.builtinParserService.hasParser(parserName)) {
      return this.transformWithBuiltinParser(parserName, payload, bucketId);
    }

    // TODO: Implement user parser lookup by ID or name
    // This should look up a user-created payload mapper with the given ID or name
    // For now, throw an error indicating the parser was not found
    throw new NotFoundException(`Parser '${parserName}' not found. Builtin parsers are available via /messages/parsers endpoint.`);
  }

  /**
   * Transform payload using builtin parser
   */
  private transformWithBuiltinParser(parserName: string, payload: any, bucketId: string): CreateMessageDto {
    // Transform the payload using the builtin parser
    const transformedPayload = this.builtinParserService.transformPayload(parserName, payload);

    // Set the bucketId from the service parameter
    return {
      ...transformedPayload,
      bucketId: bucketId,
    };
  }

}

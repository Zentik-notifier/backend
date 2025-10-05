import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExecutionStatus, ExecutionType } from '../entities';
import { PayloadMapper } from '../entities/payload-mapper.entity';
import { EntityExecutionService } from '../entity-execution/entity-execution.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { BuiltinParserService } from './builtin';
import { CreatePayloadMapperDto, UpdatePayloadMapperDto } from './dto';

@Injectable()
export class PayloadMapperService {
  constructor(
    @InjectRepository(PayloadMapper)
    private readonly payloadMapperRepository: Repository<PayloadMapper>,
    private readonly builtinParserService: BuiltinParserService,
    private readonly entityExecutionService: EntityExecutionService,
  ) {}

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

  async findAll(userId: string): Promise<PayloadMapper[]> {
    // Get user's payload mappers
    const userPayloadMappers = await this.payloadMapperRepository.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const result: PayloadMapper[] = [...userPayloadMappers];

    const allBuiltinParsers = this.builtinParserService.getAllParsers();
    allBuiltinParsers.forEach((parser) => {
      // Create a virtual entry for the builtin parser
      const virtualBuiltin: PayloadMapper = {
        id: `builtin-${parser.type.toLowerCase()}`,
        builtInName: parser.type,
        name: parser.name,
        jsEvalFn: '', // Empty for builtin parsers
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: undefined, // Built-in parsers don't have a user
      };
      result.push(virtualBuiltin);
    });

    return result;
  }

  async findOne(id: string, userId: string): Promise<PayloadMapper> {
    // Check if it's a built-in mapper
    if (id.startsWith('builtin-')) {
      const builtinType = id.replace('builtin-', '').toUpperCase();
      const allBuiltinParsers = this.builtinParserService.getAllParsers();
      const parser = allBuiltinParsers.find(
        (p) => p.type.toString() === builtinType,
      );

      if (parser) {
        return {
          id,
          builtInName: parser.type,
          name: parser.name,
          jsEvalFn: '', // Empty for builtin parsers
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: undefined, // Built-in parsers don't have a user
        } as PayloadMapper;
      }
    }

    const payloadMapper = await this.payloadMapperRepository.findOne({
      where: [
        { id, userId },
        { name: id, userId },
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
      throw new ForbiddenException(
        'Cannot update built-in or other user mappers',
      );
    }

    Object.assign(payloadMapper, updatePayloadMapperDto);
    const saved = await this.payloadMapperRepository.save(payloadMapper);
    return this.findOne(saved.id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const payloadMapper = await this.findOne(id, userId);

    // Only allow deleting user's own mappers, not built-in ones
    if (!payloadMapper.userId || payloadMapper.userId !== userId) {
      throw new ForbiddenException(
        'Cannot delete built-in or other user mappers',
      );
    }

    await this.payloadMapperRepository.remove(payloadMapper);
  }

  /**
   * Transform payload using parser (builtin or user-created)
   */
  async transformPayload(
    parserName: string,
    payload: any,
    userId: string,
    bucketId: string,
  ): Promise<CreateMessageDto> {
    let result: CreateMessageDto | undefined;

    try {
      // Check if it's a builtin parser
      if (this.builtinParserService.hasParser(parserName)) {
        result = await this.transformWithBuiltinParser(
          parserName,
          payload,
          bucketId,
          userId,
        );
      } else {
        // Look up user-created payload mapper by name or ID
        const payloadMapper = await this.findUserPayloadMapperByNameOrId(
          parserName,
          userId,
        );
        if (!payloadMapper) {
          throw new NotFoundException(`User parser '${parserName}' not found`);
        }

        result = await this.transformWithUserParser(
          payloadMapper,
          payload,
          bucketId,
          userId,
        );
      }
    } catch (error: any) {
      throw error; // Re-throw to maintain existing behavior
    }

    return result;
  }

  /**
   * Find user payload mapper by name or ID
   */
  private async findUserPayloadMapperByNameOrId(
    nameOrId: string,
    userId: string,
  ): Promise<PayloadMapper | null> {
    // First try to find by ID
    try {
      return await this.findOne(nameOrId, userId);
    } catch (error) {
      // If not found by ID, try to find by name
      const payloadMappers = await this.payloadMapperRepository.find({
        where: { userId, name: nameOrId },
        relations: ['user'],
      });

      return payloadMappers.length > 0 ? payloadMappers[0] : null;
    }
  }

  /**
   * Transform payload using user-created parser
   */
  private async transformWithUserParser(
    payloadMapper: PayloadMapper,
    payload: any,
    bucketId: string,
    userId: string,
  ): Promise<CreateMessageDto> {
    const startTime = Date.now();
    let executionStatus: ExecutionStatus = ExecutionStatus.SUCCESS;
    let executionErrors: string | undefined;
    let result: CreateMessageDto | undefined;

    try {
      // Create a function from the stored JavaScript code
      const userFunction = eval(payloadMapper.jsEvalFn);

      // Execute the user function with the payload
      const transformedPayload = userFunction(payload);

      // Ensure the result is a valid CreateMessageDto structure
      if (!transformedPayload || typeof transformedPayload !== 'object') {
        throw new Error('User parser must return an object');
      }

      // Set the bucketId from the service parameter
      result = {
        ...transformedPayload,
        bucketId: bucketId,
      };
    } catch (error: any) {
      executionStatus = ExecutionStatus.ERROR;
      executionErrors = error.message;
      throw new Error(
        `Error executing user parser '${payloadMapper.name}': ${error.message}`,
      );
    }

    // Track the execution
    try {
      await this.entityExecutionService.create({
        type: ExecutionType.PAYLOAD_MAPPER,
        status: executionStatus,
        entityName: payloadMapper.name,
        entityId: payloadMapper.id,
        userId,
        input: JSON.stringify({
          parserName: payloadMapper.name,
          parserId: payloadMapper.id,
          payload,
          bucketId,
        }),
        output: result ? JSON.stringify(result) : undefined,
        errors: executionErrors,
        durationMs: Date.now() - startTime,
      });
    } catch (trackingError) {
      // Log but don't throw - tracking shouldn't break the main flow
      console.error('Failed to track payload mapper execution:', trackingError);
    }

    return result!;
  }

  /**
   * Transform payload using builtin parser
   */
  private async transformWithBuiltinParser(
    parserName: string,
    payload: any,
    bucketId: string,
    userId: string,
  ): Promise<CreateMessageDto> {
    const startTime = Date.now();
    let executionStatus: ExecutionStatus = ExecutionStatus.SUCCESS;
    let executionErrors: string | undefined;
    let result: CreateMessageDto | undefined;

    try {
      // Transform the payload using the builtin parser
      const transformedPayload = this.builtinParserService.transformPayload(
        parserName,
        payload,
      );

      // Set the bucketId from the service parameter
      result = {
        ...transformedPayload,
        bucketId: bucketId,
      };
    } catch (error: any) {
      executionStatus = ExecutionStatus.ERROR;
      executionErrors = error.message;
      throw error; // Re-throw to maintain existing behavior
    }

    // Track the execution
    try {
      await this.entityExecutionService.create({
        type: ExecutionType.PAYLOAD_MAPPER,
        status: executionStatus,
        entityName: parserName,
        userId,
        input: JSON.stringify({
          parserName,
          parserType: 'builtin',
          payload,
          bucketId,
        }),
        output: result ? JSON.stringify(result) : undefined,
        errors: executionErrors,
        durationMs: Date.now() - startTime,
      });
    } catch (trackingError) {
      // Log but don't throw - tracking shouldn't break the main flow
      console.error(
        'Failed to track builtin payload mapper execution:',
        trackingError,
      );
    }

    return result;
  }
}
